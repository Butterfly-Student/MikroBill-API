import { db } from "@/lib/db/index";
import {
	hotspot_profiles,
	voucher_batches,
	vouchers,
	type HotspotProfile,
	type NewHotspotProfile,
	type HotspotUser,
	type HotspotVoucherBatch,
	type NewHotspotVoucherBatch,
	type HotspotVoucher,
	type NewHotspotVoucher,
	NewHotspotUser,
} from "@/database/schema/mikrotik";
import { eq, desc, count, inArray } from "drizzle-orm";
import { MikrotikClient } from "../../lib/mikrotik/client";
import { IRosOptions } from "node-routeros";
import { generateOnLoginScript } from "@/utils/mikrotik.utils";
import { MikrotikCommandGenerator } from "@/utils/mikrotik_hotspot";

export interface VoucherConfig {
	length?: number;
	prefix?: string;
	suffix?: string;
	characters?: string; // Changed from 'charset' to match form field
	passwordMode?: "same_as_username" | "random" | "custom"; // Added custom mode
	customPassword?: string; // For custom password
}

export interface SingleVoucherConfig {
	router_id: number;
	profile_id: number;
	server?: string;
	username: string; // Custom username
	password?: string; // Custom password (optional, will use same_as_username if not provided)
	comment?: string;
	created_by?: number;
}

export interface BulkVoucherConfig extends VoucherConfig {
	quantity: number; // total voucher to generate
	batch_name: string; // Changed from 'batchName' to match form field
	router_id: number; // Added router_id field
	profile_id: number; // Changed from 'profileId' to match form field, made optional
	comment?: string;
	created_by?: number; // Made optional
	generation_mode?: "random" | "sequential"; // Added generation mode
	length: number;
}

// Interface untuk bulk update config
interface BulkUpdateVoucherConfig {
	batch_id?: number; // Optional, jika tidak ada akan update berdasarkan filters
	router_id: number;
	updates: {
		profile?: string | null; // Changed to string to match schema
		comment?: string;
		voucher_status?: "unused" | "used" | "expired";
	};
	updated_by?: number;
	// Filter untuk vouchers yang akan diupdate
	filters?: {
		voucher_status?: "unused" | "used" | "expired";
		unused_only?: boolean;
		voucher_ids?: number[];
		batch_ids?: number[];
	};
}

// Interface untuk bulk delete config
interface BulkDeleteVoucherConfig {
	batch_id?: number; // Jika ingin delete satu batch
	router_id: number;
	deleted_by?: number;
	// Filter untuk vouchers yang akan dihapus
	filters?: {
		voucher_status?: "unused" | "used" | "expired";
		unused_only?: boolean;
		voucher_ids?: number[];
		batch_ids?: number[];
	};
	force_delete_active?: boolean; // Untuk menghapus voucher yang sedang digunakan
}

export class MikrotikVoucher extends MikrotikClient {
	static async createFromDatabase(
		routerId: number,
		overrideConfig?: Partial<IRosOptions>
	): Promise<MikrotikVoucher> {
		try {
			if (!routerId || routerId <= 0) {
				throw new Error("Invalid router ID provided");
			}

			// Cek cache terlebih dahulu, tapi pastikan instance adalah MikrotikVoucher
			const cachedClient = MikrotikClient.getCachedClient(routerId);
			if (cachedClient && cachedClient instanceof MikrotikVoucher) {
				console.log(
					`♻️ Using cached MikrotikVoucher client for router ${routerId}`
				);
				return cachedClient;
			}

			// Jika cached client bukan MikrotikVoucher atau tidak ada, buat yang baru
			if (cachedClient) {
				// Disconnect cached client yang bukan MikrotikVoucher
				await MikrotikClient.disconnectCachedClient(routerId);
			}

			// Dapatkan router dari database
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
				`🔌 Creating MikroTik Voucher client for router: ${router.name} (${router.hostname})`
			);

			// Buat instance MikrotikVoucher baru
			const voucherClient = new MikrotikVoucher(clientConfig);
			await voucherClient.connectWithTimeout(clientConfig.timeout || 30000);

			// Simpan ke cache dengan menggunakan workaround
			const clientCache = (MikrotikClient as any).clientCache;
			if (clientCache && clientCache instanceof Map) {
				clientCache.set(routerId, {
					client: voucherClient,
					lastUsed: new Date(),
					isConnected: true,
				});
			}

			console.log(`✅ MikrotikVoucher client cached for router ${routerId}`);

			return voucherClient;
		} catch (error) {
			console.error(
				`❌ Failed to create MikroTik Voucher client for router ${routerId}:`,
				error
			);
			// Clean up cache jika ada error
			await MikrotikClient.disconnectCachedClient(routerId);
			throw error;
		}
	}

	/**
	 * Tambahkan method connectWithTimeout ke instance
	 */
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

	private generateVoucherCode(config: VoucherConfig = {}): string {
		const {
			length = 8,
			prefix = "",
			suffix = "",
			characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
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
	): Promise<NewHotspotVoucher> {
		let createdVoucher: NewHotspotVoucher | null = null;

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
			let profile: HotspotProfile | undefined;
			if (voucherConfig.profile_id) {
				profile = await db.query.hotspot_profiles.findFirst({
					where: (sp, { eq, and }) =>
						and(
							eq(sp.id, voucherConfig.profile_id),
							eq(sp.router_id, voucherConfig.router_id),
							eq(sp.is_active, true)
						),
				});

				if (!profile) {
					throw new Error(
						`Hotspot profile with name ${voucherConfig.profile_id} not found`
					);
				}
			}

			// 3. Check if username already exists for this router
			const existingVoucher = await db.query.vouchers.findFirst({
				where: (v, { eq, and }) =>
					and(
						eq(v.router_id, voucherConfig.router_id),
						eq(v.username, voucherConfig.username)
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
			const newVoucher: NewHotspotVoucher = {
				router_id: voucherConfig.router_id,
				server: voucherConfig.server,
				profile_id: voucherConfig.profile_id,
				username: voucherConfig.username,
				password: password,
				comment: voucherConfig.comment,
				created_by: voucherConfig.created_by,
				voucher_status: "unused",
				status: "active",
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

			// Add server if specified
			if (voucherConfig.server) {
				mikrotikParams.server = voucherConfig.server;
			}

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
					mikrotik_user_id: result["id"],
					synced_to_mikrotik: true,
					updated_at: new Date(),
				})
				.where(eq(vouchers.id, dbVoucher.id));

			console.log(
				`✅ Single voucher '${voucherConfig.username}' synced to MikroTik with ID: ${result["id"]}`
			);

			return {
				...dbVoucher,
				mikrotik_user_id: result["id"],
				synced_to_mikrotik: true,
			};
		} catch (error) {
			console.error("❌ Error creating single voucher:", error);

			// Rollback: Delete from database if MikroTik creation failed
			if (createdVoucher && createdVoucher.id !== undefined) {
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
				and(eq(v.router_id, routerId), eq(v.username, code)),
		});
		return !existing;
	}

	/**
	 * Create single voucher - Database first approach
	 */
	async createVoucher(
		routerId: number,
		profileName: string,
		serverName?: string,
		voucherConfig: Partial<VoucherConfig> = {},
		customCode?: string,
		comment?: string,
		createdBy?: number
	): Promise<NewHotspotVoucher> {
		let createdVoucher: NewHotspotVoucher | null = null;

		try {
			// 1. Validate router and profile
			const router = await db.query.routers.findFirst({
				where: (r, { eq, and }) =>
					and(eq(r.id, routerId), eq(r.is_active, true)),
			});

			if (!router) {
				throw new Error(`Router with ID ${routerId} not found or inactive`);
			}

			const profile = await db.query.hotspot_profiles.findFirst({
				where: (sp, { eq, and }) =>
					and(
						eq(sp.router_id, routerId),
						eq(sp.name, profileName),
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

			// 3. Generate password
			const password = this.generatePassword(voucherCode, voucherConfig);

			// 4. Prepare database record
			const newVoucher: NewHotspotVoucher = {
				router_id: routerId,
				profile_id: profile.id,
				server: serverName,
				username: voucherCode,
				password: password,
				voucher_status: "unused",
				status: "active",
				comment: comment,
				created_by: createdBy,
				synced_to_mikrotik: false,
			};

			// 5. Create in database first
			const [dbVoucher] = await db
				.insert(vouchers)
				.values(newVoucher)
				.returning();

			createdVoucher = dbVoucher;

			console.log(`✅ Voucher '${voucherCode}' created in database`);

			// 6. Create in MikroTik as hotspot user
			await this.connect();

			const mikrotikParams: any = {
				name: voucherCode,
				password: password,
				profile: profileName,
				comment: comment || `Voucher created at ${new Date().toISOString()}`,
			};

			if (serverName) {
				mikrotikParams.server = serverName;
			}

			const result = await this.connectedApi!.menu("/ip/hotspot/user").add(
				mikrotikParams
			);

			// 7. Update database with MikroTik ID and sync status
			await db
				.update(vouchers)
				.set({
					mikrotik_user_id: result["id"],
					synced_to_mikrotik: true,
					updated_at: new Date(),
				})
				.where(eq(vouchers.id, dbVoucher.id));

			console.log(
				`✅ Voucher '${voucherCode}' synced to MikroTik with ID: ${result["id"]}`
			);

			return {
				...dbVoucher,
				mikrotik_user_id: result["id"],
				synced_to_mikrotik: true,
			};
		} catch (error) {
			console.error("❌ Error creating voucher:", error);

			// Rollback: Delete from database if MikroTik creation failed
			if (createdVoucher && createdVoucher.id !== undefined) {
				try {
					await db.delete(vouchers).where(eq(vouchers.id, createdVoucher?.id));
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
	async createVouchers(bulkConfig: BulkVoucherConfig): Promise<{
		batch: NewHotspotVoucherBatch;
		vouchers?: NewHotspotVoucher[];
		failed: Array<{ code: string; error: string }>;
	}> {
		let createdBatch: NewHotspotVoucherBatch | null = null;
		const createdVouchers: NewHotspotVoucher[] = [];
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
			let profile: HotspotProfile | undefined;
			if (bulkConfig.profile_id) {
				profile = await db.query.hotspot_profiles.findFirst({
					where: (sp, { eq, and }) =>
						and(
							eq(sp.id, bulkConfig.profile_id!),
							eq(sp.router_id, bulkConfig.router_id),
							eq(sp.is_active, true)
						),
				});

				if (!profile) {
					throw new Error(
						`Hotspot profile with name ${bulkConfig.profile_id} not found`
					);
				}
			}

			// 3. Create batch record first
			const newBatch: NewHotspotVoucherBatch = {
				router_id: bulkConfig.router_id,
				profile_id: bulkConfig.profile_id, // Allow null for optional profile
				batch_name: bulkConfig.batch_name,
				length: bulkConfig.length || 8,
				prefix: bulkConfig.prefix || "",
				suffix: bulkConfig.suffix || "",
				charset:
					bulkConfig.characters ||
					"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
				password_mode: bulkConfig.passwordMode || "same_as_username",
				generation_mode: bulkConfig.generation_mode || "random",
				count: bulkConfig.quantity,
				total_generated: 0, // Will be updated after generation
				comment: bulkConfig.comment,
				//FIXME - IT's should be fixed when add user 
				created_by: bulkConfig.created_by || 1,
				is_active: true,
				status: "active",
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
			for (let i = 0; i < bulkConfig.quantity; i++) {
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
					const newVoucher: NewHotspotVoucher = {
						router_id: bulkConfig.router_id,
						batch_id: dbBatch.id,
						username: voucherCode,
						password: password,
						profile_id: bulkConfig.profile_id, // Allow null
						voucher_status: "unused",
						status: "active",
						comment: `Batch: ${
							bulkConfig.batch_name
						} - ${new Date().toISOString()}`,
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
								mikrotik_user_id: result["id"],
								synced_to_mikrotik: true,
								updated_at: new Date(),
							})
							.where(eq(vouchers.id, dbVoucher.id));

						createdVouchers.push({
							...dbVoucher,
							mikrotik_user_id: result["id"],
							synced_to_mikrotik: true,
						});

						console.log(
							`✅ Voucher ${i + 1}/${
								bulkConfig.quantity
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
			if (createdBatch && createdBatch.id !== undefined) {
				try {
					// Delete vouchers first (foreign key constraint)
					await db
						.delete(vouchers)
						.where(eq(vouchers.batch_id, createdBatch.id));

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
	 * Update bulk vouchers - Database first approach with MikroTik sync
	 */
	async updateVoucers(bulkConfig: BulkUpdateVoucherConfig): Promise<{
		updated: NewHotspotVoucher[];
		failed: Array<{ code: string; error: string }>;
		summary: {
			total_processed: number;
			total_updated: number;
			total_failed: number;
		};
	}> {
		const updatedVouchers: NewHotspotVoucher[] = [];
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

			// 2. Validate batch exists if specified
			if (bulkConfig.batch_id) {
				const batch = await db.query.voucher_batches.findFirst({
					where: (vb, { eq, and }) =>
						and(
							eq(vb.id, Number(bulkConfig.batch_id)),
							eq(vb.router_id, bulkConfig.router_id),
							eq(vb.is_active, true)
						),
				});

				if (!batch) {
					throw new Error(
						`Batch with ID ${bulkConfig.batch_id} not found or inactive`
					);
				}
			}

			// 3. Validate new profile if specified
			let newProfile: HotspotProfile | undefined;
			if (bulkConfig.updates.profile) {
				newProfile = await db.query.hotspot_profiles.findFirst({
					where: (sp, { eq, and }) =>
						and(
							eq(sp.name, bulkConfig.updates.profile!),
							eq(sp.router_id, bulkConfig.router_id),
							eq(sp.is_active, true)
						),
				});

				if (!newProfile) {
					throw new Error(
						`Profile with name ${bulkConfig.updates.profile} not found`
					);
				}
			}

			// 4. Build query conditions for vouchers to update
			const conditions: any[] = [eq(vouchers.router_id, bulkConfig.router_id)];

			// Filter by batch_id if specified
			if (bulkConfig.batch_id) {
				conditions.push(eq(vouchers.batch_id, bulkConfig.batch_id));
			}

			// Apply other filters
			if (
				bulkConfig.filters?.batch_ids &&
				bulkConfig.filters.batch_ids.length > 0
			) {
				conditions.push(
					inArray(vouchers.batch_id, bulkConfig.filters.batch_ids)
				);
			}

			if (bulkConfig.filters?.voucher_status) {
				conditions.push(
					eq(vouchers.voucher_status, bulkConfig.filters.voucher_status)
				);
			}

			if (bulkConfig.filters?.unused_only) {
				conditions.push(eq(vouchers.voucher_status, "unused"));
			}

			if (
				bulkConfig.filters?.voucher_ids &&
				bulkConfig.filters.voucher_ids.length > 0
			) {
				conditions.push(inArray(vouchers.id, bulkConfig.filters.voucher_ids));
			}

			const vouchersToUpdate = await db.query.vouchers.findMany({
				where: (v, { and }) => and(...conditions),
				with: {
					profile: true,
				},
			});

			if (vouchersToUpdate.length === 0) {
				console.log("⚠️ No vouchers found matching the criteria");
				return {
					updated: [],
					failed: [],
					summary: {
						total_processed: 0,
						total_updated: 0,
						total_failed: 0,
					},
				};
			}

			console.log(`📝 Updating ${vouchersToUpdate.length} vouchers...`);

			// 5. Connect to MikroTik
			await this.connect();

			// 6. Update each voucher
			for (const voucher of vouchersToUpdate) {
				try {
					const voucherCode = voucher?.username;

					// Prepare update data
					const updateData: any = {
						updated_at: new Date(),
					};

					if (bulkConfig.updated_by) {
						updateData.updated_by = bulkConfig.updated_by;
					}

					// Update comment if provided
					if (bulkConfig.updates.comment !== undefined) {
						updateData.comment = bulkConfig.updates.comment;
					}

					// Update voucher status if provided
					if (bulkConfig.updates.voucher_status) {
						updateData.voucher_status = bulkConfig.updates.voucher_status;
					}

					// Update profile if provided
					if (bulkConfig.updates.profile !== undefined) {
						updateData.profile = bulkConfig.updates.profile;
					}

					// Update in MikroTik if synced
					if (voucher.synced_to_mikrotik && voucher.mikrotik_user_id) {
						try {
							const mikrotikParams: any = {};

							if (bulkConfig.updates.comment !== undefined) {
								mikrotikParams.comment = bulkConfig.updates.comment;
							}

							if (newProfile) {
								mikrotikParams.profile = newProfile.name;
							}

							if (Object.keys(mikrotikParams).length > 0) {
								await this.connectedApi!.menu("/ip/hotspot/user").set({
									...mikrotikParams,
									".id": voucher.mikrotik_user_id,
								});
							}
						} catch (mikrotikError: any) {
							console.error(
								`❌ Failed to update voucher '${voucherCode}' in MikroTik:`,
								mikrotikError
							);
							failed.push({
								code: voucherCode || "unknown",
								error: `MikroTik error: ${
									mikrotikError.message || mikrotikError
								}`,
							});
							continue;
						}
					}

					// Update in database
					const [updatedVoucher] = await db
						.update(vouchers)
						.set(updateData)
						.where(eq(vouchers.id, voucher.id))
						.returning();

					updatedVouchers.push(updatedVoucher);

					console.log(`✅ Updated voucher: ${voucherCode}`);
				} catch (error: any) {
					console.error(`❌ Failed to update voucher:`, error);
					failed.push({
						code: voucher?.username || "unknown",
						error: error.message || error.toString(),
					});
				}
			}

			// 7. Update batch timestamp if batch_id specified
			if (bulkConfig.batch_id) {
				await db
					.update(voucher_batches)
					.set({ updated_at: new Date() })
					.where(eq(voucher_batches.id, bulkConfig.batch_id));
			}

			const summary = {
				total_processed: vouchersToUpdate.length,
				total_updated: updatedVouchers.length,
				total_failed: failed.length,
			};

			console.log(
				`✅ Bulk voucher update completed: ${summary.total_updated} updated, ${summary.total_failed} failed`
			);

			return {
				updated: updatedVouchers,
				failed,
				summary,
			};
		} catch (error) {
			console.error("❌ Error updating bulk vouchers:", error);
			throw error;
		}
	}

	/**
	 * Delete bulk vouchers - Remove from both MikroTik and database
	 */
	async deleteVouchers(bulkConfig: BulkDeleteVoucherConfig): Promise<{
		deleted: Array<{ id: number; code: string }>;
		failed: Array<{ code: string; error: string }>;
		deleted_batches: Array<{ id: string; name: string }>;
		summary: {
			total_processed: number;
			total_deleted: number;
			total_failed: number;
			batches_deleted: number;
		};
	}> {
		const deletedVouchers: Array<{ id: number; code: string }> = [];
		const failed: Array<{ code: string; error: string }> = [];
		const deletedBatches: Array<{ id: string; name: string }> = [];

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

			// 2. Build query conditions for vouchers to delete
			const conditions: any[] = [eq(vouchers.router_id, bulkConfig.router_id)];

			// Filter by batch_id if specified
			if (bulkConfig.batch_id) {
				conditions.push(eq(vouchers.batch_id, bulkConfig.batch_id));
			}

			// Apply other filters
			if (
				bulkConfig.filters?.batch_ids &&
				bulkConfig.filters.batch_ids.length > 0
			) {
				conditions.push(
					inArray(vouchers.batch_id, bulkConfig.filters.batch_ids)
				);
			}

			if (bulkConfig.filters?.voucher_status) {
				conditions.push(
					eq(vouchers.voucher_status, bulkConfig.filters.voucher_status)
				);
			}

			if (bulkConfig.filters?.unused_only) {
				conditions.push(eq(vouchers.voucher_status, "unused"));
			}

			if (
				bulkConfig.filters?.voucher_ids &&
				bulkConfig.filters.voucher_ids.length > 0
			) {
				conditions.push(inArray(vouchers.id, bulkConfig.filters.voucher_ids));
			}

			const vouchersToDelete = await db.query.vouchers.findMany({
				where: (v, { and }) => and(...conditions),
			});

			if (vouchersToDelete.length === 0) {
				console.log("⚠️ No vouchers found matching the criteria");
				return {
					deleted: [],
					failed: [],
					deleted_batches: [],
					summary: {
						total_processed: 0,
						total_deleted: 0,
						total_failed: 0,
						batches_deleted: 0,
					},
				};
			}

			// 3. Check for active/used vouchers if force_delete_active is false
			if (!bulkConfig.force_delete_active) {
				const activeVouchers = vouchersToDelete.filter(
					(v) => v.voucher_status === "used"
				);
				if (activeVouchers.length > 0) {
					throw new Error(
						`Cannot delete ${activeVouchers.length} used vouchers. Set force_delete_active to true to override.`
					);
				}
			}

			console.log(`🗑️ Deleting ${vouchersToDelete.length} vouchers...`);

			// 4. Connect to MikroTik
			await this.connect();

			// 5. Delete each voucher
			for (const voucher of vouchersToDelete) {
				try {
					const voucherCode = voucher.username || "unknown";

					// Delete from MikroTik if synced
					if (voucher.synced_to_mikrotik && voucher.mikrotik_user_id) {
						try {
							await this.connectedApi!.menu("/ip/hotspot/user").remove({
								".id": voucher.mikrotik_user_id,
							});
						} catch (mikrotikError: any) {
							console.error(
								`⚠️ Failed to delete voucher '${voucherCode}' from MikroTik (continuing with DB deletion):`,
								mikrotikError
							);
							// Continue with database deletion even if MikroTik fails
						}
					}

					// Delete from database
					await db.delete(vouchers).where(eq(vouchers.id, voucher.id));

					deletedVouchers.push({
						id: voucher.id,
						code: voucherCode,
					});

					console.log(`✅ Deleted voucher: ${voucherCode}`);
				} catch (error: any) {
					console.error(`❌ Failed to delete voucher:`, error);
					failed.push({
						code: voucher.username || "unknown",
						error: error.message || error.toString(),
					});
				}
			}

			// 6. Check and delete empty batches
			const batchesToCheck = new Set<number>();

			if (bulkConfig.batch_id) {
				batchesToCheck.add(bulkConfig.batch_id);
			} else if (bulkConfig.filters?.batch_ids) {
				bulkConfig.filters.batch_ids.forEach((id) => batchesToCheck.add(id));
			} else {
				// Get unique batch IDs from deleted vouchers
				vouchersToDelete.forEach((v) => {
					if (v.batch_id) batchesToCheck.add(v.batch_id);
				});
			}

			for (const batchId of batchesToCheck) {
				try {
					// Check if batch still has vouchers
					const remainingVouchers = await db.query.vouchers.findFirst({
						where: (v, { eq }) => eq(v.batch_id, batchId),
					});

					if (!remainingVouchers) {
						// Get batch info before deletion
						const batch = await db.query.voucher_batches.findFirst({
							where: (vb, { eq }) => eq(vb.id, batchId),
						});

						if (batch) {
							// Delete empty batch
							await db
								.delete(voucher_batches)
								.where(eq(voucher_batches.id, batchId));

							deletedBatches.push({
								id: batchId.toString(),
								name: batch.batch_name,
							});

							console.log(`✅ Deleted empty batch: ${batch.batch_name}`);
						}
					}
				} catch (error: any) {
					console.error(`❌ Failed to process batch ${batchId}:`, error);
				}
			}

			const summary = {
				total_processed: vouchersToDelete.length,
				total_deleted: deletedVouchers.length,
				total_failed: failed.length,
				batches_deleted: deletedBatches.length,
			};

			console.log(
				`✅ Bulk voucher deletion completed: ${summary.total_deleted} vouchers deleted, ${summary.total_failed} failed, ${summary.batches_deleted} batches deleted`
			);

			return {
				deleted: deletedVouchers,
				failed,
				deleted_batches: deletedBatches,
				summary,
			};
		} catch (error) {
			console.error("❌ Error deleting bulk vouchers:", error);
			throw error;
		}
	}

	/**
	 * Get active vouchers (unused vouchers)
	 */
	async getActiveVouchers(
		routerId: number,
		limit = 50
	): Promise<NewHotspotVoucher[]> {
		return await db.query.vouchers.findMany({
			where: (v, { eq, and }) =>
				and(eq(v.router_id, routerId), eq(v.voucher_status, "unused")),
			orderBy: (v, { desc }) => [desc(v.created_at)],
			limit,
			with: {
				profile: true,
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

	/**
	 * Get voucher batches
	 */
	async getVoucherBatches(routerId: number): Promise<NewHotspotVoucherBatch[]> {
		return await db.query.voucher_batches.findMany({
			where: (vb, { eq }) => eq(vb.router_id, routerId),
			orderBy: (vb, { desc }) => [desc(vb.created_at)],
			with: {
				profile: true,
				created_by_user: true,
			},
		});
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
			if (voucher.mikrotik_user_id) {
				await this.connect();
				await this.connectedApi!.menu("/ip/hotspot/user").remove({
					".id": voucher.mikrotik_user_id,
				});
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
				and(eq(v.router_id, routerId), eq(v.username, voucherCode)),
		});

		if (!voucher) {
			throw new Error(`Voucher '${voucherCode}' not found`);
		}

		const updateData: any = {
			voucher_status: "used",
			first_login: voucher.first_login || new Date(),
			last_login: new Date(),
			updated_at: new Date(),
		};

		if (usageStats) {
			if (usageStats.bytesIn) {
				updateData.total_bytes_in =
					(voucher.total_bytes_in || 0) + usageStats.bytesIn;
			}
			if (usageStats.bytesOut) {
				updateData.total_bytes_out =
					(voucher.total_bytes_out || 0) + usageStats.bytesOut;
			}
			if (usageStats.sessionTime) {
				updateData.total_uptime =
					(voucher.total_uptime || 0) + usageStats.sessionTime;
			}
			updateData.total_sessions = (voucher.total_sessions || 0) + 1;
		}

		await db
			.update(vouchers)
			.set(updateData)
			.where(eq(vouchers.id, voucher.id));

		console.log(`✅ Voucher '${voucherCode}' marked as used`);
	}

	/**
	 * Sync vouchers from MikroTik to database
	 */
	//FIXME - Fix this on the profile
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
							and(eq(v.router_id, routerId), eq(v.username, mikrotikUser.name)),
					});

					if (existingVoucher) {
						// Update existing voucher
						await db
							.update(vouchers)
							.set({
								mikrotik_user_id: mikrotikUser[".id"],
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
							const newVoucher: NewHotspotVoucher = {
								router_id: routerId,
								profile_id: 1,
								username: mikrotikUser.name,
								password: mikrotikUser.password || mikrotikUser.name,
								comment: mikrotikUser.comment || "Synced from MikroTik",
								voucher_status: "unused",
								status: "active",
								mikrotik_user_id: mikrotikUser[".id"],
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
					and(eq(v.router_id, routerId), eq(v.voucher_status, "expired")),
			});

			await this.connect();

			for (const voucher of expiredVouchers) {
				try {
					// Remove from MikroTik if synced
					if (voucher.mikrotik_user_id) {
						await this.connectedApi!.menu("/ip/hotspot/user").remove({
							".id": voucher.mikrotik_user_id,
						});
					}

					// Delete from database
					await db.delete(vouchers).where(eq(vouchers.id, voucher.id));

					cleaned++;
				} catch (error) {
					errors.push(`Failed to clean voucher ${voucher.username}: ${error}`);
				}
			}

			console.log(`✅ Cleanup completed: ${cleaned} expired vouchers removed`);

			return { cleaned, errors };
		} catch (error) {
			console.error("❌ Error cleaning up expired vouchers:", error);
			throw error;
		}
	}

	/**
	 * Get voucher details by username
	 */
	async getVoucherByUsername(
		routerId: number,
		username: string
	): Promise<NewHotspotVoucher | null> {
		const voucher = await db.query.vouchers.findFirst({
			where: (v, { eq, and }) =>
				and(eq(v.router_id, routerId), eq(v.username, username)),
			with: {
				profile: true,
				batch: true,
				created_by_user: true,
			},
		});

		return voucher ?? null;
	}

	/**
	 * Get vouchers by batch
	 */
	async getVouchersByBatch(
		batchId: number,
		limit = 100
	): Promise<NewHotspotVoucher[]> {
		return await db.query.vouchers.findMany({
			where: (v, { eq }) => eq(v.batch_id, batchId),
			orderBy: (v, { asc }) => [asc(v.username)],
			limit,
			with: {
				profile: true,
			},
		});
	}

	/**
	 * Update voucher expiry
	 */
	async updateVoucherExpiry(voucherId: number, endAt: Date): Promise<void> {
		await db
			.update(vouchers)
			.set({
				end_at: endAt,
				updated_at: new Date(),
			})
			.where(eq(vouchers.id, voucherId));

		console.log(`✅ Voucher expiry updated`);
	}
}

export const createMikrotikVoucher = MikrotikVoucher.createFromDatabase;
