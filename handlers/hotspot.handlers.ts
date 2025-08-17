import {
	createSuccessResponse,
	createErrorResponse,
	createPaginatedResponse,
} from "@/utils/response.utils";
import { createMikrotikHotspot } from "@/services/mikrotik/MikrotikHotspot";
import { db } from "@/lib/db/index";
import { eq, and } from "drizzle-orm";
import {
	vouchers,
	voucher_batches,
	hotspot_profiles,
	NewHotspotProfile,
} from "@/database/schema/mikrotik";
import { calculateEndTime, formatDuration, startVoucherCron, stopVoucherCron } from "@/utils/mikrotik.utils";


/**
 * Handler untuk login voucher
 * Mengupdate status voucher menjadi 'active' dan memulai cron job untuk monitoring
 */
export const voucherLogin = async ({
	body,
	params
}: {
	body: {
		name: string;
	};
	params: { router_id: number };
}) => {
	try {
		const { name } = body;
		const { router_id } = params;

		// Cari voucher berdasarkan nama dan router_id
		const [voucher] = await db
			.select()
			.from(vouchers)
			.where(
				and(
					eq(vouchers.router_id, router_id),
					// Assuming name is stored in general.name field
					eq(vouchers.username, name)
				)
			)
			.limit(1);

		if (!voucher) {
			return createErrorResponse("Voucher not found", "VOUCHER_NOT_FOUND");
		}

		// Cek apakah voucher sudah aktif
		if (voucher.status === 'active') {
			return createErrorResponse("Voucher is already active", "VOUCHER_ALREADY_ACTIVE");
		}

		// Cek apakah voucher masih valid (belum expired)
		if (voucher.voucher_status === "expired") {
			return createErrorResponse("Voucher has expired", "VOUCHER_EXPIRED");
		}

		console.log(voucher);

		// Ambil session profile untuk mendapatkan konfigurasi
		const [sessionProfile] = await db
			.select()
			.from(hotspot_profiles)
			.where(
				and(
					eq(hotspot_profiles.router_id, router_id),
					eq(
						hotspot_profiles.mikrotik_profile_id,
						voucher.mikrotik_user_id ?? ""
					)
				)
			)
			.limit(1);

		if (!sessionProfile) {
			return createErrorResponse("Session profile not found", "SESSION_PROFILE_NOT_FOUND");
		}

		// // Hitung waktu berakhir berdasarkan validity dari session profile
		const startTime = new Date();
		const endTime = calculateEndTime(startTime, sessionProfile.validity || '');
		const nextCronRun = new Date(startTime.getTime() + 60000); // Check setiap menit

		// Update voucher status menjadi active
		const [updatedVoucher] = await db
			.update(vouchers)
			.set({
				status: 'active',
				start_at: startTime,
				end_at: endTime,
				cron_enabled: true,
				cron_last_run: startTime,
				cron_next_run: nextCronRun,
				profile_id: sessionProfile.id,
				updated_at: new Date()
			})
			.where(eq(vouchers.id, voucher.id))
			.returning();

		// Mulai cron job untuk monitoring voucher
		startVoucherCron(updatedVoucher);

		return createSuccessResponse(
			{
				voucher_id: updatedVoucher.id,
				username: updatedVoucher.username,
				password: updatedVoucher.password,
				status: updatedVoucher.status,
				start_at: updatedVoucher.start_at,
				end_at: updatedVoucher.end_at,
				
			},
			"Voucher login successful"
		);

	} catch (error: any) {
		console.error("Error in voucherLogin:", error);
		return createErrorResponse(error.message || "Internal server error", "INTERNAL_ERROR");
	}
};

/**
 * Handler untuk logout voucher
 * Mengupdate status voucher menjadi 'used' dan menghentikan cron job
 */
export const voucherLogout = async ({
	body,
	params
}: {
	body: {
		mikrotik_profile_id: string;
		username: string;
	};
	params: { router_id: number };
}) => {
	try {
		const { mikrotik_profile_id, username } = body;
		const { router_id } = params;

		// Cari voucher yang sedang aktif
		const [voucher] = await db
			.select()
			.from(vouchers)
			.where(
				and(
					eq(vouchers.router_id, router_id),
					eq(vouchers.username, username),
					eq(vouchers.status, "active")
				)
			)
			.limit(1);

		if (!voucher) {
			return createErrorResponse(
				"Active voucher not found",
				"ACTIVE_VOUCHER_NOT_FOUND"
			);
		}

		// Update voucher status menjadi used
		const [updatedVoucher] = await db
			.update(vouchers)
			.set({
				voucher_status: "used",
				cron_enabled: false,
				updated_at: new Date(),
			})
			.where(eq(vouchers.id, voucher.id))
			.returning();

		// Hentikan cron job
		stopVoucherCron(updatedVoucher.id.toString());

		// Hitung durasi penggunaan
		const usageDuration = voucher.start_at
			? new Date().getTime() - new Date(voucher.start_at).getTime()
			: 0;

		return createSuccessResponse(
			{
				voucher_id: updatedVoucher.id,
				name: updatedVoucher.username,
				status: updatedVoucher.status,
				start_at: voucher.start_at,
				end_at: new Date(),
				usage_duration_ms: usageDuration,
				usage_duration_readable: formatDuration(usageDuration),
			},
			"Voucher logout successful"
		);
	} catch (error: any) {
		console.error("Error in voucherLogout:", error);
		return createErrorResponse(
			error.message || "Internal server error",
			"INTERNAL_ERROR"
		);
	}
};

// ============ PROFILE HANDLERS ============

export const getRouterHotspotProfiles = async ({
	params,
}: {
	params: { router_id: string };
}) => {
	try {
		const routerId = parseInt(params.router_id);

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const hotspotService = await createMikrotikHotspot(routerId);
		const profiles = await hotspotService.getProfiles(routerId);
		

		return createSuccessResponse(
			profiles,
			"Hotspot profiles retrieved successfully"
		);
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to retrieve hotspot profiles"
		);
	}
};

export const createRouterHotspotProfile = async ({
	params,
	body,
}: {
	params: { router_id: string };
	body: NewHotspotProfile;
}) => {
	try {
		const routerId = parseInt(params.router_id);

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const newProfile: NewHotspotProfile = {
			router_id: routerId,
			name: body.name,
			price: body.price,
			sell_price: body.sell_price,
			validity: body.validity,
			mikrotik_profile_id: body.mikrotik_profile_id || "",
			cron_enabled: body.cron_enabled || true,
			comment: body.comment || "",
			synced_to_mikrotik: body.synced_to_mikrotik || true,
		};

		const hotspotService = await createMikrotikHotspot(routerId);
		const profile = await hotspotService.createProfile(routerId, newProfile);

		return createSuccessResponse(
			profile,
			"Hotspot profile created successfully"
		);
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to create hotspot profile"
		);
	}
};

export const getRouterHotspotProfileById = async ({
	params,
}: {
	params: { router_id: string; profileId: string };
}) => {
	try {
		const routerId = parseInt(params.router_id);
		const profileId = parseInt(params.profileId);

		if (isNaN(routerId) || isNaN(profileId)) {
			return createErrorResponse("Invalid ID format", "Validation error");
		}

		const profile = await db.query.hotspot_profiles.findFirst({
			where: (sp, { eq, and }) =>
				and(
					eq(sp.id, profileId),
					eq(sp.router_id, routerId),
					eq(sp.is_active, true)
				),
		});

		if (!profile) {
			return createErrorResponse("Profile not found", "Not found");
		}

		return createSuccessResponse(
			profile,
			"Hotspot profile retrieved successfully"
		);
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to retrieve hotspot profile"
		);
	}
};

export const updateRouterHotspotProfile = async ({
	params,
	body,
}: {
	params: { router_id: string; profileId: string };
	body: any;
}) => {
	try {
		const routerId = parseInt(params.router_id);
		const profileId = parseInt(params.profileId);

		if (isNaN(routerId) || isNaN(profileId)) {
			return createErrorResponse("Invalid ID format", "Validation error");
		}

		const hotspotService = await createMikrotikHotspot(routerId);
		const updatedProfile = await hotspotService.updateProfile(
			routerId,
			profileId,
			body
		);

		return createSuccessResponse(
			updatedProfile,
			"Hotspot profile updated successfully"
		);
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to update hotspot profile"
		);
	}
};

export const deleteRouterHotspotProfile = async ({
	params,
}: {
	params: { router_id: number; profileId: string };
}) => {
	try {
		const routerId = params.router_id;
		const profileId = parseInt(params.profileId);

		if (isNaN(routerId) || isNaN(profileId)) {
			return createErrorResponse("Invalid ID format", "Validation error");
		}

		const hotspotService = await createMikrotikHotspot(routerId);
		await hotspotService.deleteProfile(profileId);

		return createSuccessResponse(null, "Hotspot profile deleted successfully");
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to delete hotspot profile"
		);
	}
};

// ============ USER HANDLERS ============

export const getRouterHotspotUsers = async ({
	params,
	query,
}: {
	params: { router_id: number };
	query?: { limit?: string; offset?: string };
}) => {
	try {
		const routerId = params.router_id;

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const hotspotService = await createMikrotikHotspot(routerId);
		const users = await hotspotService.getUsers(routerId);

		// Apply pagination if provided
		const limit = query?.limit ? parseInt(query.limit) : 50;
		const offset = query?.offset ? parseInt(query.offset) : 0;

		const paginatedUsers = users.slice(offset, offset + limit);

		const total = users.length;

		return createPaginatedResponse(users, {
			page: offset / limit,
			limit,
			total,
		});
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to retrieve hotspot users"
		);
	}
};

export const getRouterHotspotUsersActive = async ({
	params,
}: {
	params: { router_id: number };
}) => {
	try {
		const routerId = params.router_id;

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const hotspotService = await createMikrotikHotspot(routerId);
		const activeUsers = await hotspotService.getActiveUsers(routerId);

		return createSuccessResponse(
			activeUsers,
			"Active hotspot users retrieved successfully"
		);
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to retrieve active hotspot users"
		);
	}
};

export const disconnectRouterHotspotUser = async ({
	params,
}: {
	params: { router_id: number; username: string };
}) => {
	try {
		const routerId = params.router_id;

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const hotspotService = await createMikrotikHotspot(routerId);
		await hotspotService.disconnectUser(routerId, params.username);

		return createSuccessResponse(
			null,
			`User '${params.username}' disconnected successfully`
		);
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to disconnect user");
	}
};
