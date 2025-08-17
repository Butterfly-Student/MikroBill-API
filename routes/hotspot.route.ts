import { Elysia, t } from "elysia";
import * as routerHotspotHandler from "@/handlers/hotspot.handlers";

export const routerHotspotRoutes = new Elysia({
	prefix: "/routers/:router_id/hotspot",
})

	.post("/voucher/login", routerHotspotHandler.voucherLogin, {
		params: t.Object({ router_id: t.Number({ minimum: 1 }) }),
		body: t.Object({
			name: t.String({ minLength: 1, maxLength: 100 }),
		}),
		detail: {
			summary: "Voucher login",
			description: "Login to a router with a voucher",
			tags: ["Routers", "Hotspot", "Vouchers"],
		},
	})

	.post("/voucher/logout", routerHotspotHandler.voucherLogout, {
		params: t.Object({ router_id: t.Number({ minimum: 1 }) }),
		body: t.Object({
			mikrotik_profile_id: t.String({ minLength: 1, maxLength: 10 }),
			name: t.String({ minLength: 1, maxLength: 100 }),
		}),
		detail: {
			summary: "Voucher logout",
			description: "Logout from a router",
			tags: ["Routers", "Hotspot", "Vouchers"],
		},
	})

	// ============ PROFILE ROUTES ============
	.get("/profiles", routerHotspotHandler.getRouterHotspotProfiles, {
		params: t.Object({
			router_id: t.String({ pattern: "^[0-9]+$" }),
		}),
		detail: {
			summary: "Get hotspot profiles",
			description: "Retrieve all hotspot profiles for a router",
			tags: ["Routers", "Hotspot", "Profiles"],
		},
	})

	.post("/profiles/add", routerHotspotHandler.createRouterHotspotProfile, {
		params: t.Object({
			router_id: t.String({ pattern: "^[0-9]+$" }),
		}),
		body: t.Object({
			name: t.String({ minLength: 1, maxLength: 100 }),
			type: t.UnionEnum([
				"pppoe",
				"hotspot",
				"vpn",
				"bandwidth",
				"static_ip",
				"others",
			]),
			price: t.Number({ minimum: 0, decimals: 2 }),
			sell_price: t.Number({ minimum: 0, decimals: 2 }),
			validity: t.String({ minLength: 1, maxLength: 100 }),
			sessionTimeout: t.Optional(t.String()),
			idleTimeout: t.Optional(t.String()),
			keepaliveTimeout: t.Optional(t.String()),
			statusAutorefresh: t.Optional(t.String()),
			sharedUsers: t.Optional(t.Number({ minimum: 1 })),
			rateLimit: t.Optional(t.String()),
			transparentProxy: t.Optional(t.Boolean()),
			addressList: t.Optional(t.String()),
			macCookieTimeout: t.Optional(t.String()),
			addMacCookie: t.Optional(t.Boolean()),
			comment: t.Optional(t.String({ maxLength: 500 })),
		}),
		detail: {
			summary: "Create hotspot profile",
			description: "Create a new hotspot profile for a router",
			tags: ["Routers", "Hotspot", "Profiles"],
		},
	})

	.get(
		"profiles/:profileId",
		routerHotspotHandler.getRouterHotspotProfileById,
		{
			params: t.Object({
				router_id: t.String({ pattern: "^[0-9]+$" }),
				profileId: t.String({ pattern: "^[0-9]+$" }),
			}),
			detail: {
				summary: "Get hotspot profile by ID",
				description: "Retrieve a specific hotspot profile",
				tags: ["Routers", "Hotspot", "Profiles"],
			},
		}
	)

	.put(
		"profiles/:profileId/update",
		routerHotspotHandler.updateRouterHotspotProfile,
		{
			params: t.Object({
				router_id: t.String({ pattern: "^[0-9]+$" }),
				profileId: t.String({ pattern: "^[0-9]+$" }),
			}),
			body: t.Object({
				sessionTimeout: t.Optional(t.String()),
				idleTimeout: t.Optional(t.String()),
				keepaliveTimeout: t.Optional(t.String()),
				statusAutorefresh: t.Optional(t.String()),
				sharedUsers: t.Optional(t.Number({ minimum: 1 })),
				rateLimit: t.Optional(t.String()),
				transparentProxy: t.Optional(t.Boolean()),
				addressList: t.Optional(t.String()),
				macCookieTimeout: t.Optional(t.String()),
				addMacCookie: t.Optional(t.Boolean()),
				comment: t.Optional(t.String({ maxLength: 500 })),
			}),
			detail: {
				summary: "Update hotspot profile",
				description: "Update an existing hotspot profile",
				tags: ["Routers", "Hotspot", "Profiles"],
			},
		}
	)

	.delete(
		"/profiles/:profileId",
		routerHotspotHandler.deleteRouterHotspotProfile,
		{
			params: t.Object({
				router_id: t.String({ pattern: "^[0-9]+$" }),
				profileId: t.String({ pattern: "^[0-9]+$" }),
			}),
			detail: {
				summary: "Delete hotspot profile",
				description: "Delete a hotspot profile",
				tags: ["Routers", "Hotspot", "Profiles"],
			},
		}
	)

	// ============ USER ROUTES ============
	.get("/users", routerHotspotHandler.getRouterHotspotUsers, {
		params: t.Object({
			router_id: t.String({ pattern: "^[0-9]+$" }),
		}),
		query: t.Object({
			limit: t.Optional(t.String({ pattern: "^[0-9]+$" })),
			offset: t.Optional(t.String({ pattern: "^[0-9]+$" })),
		}),
		detail: {
			summary: "Get hotspot users",
			description: "Retrieve all hotspot users from database",
			tags: ["Routers", "Hotspot", "Users"],
		},
	})

	.get("/users/active", routerHotspotHandler.getRouterHotspotUsersActive, {
		params: t.Object({
			router_id: t.String({ pattern: "^[0-9]+$" }),
		}),
		detail: {
			summary: "Get active hotspot users",
			description: "Retrieve currently active hotspot users from MikroTik",
			tags: ["Routers", "Hotspot", "Users"],
		},
	})

	.post(
		"/users/:username/disconnect",
		routerHotspotHandler.disconnectRouterHotspotUser,
		{
			params: t.Object({
				router_id: t.String({ pattern: "^[0-9]+$" }),
				username: t.String({ minLength: 1 }),
			}),
			detail: {
				summary: "Disconnect hotspot user",
				description: "Disconnect an active hotspot user",
				tags: ["Routers", "Hotspot", "Users"],
			},
		}
	)
