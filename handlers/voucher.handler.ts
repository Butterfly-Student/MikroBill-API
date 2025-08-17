import {
	createSuccessResponse,
	createErrorResponse,
	createPaginatedResponse,
} from "@/utils/response.utils";
import { createMikrotikVoucher } from "@/services/mikrotik/MikrotikVoucher";
import { db } from "@/lib/db/index";
import { eq, and } from "drizzle-orm";
import {
	vouchers,
	voucher_batches,
	hotspot_profiles,
	NewHotspotProfile,
} from "@/database/schema/mikrotik";
import {
	calculateEndTime,
	formatDuration,
	startVoucherCron,
	stopVoucherCron,
} from "@/utils/mikrotik.utils";
import { createMikrotikHotspot } from "@/services/mikrotik/MikrotikHotspot";


export const getRouterHotspotVouchers = async ({
	params,
	query,
}: {
	params: { router_id: number };
	query?: { status?: string; limit?: string; offset?: string };
}) => {
	try {
		const routerId = params.router_id;

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const limit = query?.limit ? parseInt(query.limit) : 50;
		const offset = query?.offset ? parseInt(query.offset) : 0;

		let whereCondition = and(eq(vouchers.router_id, routerId));

		if (query?.status) {
			whereCondition = and(
				eq(vouchers.router_id, routerId),
				eq(vouchers.status, query.status as any)
			);
		}

		const vouchersList = await db.query.vouchers.findMany({
			where: whereCondition,
			limit: limit,
			offset: offset,
			orderBy: (v, { desc }) => [desc(v.created_at)],
			with: {
				profile: true,
				batch: true,
			},
		});

		// Get total count for pagination
		const totalVouchers = await db
			.select({ count: vouchers.id })
			.from(vouchers)
			.where(whereCondition);

		const total = totalVouchers.length;

		return createPaginatedResponse(vouchersList, {
			page: offset / limit,
			limit,
			total,
		});
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to retrieve vouchers");
	}
};

export const getRouterHotspotVouchersActive = async ({
	params,
	query,
}: {
	params: { router_id: number };
	query?: { limit?: string };
}) => {
	try {
		const routerId = params.router_id;

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const limit = query?.limit ? parseInt(query.limit) : 50;

		const voucherService = await createMikrotikVoucher(routerId);
		const activeVouchers = await voucherService.getActiveVouchers(
			routerId,
			limit
		);

		return createSuccessResponse(
			activeVouchers,
			"Active vouchers retrieved successfully"
		);
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to retrieve active vouchers"
		);
	}
};

export const createRouterHotspotSingleVoucher = async ({
	params,
	body,
}: {
	params: { router_id: number };
	body: any;
}) => {
	try {
		const routerId = params.router_id;

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const voucherService = await createMikrotikVoucher(routerId);
		const voucher = await voucherService.createSingleVoucher({
			router_id: routerId,
			...body,
		});

		return createSuccessResponse(
			voucher,
			"Single voucher created successfully"
		);
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to create single voucher"
		);
	}
};

export const createRouterHotspotBulkVouchers = async ({
	params,
	body,
}: {
	params: { router_id: number };
	body: any;
}) => {
	try {
		const routerId = params.router_id;

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const voucherService = await createMikrotikVoucher(routerId);
		const result = await voucherService.createVouchers({
			router_id: routerId,
			...body,
		});

		return createSuccessResponse(
			{
				batch: result.batch,
				created_count: result.vouchers?.length || 0,
				failed_count: result.failed.length,
				failed_vouchers: result.failed,
			},
			`Bulk vouchers created: ${result.vouchers?.length || 0} created, ${
				result.failed.length
			} failed`
		);
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to create bulk vouchers");
	}
};

export const deleteRouterHotspotVoucher = async ({
	params,
}: {
	params: { router_id: number; voucherId: string };
}) => {
	try {
		const routerId = params.router_id;
		const voucherId = parseInt(params.voucherId);

		if (isNaN(routerId) || isNaN(voucherId)) {
			return createErrorResponse("Invalid ID format", "Validation error");
		}

		const voucherService = await createMikrotikVoucher(routerId);
		await voucherService.deleteVoucher(voucherId);

		return createSuccessResponse(null, "Voucher deleted successfully");
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to delete voucher");
	}
};

export const markRouterHotspotVoucherAsUsed = async ({
	params,
	body,
}: {
	params: { router_id: number; voucherId: string };
	body: any;
}) => {
	try {
		const routerId = params.router_id;
		const voucherId = parseInt(params.voucherId);

		if (isNaN(routerId) || isNaN(voucherId)) {
			return createErrorResponse("Invalid ID format", "Validation error");
		}

		// Get voucher to find the code
		const voucher = await db.query.vouchers.findFirst({
			where: eq(vouchers.id, voucherId),
		});

		if (!voucher) {
			return createErrorResponse("Voucher not found", "Not found");
		}

		const voucherService = await createMikrotikVoucher(routerId);
		await voucherService.markVoucherAsUsed(routerId, voucher.username, body);

		return createSuccessResponse(null, "Voucher marked as used successfully");
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to mark voucher as used");
	}
};

// ============ BATCH HANDLERS ============

export const getRouterHotspotBatches = async ({
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

		const voucherService = await createMikrotikVoucher(routerId);
		const batches = await voucherService.getVoucherBatches(routerId);

		// Apply pagination if provided
		const limit = query?.limit ? parseInt(query.limit) : 50;
		const offset = query?.offset ? parseInt(query.offset) : 0;

		const paginatedBatches = batches.slice(offset, offset + limit);

		const total = batches.length;

		return createPaginatedResponse(paginatedBatches, {
			page: offset / limit,
			limit,
			total,
		});
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to retrieve voucher batches"
		);
	}
};

export const getRouterHotspotBatchById = async ({
	params,
}: {
	params: { router_id: number; batchId: string };
}) => {
	try {
		const routerId = params.router_id;
		const batchId = parseInt(params.batchId);

		if (isNaN(routerId) || isNaN(batchId)) {
			return createErrorResponse("Invalid ID format", "Validation error");
		}

		const batch = await db.query.voucher_batches.findFirst({
			where: (vb, { eq, and }) =>
				and(eq(vb.id, batchId), eq(vb.router_id, routerId)),
			with: {
				profile: true,
			},
		});

		if (!batch) {
			return createErrorResponse("Batch not found", "Not found");
		}

		// Get batch statistics
		const batchStats = await db
			.select({
				total: vouchers.id,
				status: vouchers.status,
			})
			.from(vouchers)
			.where(eq(vouchers.batch_id, batchId));

		const stats = {
			total: batchStats.length,
			unused: batchStats.filter((v) => v.status === "inactive").length,
			used: batchStats.filter((v) => v.status === "active").length,
			expired: batchStats.filter((v) => v.status === "suspended").length,
		};

		return createSuccessResponse(
			{
				...batch,
				statistics: stats,
			},
			"Batch retrieved successfully"
		);
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to retrieve batch");
	}
};

export const getRouterHotspotBatchVouchers = async ({
	params,
	query,
}: {
	params: { router_id: number; batchId: string };
	query?: { limit?: string; offset?: string };
}) => {
	try {
		const routerId = params.router_id;
		const batchId = parseInt(params.batchId);

		if (isNaN(routerId) || isNaN(batchId)) {
			return createErrorResponse("Invalid ID format", "Validation error");
		}

		const limit = query?.limit ? parseInt(query.limit) : 50;
		const offset = query?.offset ? parseInt(query.offset) : 0;

		const batchVouchers = await db.query.vouchers.findMany({
			where: (v, { eq, and }) =>
				and(eq(v.batch_id, batchId), eq(v.router_id, routerId)),
			limit: limit,
			offset: offset,
			orderBy: (v, { desc }) => [desc(v.created_at)],
			with: {
				profile: true,
			},
		});

		// Get total count for pagination
		const totalCount = await db
			.select({ count: vouchers.id })
			.from(vouchers)
			.where(
				and(eq(vouchers.batch_id, batchId), eq(vouchers.router_id, routerId))
			);

		const total = totalCount.length;

		return createPaginatedResponse(batchVouchers, {
			page: offset / limit,
			limit,
			total,
		});
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to retrieve batch vouchers"
		);
	}
};

export const deleteRouterHotspotBatch = async ({
	params,
}: {
	params: { router_id: number; batchId: string };
}) => {
	try {
		const routerId = params.router_id;
		const batchId = parseInt(params.batchId);

		if (isNaN(routerId) || isNaN(batchId)) {
			return createErrorResponse("Invalid ID format", "Validation error");
		}

		const voucherService = await createMikrotikVoucher(routerId);

		// Get all vouchers in this batch
		const batchVouchers = await db.query.vouchers.findMany({
			where: (v, { eq, and }) =>
				and(eq(v.batch_id, batchId), eq(v.router_id, routerId)),
		});

		// Delete all vouchers in the batch
		let deletedCount = 0;
		const errors: string[] = [];

		for (const voucher of batchVouchers) {
			try {
				await voucherService.deleteVoucher(voucher.id);
				deletedCount++;
			} catch (error: any) {
				errors.push(
					`Failed to delete voucher ${voucher.username}: ${error.message}`
				);
			}
		}

		// Delete the batch record
		await db.delete(voucher_batches).where(eq(voucher_batches.id, batchId));

		return createSuccessResponse(
			{
				deleted_vouchers: deletedCount,
				errors: errors,
			},
			`Batch deleted successfully. ${deletedCount} vouchers removed.`
		);
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to delete batch");
	}
};

// ============ STATS & MONITORING HANDLERS ============

export const getRouterHotspotStats = async ({
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
		const stats = await hotspotService.getHotspotStats(routerId);

		return createSuccessResponse(
			stats,
			"Hotspot statistics retrieved successfully"
		);
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to retrieve hotspot statistics"
		);
	}
};

export const getRouterHotspotStatus = async ({
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
		const status = await hotspotService.getHotspotStatus(routerId);

		return createSuccessResponse(
			status,
			"Hotspot status retrieved successfully"
		);
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to retrieve hotspot status"
		);
	}
};

export const getRouterHotspotVoucherStats = async ({
	params,
}: {
	params: { router_id: number };
}) => {
	try {
		const routerId = params.router_id;

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const voucherService = await createMikrotikVoucher(routerId);
		const voucherStats = await voucherService.getVoucherStats(routerId);

		return createSuccessResponse(
			voucherStats,
			"Voucher statistics retrieved successfully"
		);
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to retrieve voucher statistics"
		);
	}
};

// ============ SYNC & MAINTENANCE HANDLERS ============

export const syncRouterHotspotVouchers = async ({
	params,
}: {
	params: { router_id: number };
}) => {
	try {
		const routerId = params.router_id;

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const voucherService = await createMikrotikVoucher(routerId);
		const syncResult = await voucherService.syncVouchersFromMikrotik(routerId);

		return createSuccessResponse(
			syncResult,
			`Voucher sync completed: ${syncResult.synced} processed, ${syncResult.created} created, ${syncResult.updated} updated`
		);
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to sync vouchers");
	}
};

export const cleanupRouterHotspotExpiredVouchers = async ({
	params,
}: {
	params: { router_id: number };
}) => {
	try {
		const routerId = params.router_id;

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const voucherService = await createMikrotikVoucher(routerId);
		const cleanupResult = await voucherService.cleanupExpiredVouchers(routerId);

		return createSuccessResponse(
			{
				cleaned_count: cleanupResult.cleaned,
				errors: cleanupResult.errors,
			},
			`Cleanup completed: ${cleanupResult.cleaned} expired vouchers removed`
		);
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to cleanup expired vouchers"
		);
	}
};
