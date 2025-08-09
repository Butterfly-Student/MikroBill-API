import { IRosOptions } from "@/package/node-routeros/src";
import { MikrotikClient } from "../mikrotik/client";
import { db } from "@/lib/db/index";

interface CachedClient {
	client: MikrotikClient;
	lastUsed: Date;
	isConnected: boolean;
}

class MikrotikClientManager {
	private clientCache = new Map<number, CachedClient>();
	private cleanupInterval: NodeJS.Timeout;
	private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
	private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

	constructor() {
		// Setup periodic cleanup
		this.cleanupInterval = setInterval(() => {
			this.cleanupStaleConnections();
		}, this.CLEANUP_INTERVAL);
	}

	/**
	 * Create or get cached MikroTik client
	 */
	async createMikrotikClient(
		routerId: number,
		overrideConfig?: Partial<IRosOptions>
	): Promise<MikrotikClient> {
		try {
			// Validate routerId
			if (!routerId || routerId <= 0) {
				throw new Error("Invalid router ID provided");
			}

			// Check if we have a valid cached client
			const cachedClient = this.clientCache.get(routerId);
			console.log("Cached Client:", cachedClient);
			if (cachedClient && cachedClient.isConnected) {
				// Update last used time
				cachedClient.lastUsed = new Date();
				return cachedClient.client;
			}

			// Remove stale cached client if exists
			if (cachedClient) {
				await this.disconnectClient(routerId);
			}

			// Get router config from database
			const router = await db.query.routers.findFirst({
				where: (r, { eq }) => eq(r.id, routerId),
			});

			if (!router) {
				throw new Error(`Router with ID ${routerId} not found`);
			}

			if (!router.is_active) {
				throw new Error(`Router ${router.name} is not active`);
			}

			// Create client config
			const clientConfig: IRosOptions = {
				host: overrideConfig?.host || router.ip_address,
				user: overrideConfig?.user || router.username,
				password: overrideConfig?.password || router.password,
				port: overrideConfig?.port || router.port || 8728,
				timeout: overrideConfig?.timeout || router.timeout || 30000,
				keepalive: overrideConfig?.keepalive ?? true,
			};

			// Validate required config
			if (!clientConfig.host || !clientConfig.user || !clientConfig.password) {
				throw new Error(
					"Missing required router configuration (host, user, password)"
				);
			}

			console.log(
				`Creating MikroTik client for router: ${router.name} (${router.ip_address})`
			);

			// Create new client
			const client = new MikrotikClient(clientConfig);

			// Connect with timeout
			await this.connectWithTimeout(client, clientConfig.timeout || 30000);

			// Cache the client
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

			// Clean up failed connection
			this.clientCache.delete(routerId);

			throw error;
		}
	}

	/**
	 * Create client with custom config (without database lookup)
	 */
	async createDirectClient(config: IRosOptions): Promise<MikrotikClient> {
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
		await this.connectWithTimeout(client, clientConfig.timeout || 30000);

		return client;
	}

	/**
	 * Connect client with timeout
	 */
	private async connectWithTimeout(
		client: MikrotikClient,
		timeout: number
	): Promise<void> {
		const connectPromise = client.connect();
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(
				() => reject(new Error(`Connection timeout after ${timeout}ms`)),
				timeout
			);
		});

		await Promise.race([connectPromise, timeoutPromise]);
	}

	/**
	 * Get cached client without creating new one
	 */
	getCachedClient(routerId: number): MikrotikClient | null {
		const cachedClient = this.clientCache.get(routerId);
		if (cachedClient && cachedClient.isConnected) {
			cachedClient.lastUsed = new Date();
			return cachedClient.client;
		}
		return null;
	}

	/**
	 * Disconnect and remove client from cache
	 */
	async disconnectClient(routerId: number): Promise<void> {
		const cachedClient = this.clientCache.get(routerId);
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
				this.clientCache.delete(routerId);
			}
		}
	}

	/**
	 * Check if client is connected
	 */
	isClientConnected(routerId: number): boolean {
		const cachedClient = this.clientCache.get(routerId);
		return cachedClient?.isConnected ?? false;
	}

	/**
	 * Get connection stats
	 */
	getConnectionStats() {
		const stats = {
			totalConnections: this.clientCache.size,
			activeConnections: 0,
			connections: [] as Array<{
				routerId: number;
				lastUsed: Date;
				isConnected: boolean;
			}>,
		};

		this.clientCache.forEach((cachedClient, routerId) => {
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
	 * Clean up stale connections
	 */
	private async cleanupStaleConnections(): Promise<void> {
		const now = new Date();
		const staleRouterIds: number[] = [];

		this.clientCache.forEach((cachedClient, routerId) => {
			const timeSinceLastUse = now.getTime() - cachedClient.lastUsed.getTime();
			if (timeSinceLastUse > this.CACHE_TTL) {
				staleRouterIds.push(routerId);
			}
		});

		if (staleRouterIds.length > 0) {
			console.log(
				`Cleaning up ${staleRouterIds.length} stale MikroTik connections`
			);

			await Promise.allSettled(
				staleRouterIds.map((routerId) => this.disconnectClient(routerId))
			);
		}
	}

	/**
	 * Disconnect all clients and cleanup
	 */
	async cleanup(): Promise<void> {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}

		const disconnectPromises = Array.from(this.clientCache.keys()).map(
			(routerId) => this.disconnectClient(routerId)
		);

		await Promise.allSettled(disconnectPromises);
		this.clientCache.clear();
	}

	/**
	 * Reconnect a client (useful for connection recovery)
	 */
	async reconnectClient(routerId: number): Promise<MikrotikClient> {
		await this.disconnectClient(routerId);
		return this.createMikrotikClient(routerId);
	}
}

// Create singleton instance
export const mikrotikClientManager = new MikrotikClientManager();

// Export convenience functions
export const createMikrotikClient =
	mikrotikClientManager.createMikrotikClient.bind(mikrotikClientManager);
export const createDirectClient = mikrotikClientManager.createDirectClient.bind(
	mikrotikClientManager
);
export const getCachedClient = mikrotikClientManager.getCachedClient.bind(
	mikrotikClientManager
);
export const disconnectClient = mikrotikClientManager.disconnectClient.bind(
	mikrotikClientManager
);
export const isClientConnected = mikrotikClientManager.isClientConnected.bind(
	mikrotikClientManager
);
export const getConnectionStats = mikrotikClientManager.getConnectionStats.bind(
	mikrotikClientManager
);
export const reconnectClient = mikrotikClientManager.reconnectClient.bind(
	mikrotikClientManager
);

// Cleanup on process exit
process.on("SIGINT", async () => {
	console.log("Cleaning up MikroTik connections...");
	await mikrotikClientManager.cleanup();
	process.exit(0);
});

process.on("SIGTERM", async () => {
	console.log("Cleaning up MikroTik connections...");
	await mikrotikClientManager.cleanup();
	process.exit(0);
});
