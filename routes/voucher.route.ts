
import { Elysia, t } from "elysia";
import * as routerVoucherHandler from "@/handlers/voucher.handler";


export const routerVoucherRoutes = new Elysia({
	prefix: "/routers/:router_id/voucher",
})

	// ============ VOUCHER ROUTES ============
	.get("/all", routerVoucherHandler.getRouterHotspotVouchers, {
		params: t.Object({
			router_id: t.String({ pattern: "^[0-9]+$" }),
		}),
		query: t.Object({
			status: t.Optional(
				t.Union([t.Literal("unused"), t.Literal("used"), t.Literal("expired")])
			),
			limit: t.Optional(t.String({ pattern: "^[0-9]+$" })),
			offset: t.Optional(t.String({ pattern: "^[0-9]+$" })),
		}),
		detail: {
			summary: "Get vouchers",
			description: "Retrieve vouchers with optional status filtering",
			tags: ["Routers", "Hotspot", "Vouchers"],
		},
	})

	.get(
		"active",
		routerVoucherHandler.getRouterHotspotVouchersActive,
		{
			params: t.Object({
				router_id: t.String({ pattern: "^[0-9]+$" }),
			}),
			query: t.Object({
				limit: t.Optional(t.String({ pattern: "^[0-9]+$" })),
			}),
			detail: {
				summary: "Get active vouchers",
				description: "Retrieve unused/active vouchers",
				tags: ["Routers", "Hotspot", "Vouchers"],
			},
		}
	)

	.post(
		"single",
		routerVoucherHandler.createRouterHotspotSingleVoucher,
		{
			params: t.Object({
				router_id: t.String({ pattern: "^[0-9]+$" }),
			}),
			body: t.Object({
				username: t.String({ minLength: 1, maxLength: 100 }),
				password: t.Optional(t.String({ maxLength: 100 })),
				profile_id: t.Optional(t.Number({ minimum: 1 })),
				comment: t.Optional(t.String({ maxLength: 500 })),
				created_by: t.Optional(t.Number({ minimum: 1 })),
			}),
			detail: {
				summary: "Create single voucher",
				description: "Create a single voucher with custom username/password",
				tags: ["Routers", "Hotspot", "Vouchers"],
			},
		}
	)

	.post(
		"bulk",
		routerVoucherHandler.createRouterHotspotBulkVouchers,
		{
			params: t.Object({
				router_id: t.String({ pattern: "^[0-9]+$" }),
			}),
			body: t.Object({
				batch_name: t.String({ minLength: 1, maxLength: 100 }),
				quantity: t.Number({ minimum: 1, maximum: 1000 }),
				profile_id: t.Optional(t.Number({ minimum: 1 })),
				length: t.Optional(t.Number({ minimum: 4, maximum: 20 })),
				prefix: t.Optional(t.String({ maxLength: 20 })),
				suffix: t.Optional(t.String({ maxLength: 20 })),
				characters: t.Optional(t.String({ minLength: 1 })),
				passwordMode: t.Optional(
					t.Union([
						t.Literal("same_as_username"),
						t.Literal("random"),
						t.Literal("custom"),
					])
				),
				customPassword: t.Optional(t.String({ maxLength: 100 })),
				generation_mode: t.Optional(
					t.Union([t.Literal("random"), t.Literal("sequential")])
				),
				comment: t.Optional(t.String({ maxLength: 500 })),
				created_by: t.Optional(t.Number({ minimum: 1 })),
			}),
			detail: {
				summary: "Create bulk vouchers",
				description: "Create multiple vouchers in a batch",
				tags: ["Routers", "Hotspot", "Vouchers"],
			},
		}
	)

	.delete(
		":voucherId",
		routerVoucherHandler.deleteRouterHotspotVoucher,
		{
			params: t.Object({
				router_id: t.String({ pattern: "^[0-9]+$" }),
				voucherId: t.String({ pattern: "^[0-9]+$" }),
			}),
			detail: {
				summary: "Delete voucher",
				description: "Delete a voucher from both database and MikroTik",
				tags: ["Routers", "Hotspot", "Vouchers"],
			},
		}
	)

	.put(
		":voucherId/mark-used",
		routerVoucherHandler.markRouterHotspotVoucherAsUsed,
		{
			params: t.Object({
				router_id: t.String({ pattern: "^[0-9]+$" }),
				voucherId: t.String({ pattern: "^[0-9]+$" }),
			}),
			body: t.Object({
				bytesIn: t.Optional(t.Number({ minimum: 0 })),
				bytesOut: t.Optional(t.Number({ minimum: 0 })),
				sessionTime: t.Optional(t.Number({ minimum: 0 })),
			}),
			detail: {
				summary: "Mark voucher as used",
				description: "Mark a voucher as used with usage statistics",
				tags: ["Routers", "Hotspot", "Vouchers"],
			},
		}
	)

	// ============ BATCH ROUTES ============
	.get("/batches", routerVoucherHandler.getRouterHotspotBatches, {
		params: t.Object({
			router_id: t.String({ pattern: "^[0-9]+$" }),
		}),
		query: t.Object({
			limit: t.Optional(t.String({ pattern: "^[0-9]+$" })),
			offset: t.Optional(t.String({ pattern: "^[0-9]+$" })),
		}),
		detail: {
			summary: "Get voucher batches",
			description: "Retrieve all voucher batches for a router",
			tags: ["Routers", "Hotspot", "Batches"],
		},
	})

	.get("/batches/:batchId", routerVoucherHandler.getRouterHotspotBatchById, {
		params: t.Object({
			router_id: t.String({ pattern: "^[0-9]+$" }),
			batchId: t.String({ pattern: "^[0-9]+$" }),
		}),
		detail: {
			summary: "Get batch by ID",
			description: "Retrieve a specific voucher batch with its vouchers",
			tags: ["Routers", "Hotspot", "Batches"],
		},
	})

	.get(
		"/batches/:batchId/vouchers",
		routerVoucherHandler.getRouterHotspotBatchVouchers,
		{
			params: t.Object({
				router_id: t.String({ pattern: "^[0-9]+$" }),
				batchId: t.String({ pattern: "^[0-9]+$" }),
			}),
			query: t.Object({
				limit: t.Optional(t.String({ pattern: "^[0-9]+$" })),
				offset: t.Optional(t.String({ pattern: "^[0-9]+$" })),
			}),
			detail: {
				summary: "Get batch vouchers",
				description: "Retrieve vouchers belonging to a specific batch",
				tags: ["Routers", "Hotspot", "Batches"],
			},
		}
	)

	.delete("/batches/:batchId", routerVoucherHandler.deleteRouterHotspotBatch, {
		params: t.Object({
			router_id: t.String({ pattern: "^[0-9]+$" }),
			batchId: t.String({ pattern: "^[0-9]+$" }),
		}),
		detail: {
			summary: "Delete batch",
			description: "Delete a voucher batch and all its vouchers",
			tags: ["Routers", "Hotspot", "Batches"],
		},
	})

	// ============ STATS & MONITORING ROUTES ============
	.get("/stats", routerVoucherHandler.getRouterHotspotStats, {
		params: t.Object({
			router_id: t.String({ pattern: "^[0-9]+$" }),
		}),
		detail: {
			summary: "Get hotspot statistics",
			description: "Retrieve comprehensive hotspot statistics",
			tags: ["Routers", "Hotspot", "Statistics"],
		},
	})

	.get("/status", routerVoucherHandler.getRouterHotspotStatus, {
		params: t.Object({
			router_id: t.String({ pattern: "^[0-9]+$" }),
		}),
		detail: {
			summary: "Get hotspot status",
			description: "Retrieve hotspot server status and active users",
			tags: ["Routers", "Hotspot", "Status"],
		},
	})

	.get("stats", routerVoucherHandler.getRouterHotspotVoucherStats, {
		params: t.Object({
			router_id: t.String({ pattern: "^[0-9]+$" }),
		}),
		detail: {
			summary: "Get voucher statistics",
			description: "Retrieve voucher usage statistics",
			tags: ["Routers", "Hotspot", "Vouchers", "Statistics"],
		},
	})

	// ============ SYNC & MAINTENANCE ROUTES ============
	.post("/sync", routerVoucherHandler.syncRouterHotspotVouchers, {
		params: t.Object({
			router_id: t.String({ pattern: "^[0-9]+$" }),
		}),
		detail: {
			summary: "Sync vouchers",
			description: "Sync vouchers from MikroTik to database",
			tags: ["Routers", "Hotspot", "Sync"],
		},
	})

	.post(
		"/cleanup/expired",
		routerVoucherHandler.cleanupRouterHotspotExpiredVouchers,
		{
			params: t.Object({
				router_id: t.String({ pattern: "^[0-9]+$" }),
			}),
			detail: {
				summary: "Cleanup expired vouchers",
				description: "Remove expired vouchers from MikroTik and database",
				tags: ["Routers", "Hotspot", "Maintenance"],
			},
		}
	);
