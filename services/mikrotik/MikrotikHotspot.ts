import { db } from "@/lib/db/index";
import {
	session_profiles,
	session_users,
	voucher_batches,
	vouchers,
	type SessionProfile,
	type NewSessionProfile,
	type SessionUser,
	type NewSessionUser,
	type VoucherBatch,
	type NewVoucherBatch,
	type Voucher,
	type NewVoucher,
} from "@/database/schema/mikrotik";
import { eq, and, desc, count } from "drizzle-orm";
import { MikrotikClient } from "../../lib/mikrotik/client";

export interface HotspotProfile {
	name: string;
	sessionTimeout?: string;
	idleTimeout?: string;
	keepaliveTimeout?: string;
	statusAutorefresh?: string;
	sharedUsers?: number;
	rateLimit?: string;
	transparentProxy?: boolean;
	addressList?: string;
	macCookieTimeout?: string;
	addMacCookie?: boolean;
	comment?: string;
}

export interface HotspotUser {
	name: string;
	password?: string;
	profile?: string;
	limitUptime?: string;
	limitBytesIn?: number;
	limitBytesOut?: number;
	limitBytesTotal?: number;
	comment?: string;
}

export interface VoucherConfig {
	length?: number;
	prefix?: string;
	suffix?: string;
	characters?: string; // Changed from 'charset' to match form field
	passwordMode?: 'same_as_username' | 'random' | 'custom'; // Added custom mode
	customPassword?: string; // For custom password
}

export interface SingleVoucherConfig {
	router_id: number;
	profile_id?: number;
	username: string; // Custom username
	password?: string; // Custom password (optional, will use same_as_username if not provided)
	comment?: string;
	created_by?: number;
}

export interface BulkVoucherConfig extends VoucherConfig {
	total_generated: number; // Changed from 'count' to match form field
	batch_name: string; // Changed from 'batchName' to match form field
	router_id: number; // Added router_id field
	profile_id?: number; // Changed from 'profileId' to match form field, made optional
	comment?: string;
	created_by?: number; // Made optional
	generation_mode?: 'random' | 'sequential'; // Added generation mode
}


export class MikrotikHotspot extends MikrotikClient {
	// ============ PROFILE MANAGEMENT ============

	/**
	 * Create hotspot profile - Database first approach
	 */
	async createProfile(
		routerId: number,
		profileData: HotspotProfile,
		userId?: number
	): Promise<SessionProfile> {
		let createdProfile: SessionProfile | null = null;

		try {
			// 1. Validate router exists and is active
			const router = await db.query.routers.findFirst({
				where: (r, { eq, and }) =>
					and(eq(r.id, routerId), eq(r.is_active, true)),
			});

			if (!router) {
				throw new Error(`Router with ID ${routerId} not found or inactive`);
			}

			// 2. Check if profile name already exists for this router
			const existingProfile = await db.query.session_profiles.findFirst({
				where: (sp, { eq, and }) =>
					and(
						eq(sp.router_id, routerId),
						eq(sp.name, profileData.name),
						eq(sp.type, "hotspot")
					),
			});

			if (existingProfile) {
				throw new Error(
					`Hotspot profile '${profileData.name}' already exists on this router`
				);
			}

			// 3. Prepare database record
			const newProfile: NewSessionProfile = {
				router_id: routerId,
				name: profileData.name,
				type: "hotspot",
				network_config: {},
				bandwidth_config: {
					rateLimit: profileData.rateLimit,
				},
				timeout_config: {
					sessionTimeout: profileData.sessionTimeout,
					idleTimeout: profileData.idleTimeout,
					keepaliveTimeout: profileData.keepaliveTimeout,
					statusAutorefresh: profileData.statusAutorefresh,
				},
				limits: {},
				security_config: {
					transparentProxy: profileData.transparentProxy,
					addressList: profileData.addressList,
				},
				advanced_config: {
					sharedUsers: profileData.sharedUsers,
					addMacCookie: profileData.addMacCookie,
					macCookieTimeout: profileData.macCookieTimeout,
				},
				comment: profileData.comment,
				synced_to_mikrotik: false,
				is_active: true,
			};

			// 4. Create in database first
			const [dbProfile] = await db
				.insert(session_profiles)
				.values(newProfile)
				.returning();

			createdProfile = dbProfile;

			console.log(
				`✅ Hotspot profile '${profileData.name}' created in database`
			);

			// 5. Create in MikroTik
			await this.connect();

			const mikrotikCommand = [
				"/ip/hotspot/user/profile/add",
				`=name=${profileData.name}`,
			];

			// Add optional parameters
			if (profileData.sessionTimeout) {
				mikrotikCommand.push(`=session-timeout=${profileData.sessionTimeout}`);
			}
			if (profileData.idleTimeout) {
				mikrotikCommand.push(`=idle-timeout=${profileData.idleTimeout}`);
			}
			if (profileData.keepaliveTimeout) {
				mikrotikCommand.push(
					`=keepalive-timeout=${profileData.keepaliveTimeout}`
				);
			}
			if (profileData.statusAutorefresh) {
				mikrotikCommand.push(
					`=status-autorefresh=${profileData.statusAutorefresh}`
				);
			}
			if (profileData.sharedUsers !== undefined) {
				mikrotikCommand.push(`=shared-users=${profileData.sharedUsers}`);
			}
			if (profileData.rateLimit) {
				mikrotikCommand.push(`=rate-limit=${profileData.rateLimit}`);
			}
			if (profileData.transparentProxy !== undefined) {
				mikrotikCommand.push(
					`=transparent-proxy=${profileData.transparentProxy ? "yes" : "no"}`
				);
			}
			if (profileData.addressList) {
				mikrotikCommand.push(`=address-list=${profileData.addressList}`);
			}
			if (profileData.macCookieTimeout) {
				mikrotikCommand.push(
					`=mac-cookie-timeout=${profileData.macCookieTimeout}`
				);
			}
			if (profileData.addMacCookie !== undefined) {
				mikrotikCommand.push(
					`=add-mac-cookie=${profileData.addMacCookie ? "yes" : "no"}`
				);
			}
			if (profileData.comment) {
				mikrotikCommand.push(`=comment=${profileData.comment}`);
			}

			const result = await this.connectedApi!.menu(
				"/ip/hotspot/user/profile"
			).add(
				mikrotikCommand.slice(1).reduce((acc, param) => {
					const [key, value] = param.split("=");
					acc[key.replace("=", "")] = value;
					return acc;
				}, {} as any)
			);

			// 6. Update database with MikroTik ID and sync status
			await db
				.update(session_profiles)
				.set({
					mikrotik_id: result.ret,
					synced_to_mikrotik: true,
					updated_at: new Date(),
				})
				.where(eq(session_profiles.id, dbProfile.id));

			console.log(
				`✅ Hotspot profile '${profileData.name}' synced to MikroTik with ID: ${result.ret}`
			);

			return {
				...dbProfile,
				mikrotik_id: result.ret,
				synced_to_mikrotik: true,
			};
		} catch (error) {
			console.error("❌ Error creating hotspot profile:", error);

			// Rollback: Delete from database if MikroTik creation failed
			if (createdProfile) {
				try {
					await db
						.delete(session_profiles)
						.where(eq(session_profiles.id, createdProfile.id));
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

	/**
	 * Get all hotspot profiles for a router
	 */
	async getProfiles(routerId: number): Promise<SessionProfile[]> {
		return await db.query.session_profiles.findMany({
			where: (sp, { eq, and }) =>
				and(
					eq(sp.router_id, routerId),
					eq(sp.type, "hotspot"),
					eq(sp.is_active, true)
				),
			orderBy: (sp, { asc }) => [asc(sp.name)],
		});
	}

	/**
	 * Update hotspot profile
	 */
	async updateProfile(
		profileId: number,
		profileData: Partial<HotspotProfile>
	): Promise<SessionProfile> {
		const profile = await db.query.session_profiles.findFirst({
			where: (sp, { eq }) => eq(sp.id, profileId),
		});

		if (!profile) {
			throw new Error(`Profile with ID ${profileId} not found`);
		}

		if (!profile.mikrotik_id) {
			throw new Error("Profile is not synced to MikroTik");
		}

		try {
			// Update in MikroTik first
			await this.connect();

			const updateParams: any = {};

			if (profileData.sessionTimeout)
				updateParams["session-timeout"] = profileData.sessionTimeout;
			if (profileData.idleTimeout)
				updateParams["idle-timeout"] = profileData.idleTimeout;
			if (profileData.keepaliveTimeout)
				updateParams["keepalive-timeout"] = profileData.keepaliveTimeout;
			if (profileData.statusAutorefresh)
				updateParams["status-autorefresh"] = profileData.statusAutorefresh;
			if (profileData.sharedUsers !== undefined)
				updateParams["shared-users"] = profileData.sharedUsers;
			if (profileData.rateLimit)
				updateParams["rate-limit"] = profileData.rateLimit;
			if (profileData.transparentProxy !== undefined)
				updateParams["transparent-proxy"] = profileData.transparentProxy
					? "yes"
					: "no";
			if (profileData.addressList)
				updateParams["address-list"] = profileData.addressList;
			if (profileData.macCookieTimeout)
				updateParams["mac-cookie-timeout"] = profileData.macCookieTimeout;
			if (profileData.addMacCookie !== undefined)
				updateParams["add-mac-cookie"] = profileData.addMacCookie
					? "yes"
					: "no";
			if (profileData.comment) updateParams["comment"] = profileData.comment;

			if (Object.keys(updateParams).length > 0) {
				await this.connectedApi!.menu("/ip/hotspot/user/profile").update(
					updateParams,
					profile.mikrotik_id
				);
			}

			// Update in database
			const updatedConfig = {
				bandwidth_config: {
					...(profile.bandwidth_config as any),
					rateLimit:
						profileData.rateLimit ??
						(profile.bandwidth_config as any)?.rateLimit,
				},
				timeout_config: {
					...(profile.timeout_config as any),
					sessionTimeout:
						profileData.sessionTimeout ??
						(profile.timeout_config as any)?.sessionTimeout,
					idleTimeout:
						profileData.idleTimeout ??
						(profile.timeout_config as any)?.idleTimeout,
					keepaliveTimeout:
						profileData.keepaliveTimeout ??
						(profile.timeout_config as any)?.keepaliveTimeout,
					statusAutorefresh:
						profileData.statusAutorefresh ??
						(profile.timeout_config as any)?.statusAutorefresh,
				},
				security_config: {
					...(profile.security_config as any),
					transparentProxy:
						profileData.transparentProxy ??
						(profile.security_config as any)?.transparentProxy,
					addressList:
						profileData.addressList ??
						(profile.security_config as any)?.addressList,
				},
				advanced_config: {
					...(profile.advanced_config as any),
					sharedUsers:
						profileData.sharedUsers ??
						(profile.advanced_config as any)?.sharedUsers,
					addMacCookie:
						profileData.addMacCookie ??
						(profile.advanced_config as any)?.addMacCookie,
					macCookieTimeout:
						profileData.macCookieTimeout ??
						(profile.advanced_config as any)?.macCookieTimeout,
				},
			};

			const [updatedProfile] = await db
				.update(session_profiles)
				.set({
					bandwidth_config: updatedConfig.bandwidth_config,
					timeout_config: updatedConfig.timeout_config,
					security_config: updatedConfig.security_config,
					advanced_config: updatedConfig.advanced_config,
					comment: profileData.comment ?? profile.comment,
					updated_at: new Date(),
				})
				.where(eq(session_profiles.id, profileId))
				.returning();

			console.log(`✅ Hotspot profile '${profile.name}' updated successfully`);
			return updatedProfile;
		} catch (error) {
			console.error("❌ Error updating hotspot profile:", error);
			throw error;
		}
	}

	/**
	 * Delete hotspot profile
	 */
	async deleteProfile(profileId: number): Promise<void> {
		const profile = await db.query.session_profiles.findFirst({
			where: (sp, { eq }) => eq(sp.id, profileId),
		});

		if (!profile) {
			throw new Error(`Profile with ID ${profileId} not found`);
		}

		try {
			// Delete from MikroTik first if synced
			if (profile.mikrotik_id) {
				await this.connect();
				await this.connectedApi!.menu("/ip/hotspot/user/profile").remove(
					profile.mikrotik_id
				);
				console.log(
					`✅ Hotspot profile '${profile.name}' removed from MikroTik`
				);
			}

			// Soft delete in database
			await db
				.update(session_profiles)
				.set({
					is_active: false,
					synced_to_mikrotik: false,
					updated_at: new Date(),
				})
				.where(eq(session_profiles.id, profileId));

			console.log(
				`✅ Hotspot profile '${profile.name}' deactivated in database`
			);
		} catch (error) {
			console.error("❌ Error deleting hotspot profile:", error);
			throw error;
		}
	}

	// ============ USER MANAGEMENT ============

	/**
	 * Create hotspot user - Database first approach
	 */
	async createUser(
		routerId: number,
		userData: HotspotUser,
		customerId?: number
	): Promise<SessionUser> {
		let createdUser: SessionUser | null = null;

		try {
			// 1. Validate router exists and is active
			const router = await db.query.routers.findFirst({
				where: (r, { eq, and }) =>
					and(eq(r.id, routerId), eq(r.is_active, true)),
			});

			if (!router) {
				throw new Error(`Router with ID ${routerId} not found or inactive`);
			}

			// 2. Validate profile exists if specified
			let profileId: number | undefined;
			if (userData.profile) {
				const profile = await db.query.session_profiles.findFirst({
					where: (sp, { eq, and }) =>
						and(
							eq(sp.router_id, routerId),
							eq(sp.name, userData.profile ?? ""),
							eq(sp.type, "hotspot"),
							eq(sp.is_active, true)
						),
				});

				if (!profile) {
					throw new Error(`Hotspot profile '${userData.profile}' not found`);
				}
				profileId = profile.id;
			}

			// 3. Check if username already exists for this router
			const existingUser = await db.query.session_users.findFirst({
				where: (su, { eq, and }) =>
					and(
						eq(su.router_id, routerId),
						eq(su.name, userData.name),
						eq(su.type, "hotspot")
					),
			});

			if (existingUser) {
				throw new Error(
					`Hotspot user '${userData.name}' already exists on this router`
				);
			}

			// 4. Prepare database record
			const newUser: NewSessionUser = {
				router_id: routerId,
				profile_id: profileId,
				customer_id: customerId,
				name: userData.name,
				password: userData.password,
				type: "hotspot",
				network_config: {},
				limits: {
					limitUptime: userData.limitUptime,
					limitBytesIn: userData.limitBytesIn,
					limitBytesOut: userData.limitBytesOut,
					limitBytesTotal: userData.limitBytesTotal,
				},
				usage_stats: {
					bytesIn: 0,
					bytesOut: 0,
					sessionCount: 0,
					lastLogin: null,
				},
				comment: userData.comment,
				synced_to_mikrotik: false,
				is_active: true,
			};

			// 5. Create in database first
			const [dbUser] = await db
				.insert(session_users)
				.values(newUser)
				.returning();

			createdUser = dbUser;

			console.log(`✅ Hotspot user '${userData.name}' created in database`);

			// 6. Create in MikroTik
			await this.connect();

			const mikrotikParams: any = {
				name: userData.name,
			};

			if (userData.password) mikrotikParams.password = userData.password;
			if (userData.profile) mikrotikParams.profile = userData.profile;
			if (userData.limitUptime)
				mikrotikParams["limit-uptime"] = userData.limitUptime;
			if (userData.limitBytesIn)
				mikrotikParams["limit-bytes-in"] = userData.limitBytesIn;
			if (userData.limitBytesOut)
				mikrotikParams["limit-bytes-out"] = userData.limitBytesOut;
			if (userData.limitBytesTotal)
				mikrotikParams["limit-bytes-total"] = userData.limitBytesTotal;
			if (userData.comment) mikrotikParams.comment = userData.comment;

			const result = await this.connectedApi!.menu("/ip/hotspot/user").add(
				mikrotikParams
			);

			// 7. Update database with MikroTik ID and sync status
			await db
				.update(session_users)
				.set({
					mikrotik_id: result.ret,
					synced_to_mikrotik: true,
					updated_at: new Date(),
				})
				.where(eq(session_users.id, dbUser.id));

			console.log(
				`✅ Hotspot user '${userData.name}' synced to MikroTik with ID: ${result.ret}`
			);

			return { ...dbUser, mikrotik_id: result.ret, synced_to_mikrotik: true };
		} catch (error) {
			console.error("❌ Error creating hotspot user:", error);

			// Rollback: Delete from database if MikroTik creation failed
			if (createdUser) {
				try {
					await db
						.delete(session_users)
						.where(eq(session_users.id, createdUser.id));
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

	/**
	 * Get active hotspot users
	 */
	async getActiveUsers(routerId: number): Promise<any[]> {
		await this.connect();

		try {
			const activeUsers = await this.connectedApi!.menu(
				"/ip/hotspot/active"
			).get();
			return activeUsers;
		} catch (error) {
			console.error("❌ Error getting active hotspot users:", error);
			throw error;
		}
	}

	/**
	 * Get all hotspot users for a router from database
	 */
	async getUsers(routerId: number): Promise<SessionUser[]> {
		return await db.query.session_users.findMany({
			where: (su, { eq, and }) =>
				and(
					eq(su.router_id, routerId),
					eq(su.type, "hotspot"),
					eq(su.is_active, true)
				),
			orderBy: (su, { desc }) => [desc(su.created_at)],
		});
	}

	/**
	 * Disconnect hotspot user
	 */
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

			console.log(
				`✅ Disconnected ${activeSessions.length} session(s) for user '${username}'`
			);
		} catch (error) {
			console.error("❌ Error disconnecting hotspot user:", error);
			throw error;
		}
	}

	// ============ VOUCHER MANAGEMENT ============

	/**
	 * Generate random string for voucher
	 */
	private generateVoucherCode(config: VoucherConfig = {}): string {
		const {
			length = 8,
			prefix = "",
			suffix = "",
			characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", // Updated default
		} = config;

		let result = prefix;
		for (let i = 0; i < length; i++) {
			result += characters.charAt(
				Math.floor(Math.random() * characters.length)
			);
		}
		result += suffix;

		return result;
	}

	/**
	 * Generate password based on mode
	 */
	private generatePassword(
		username: string,
		config: VoucherConfig = {}
	): string {
		const { passwordMode = "same_as_username", customPassword } = config;

		switch (passwordMode) {
			case "same_as_username":
				return username;
			case "custom":
				return customPassword || username; // Fallback to username if custom password not provided
			case "random":
			default:
				// Generate random password with same config as username
				return this.generateVoucherCode({
					length: config.length,
					prefix: "",
					suffix: "",
					characters: config.characters,
				});
		}
	}

	/**
	 * Create single voucher with custom username/password - Database first approach
	 */
	async createSingleVoucher(
		voucherConfig: SingleVoucherConfig
	): Promise<Voucher> {
		let createdVoucher: Voucher | null = null;

		try {
			// 1. Validate router exists and is active
			const router = await db.query.routers.findFirst({
				where: (r, { eq, and }) =>
					and(eq(r.id, voucherConfig.router_id), eq(r.is_active, true)),
			});

			if (!router) {
				throw new Error(
					`Router with ID ${voucherConfig.router_id} not found or inactive`
				);
			}

			// 2. Validate profile exists if specified
			let profile: SessionProfile | undefined;
			if (voucherConfig.profile_id) {
				profile = await db.query.session_profiles.findFirst({
					where: (sp, { eq, and }) =>
						and(
							eq(sp.id, voucherConfig.profile_id!),
							eq(sp.router_id, voucherConfig.router_id),
							eq(sp.type, "hotspot"),
							eq(sp.is_active, true)
						),
				});

				if (!profile) {
					throw new Error(
						`Hotspot profile with ID ${voucherConfig.profile_id} not found`
					);
				}
			}

			// 3. Check if username already exists for this router
			const existingVoucher = await db.query.vouchers.findFirst({
				where: (v, { eq, and }) =>
					and(
						eq(v.router_id, voucherConfig.router_id),
						eq((v.general as any).name, voucherConfig.username)
					),
			});

			if (existingVoucher) {
				throw new Error(
					`Voucher with username '${voucherConfig.username}' already exists on this router`
				);
			}

			// 4. Determine password
			const password = voucherConfig.password || voucherConfig.username; // Use same_as_username if no password provided

			// 5. Prepare database record
			const newVoucher: NewVoucher = {
				router_id: voucherConfig.router_id,
				session_profiles_id: voucherConfig.profile_id || null,
				general: {
					name: voucherConfig.username,
					password: password,
				},
				comment:
					voucherConfig.comment ||
					`Custom voucher created at ${new Date().toISOString()}`,
				limits: profile
					? {
							limit_uptime: (profile.timeout_config as any)?.sessionTimeout,
							limit_bytes_total: (profile.bandwidth_config as any)?.dataLimit,
					  }
					: {},
				statistics: {
					used_count: 0,
					used_bytes_in: 0,
					used_bytes_out: 0,
					last_used: null,
				},
				status: "unused",
				created_by: voucherConfig.created_by,
				synced_to_mikrotik: false,
			};

			// 6. Create in database first
			const [dbVoucher] = await db
				.insert(vouchers)
				.values(newVoucher)
				.returning();

			createdVoucher = dbVoucher;

			console.log(
				`✅ Single voucher '${voucherConfig.username}' created in database`
			);

			// 7. Create in MikroTik
			await this.connect();

			const mikrotikParams: any = {
				name: voucherConfig.username,
				password: password,
				comment:
					voucherConfig.comment ||
					`Custom voucher - ${new Date().toISOString()}`,
			};

			// Add profile if specified
			if (profile) {
				mikrotikParams.profile = profile.name;
			}

			const result = await this.connectedApi!.menu("/ip/hotspot/user").add(
				mikrotikParams
			);

			// 8. Update database with MikroTik ID and sync status
			await db
				.update(vouchers)
				.set({
					mikrotik_id: result.ret,
					synced_to_mikrotik: true,
					updated_at: new Date(),
				})
				.where(eq(vouchers.id, dbVoucher.id));

			console.log(
				`✅ Single voucher '${voucherConfig.username}' synced to MikroTik with ID: ${result.ret}`
			);

			return {
				...dbVoucher,
				mikrotik_id: result.ret,
				synced_to_mikrotik: true,
			};
		} catch (error) {
			console.error("❌ Error creating single voucher:", error);

			// Rollback: Delete from database if MikroTik creation failed
			if (createdVoucher) {
				try {
					await db.delete(vouchers).where(eq(vouchers.id, createdVoucher.id));
					console.log(
						`🔄 Rolled back database record for voucher '${voucherConfig.username}'`
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

	/**
	 * Check if voucher code is unique
	 */
	private async isVoucherCodeUnique(
		routerId: number,
		code: string
	): Promise<boolean> {
		const existing = await db.query.vouchers.findFirst({
			where: (v, { eq, and }) =>
				and(eq(v.router_id, routerId), eq(v.general as any, { name: code })),
		});
		return !existing;
	}

	/**
	 * Create single voucher - Database first approach
	 */
	async createVoucher(
		routerId: number,
		profileName: string,
		voucherConfig: Partial<VoucherConfig> = {},
		customCode?: string,
		comment?: string,
		createdBy?: number
	): Promise<Voucher> {
		let createdVoucher: Voucher | null = null;

		try {
			// 1. Validate router and profile
			const router = await db.query.routers.findFirst({
				where: (r, { eq, and }) =>
					and(eq(r.id, routerId), eq(r.is_active, true)),
			});

			if (!router) {
				throw new Error(`Router with ID ${routerId} not found or inactive`);
			}

			const profile = await db.query.session_profiles.findFirst({
				where: (sp, { eq, and }) =>
					and(
						eq(sp.router_id, routerId),
						eq(sp.name, profileName),
						eq(sp.type, "hotspot"),
						eq(sp.is_active, true)
					),
			});

			if (!profile) {
				throw new Error(`Hotspot profile '${profileName}' not found`);
			}

			// 2. Generate unique voucher code
			let voucherCode = customCode;
			if (!voucherCode) {
				let attempts = 0;
				do {
					voucherCode = this.generateVoucherCode(voucherConfig);
					attempts++;
				} while (
					!(await this.isVoucherCodeUnique(routerId, voucherCode)) &&
					attempts < 100
				);

				if (attempts >= 100) {
					throw new Error(
						"Failed to generate unique voucher code after 100 attempts"
					);
				}
			} else {
				// Check if custom code is unique
				if (!(await this.isVoucherCodeUnique(routerId, voucherCode))) {
					throw new Error(`Voucher code '${voucherCode}' already exists`);
				}
			}

			// 3. Prepare database record
			const newVoucher: NewVoucher = {
				router_id: routerId,
				session_profiles_id: profile.id,
				general: {
					name: voucherCode,
					password: voucherCode, // Use same as username for hotspot vouchers
				},
				comment,
				limits: {
					limit_uptime: (profile.timeout_config as any)?.sessionTimeout,
					limit_bytes_total: (profile.bandwidth_config as any)?.dataLimit,
				},
				statistics: {
					used_count: 0,
					used_bytes_in: 0,
					used_bytes_out: 0,
					last_used: null,
				},
				status: "unused",
				created_by: createdBy,
				synced_to_mikrotik: false,
			};

			// 4. Create in database first
			const [dbVoucher] = await db
				.insert(vouchers)
				.values(newVoucher)
				.returning();

			createdVoucher = dbVoucher;

			console.log(`✅ Voucher '${voucherCode}' created in database`);

			// 5. Create in MikroTik as hotspot user
			await this.connect();

			const mikrotikParams: any = {
				name: voucherCode,
				password: voucherCode,
				profile: profileName,
				comment: comment || `Voucher created at ${new Date().toISOString()}`,
			};

			const result = await this.connectedApi!.menu("/ip/hotspot/user").add(
				mikrotikParams
			);

			// 6. Update database with MikroTik ID and sync status
			await db
				.update(vouchers)
				.set({
					mikrotik_id: result.ret,
					synced_to_mikrotik: true,
					updated_at: new Date(),
				})
				.where(eq(vouchers.id, dbVoucher.id));

			console.log(
				`✅ Voucher '${voucherCode}' synced to MikroTik with ID: ${result.ret}`
			);

			return {
				...dbVoucher,
				mikrotik_id: result.ret,
				synced_to_mikrotik: true,
			};
		} catch (error) {
			console.error("❌ Error creating voucher:", error);

			// Rollback: Delete from database if MikroTik creation failed
			if (createdVoucher) {
				try {
					await db.delete(vouchers).where(eq(vouchers.id, createdVoucher.id));
					console.log(`🔄 Rolled back database record for voucher`);
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

	/**
	 * Create bulk vouchers - Database first approach
	 */
	async createBulkVouchers(bulkConfig: BulkVoucherConfig): Promise<{
		batch: VoucherBatch;
		vouchers?: Voucher[];
		failed: Array<{ code: string; error: string }>;
	}> {
		let createdBatch: VoucherBatch | null = null;
		const createdVouchers: Voucher[] = [];
		const failed: Array<{ code: string; error: string }> = [];

		try {
			// 1. Validate router exists and is active
			const router = await db.query.routers.findFirst({
				where: (r, { eq, and }) =>
					and(eq(r.id, bulkConfig.router_id), eq(r.is_active, true)),
			});

			if (!router) {
				throw new Error(
					`Router with ID ${bulkConfig.router_id} not found or inactive`
				);
			}

			// 2. Validate profile exists if specified (profile is now optional)
			let profile: SessionProfile | undefined;
			if (bulkConfig.profile_id) {
				profile = await db.query.session_profiles.findFirst({
					where: (sp, { eq, and }) =>
						and(
							eq(sp.id, bulkConfig.profile_id!),
							eq(sp.router_id, bulkConfig.router_id),
							eq(sp.type, "hotspot"),
							eq(sp.is_active, true)
						),
				});

				if (!profile) {
					throw new Error(
						`Hotspot profile with ID ${bulkConfig.profile_id} not found`
					);
				}
			}

			// 3. Create batch record first
			const newBatch: NewVoucherBatch = {
				router_id: bulkConfig.router_id,
				profile_id: bulkConfig.profile_id || null, // Allow null for optional profile
				batch_name: bulkConfig.batch_name,
				generation_config: {
					length: bulkConfig.length || 8,
					prefix: bulkConfig.prefix || "",
					suffix: bulkConfig.suffix || "",
					characters:
						bulkConfig.characters ||
						"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
					passwordMode: bulkConfig.passwordMode || "same_as_username",
					generation_mode: bulkConfig.generation_mode || "random",
					count: bulkConfig.total_generated, // Map total_generated to count for storage
				},
				total_generated: 0, // Will be updated after generation
				comment: bulkConfig.comment,
				created_by: bulkConfig.created_by,
				is_active: true,
			};

			const [dbBatch] = await db
				.insert(voucher_batches)
				.values(newBatch)
				.returning();

			createdBatch = dbBatch;
			console.log(
				`✅ Voucher batch '${bulkConfig.batch_name}' created in database`
			);

			// 4. Connect to MikroTik
			await this.connect();

			// 5. Generate and create vouchers
			for (let i = 0; i < bulkConfig.total_generated; i++) {
				try {
					// Generate unique username based on generation mode
					let voucherCode: string;
					let attempts = 0;

					if (bulkConfig.generation_mode === "sequential") {
						// Sequential generation with prefix + number
						const basePrefix = bulkConfig.prefix || "VOUCHER";
						const sequenceNumber = (i + 1).toString().padStart(4, "0"); // 0001, 0002, etc.
						voucherCode = `${basePrefix}${sequenceNumber}`;

						// Check if it's unique
						if (
							!(await this.isVoucherCodeUnique(
								bulkConfig.router_id,
								voucherCode
							))
						) {
							failed.push({
								code: voucherCode,
								error: "Sequential voucher code already exists",
							});
							continue;
						}
					} else {
						// Random generation (default)
						do {
							voucherCode = this.generateVoucherCode({
								length: bulkConfig.length,
								prefix: bulkConfig.prefix,
								suffix: bulkConfig.suffix,
								characters: bulkConfig.characters,
							});
							attempts++;
						} while (
							!(await this.isVoucherCodeUnique(
								bulkConfig.router_id,
								voucherCode
							)) &&
							attempts < 10
						);

						if (attempts >= 10) {
							failed.push({
								code: `attempt-${i}`,
								error: "Failed to generate unique code after 10 attempts",
							});
							continue;
						}
					}

					// Generate password based on mode
					const password = this.generatePassword(voucherCode, {
						length: bulkConfig.length,
						characters: bulkConfig.characters,
						passwordMode: bulkConfig.passwordMode,
						customPassword: bulkConfig.customPassword,
					});

					// Create voucher in database
					const newVoucher: NewVoucher = {
						router_id: bulkConfig.router_id,
						batch_id: dbBatch.id,
						session_profiles_id: bulkConfig.profile_id || null, // Allow null
						general: {
							name: voucherCode,
							password: password,
						},
						comment: `Batch: ${bulkConfig.batch_name}`,
						limits: profile
							? {
									limit_uptime: (profile.timeout_config as any)?.sessionTimeout,
									limit_bytes_total: (profile.bandwidth_config as any)
										?.dataLimit,
							  }
							: {}, // Empty limits if no profile
						statistics: {
							used_count: 0,
							used_bytes_in: 0,
							used_bytes_out: 0,
							last_used: null,
						},
						status: "unused",
						created_by: bulkConfig.created_by,
						synced_to_mikrotik: false,
					};

					const [dbVoucher] = await db
						.insert(vouchers)
						.values(newVoucher)
						.returning();

					// Create in MikroTik
					try {
						const mikrotikParams: any = {
							name: voucherCode,
							password: password,
							comment: `Batch: ${
								bulkConfig.batch_name
							} - ${new Date().toISOString()}`,
						};

						// Add profile if specified
						if (profile) {
							mikrotikParams.profile = profile.name;
						}

						const result = await this.connectedApi!.menu(
							"/ip/hotspot/user"
						).add(mikrotikParams);

						// Update with MikroTik ID
						await db
							.update(vouchers)
							.set({
								mikrotik_id: result.ret,
								synced_to_mikrotik: true,
								updated_at: new Date(),
							})
							.where(eq(vouchers.id, dbVoucher.id));

						createdVouchers.push({
							...dbVoucher,
							mikrotik_id: result.ret,
							synced_to_mikrotik: true,
						});

						console.log(
							`✅ Voucher ${i + 1}/${
								bulkConfig.total_generated
							} created: ${voucherCode}`
						);
					} catch (mikrotikError: any) {
						console.error(
							`❌ Failed to create voucher '${voucherCode}' in MikroTik:`,
							mikrotikError
						);

						// Delete from database since MikroTik creation failed
						await db.delete(vouchers).where(eq(vouchers.id, dbVoucher.id));
						failed.push({
							code: voucherCode,
							error: `MikroTik error: ${
								mikrotikError.message || mikrotikError
							}`,
						});
					}
				} catch (error: any) {
					console.error(`❌ Failed to create voucher ${i + 1}:`, error);
					failed.push({
						code: `voucher-${i + 1}`,
						error: error.message || error.toString(),
					});
				}
			}

			// 6. Update batch with total generated
			const finalBatch = await db
				.update(voucher_batches)
				.set({
					total_generated: createdVouchers.length,
					updated_at: new Date(),
				})
				.where(eq(voucher_batches.id, dbBatch.id))
				.returning();

			console.log(
				`✅ Bulk voucher creation completed: ${createdVouchers.length} created, ${failed.length} failed`
			);

			return {
				batch: finalBatch[0],
				vouchers: createdVouchers,
				failed,
			};
		} catch (error) {
			console.error("❌ Error creating bulk vouchers:", error);

			// Rollback: Delete batch and any created vouchers if critical error
			if (createdBatch) {
				try {
					// Delete vouchers first (foreign key constraint)
					if (createdVouchers.length > 0) {
						await db
							.delete(vouchers)
							.where(eq(vouchers.batch_id, createdBatch.id));
					}

					// Delete batch
					await db
						.delete(voucher_batches)
						.where(eq(voucher_batches.id, createdBatch.id));

					console.log(
						`🔄 Rolled back batch '${bulkConfig.batch_name}' and ${createdVouchers.length} vouchers`
					);
				} catch (rollbackError) {
					console.error("❌ Failed to rollback batch creation:", rollbackError);
				}
			}

			throw error;
		}
	}

	/**
	 * Get active vouchers (unused vouchers)
	 */
	async getActiveVouchers(routerId: number, limit = 50): Promise<Voucher[]> {
		return await db.query.vouchers.findMany({
			where: (v, { eq, and }) =>
				and(eq(v.router_id, routerId), eq(v.status, "unused")),
			orderBy: (v, { desc }) => [desc(v.created_at)],
			limit,
			with: {
				session_profiles: true,
				batch: true,
			},
		});
	}

	/**
	 * Get voucher usage statistics
	 */
	async getVoucherStats(routerId: number): Promise<{
		total: number;
		unused: number;
		used: number;
		expired: number;
	}> {
		const stats = await db
			.select({
				status: vouchers.status,
				count: count(),
			})
			.from(vouchers)
			.where(eq(vouchers.router_id, routerId))
			.groupBy(vouchers.status);

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

	/**
	 * Get voucher batches
	 */
	async getVoucherBatches(routerId: number): Promise<VoucherBatch[]> {
		return await db
			.select({
				id: voucher_batches.id,
				router_id: voucher_batches.router_id,
				profile_id: voucher_batches.profile_id,
				batch_name: voucher_batches.batch_name,
				generation_config: voucher_batches.generation_config,
				total_generated: voucher_batches.total_generated,
				comment: voucher_batches.comment,
				status: voucher_batches.status,
				is_active: voucher_batches.is_active,
				created_at: voucher_batches.created_at,
				updated_at: voucher_batches.updated_at,
				created_by: voucher_batches.created_by,
				profile_name: session_profiles.name, // from LEFT JOIN
			})
			.from(voucher_batches)
			.leftJoin(
				session_profiles,
				eq(voucher_batches.profile_id, session_profiles.id)
			)
			.where(eq(voucher_batches.router_id, routerId))
			.orderBy(desc(voucher_batches.created_at));
	}

	/**
	 * Delete voucher - Remove from both MikroTik and database
	 */
	async deleteVoucher(voucherId: number): Promise<void> {
		const voucher = await db.query.vouchers.findFirst({
			where: (v, { eq }) => eq(v.id, voucherId),
		});

		if (!voucher) {
			throw new Error(`Voucher with ID ${voucherId} not found`);
		}

		try {
			// Delete from MikroTik first if synced
			if (voucher.mikrotik_id) {
				await this.connect();
				await this.connectedApi!.menu("/ip/hotspot/user").remove(
					voucher.mikrotik_id
				);
				console.log(`✅ Voucher removed from MikroTik`);
			}

			// Delete from database
			await db.delete(vouchers).where(eq(vouchers.id, voucherId));

			console.log(`✅ Voucher deleted from database`);
		} catch (error) {
			console.error("❌ Error deleting voucher:", error);
			throw error;
		}
	}

	/**
	 * Mark voucher as used (when user authenticates)
	 */
	async markVoucherAsUsed(
		routerId: number,
		voucherCode: string,
		usageStats?: {
			bytesIn?: number;
			bytesOut?: number;
			sessionTime?: number;
		}
	): Promise<void> {
		const voucher = await db.query.vouchers.findFirst({
			where: (v, { eq, and }) =>
				and(
					eq(v.router_id, routerId),
					eq((v.general as any).name, voucherCode)
				),
		});

		if (!voucher) {
			throw new Error(`Voucher '${voucherCode}' not found`);
		}

		const currentStats = (voucher.statistics as any) || {};

		await db
			.update(vouchers)
			.set({
				status: "used",
				statistics: {
					...currentStats,
					used_count: (currentStats.used_count || 0) + 1,
					used_bytes_in:
						(currentStats.used_bytes_in || 0) + (usageStats?.bytesIn || 0),
					used_bytes_out:
						(currentStats.used_bytes_out || 0) + (usageStats?.bytesOut || 0),
					last_used: new Date(),
					session_time: usageStats?.sessionTime,
				},
				updated_at: new Date(),
			})
			.where(eq(vouchers.id, voucher.id));

		console.log(`✅ Voucher '${voucherCode}' marked as used`);
	}

	/**
	 * Sync vouchers from MikroTik to database
	 */
	async syncVouchersFromMikrotik(routerId: number): Promise<{
		synced: number;
		created: number;
		updated: number;
	}> {
		await this.connect();

		try {
			// Get all hotspot users from MikroTik
			const mikrotikUsers = await this.connectedApi!.menu(
				"/ip/hotspot/user"
			).get();

			let synced = 0,
				created = 0,
				updated = 0;

			for (const mikrotikUser of mikrotikUsers) {
				try {
					// Check if this user exists in our vouchers table
					const existingVoucher = await db.query.vouchers.findFirst({
						where: (v, { eq, and }) =>
							and(
								eq(v.router_id, routerId),
								eq((v.general as any).name, mikrotikUser.name)
							),
					});

					if (existingVoucher) {
						// Update existing voucher
						await db
							.update(vouchers)
							.set({
								mikrotik_id: mikrotikUser[".id"],
								synced_to_mikrotik: true,
								updated_at: new Date(),
							})
							.where(eq(vouchers.id, existingVoucher.id));
						updated++;
					} else {
						// This might be a voucher created directly in MikroTik
						// We can optionally create it in database if it follows voucher pattern
						if (
							mikrotikUser.comment?.includes("Voucher") ||
							mikrotikUser.comment?.includes("Batch")
						) {
							const newVoucher: NewVoucher = {
								router_id: routerId,
								general: {
									name: mikrotikUser.name,
									password: mikrotikUser.password || mikrotikUser.name,
								},
								comment: mikrotikUser.comment || "Synced from MikroTik",
								limits: {},
								statistics: {
									used_count: 0,
									used_bytes_in: 0,
									used_bytes_out: 0,
									last_used: null,
								},
								status: "unused",
								mikrotik_id: mikrotikUser[".id"],
								synced_to_mikrotik: true,
							};

							await db.insert(vouchers).values(newVoucher);
							created++;
						}
					}
					synced++;
				} catch (error) {
					console.error(
						`❌ Failed to sync voucher '${mikrotikUser.name}':`,
						error
					);
				}
			}

			console.log(
				`✅ Voucher sync completed: ${synced} processed, ${created} created, ${updated} updated`
			);

			return { synced, created, updated };
		} catch (error) {
			console.error("❌ Error syncing vouchers from MikroTik:", error);
			throw error;
		}
	}

	/**
	 * Clean up expired vouchers
	 */
	async cleanupExpiredVouchers(routerId: number): Promise<{
		cleaned: number;
		errors: string[];
	}> {
		const errors: string[] = [];
		let cleaned = 0;

		try {
			// Get expired vouchers (you can define your own expiry logic)
			const expiredVouchers = await db.query.vouchers.findMany({
				where: (v, { eq, and, lt }) =>
					and(eq(v.router_id, routerId), eq(v.status, "expired")),
			});

			await this.connect();

			for (const voucher of expiredVouchers) {
				try {
					// Remove from MikroTik if synced
					if (voucher.mikrotik_id) {
						await this.connectedApi!.menu("/ip/hotspot/user").remove(
							voucher.mikrotik_id
						);
					}

					// Delete from database
					await db.delete(vouchers).where(eq(vouchers.id, voucher.id));

					cleaned++;
				} catch (error) {
					errors.push(
						`Failed to clean voucher ${
							(voucher.general as any)?.name
						}: ${error}`
					);
				}
			}

			console.log(`✅ Cleanup completed: ${cleaned} expired vouchers removed`);

			return { cleaned, errors };
		} catch (error) {
			console.error("❌ Error cleaning up expired vouchers:", error);
			throw error;
		}
	}

	// ============ MONITORING & UTILITIES ============

	/**
	 * Get hotspot server status
	 */
	async getHotspotStatus(routerId: number): Promise<any> {
		await this.connect();

		try {
			const hotspotServers = await this.connectedApi!.menu("/ip/hotspot").get();
			const activeUsers = await this.getActiveUsers(routerId);

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

	/**
	 * Get hotspot statistics
	 */
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

(MikrotikHotspot as typeof MikrotikClient).createFromDatabase =
	MikrotikClient.createFromDatabase;

export const createMikrotikHotspot =
	MikrotikHotspot.createFromDatabase.bind(MikrotikHotspot);