
import { db } from "@/lib/db/index";
import { IRosOptions, RouterOSAPI, RouterOSClient } from "routeros-client";


export interface StreamData {
	type:
		| "ip-address"
		| "dhcp-lease"
		| "torch"
		| "interface-traffic"
		| "write-data"
		| "write-stream"
		| "stream-data";
	interfaceName?: string;
	data: any;
	timestamp: Date;
}

interface CachedClient {
	client: MikrotikClient;
	lastUsed: Date;
	isConnected: boolean;
}

export class MikrotikClient {
	private client: RouterOSClient;
	protected connectedApi?: Awaited<ReturnType<RouterOSClient["connect"]>>;
	private isConnected = false;
	private activeStreams: Map<string, any> = new Map();

	// RouterOSAPI untuk tugas-tugas tertentu
	private routerosApi: RouterOSAPI;
	private isRouterosApiConnected = false;

	// Static properties untuk client management
	private static clientCache = new Map<number, CachedClient>();
	private static cleanupInterval: NodeJS.Timeout;
	private static readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
	private static readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
	private static isCleanupInitialized = false;

	constructor(private config: IRosOptions) {
		this.client = new RouterOSClient({
			host: config.host,
			user: config.user,
			password: config.password,
			port: config.port || 8728,
			keepalive: config.keepalive ?? true,
			timeout: 10000,
		});

		// Initialize RouterOSAPI dengan konfigurasi yang sama
		this.routerosApi = new RouterOSAPI({
			host: config.host,
			user: config.user,
			password: config.password,
			port: config.port || 8728,
			keepalive: config.keepalive ?? true,
			timeout: 10000,
		});

		// Initialize cleanup interval once
		if (!MikrotikClient.isCleanupInitialized) {
			MikrotikClient.setupCleanupInterval();
			MikrotikClient.isCleanupInitialized = true;
		}
	}

	/**
	 * Static method to create or get cached MikroTik client from database
	 */
	static async createFromDatabase<T extends typeof MikrotikClient>(
		this: T,
		routerId: number,
		overrideConfig?: Partial<IRosOptions>
	): Promise<InstanceType<T>> {
		try {
			if (!routerId || routerId <= 0) {
				throw new Error("Invalid router ID provided");
			}

			const cachedClient = this.clientCache.get(routerId);
			console.log("Cached Client:", cachedClient);

			if (cachedClient && cachedClient.isConnected) {
				cachedClient.lastUsed = new Date();
				return cachedClient.client as InstanceType<T>;
			}

			if (cachedClient) {
				await this.disconnectCachedClient(routerId);
			}

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
				throw new Error(
					"Missing required router configuration (host, user, password)"
				);
			}

			console.log(
				`Creating MikroTik client for router: ${router.name} (${router.hostname})`
			);

			const client = new this(clientConfig) as InstanceType<T>;

			await client.connectWithTimeout(clientConfig.timeout || 30000);

			this.clientCache.set(routerId, {
				client,
				lastUsed: new Date(),
				isConnected: true,
			});

			return client;
		} catch (error) {
			console.error(
				`Failed to create MikroTik client for router ${routerId}:`,
				error
			);
			this.clientCache.delete(routerId);
			throw error;
		}
	}

	/**
	 * Static method to create client with custom config (without database lookup)
	 */
	static async createDirect(config: IRosOptions): Promise<MikrotikClient> {
		// Validate required config
		if (!config.host || !config.user || !config.password) {
			throw new Error("Missing required configuration (host, user, password)");
		}

		const clientConfig: IRosOptions = {
			...config,
			port: config.port || 8728,
			timeout: config.timeout || 30000,
			keepalive: config.keepalive ?? true,
		};

		console.log(`Creating direct MikroTik client for: ${config.host}`);

		const client = new MikrotikClient(clientConfig);
		await client.connectWithTimeout(clientConfig.timeout || 30000);

		return client;
	}

	/**
	 * Static method to get cached client without creating new one
	 */
	static getCachedClient(routerId: number): MikrotikClient | null {
		const cachedClient = MikrotikClient.clientCache.get(routerId);
		if (cachedClient && cachedClient.isConnected) {
			cachedClient.lastUsed = new Date();
			return cachedClient.client;
		}
		return null;
	}

	/**
	 * Static method to disconnect and remove client from cache
	 */
	static async disconnectCachedClient(routerId: number): Promise<void> {
		const cachedClient = MikrotikClient.clientCache.get(routerId);
		if (cachedClient) {
			try {
				if (cachedClient.isConnected) {
					await cachedClient.client.disconnect();
				}
			} catch (error) {
				console.error(
					`Error disconnecting client for router ${routerId}:`,
					error
				);
			} finally {
				cachedClient.isConnected = false;
				MikrotikClient.clientCache.delete(routerId);
			}
		}
	}

	/**
	 * Static method to check if client is connected
	 */
	static isClientConnected(routerId: number): boolean {
		const cachedClient = MikrotikClient.clientCache.get(routerId);
		return cachedClient?.isConnected ?? false;
	}

	/**
	 * Static method to get connection stats
	 */
	static getConnectionStats() {
		const stats = {
			totalConnections: MikrotikClient.clientCache.size,
			activeConnections: 0,
			connections: [] as Array<{
				routerId: number;
				lastUsed: Date;
				isConnected: boolean;
			}>,
		};

		MikrotikClient.clientCache.forEach((cachedClient, routerId) => {
			if (cachedClient.isConnected) {
				stats.activeConnections++;
			}
			stats.connections.push({
				routerId,
				lastUsed: cachedClient.lastUsed,
				isConnected: cachedClient.isConnected,
			});
		});

		return stats;
	}

	/**
	 * Static method to reconnect a client (useful for connection recovery)
	 */
	static async reconnectClient(routerId: number): Promise<MikrotikClient> {
		await MikrotikClient.disconnectCachedClient(routerId);
		return MikrotikClient.createFromDatabase(routerId);
	}

	/**
	 * Static method to cleanup all connections
	 */
	static async cleanup(): Promise<void> {
		if (MikrotikClient.cleanupInterval) {
			clearInterval(MikrotikClient.cleanupInterval);
		}

		const disconnectPromises = Array.from(
			MikrotikClient.clientCache.keys()
		).map((routerId) => MikrotikClient.disconnectCachedClient(routerId));

		await Promise.allSettled(disconnectPromises);
		MikrotikClient.clientCache.clear();
	}

	/**
	 * Setup periodic cleanup
	 */
	private static setupCleanupInterval(): void {
		MikrotikClient.cleanupInterval = setInterval(() => {
			MikrotikClient.cleanupStaleConnections();
		}, MikrotikClient.CLEANUP_INTERVAL);
	}

	/**
	 * Clean up stale connections
	 */
	private static async cleanupStaleConnections(): Promise<void> {
		const now = new Date();
		const staleRouterIds: number[] = [];

		MikrotikClient.clientCache.forEach((cachedClient, routerId) => {
			const timeSinceLastUse = now.getTime() - cachedClient.lastUsed.getTime();
			if (timeSinceLastUse > MikrotikClient.CACHE_TTL) {
				staleRouterIds.push(routerId);
			}
		});

		if (staleRouterIds.length > 0) {
			console.log(
				`Cleaning up ${staleRouterIds.length} stale MikroTik connections`
			);

			await Promise.allSettled(
				staleRouterIds.map((routerId) =>
					MikrotikClient.disconnectCachedClient(routerId)
				)
			);
		}
	}

	// Instance methods
	async connect(): Promise<void> {
		if (!this.isConnected) {
			this.connectedApi = await this.client.connect();
			this.isConnected = true;
		}
	}

	/**
	 * Connect client with timeout
	 */
	private async connectWithTimeout(timeout: number): Promise<void> {
		const connectPromise = this.connect();
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(
				() => reject(new Error(`Connection timeout after ${timeout}ms`)),
				timeout
			);
		});

		await Promise.race([connectPromise, timeoutPromise]);
	}

	// Method untuk menghubungkan RouterOSAPI untuk tugas tertentu
	private async connectRouterosApi(): Promise<void> {
		if (!this.isRouterosApiConnected) {
			await this.routerosApi.connect();
			this.isRouterosApiConnected = true;
		}
	}

	async disconnect(): Promise<void> {
		if (this.isConnected) {
			// Stop all active streams
			for (const [streamId, stream] of this.activeStreams) {
				try {
					stream.stop();
				} catch (error) {
					console.error(`Error stopping stream ${streamId}:`, error);
				}
			}
			this.activeStreams.clear();

			await this.client.close();
			this.isConnected = false;
		}
		// Disconnect RouterOSAPI jika masih terhubung
		if (this.isRouterosApiConnected) {
			await this.routerosApi.close();
			this.isRouterosApiConnected = false;
		}
	}

	async getSystemInfo(): Promise<any> {
		await this.connect();
		return this.connectedApi!.menu("/system/resource").getOnly();
	}

	async getIdentity(): Promise<any> {
		await this.connect();
		return this.connectedApi!.menu("/system/identity").getOnly();
	}

	async getResources(): Promise<any> {
		await this.connect();
		return this.connectedApi!.menu("/system/resource").getOnly();
	}

	async getInterfaces(): Promise<any[]> {
		await this.connect();
		return this.connectedApi!.menu("/interface").get();
	}

	async getPPPoEProfiles(): Promise<any[]> {
		await this.connect();
		return this.connectedApi!.menu("/ppp/profile").get();
	}

	/**
	 * Get PPPoE secrets from MikroTik
	 */
	async getPPPoESecrets(): Promise<any[]> {
		await this.connect();
		return this.connectedApi!.menu("/ppp/secret").get();
	}

	/**
	 * Get Hotspot profiles from MikroTik
	 */
	async getHotspotProfiles(): Promise<any[]> {
		await this.connect();
		return this.connectedApi!.menu("/ip/hotspot/user/profile").get();
	}

	// Method untuk menggunakan RouterOSAPI untuk tugas-tugas tertentu
	async execRouterosApi(
		callback: (data: any) => void,
		errCallback: (error: any) => void,
		params: string | string[],
		...moreParams: Array<string | string[]>
	): Promise<any> {
		await this.connectRouterosApi();

		const streamId = `write-data-${Date.now().toString()}`;

		const stream = this.routerosApi.write(params, ...moreParams);
		stream
			.then((packet: any) => {
				const streamData: StreamData = {
					type: "write-data",
					data: packet,
					timestamp: new Date(),
				};
				callback(streamData);
			})
			.catch((err: any) => {
				if (err) {
					console.error("RouterOSAPI stream error:", err);
					errCallback(err);
					return;
				}
			});
		this.activeStreams.set(streamId, stream);
		return streamId;
	}

	// Method untuk menggunakan RouterOSAPI untuk tugas-tugas tertentu
	async execRouterosApiWithStream(
		callback: (data: any) => void,
		errCallback: (error: any) => void,
		params: string | string[],
		...moreParams: Array<string | string[]>
	): Promise<any> {
		await this.connectRouterosApi();

		const streamId = `write-stream-${Date.now().toString()}`;

		const stream = this.routerosApi.writeStream(params, ...moreParams);
		stream.data((err: any, packet: any) => {
			if (err) {
				console.error("RouterOSAPI stream error:", err);
				errCallback(err);
				return;
			}
			const streamData: StreamData = {
				type: "write-stream",
				data: packet,
				timestamp: new Date(),
			};
			callback(streamData);
		});
		this.activeStreams.set(streamId, stream);
		return streamId;
	}

	// Method untuk menggunakan RouterOSAPI untuk tugas-tugas tertentu dengan streaming
	async streamData(
		callback: (data: any) => void,
		errCallback?: (data: any) => void,
		params?: string | string[],
		interfaceName?: string,
		...moreParams: any[]
	): Promise<any> {
		await this.connectRouterosApi();

		const streamId = `write-stream-${Date.now().toString()}`;

		const stream = this.routerosApi.stream(
			params,
			`=interface=${interfaceName}`,
			...moreParams
		);
		stream.data((err: any, packet: any) => {
			if (err) {
				console.error("RouterOSAPI stream error:", err);
				errCallback?.(err);
				return;
			}
			const streamData: StreamData = {
				type: "stream-data",
				interfaceName,
				data: packet,
				timestamp: new Date(),
			};
			callback(streamData);
		});
		this.activeStreams.set(streamId, stream);
		return streamId;
	}

	// Stream IP Address changes
	async startIpAddressStream(
		callback: (data: StreamData) => void,
		errorCallback?: (error: any) => void
	): Promise<string> {
		await this.connect();

		const streamId = `ip-address-${Date.now()}`;

		try {
			const stream = this.connectedApi!.menu("/ip/address").stream(
				"listen",
				(err, data) => {
					if (err) {
						console.error("IP Address stream error:", err);
						errorCallback?.(err);
						return;
					}

					const streamData: StreamData = {
						type: "ip-address",
						data: data,
						timestamp: new Date(),
					};

					callback(streamData);
				}
			);

			this.activeStreams.set(streamId, stream);
			return streamId;
		} catch (error) {
			console.error("Failed to start IP address stream:", error);
			errorCallback?.(error);
			throw error;
		}
	}

	// Stream DHCP Leases changes
	async startDhcpLeasesStream(
		callback: (data: StreamData) => void,
		errorCallback?: (error: any) => void
	): Promise<string> {
		await this.connect();

		const streamId = `dhcp-lease-${Date.now()}`;

		try {
			const stream = this.connectedApi!.menu("/ip/dhcp-server/lease").stream(
				"listen",
				(err, data) => {
					if (err) {
						console.error("DHCP stream error:", err);
						errorCallback?.(err);
						return;
					}

					const streamData: StreamData = {
						type: "dhcp-lease",
						data: data,
						timestamp: new Date(),
					};

					callback(streamData);
				}
			);

			this.activeStreams.set(streamId, stream);
			return streamId;
		} catch (error) {
			console.error("Failed to start DHCP lease stream:", error);
			errorCallback?.(error);
			throw error;
		}
	}

	// Stream Torch data
	async startTorchStream(
		interfaceName: string = "ether2",
		callback: (data: StreamData) => void,
		errorCallback?: (error: any) => void
	): Promise<string> {
		console.log("📡 Starting torch stream...");

		// Force reconnection for torch streams to avoid connection state issues
		if (this.isConnected) {
			await this.disconnect();
		}

		await this.connect();
		console.log("🔌 Connected to MikroTik in startTorchStream");

		const streamId = `torch-${interfaceName}-${Date.now()}`;
		console.log("🆔 Stream ID:", streamId);

		try {
			// Create a fresh menu instance for torch
			const torchMenu = this.connectedApi!.menu("/tool torch");

			const stream = torchMenu
				.where({ interface: interfaceName })
				.stream((err: any, data: any) => {
					console.log("📥 Stream callback triggered");

					if (err) {
						console.error("Torch stream error:", err);
						errorCallback?.(err);
						return;
					}

					console.log("📦 Raw data from MikroTik:", data);

					const streamData: StreamData = {
						type: "torch",
						data: {
							...data,
							interface: interfaceName,
						},
						timestamp: new Date(),
					};

					callback(streamData);
				});

			this.activeStreams.set(streamId, stream);
			console.log("✅ Torch stream started successfully");
			return streamId;
		} catch (error) {
			console.error("Failed to start torch stream:", error);
			errorCallback?.(error);
			throw error;
		}
	}

	// Stop specific stream
	stopStream(streamId: string): boolean {
		const stream = this.activeStreams.get(streamId);
		if (stream) {
			try {
				stream.stop();
				this.activeStreams.delete(streamId);
				return true;
			} catch (error) {
				console.error(`Error stopping stream ${streamId}:`, error);
				return false;
			}
		}
		return false;
	}

	// Get active streams count
	getActiveStreamsCount(): number {
		return this.activeStreams.size;
	}

	// Get connection status
	getConnectionStatus(): boolean {
		return this.isConnected;
	}
}

// Export convenience functions
export const createMikrotikClient = MikrotikClient.createFromDatabase.bind(MikrotikClient);
export const createDirectClient = MikrotikClient.createDirect.bind(MikrotikClient);
export const getCachedClient = MikrotikClient.getCachedClient.bind(MikrotikClient);
export const disconnectClient = MikrotikClient.disconnectCachedClient.bind(MikrotikClient);
export const isClientConnected = MikrotikClient.isClientConnected.bind(MikrotikClient);
export const getConnectionStats = MikrotikClient.getConnectionStats.bind(MikrotikClient);
export const reconnectClient = MikrotikClient.reconnectClient.bind(MikrotikClient);

// Cleanup on process exit
process.on("SIGINT", async () => {
	console.log("Cleaning up MikroTik connections...");
	await MikrotikClient.cleanup();
	process.exit(0);
});

process.on("SIGTERM", async () => {
	console.log("Cleaning up MikroTik connections...");
	await MikrotikClient.cleanup();
	process.exit(0);
});
