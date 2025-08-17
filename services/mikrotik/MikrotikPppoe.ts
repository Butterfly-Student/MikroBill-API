import { db } from "@/lib/db";
import { MikrotikClient } from "@/lib/mikrotik/client";
import { IRosOptions } from "routeros-api";
import Redis, { RedisOptions } from "ioredis";
import { Queue, Worker, Job } from "bullmq";

interface PPPEvent {
	type: 'connect' | 'disconnect' | 'sync' | 'secret_update';
	username?: string;
	routerId: number;
	data?: any;
	timestamp: number;
}

interface PPPUserData {
	username: string;
	secret: any;
	isActive: boolean;
	lastSeen: number;
	routerId: number;
}

export class MikrotikPppoe extends MikrotikClient {
	private redis!: Redis;
	private eventQueue!: Queue;
	private worker: Worker | null = null;
	private routerId: number;
	private isListening = false;
	private activeListener: any = null;
	
	// Redis Keys
	private readonly KEYS = {
		secrets: (routerId: number) => `ppp:secrets:${routerId}`,
		active: (routerId: number) => `ppp:active:${routerId}`,
		user: (routerId: number, username: string) => `ppp:user:${routerId}:${username}`,
		stats: (routerId: number) => `ppp:stats:${routerId}`,
		lastSync: (routerId: number) => `ppp:sync:${routerId}`,
		events: (routerId: number) => `ppp:events:${routerId}`,
	};

	constructor(config: IRosOptions, routerId: number) {
		super(config);
		this.routerId = routerId;
		this.setupRedis();
	}

	private setupRedis(): void {
		// Redis connection configuration untuk BullMQ
		const redisConfig: RedisOptions = {
			host: "127.0.0.1",
			port: 6379,
			password: "r00t",
			maxRetriesPerRequest: null, // Required for BullMQ blocking operations
			enableReadyCheck: false,
		};

		// Create Redis instance untuk general operations
		this.redis = new Redis(redisConfig);

		// Setup event queue dengan proper Redis connection
		this.eventQueue = new Queue('ppp-events', {
			connection: redisConfig, // Use config object instead of Redis instance
			defaultJobOptions: {
				removeOnComplete: 100, // Keep last 100 completed jobs
				removeOnFail: 50,      // Keep last 50 failed jobs
				attempts: 3,
				backoff: {
					type: 'exponential',
					delay: 1000,
				},
			},
		});

		// Setup worker untuk process events
		this.setupWorker(redisConfig);

		this.redis.on('error', (error) => {
			console.error(`Redis connection error for router ${this.routerId}:`, error);
		});

		this.redis.on('connect', () => {
			console.log(`✅ Redis connected for router ${this.routerId}`);
		});
	}

	private setupWorker(redisConfig: RedisOptions): void {
		this.worker = new Worker('ppp-events', async (job: Job<PPPEvent>) => {
			return this.processEvent(job.data);
		}, {
			connection: redisConfig, // Use same config as queue
			concurrency: 10, // Process up to 10 events simultaneously
		});

		this.worker.on('completed', (job) => {
			console.log(`✅ Event processed: ${job.data.type} for router ${this.routerId}`);
		});

		this.worker.on('failed', (job, error) => {
			console.error(`❌ Event failed: ${job?.data.type} for router ${this.routerId}:`, error);
		});

		this.worker.on('error', (error) => {
			console.error(`❌ Worker error for router ${this.routerId}:`, error);
		});
	}

	static async createFromDatabase(
		routerId: number,
		overrideConfig?: Partial<IRosOptions>
	): Promise<MikrotikPppoe> {
		try {
			if (!routerId || routerId <= 0) {
				throw new Error("Invalid router ID provided");
			}

			// Cek cache terlebih dahulu
			const cachedClient = MikrotikClient.getCachedClient(routerId);
			if (cachedClient && cachedClient instanceof MikrotikPppoe) {
				console.log(`♻️ Using cached MikrotikPppoe client for router ${routerId}`);
				return cachedClient;
			}

			if (cachedClient) {
				await MikrotikClient.disconnectCachedClient(routerId);
			}

			// Get router dari database
			const router = await db.query.routers.findFirst({
				where: (r, { eq }) => eq(r.id, routerId),
			});

			if (!router) {
				throw new Error(`Router with ID ${routerId} not found`);
			}

			if (!router.is_active) {
				throw new Error(`Router ${router.name} is not active`);
			}

			const clientConfig: IRosOptions = {
				host: overrideConfig?.host || router.hostname,
				user: overrideConfig?.user || router.username,
				password: overrideConfig?.password || router.password,
				port: overrideConfig?.port || router.port || 8728,
				timeout: overrideConfig?.timeout || router.timeout || 30000,
				keepalive: overrideConfig?.keepalive ?? true,
			};

			if (!clientConfig.host || !clientConfig.user || !clientConfig.password) {
				throw new Error("Missing required router configuration (host, user, password)");
			}

			console.log(`🔌 Creating MikroTik PPPoE client for router: ${router.name} (${router.hostname})`);

			// Create instance dengan routerId
			const pppoeClient = new MikrotikPppoe(clientConfig, routerId);
			await pppoeClient.connectWithTimeout(clientConfig.timeout || 30000);

			// Cache client
			const clientCache = (MikrotikClient as any).clientCache;
			if (clientCache && clientCache instanceof Map) {
				clientCache.set(routerId, {
					client: pppoeClient,
					lastUsed: new Date(),
					isConnected: true,
				});
			}

			console.log(`✅ MikrotikPppoe client cached for router ${routerId}`);
			return pppoeClient;

		} catch (error) {
			console.error(`❌ Failed to create MikroTik PPPoE client for router ${routerId}:`, error);
			await MikrotikClient.disconnectCachedClient(routerId);
			throw error;
		}
	}

	override async connectWithTimeout(timeout: number): Promise<void> {
		const connectPromise = this.connect();
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error(`Connection timeout after ${timeout}ms`)), timeout);
		});

		await Promise.race([connectPromise, timeoutPromise]);
	}

	/**
	 * Initialize PPP monitoring dengan Redis backend
	 */
	async initActiveUsers(): Promise<void> {
		try {
			console.log(`🚀 Initializing Redis-backed PPP monitoring for router ${this.routerId}...`);
			
			// Connect Redis jika belum
			if (this.redis.status !== 'ready') {
				await this.redis.connect();
			}

			// Perform initial sync
			await this.performFullSync();
			
			// Start real-time monitoring
			await this.startRealTimeMonitoring();
			
			// Setup periodic sync
			this.setupPeriodicSync();
			
			const stats = await this.getStats();
			console.log(`✅ PPP monitoring initialized: ${stats.totalSecrets} secrets, ${stats.activeUsers} active users`);
			
		} catch (error) {
			console.error("Failed to initialize PPP monitoring:", error);
			throw error;
		}
	}

	/**
	 * Perform full sync dan simpan ke Redis
	 */
	private async performFullSync(): Promise<void> {
		const start = Date.now();
		
		try {
			if (!this.connectedApi) {
				throw new Error("API connection not available");
			}

			console.log(`🔄 Performing full sync for router ${this.routerId}...`);

			// Parallel fetch
			const [secrets, activeUsers] = await Promise.all([
				this.connectedApi.menu("/ppp/secret").getAll(),
				this.connectedApi.menu("/ppp/active").getAll(),
			]);

			// Use Redis pipeline untuk bulk operations
			const pipeline = this.redis.pipeline();
			
			// Clear existing data
			pipeline.del(this.KEYS.secrets(this.routerId));
			pipeline.del(this.KEYS.active(this.routerId));

			// Store secrets
			const secretsData: Record<string, any> = {};
			(secrets || []).forEach((secret: any) => {
				if (secret.name) {
					const username = secret.name.toLowerCase();
					secretsData[username] = JSON.stringify(secret);
				}
			});
			
			if (Object.keys(secretsData).length > 0) {
				pipeline.hmset(this.KEYS.secrets(this.routerId), secretsData);
			}

			// Store active users dengan scores (timestamp)
			const timestamp = Date.now();
			(activeUsers || []).forEach((user: any) => {
				const username = (user.name || user.user || "").toLowerCase().trim();
				if (username) {
					pipeline.zadd(this.KEYS.active(this.routerId), timestamp, username);
				}
			});

			// Update stats
			const stats = {
				totalSecrets: Object.keys(secretsData).length,
				activeUsers: activeUsers?.length || 0,
				lastSync: timestamp,
				routerId: this.routerId,
			};
			pipeline.hmset(this.KEYS.stats(this.routerId), stats);
			pipeline.set(this.KEYS.lastSync(this.routerId), timestamp);

			// Execute pipeline
			await pipeline.exec();

			console.log(`✅ Full sync completed for router ${this.routerId} in ${Date.now() - start}ms`);
			
			// Queue sync event
			await this.eventQueue.add('sync', {
				type: 'sync',
				routerId: this.routerId,
				timestamp,
			});
			
		} catch (error) {
			console.error(`Full sync failed for router ${this.routerId}:`, error);
			throw error;
		}
	}

	/**
	 * Start real-time monitoring dengan RouterOS streams
	 */
	private async startRealTimeMonitoring(): Promise<void> {
		try {
			if (!this.connectedApi) {
				throw new Error("API connection not available");
			}

			const activeMenu = this.connectedApi.menu("/ppp/active");
			console.log(`🎧 Starting real-time monitoring for router ${this.routerId}...`);

			this.activeListener = activeMenu.stream("listen", async (err: any, data: any) => {
				if (err) {
					console.error(`PPP stream error for router ${this.routerId}:`, err);
					await this.handleStreamError();
					return;
				}

				if (data) {
					await this.queueStreamEvent(data);
				}
			});

			this.isListening = true;
			
		} catch (error) {
			console.error(`Failed to start real-time monitoring for router ${this.routerId}:`, error);
			throw error;
		}
	}

	/**
	 * Queue stream events untuk processing
	 */
	private async queueStreamEvent(data: any): Promise<void> {
		try {
			const events: PPPEvent[] = [];
			const dataArray = Array.isArray(data) ? data : [data];

			dataArray.forEach((item: any) => {
				const username = (item.name || item.user || "").toLowerCase().trim();
				if (!username) return;

				// Queue event berdasarkan data yang diterima
				events.push({
					type: 'connect', // Will be refined dalam processEvent
					username,
					routerId: this.routerId,
					data: item,
					timestamp: Date.now(),
				});
			});

			// Add events ke queue
			for (const event of events) {
				await this.eventQueue.add('stream-event', event, {
					delay: Math.random() * 1000, // Random delay 0-1s untuk load balancing
				});
			}
			
		} catch (error) {
			console.error(`Error queuing stream event for router ${this.routerId}:`, error);
		}
	}

	/**
	 * Process individual events dari queue
	 */
	private async processEvent(event: PPPEvent): Promise<void> {
		try {
			switch (event.type) {
				case 'sync':
					// Already handled in performFullSync
					break;
					
				case 'connect':
				case 'disconnect':
				case 'secret_update':
					await this.processUserEvent(event);
					break;
					
				default:
					console.warn(`Unknown event type: ${event.type}`);
			}
		} catch (error) {
			console.error(`Error processing event for router ${this.routerId}:`, error);
			throw error;
		}
	}

	/**
	 * Process user-specific events
	 */
	private async processUserEvent(event: PPPEvent): Promise<void> {
		if (!event.username) return;

		// Verify current state dengan fresh data dari RouterOS
		const currentActive = await this.connectedApi!.menu("/ppp/active").getAll();
		const activeUsernames = new Set(
			(currentActive || [])
				.map((u: any) => (u.name || u.user || "").toLowerCase().trim())
				.filter(Boolean)
		);

		// Update Redis dengan current state
		const pipeline = this.redis.pipeline();
		const timestamp = Date.now();

		// Update active users set
		pipeline.del(this.KEYS.active(this.routerId));
		if (activeUsernames.size > 0) {
			const activeArray: (string | number)[] = [];
			activeUsernames.forEach(username => {
				activeArray.push(timestamp, username as string);
			});
			pipeline.zadd(this.KEYS.active(this.routerId), ...activeArray);
		}

		// Update individual user data jika ada
		if (event.username && event.data) {
			const userData: PPPUserData = {
				username: event.username,
				secret: event.data,
				isActive: activeUsernames.has(event.username),
				lastSeen: timestamp,
				routerId: this.routerId,
			};
			pipeline.set(this.KEYS.user(this.routerId, event.username), JSON.stringify(userData));
		}

		// Update stats
		const totalSecrets = await this.redis.hlen(this.KEYS.secrets(this.routerId));
		const stats = {
			totalSecrets,
			activeUsers: activeUsernames.size,
			lastUpdate: timestamp,
			routerId: this.routerId,
		};
		pipeline.hmset(this.KEYS.stats(this.routerId), stats);

		await pipeline.exec();
	}

	/**
	 * Handle stream errors dengan exponential backoff
	 */
	private async handleStreamError(): Promise<void> {
		this.isListening = false;
		
		const backoffDelay = Math.min(5000 * Math.pow(2, Math.random()), 60000);
		console.log(`🔄 Reconnecting stream for router ${this.routerId} in ${backoffDelay}ms...`);
		
		setTimeout(async () => {
			try {
				if (this.connectedApi && !this.isListening) {
					await this.startRealTimeMonitoring();
				}
			} catch (error) {
				console.error(`Stream reconnection failed for router ${this.routerId}:`, error);
				await this.handleStreamError();
			}
		}, backoffDelay);
	}

	/**
	 * Setup periodic sync untuk consistency
	 */
	private setupPeriodicSync(): void {
		setInterval(async () => {
			try {
				const lastSync = await this.redis.get(this.KEYS.lastSync(this.routerId));
				const now = Date.now();
				
				// Full sync setiap 5 menit
				if (!lastSync || (now - parseInt(lastSync)) > 300000) {
					console.log(`⏰ Periodic sync triggered for router ${this.routerId}`);
					await this.performFullSync();
				}
			} catch (error) {
				console.error(`Periodic sync error for router ${this.routerId}:`, error);
			}
		}, 60000); // Check every minute
	}

	/**
	 * Search inactive users dengan Redis SCAN untuk performance
	 */
	async searchInactive(search?: string, limit: number = 100): Promise<any[]> {
		try {
			const pipeline = this.redis.pipeline();
			
			// Get all secrets
			pipeline.hgetall(this.KEYS.secrets(this.routerId));
			// Get active users
			pipeline.zrange(this.KEYS.active(this.routerId), 0, -1);
			
			const results = await pipeline.exec();
			const secrets = results?.[0]?.[1] as Record<string, string> || {};
			const activeUsers = new Set(results?.[1]?.[1] as string[] || []);
			
			const term = search ? search.toLowerCase() : "";
			const inactiveUsers: any[] = [];
			
			for (const [username, secretJson] of Object.entries(secrets)) {
				if (inactiveUsers.length >= limit) break;
				
				if (activeUsers.has(username)) continue;
				
				if (term && !username.includes(term)) continue;
				
				try {
					const secret = JSON.parse(secretJson);
					if (String(secret.disabled).toLowerCase() === "true") continue;
					
					inactiveUsers.push({
						...secret,
						isActive: false,
						username,
					});
				} catch (parseError) {
					console.warn(`Failed to parse secret for ${username}:`, parseError);
				}
			}
			
			return inactiveUsers;
			
		} catch (error) {
			console.error(`Search inactive error for router ${this.routerId}:`, error);
			return [];
		}
	}

	/**
	 * Search active users
	 */
	async searchActive(search?: string, limit: number = 100): Promise<any[]> {
		try {
			const activeUsers = await this.redis.zrange(this.KEYS.active(this.routerId), 0, -1);
			const term = search ? search.toLowerCase() : "";
			const results: any[] = [];
			
			for (const username of activeUsers) {
				if (results.length >= limit) break;
				
				if (term && !username.includes(term)) continue;
				
				const secretJson = await this.redis.hget(this.KEYS.secrets(this.routerId), username);
				if (secretJson) {
					try {
						const secret = JSON.parse(secretJson);
						if (String(secret.disabled).toLowerCase() !== "true") {
							results.push({
								...secret,
								isActive: true,
								username,
							});
						}
					} catch (parseError) {
						console.warn(`Failed to parse secret for ${username}:`, parseError);
					}
				}
			}
			
			return results;
			
		} catch (error) {
			console.error(`Search active error for router ${this.routerId}:`, error);
			return [];
		}
	}

	/**
	 * Get real-time stats dari Redis
	 */
	async getStats(): Promise<{
		totalSecrets: number;
		activeUsers: number;
		inactiveUsers: number;
		lastSync: Date;
		queueWaiting: number;
		queueCompleted: number;
		queueFailed: number;
		isListening: boolean;
		routerId: number;
	}> {
		try {
			const [stats, queueStats] = await Promise.all([
				this.redis.hmget(
					this.KEYS.stats(this.routerId),
					'totalSecrets',
					'activeUsers',
					'lastSync'
				),
				this.eventQueue.getWaiting(),
			]);

			const totalSecrets = parseInt(stats[0] || '0');
			const activeUsers = parseInt(stats[1] || '0');
			const lastSync = parseInt(stats[2] || '0');

			const [completed, failed] = await Promise.all([
				this.eventQueue.getCompleted(),
				this.eventQueue.getFailed(),
			]);

			return {
				totalSecrets,
				activeUsers,
				inactiveUsers: totalSecrets - activeUsers,
				lastSync: new Date(lastSync),
				queueWaiting: queueStats.length,
				queueCompleted: completed.length,
				queueFailed: failed.length,
				isListening: this.isListening,
				routerId: this.routerId,
			};
		} catch (error) {
			console.error(`Get stats error for router ${this.routerId}:`, error);
			return {
				totalSecrets: 0,
				activeUsers: 0,
				inactiveUsers: 0,
				lastSync: new Date(0),
				queueWaiting: 0,
				queueCompleted: 0,
				queueFailed: 0,
				isListening: this.isListening,
				routerId: this.routerId,
			};
		}
	}

	/**
	 * Check if user is active (Redis lookup)
	 */
	async isUserActive(username: string): Promise<boolean> {
		try {
			const score = await this.redis.zscore(this.KEYS.active(this.routerId), username.toLowerCase());
			return score !== null;
		} catch (error) {
			console.error(`Check active error for ${username}:`, error);
			return false;
		}
	}

	/**
	 * Get user details dari Redis
	 */
	async getUserDetails(username: string): Promise<any | null> {
		try {
			const [secretJson, isActive] = await Promise.all([
				this.redis.hget(this.KEYS.secrets(this.routerId), username.toLowerCase()),
				this.isUserActive(username)
			]);

			if (!secretJson) return null;

			const secret = JSON.parse(secretJson);
			return {
				...secret,
				isActive,
				isDisabled: String(secret.disabled).toLowerCase() === "true",
				username: username.toLowerCase(),
			};
		} catch (error) {
			console.error(`Get user details error for ${username}:`, error);
			return null;
		}
	}

	/**
	 * Force refresh secrets cache
	 */
	async refreshSecretsCache(): Promise<void> {
		await this.performFullSync();
	}

	/**
	 * Clean shutdown dengan Redis cleanup
	 */
	override async disconnect(): Promise<void> {
		console.log(`🔌 Disconnecting PPPoE client for router ${this.routerId}...`);
		
		this.isListening = false;

		// Stop worker
		if (this.worker) {
			await this.worker.close();
			this.worker = null;
		}

		// Close queue
		if (this.eventQueue) {
			await this.eventQueue.close();
		}

		// Cleanup Redis connection
		if (this.redis) {
			await this.redis.disconnect();
		}

		await super.disconnect();
	}
}

export const createMikrotikPppoe = MikrotikPppoe.createFromDatabase;