import { db } from "@/lib/db/index";
import {
	hotspot_profiles,
	hotspot_users,
	hotspot_active_sessions,
	hotspot_usage_sessions,
	voucher_batches,
	vouchers,
	type HotspotProfile,
	type NewHotspotProfile,
	type HotspotUser,
	type NewHotspotUser,
	type HotspotActiveSession,
	type NewHotspotActiveSession,
	type HotspotUsageSession,
	type NewHotspotUsageSession,
	type HotspotVoucherBatch,
	type NewHotspotVoucherBatch,
	type HotspotVoucher,
	type NewHotspotVoucher,
} from "@/database/schema/mikrotik";
import {
	eq,
	desc,
	count,
	inArray,
	and,
	or,
	gte,
	lte,
	isNull,
} from "drizzle-orm";
import { MikrotikClient } from "../../lib/mikrotik/client";
import { IRosOptions } from "node-routeros";
import { generateOnLoginScript } from "@/utils/mikrotik.utils";
import { MikrotikCommandGenerator } from "@/utils/mikrotik_hotspot";

export interface VoucherConfig {
	length?: number;
	prefix?: string;
	suffix?: string;
	characters?: string;
	passwordMode?: "same_as_username" | "random" | "custom";
	customPassword?: string;
}

export interface SingleVoucherConfig {
	router_id: number;
	profile?: string;
	username: string;
	password?: string;
	comment?: string;
	created_by?: number;
	validity_hours?: number;
	start_at?: Date;
	end_at?: Date;
	uptime_limit?: string;
	bytes_in_limit?: number;
	bytes_out_limit?: number;
	rate_limit?: string;
	mac_address?: string;
}

export interface BulkVoucherConfig extends VoucherConfig {
	total_generated: number;
	batch_name: string;
	router_id: number;
	profile?: string;
	comment?: string;
	created_by?: number;
	generation_mode?: "random" | "sequential";
	validity_hours?: number;
	start_date?: Date;
	end_date?: Date;
}

interface BulkUpdateVoucherConfig {
	batch_id?: number;
	router_id: number;
	updates: {
		profile?: string;
		comment?: string;
		status?: "unused" | "used" | "expired";
		voucher_status?: "unused" | "used" | "expired";
	};
	updated_by?: number;
	filters?: {
		status?: "unused" | "used" | "expired";
		unused_only?: boolean;
		voucher_ids?: number[];
		batch_ids?: number[];
	};
}

interface BulkDeleteVoucherConfig {
	batch_id?: number;
	router_id: number;
	deleted_by?: number;
	filters?: {
		status?: "unused" | "used" | "expired";
		unused_only?: boolean;
		voucher_ids?: number[];
		batch_ids?: number[];
	};
	force_delete_active?: boolean;
}

export class MikrotikHotspot extends MikrotikClient {
	static async createFromDatabase(
		routerId: number,
		overrideConfig?: Partial<IRosOptions>
	): Promise<MikrotikHotspot> {
		try {
			if (!routerId || routerId <= 0) {
				throw new Error("Invalid router ID provided");
			}

			const cachedClient = MikrotikClient.getCachedClient(routerId);
			if (cachedClient && cachedClient instanceof MikrotikHotspot) {
				console.log(
					`♻️ Using cached MikrotikHotspot client for router ${routerId}`
				);
				return cachedClient;
			}

			if (cachedClient) {
				await MikrotikClient.disconnectCachedClient(routerId);
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
				`🔌 Creating MikroTik Hotspot client for router: ${router.name} (${router.hostname})`
			);

			const hotspotClient = new MikrotikHotspot(clientConfig);
			await hotspotClient.connectWithTimeout(clientConfig.timeout || 30000);

			const clientCache = (MikrotikClient as any).clientCache;
			if (clientCache && clientCache instanceof Map) {
				clientCache.set(routerId, {
					client: hotspotClient,
					lastUsed: new Date(),
					isConnected: true,
				});
			}

			console.log(`✅ MikrotikHotspot client cached for router ${routerId}`);
			return hotspotClient;
		} catch (error) {
			console.error(
				`❌ Failed to create MikroTik Hotspot client for router ${routerId}:`,
				error
			);
			await MikrotikClient.disconnectCachedClient(routerId);
			throw error;
		}
	}

	override async connectWithTimeout(timeout: number): Promise<void> {
		const connectPromise = this.connect();
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(
				() => reject(new Error(`Connection timeout after ${timeout}ms`)),
				timeout
			);
		});

		await Promise.race([connectPromise, timeoutPromise]);
	}

	// ============ PROFILE MANAGEMENT ============

	async createProfile(
		routerId: number,
		profileData: NewHotspotProfile
	): Promise<HotspotProfile> {
		let createdProfile: HotspotProfile | null = null;

		try {
			const router = await db.query.routers.findFirst({
				where: (r, { eq, and }) =>
					and(eq(r.id, routerId), eq(r.is_active, true)),
			});

			if (!router) {
				throw new Error(`Router with ID ${routerId} not found or inactive`);
			}

			const existingProfile = await db.query.hotspot_profiles.findFirst({
				where: (hp, { eq, and }) =>
					and(eq(hp.router_id, routerId), eq(hp.name, profileData.name)),
			});

			if (existingProfile) {
				throw new Error(
					`Hotspot profile '${profileData.name}' already exists on this router`
				);
			}

			// Generate on-login script if provided
			const onLoginScript =
				profileData.on_login_script || generateOnLoginScript(profileData);

			const newProfile: NewHotspotProfile = {
				...profileData,
				router_id: routerId,
				on_login_script: onLoginScript,
				synced_to_mikrotik: false,
			};

			const [dbProfile] = await db
				.insert(hotspot_profiles)
				.values(newProfile)
				.returning();
			createdProfile = dbProfile;

			console.log(
				`✅ Hotspot profile '${profileData.name}' created in database`
			);

			// Create in MikroTik
			await this.connect();
			const mikrotikCommand =
				MikrotikCommandGenerator.generateHotspotProfileAddObject(newProfile);
			const result = await this.connectedApi!.menu(
				"/ip/hotspot/user/profile"
			).add(mikrotikCommand);

			// Update with MikroTik ID
			const [updatedProfile] = await db
				.update(hotspot_profiles)
				.set({
					mikrotik_profile_id: result["id"],
					synced_to_mikrotik: true,
					updated_at: new Date(),
				})
				.where(eq(hotspot_profiles.id, dbProfile.id))
				.returning();

			console.log(
				`✅ Hotspot profile '${profileData.name}' synced to MikroTik with ID: ${result["id"]}`
			);
			return updatedProfile;
		} catch (error) {
			console.error("❌ Error creating hotspot profile:", error);

			if (createdProfile?.id) {
				try {
					await db
						.delete(hotspot_profiles)
						.where(eq(hotspot_profiles.id, createdProfile.id));
					console.log(
						`🔄 Rolled back database record for profile '${profileData.name}'`
					);
				} catch (rollbackError) {
					console.error(
						"❌ Failed to rollback database record:",
						rollbackError
					);
				}
			}

			throw error;
		}
	}

	async getProfiles(routerId: number): Promise<HotspotProfile[]> {
		return await db.query.hotspot_profiles.findMany({
			where: (hp, { eq, and }) =>
				and(eq(hp.router_id, routerId), eq(hp.is_active, true)),
			orderBy: (hp, { desc }) => [desc(hp.created_at)],
		});
	}

	async updateProfile(
		routerId: number,
		profileId: number,
		profileData: Partial<NewHotspotProfile>
	): Promise<HotspotProfile> {
		const profile = await db.query.hotspot_profiles.findFirst({
			where: (hp, { eq, and }) =>
				and(eq(hp.id, profileId), eq(hp.router_id, routerId)),
		});

		if (!profile) {
			throw new Error(
				`Profile with ID ${profileId} not found or doesn't belong to this router`
			);
		}

		try {
			// Update in MikroTik first if synced
			if (profile.mikrotik_profile_id) {
				await this.connect();
				const mikrotikCommand =
					MikrotikCommandGenerator.generateHotspotProfileAddObject({
						...profile,
						...profileData,
					});
				await this.connectedApi!.menu("/ip/hotspot/user/profile").update(
					mikrotikCommand,
					profile.mikrotik_profile_id
				);
			}

			// Update in database
			const [updatedProfile] = await db
				.update(hotspot_profiles)
				.set({
					...profileData,
					updated_at: new Date(),
				})
				.where(eq(hotspot_profiles.id, profileId))
				.returning();

			console.log(`✅ Hotspot profile '${profile.name}' updated successfully`);
			return updatedProfile;
		} catch (error) {
			console.error("❌ Error updating hotspot profile:", error);
			throw error;
		}
	}

	async deleteProfile(profileId: number): Promise<void> {
		const profile = await db.query.hotspot_profiles.findFirst({
			where: (hp, { eq }) => eq(hp.id, profileId),
		});

		if (!profile) {
			throw new Error(`Profile with ID ${profileId} not found`);
		}

		try {
			// Delete from MikroTik first if synced
			if (profile.mikrotik_profile_id) {
				await this.connect();
				await this.connectedApi!.menu("/ip/hotspot/user/profile").remove(
					profile.mikrotik_profile_id
				);
				console.log(
					`✅ Hotspot profile '${profile.name}' removed from MikroTik`
				);
			}

			// Soft delete in database
			await db
				.update(hotspot_profiles)
				.set({
					is_active: false,
					synced_to_mikrotik: false,
					updated_at: new Date(),
				})
				.where(eq(hotspot_profiles.id, profileId));

			console.log(
				`✅ Hotspot profile '${profile.name}' deactivated in database`
			);
		} catch (error) {
			console.error("❌ Error deleting hotspot profile:", error);
			throw error;
		}
	}

	// ============ USER MANAGEMENT ============

	async createUser(
		routerId: number,
		userData: NewHotspotUser
	): Promise<HotspotUser> {
		let createdUser: HotspotUser | null = null;

		try {
			const router = await db.query.routers.findFirst({
				where: (r, { eq, and }) =>
					and(eq(r.id, routerId), eq(r.is_active, true)),
			});

			if (!router) {
				throw new Error(`Router with ID ${routerId} not found or inactive`);
			}

			// Check if username already exists
			const existingUser = await db.query.hotspot_users.findFirst({
				where: (hu, { eq, and }) =>
					and(eq(hu.router_id, routerId), eq(hu.name, userData.name)),
			});

			if (existingUser) {
				throw new Error(
					`Hotspot user '${userData.name}' already exists on this router`
				);
			}

			const newUser: NewHotspotUser = {
				...userData,
				router_id: routerId,
				synced_to_mikrotik: false,
			};

			const [dbUser] = await db
				.insert(hotspot_users)
				.values(newUser)
				.returning();
			createdUser = dbUser;

			console.log(`✅ Hotspot user '${userData.name}' created in database`);

			// Create in MikroTik
			await this.connect();
			const mikrotikCommand = {
				name: userData.name,
				password: userData.password,
				profile: userData.profile,
				comment: userData.comment || "",
			};

			const result = await this.connectedApi!.menu("/ip/hotspot/user").add(
				mikrotikCommand
			);

			// Update with MikroTik ID
			const [updatedUser] = await db
				.update(hotspot_users)
				.set({
					mikrotik_user_id: result["id"],
					synced_to_mikrotik: true,
					updated_at: new Date(),
				})
				.where(eq(hotspot_users.id, dbUser.id))
				.returning();

			console.log(
				`✅ Hotspot user '${userData.name}' synced to MikroTik with ID: ${result["id"]}`
			);
			return updatedUser;
		} catch (error) {
			console.error("❌ Error creating hotspot user:", error);

			if (createdUser?.id) {
				try {
					await db
						.delete(hotspot_users)
						.where(eq(hotspot_users.id, createdUser.id));
					console.log(
						`🔄 Rolled back database record for user '${userData.name}'`
					);
				} catch (rollbackError) {
					console.error(
						"❌ Failed to rollback database record:",
						rollbackError
					);
				}
			}

			throw error;
		}
	}

	async getUsers(routerId: number): Promise<HotspotUser[]> {
		return await db.query.hotspot_users.findMany({
			where: (hu, { eq, and }) =>
				and(eq(hu.router_id, routerId), eq(hu.is_active, true)),
			orderBy: (hu, { desc }) => [desc(hu.created_at)],
			with: {
				profile: true,
				customer: true,
			},
		});
	}

	async getActiveUsers(routerId: number): Promise<HotspotActiveSession[]> {
		return await db.query.hotspot_active_sessions.findMany({
			where: (has, { eq }) => eq(has.router_id, routerId),
			orderBy: (has, { desc }) => [desc(has.login_time)],
			with: {
				hotspot_user: true,
				customer: true,
			},
		});
	}

	async disconnectUser(routerId: number, username: string): Promise<void> {
		await this.connect();

		try {
			// Get active sessions for the user
			const activeSessions = await this.connectedApi!.menu("/ip/hotspot/active")
				.where({ user: username })
				.get();

			if (activeSessions.length === 0) {
				throw new Error(`No active session found for user '${username}'`);
			}

			// Disconnect all active sessions for this user
			for (const session of activeSessions) {
				await this.connectedApi!.menu("/ip/hotspot/active").remove(
					session[".id"]
				);
			}

			// Update database session status
			await db
				.update(hotspot_active_sessions)
				.set({
					status: "terminated",
					updated_at: new Date(),
				})
				.where(
					and(
						eq(hotspot_active_sessions.router_id, routerId),
						eq(hotspot_active_sessions.username, username)
					)
				);

			console.log(
				`✅ Disconnected ${activeSessions.length} session(s) for user '${username}'`
			);
		} catch (error) {
			console.error("❌ Error disconnecting hotspot user:", error);
			throw error;
		}
	}

	// ============ VOUCHER MANAGEMENT ============

	async createVoucherBatch(
		config: BulkVoucherConfig
	): Promise<HotspotVoucherBatch> {
		try {
			const batchData: NewHotspotVoucherBatch = {
				router_id: config.router_id,
				profile: config.profile,
				batch_name: config.batch_name,
				length: config.length || 8,
				start_date: config.start_date,
				end_date: config.end_date,
				prefix: config.prefix || "",
				suffix: config.suffix || "",
				username_length: config.length || 8,
				password_length: config.length || 8,
				charset: config.characters || "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
				password_mode: config.passwordMode || "same_as_username",
				generation_mode: config.generation_mode || "random",
				count: config.total_generated,
				total_generated: 0,
				comment: config.comment,
				created_by: config.created_by,
			};

			const [batch] = await db
				.insert(voucher_batches)
				.values(batchData)
				.returning();

			console.log(
				`✅ Voucher batch '${config.batch_name}' created with ID: ${batch.id}`
			);
			return batch;
		} catch (error) {
			console.error("❌ Error creating voucher batch:", error);
			throw error;
		}
	}

	async createSingleVoucher(
		config: SingleVoucherConfig
	): Promise<HotspotVoucher> {
		let createdVoucher: HotspotVoucher | null = null;

		try {
			// Check if username already exists
			const existingVoucher = await db.query.vouchers.findFirst({
				where: (v, { eq, and }) =>
					and(
						eq(v.router_id, config.router_id),
						eq(v.username, config.username)
					),
			});

			if (existingVoucher) {
				throw new Error(
					`Voucher with username '${config.username}' already exists`
				);
			}

			const voucherData: NewHotspotVoucher = {
				router_id: config.router_id,
				profile: config.profile,
				server: "all", // Default server
				username: config.username,
				password: config.password || config.username,
				validity_hours: config.validity_hours,
				start_at: config.start_at,
				end_at: config.end_at,
				uptime_limit: config.uptime_limit,
				bytes_in_limit: config.bytes_in_limit,
				bytes_out_limit: config.bytes_out_limit,
				rate_limit: config.rate_limit,
				mac_address: config.mac_address,
				comment: config.comment,
				created_by: config.created_by,
				voucher_status: "unused",
				synced_to_mikrotik: false,
			};

			const [dbVoucher] = await db
				.insert(vouchers)
				.values(voucherData)
				.returning();
			createdVoucher = dbVoucher;

			console.log(`✅ Voucher '${config.username}' created in database`);

			// Create in MikroTik as hotspot user
			await this.connect();
			const mikrotikCommand = {
				name: config.username,
				password: config.password || config.username,
				profile: config.profile,
				comment: config.comment || "",
			};

			const result = await this.connectedApi!.menu("/ip/hotspot/user").add(
				mikrotikCommand
			);

			// Update with MikroTik ID
			const [updatedVoucher] = await db
				.update(vouchers)
				.set({
					mikrotik_user_id: result["id"],
					synced_to_mikrotik: true,
					updated_at: new Date(),
				})
				.where(eq(vouchers.id, dbVoucher.id))
				.returning();

			console.log(
				`✅ Voucher '${config.username}' synced to MikroTik with ID: ${result["id"]}`
			);
			return updatedVoucher;
		} catch (error) {
			console.error("❌ Error creating voucher:", error);

			if (createdVoucher?.id) {
				try {
					await db.delete(vouchers).where(eq(vouchers.id, createdVoucher.id));
					console.log(
						`🔄 Rolled back database record for voucher '${config.username}'`
					);
				} catch (rollbackError) {
					console.error(
						"❌ Failed to rollback database record:",
						rollbackError
					);
				}
			}

			throw error;
		}
	}

	async getVouchers(
		routerId: number,
		batchId?: number
	): Promise<HotspotVoucher[]> {
		const whereClause = batchId
			? and(eq(vouchers.router_id, routerId), eq(vouchers.batch_id, batchId))
			: eq(vouchers.router_id, routerId);

		return await db.query.vouchers.findMany({
			where: whereClause,
			orderBy: (v, { desc }) => [desc(v.created_at)],
			with: {
				batch: true,
				profile: true,
			},
		});
	}

	async getVoucherBatches(routerId: number): Promise<HotspotVoucherBatch[]> {
		return await db.query.voucher_batches.findMany({
			where: (vb, { eq }) => eq(vb.router_id, routerId),
			orderBy: (vb, { desc }) => [desc(vb.created_at)],
			with: {
				profile: true,
			},
		});
	}

	async deleteVoucherBatch(
		batchId: number,
		forceDelete: boolean = false
	): Promise<void> {
		const batch = await db.query.voucher_batches.findFirst({
			where: (vb, { eq }) => eq(vb.id, batchId),
		});

		if (!batch) {
			throw new Error(`Voucher batch with ID ${batchId} not found`);
		}

		try {
			// Get all vouchers in this batch
			const batchVouchers = await db.query.vouchers.findMany({
				where: (v, { eq }) => eq(v.batch_id, batchId),
			});

			// Delete vouchers from MikroTik
			await this.connect();
			for (const voucher of batchVouchers) {
				if (voucher.mikrotik_user_id) {
					try {
						await this.connectedApi!.menu("/ip/hotspot/user").remove(
							voucher.mikrotik_user_id
						);
					} catch (error) {
						console.warn(
							`⚠️ Could not remove voucher ${voucher.username} from MikroTik:`,
							error
						);
					}
				}
			}

			// Delete vouchers from database
			await db.delete(vouchers).where(eq(vouchers.batch_id, batchId));

			// Delete batch from database
			await db.delete(voucher_batches).where(eq(voucher_batches.id, batchId));

			console.log(
				`✅ Voucher batch '${batch.batch_name}' and ${batchVouchers.length} vouchers deleted`
			);
		} catch (error) {
			console.error("❌ Error deleting voucher batch:", error);
			throw error;
		}
	}

	// ============ SESSION TRACKING ============

	async syncActiveSessions(routerId: number): Promise<void> {
		try {
			await this.connect();

			// Get active sessions from MikroTik
			const mikrotikSessions = await this.connectedApi!.menu(
				"/ip/hotspot/active"
			).get();

			// Get current database sessions
			const dbSessions = await db.query.hotspot_active_sessions.findMany({
				where: (has, { eq }) => eq(has.router_id, routerId),
			});

			// Create map for quick lookup
			const dbSessionMap = new Map(
				dbSessions.map((session) => [session.session_id, session])
			);

			// Update/Insert sessions from MikroTik
			for (const mikrotikSession of mikrotikSessions) {
				const sessionData: NewHotspotActiveSession = {
					router_id: routerId,
					session_id: mikrotikSession[".id"],
					username: mikrotikSession.user,
					status: "active",
					address: mikrotikSession.address,
					mac_address: mikrotikSession["mac-address"],
					uptime: mikrotikSession.uptime,
					server: mikrotikSession.server,
					login_time: new Date(), // You might want to parse this from uptime
					last_update: new Date(),
					bytes_in: parseInt(mikrotikSession["bytes-in"]) || 0,
					bytes_out: parseInt(mikrotikSession["bytes-out"]) || 0,
					packets_in: parseInt(mikrotikSession["packets-in"]) || 0,
					packets_out: parseInt(mikrotikSession["packets-out"]) || 0,
				};

				const existingSession = dbSessionMap.get(mikrotikSession[".id"]);

				if (existingSession) {
					// Update existing session
					await db
						.update(hotspot_active_sessions)
						.set({
							...sessionData,
							updated_at: new Date(),
						})
						.where(eq(hotspot_active_sessions.id, existingSession.id));
				} else {
					// Insert new session
					await db.insert(hotspot_active_sessions).values(sessionData);
				}

				dbSessionMap.delete(mikrotikSession[".id"]);
			}

			// Mark remaining sessions as terminated
			for (const [sessionId, session] of dbSessionMap) {
				await db
					.update(hotspot_active_sessions)
					.set({
						status: "terminated",
						updated_at: new Date(),
					})
					.where(eq(hotspot_active_sessions.id, session.id));
			}

			console.log(
				`✅ Synced ${mikrotikSessions.length} active sessions for router ${routerId}`
			);
		} catch (error) {
			console.error("❌ Error syncing active sessions:", error);
			throw error;
		}
	}

	// ============ STATISTICS & MONITORING ============

	async getHotspotStatus(routerId: number): Promise<any> {
		await this.connect();

		try {
			const [hotspotServers, activeUsers] = await Promise.all([
				this.connectedApi!.menu("/ip/hotspot").get(),
				this.getActiveUsers(routerId),
			]);

			return {
				servers: hotspotServers,
				activeUsers: activeUsers.length,
				activeUserDetails: activeUsers,
			};
		} catch (error) {
			console.error("❌ Error getting hotspot status:", error);
			throw error;
		}
	}

	async getVoucherStats(routerId: number): Promise<{
		total: number;
		unused: number;
		used: number;
		expired: number;
	}> {
		const stats = await db
			.select({
				status: vouchers.voucher_status,
				count: count(),
			})
			.from(vouchers)
			.where(eq(vouchers.router_id, routerId))
			.groupBy(vouchers.voucher_status);

		const result = {
			total: 0,
			unused: 0,
			used: 0,
			expired: 0,
		};

		stats.forEach((stat) => {
			result.total += stat.count;
			switch (stat.status) {
				case "unused":
					result.unused = stat.count;
					break;
				case "used":
					result.used = stat.count;
					break;
				case "expired":
					result.expired = stat.count;
					break;
			}
		});

		return result;
	}

	async getHotspotStats(routerId: number): Promise<{
		profiles: number;
		users: number;
		activeUsers: number;
		vouchers: {
			total: number;
			unused: number;
			used: number;
			expired: number;
		};
	}> {
		try {
			const [profiles, users, activeUsers, voucherStats] = await Promise.all([
				this.getProfiles(routerId),
				this.getUsers(routerId),
				this.getActiveUsers(routerId),
				this.getVoucherStats(routerId),
			]);

			return {
				profiles: profiles.length,
				users: users.length,
				activeUsers: activeUsers.length,
				vouchers: voucherStats,
			};
		} catch (error) {
			console.error("❌ Error getting hotspot statistics:", error);
			throw error;
		}
	}
}

export const createMikrotikHotspot = MikrotikHotspot.createFromDatabase;
