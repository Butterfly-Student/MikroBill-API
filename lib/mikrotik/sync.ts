import { session_profiles } from "@/database/schema/mikrotik";
import { db } from "@/lib/db/index";
import { eq, and } from "drizzle-orm";
import { routers } from "@/database/schema/users";
import { createMikrotikClient } from "./client";

export interface SimpleSyncResult {
	success: boolean;
	message: string;
	synced: {
		pppoeProfiles: number;
		hotspotProfiles: number;
	};
	errors: string[];
}

// Updated interface to match actual MikroTik API response
export interface MikrotikPPPoEProfile {
	$$path: string;
	id: string;
	name: string;
	"rate-limit"?: string;
	"session-timeout"?: string;
	"idle-timeout"?: string;
	comment?: string;
	disabled?: string;
	bridgeLearning?: string;
	useIpv6?: string;
	useMpls?: string;
	useCompression?: string;
	useEncryption?: string;
	onlyOne?: string;
	changeTcpMss?: string;
	useUpnp?: string;
	addressList?: string;
	onUp?: string;
	onDown?: string;
	default?: boolean;
}

export interface MikrotikHotspotProfile {
	$$path: string;
	id: string;
	name: string;
	"rate-limit"?: string;
	"session-timeout"?: string;
	"idle-timeout"?: string;
	idleTimeout?: string;
	keepaliveTimeout?: string;
	statusAutorefresh?: string;
	sharedUsers?: number;
	addMacCookie?: boolean;
	macCookieTimeout?: string;
	addressList?: string;
	transparentProxy?: boolean;
	comment?: string;
	disabled?: string;
	default?: boolean;
}

export class SyncRouterData {
	private client: any;

	constructor(private routerId: number) {}

	// Method untuk inisialisasi client
	private async initialize(): Promise<void> {
		if (!this.client) {
			console.log(
				`🔗 Initializing MikroTik client for router ID: ${this.routerId}`
			);
			this.client = await createMikrotikClient(this.routerId);
			console.log(`✅ MikroTik client initialized successfully`);
		}
	}

	async syncProfiles(): Promise<SimpleSyncResult> {
		const result: SimpleSyncResult = {
			success: false,
			message: "",
			synced: {
				pppoeProfiles: 0,
				hotspotProfiles: 0,
			},
			errors: [],
		};

		try {
			console.log(`🔄 Starting profile sync for router ID: ${this.routerId}`);

			// Ensure client is initialized before proceeding
			await this.initialize();

			console.log("✅ Mikrotik Client initialized:", !!this.client);

			// Update router status
			await this.updateRouterStatus("online");

			// Sync PPPoE profiles
			await this.syncPPPoEProfiles(result);

			// Sync Hotspot profiles
			await this.syncHotspotProfiles(result);

			result.success = true;
			result.message = `Sync completed. PPPoE: ${result.synced.pppoeProfiles}, Hotspot: ${result.synced.hotspotProfiles}`;

			console.log(
				`✅ Profile sync completed for router ID: ${this.routerId}`,
				result
			);
		} catch (error) {
			console.error(
				`❌ Profile sync failed for router ID: ${this.routerId}`,
				error
			);
			result.errors.push(
				`Sync failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
			result.message = "Sync failed with errors";
			await this.updateRouterStatus("error");
		}

		return result;
	}

	private async updateRouterStatus(
		status: "online" | "offline" | "error" = "online"
	): Promise<void> {
		try {
			await db
				.update(routers)
				.set({
					status,
					last_seen: new Date(),
					updated_at: new Date(),
				})
				.where(eq(routers.id, this.routerId));
		} catch (error) {
			console.error("Failed to update router status:", error);
		}
	}

	private async syncPPPoEProfiles(result: SimpleSyncResult): Promise<void> {
		try {
			console.log("🔄 Syncing PPPoE profiles...");

			// Ensure client is available
			await this.initialize();

			const mikrotikProfiles: MikrotikPPPoEProfile[] =
				await this.client.getPPPoEProfiles();
			console.log(
				`Found ${mikrotikProfiles.length} PPPoE profiles on MikroTik`
			);

			for (const mtProfile of mikrotikProfiles) {
				await this.syncPPPoEProfile(mtProfile);
				result.synced.pppoeProfiles++;
			}
		} catch (error) {
			const errorMsg = `PPPoE profiles sync error: ${
				error instanceof Error ? error.message : "Unknown error"
			}`;
			console.error(errorMsg);
			result.errors.push(errorMsg);
		}
	}

	private async syncHotspotProfiles(result: SimpleSyncResult): Promise<void> {
		try {
			console.log("🔄 Syncing Hotspot profiles...");

			// Ensure client is available
			await this.initialize();

			const mikrotikProfiles: MikrotikHotspotProfile[] =
				await this.client.getHotspotProfiles();
			console.log(
				`Found ${mikrotikProfiles.length} Hotspot profiles on MikroTik`
			);

			for (const mtProfile of mikrotikProfiles) {
				await this.syncHotspotProfile(mtProfile);
				result.synced.hotspotProfiles++;
			}
		} catch (error) {
			const errorMsg = `Hotspot profiles sync error: ${
				error instanceof Error ? error.message : "Unknown error"
			}`;
			console.error(errorMsg);
			result.errors.push(errorMsg);
		}
	}

	private async syncPPPoEProfile(
		mtProfile: MikrotikPPPoEProfile
	): Promise<void> {
		try {
			// Check if profile already exists
			const existingProfile = await db.query.session_profiles.findFirst({
				where: and(
					eq(session_profiles.router_id, this.routerId),
					eq(session_profiles.mikrotik_id, mtProfile.id),
					eq(session_profiles.type, "pppoe")
				),
			});

			// Parse configurations for PPPoE
			const bandwidthConfig = this.parseBandwidthConfig(
				mtProfile["rate-limit"]
			);
			const timeoutConfig = this.parsePPPoETimeoutConfig(mtProfile);
			const networkConfig = this.parsePPPoENetworkConfig(mtProfile);
			const securityConfig = this.parsePPPoESecurityConfig(mtProfile);

			const profileData = {
				router_id: this.routerId,
				name: mtProfile.name,
				type: "pppoe" as const,
				bandwidth_config: bandwidthConfig,
				timeout_config: timeoutConfig,
				network_config: networkConfig,
				security_config: securityConfig,
				comment: mtProfile.comment || null,
				mikrotik_id: mtProfile.id,
				synced_to_mikrotik: true,
				is_active: mtProfile.disabled !== "true",
				updated_at: new Date(),
			};

			if (existingProfile) {
				// Update existing profile
				await db
					.update(session_profiles)
					.set(profileData)
					.where(eq(session_profiles.id, existingProfile.id));

				console.log(`📝 Updated PPPoE profile: ${mtProfile.name}`);
			} else {
				// Insert new profile
				await db.insert(session_profiles).values({
					...profileData,
					created_at: new Date(),
				});

				console.log(`➕ Added new PPPoE profile: ${mtProfile.name}`);
			}
		} catch (error) {
			console.error(`Failed to sync PPPoE profile ${mtProfile.name}:`, error);
			throw error;
		}
	}

	private async syncHotspotProfile(
		mtProfile: MikrotikHotspotProfile
	): Promise<void> {
		try {
			// Check if profile already exists
			const existingProfile = await db.query.session_profiles.findFirst({
				where: and(
					eq(session_profiles.router_id, this.routerId),
					eq(session_profiles.mikrotik_id, mtProfile.id),
					eq(session_profiles.type, "hotspot")
				),
			});

			// Parse configurations for Hotspot
			const bandwidthConfig = this.parseBandwidthConfig(
				mtProfile["rate-limit"]
			);
			const timeoutConfig = this.parseHotspotTimeoutConfig(mtProfile);
			const securityConfig = this.parseHotspotSecurityConfig(mtProfile);
			const advancedConfig = this.parseHotspotAdvancedConfig(mtProfile);

			const profileData = {
				router_id: this.routerId,
				name: mtProfile.name,
				type: "hotspot" as const,
				bandwidth_config: bandwidthConfig,
				timeout_config: timeoutConfig,
				security_config: securityConfig,
				advanced_config: advancedConfig,
				comment: mtProfile.comment || null,
				mikrotik_id: mtProfile.id,
				synced_to_mikrotik: true,
				is_active: mtProfile.disabled !== "true",
				updated_at: new Date(),
			};

			if (existingProfile) {
				// Update existing profile
				await db
					.update(session_profiles)
					.set(profileData)
					.where(eq(session_profiles.id, existingProfile.id));

				console.log(`📝 Updated Hotspot profile: ${mtProfile.name}`);
			} else {
				// Insert new profile
				await db.insert(session_profiles).values({
					...profileData,
					created_at: new Date(),
				});

				console.log(`➕ Added new Hotspot profile: ${mtProfile.name}`);
			}
		} catch (error) {
			console.error(`Failed to sync Hotspot profile ${mtProfile.name}:`, error);
			throw error;
		}
	}

	private parseBandwidthConfig(rateLimit?: string): any {
		if (!rateLimit) return null;

		// Handle complex rate limit format: "6M/6M 7M/7M 4560k/4560k 11/11 8 3M/3M"
		const parts = rateLimit.split(" ");

		if (parts.length >= 1) {
			const mainRate = parts[0].split("/");
			const config: any = {
				rateLimit: rateLimit,
			};

			if (mainRate.length >= 2) {
				config.downloadSpeed = mainRate[0]; // rx-rate
				config.uploadSpeed = mainRate[1]; // tx-rate
			}

			// Parse additional rate limit parameters if present
			if (parts.length > 1) {
				config.burstRate = parts[1];
			}
			if (parts.length > 2) {
				config.burstThreshold = parts[2];
			}
			if (parts.length > 3) {
				config.burstTime = parts[3];
			}
			if (parts.length > 4) {
				config.priority = parts[4];
			}
			if (parts.length > 5) {
				config.limitAt = parts[5];
			}

			return config;
		}

		return { rateLimit };
	}

	private parsePPPoETimeoutConfig(profile: MikrotikPPPoEProfile): any {
		const config: any = {};

		if (profile["session-timeout"]) {
			config.sessionTimeout = profile["session-timeout"];
		}

		if (profile["idle-timeout"]) {
			config.idleTimeout = profile["idle-timeout"];
		}

		return Object.keys(config).length > 0 ? config : null;
	}

	private parseHotspotTimeoutConfig(profile: MikrotikHotspotProfile): any {
		const config: any = {};

		if (profile["session-timeout"]) {
			config.sessionTimeout = profile["session-timeout"];
		}

		if (profile["idle-timeout"] || profile.idleTimeout) {
			config.idleTimeout = profile["idle-timeout"] || profile.idleTimeout;
		}

		if (profile.keepaliveTimeout) {
			config.keepaliveTimeout = profile.keepaliveTimeout;
		}

		if (profile.statusAutorefresh) {
			config.statusAutorefresh = profile.statusAutorefresh;
		}

		if (profile.macCookieTimeout) {
			config.macCookieTimeout = profile.macCookieTimeout;
		}

		return Object.keys(config).length > 0 ? config : null;
	}

	private parsePPPoENetworkConfig(profile: MikrotikPPPoEProfile): any {
		const config: any = {};

		if (profile.bridgeLearning) {
			config.bridgeLearning = profile.bridgeLearning;
		}

		if (profile.useIpv6) {
			config.useIpv6 = profile.useIpv6;
		}

		if (profile.useMpls) {
			config.useMpls = profile.useMpls;
		}

		if (profile.changeTcpMss) {
			config.changeTcpMss = profile.changeTcpMss;
		}

		if (profile.useUpnp) {
			config.useUpnp = profile.useUpnp;
		}

		if (profile.addressList) {
			config.addressList = profile.addressList;
		}

		if (profile.onUp) {
			config.onUp = profile.onUp;
		}

		if (profile.onDown) {
			config.onDown = profile.onDown;
		}

		return Object.keys(config).length > 0 ? config : null;
	}

	private parsePPPoESecurityConfig(profile: MikrotikPPPoEProfile): any {
		const config: any = {};

		if (profile.useCompression) {
			config.useCompression = profile.useCompression;
		}

		if (profile.useEncryption) {
			config.useEncryption = profile.useEncryption;
		}

		if (profile.onlyOne) {
			config.onlyOne = profile.onlyOne;
		}

		return Object.keys(config).length > 0 ? config : null;
	}

	private parseHotspotSecurityConfig(profile: MikrotikHotspotProfile): any {
		const config: any = {};

		if (profile.addressList) {
			config.addressList = profile.addressList;
		}

		if (profile.transparentProxy !== undefined) {
			config.transparentProxy = profile.transparentProxy;
		}

		return Object.keys(config).length > 0 ? config : null;
	}

	private parseHotspotAdvancedConfig(profile: MikrotikHotspotProfile): any {
		const config: any = {};

		if (profile.sharedUsers !== undefined) {
			config.sharedUsers = profile.sharedUsers;
		}

		if (profile.addMacCookie !== undefined) {
			config.addMacCookie = profile.addMacCookie;
		}

		return Object.keys(config).length > 0 ? config : null;
	}
}
