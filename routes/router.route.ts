import { Elysia, t } from "elysia";
import * as routerHandler from "@/handlers/router.handler";

export const routerRoutes = new Elysia({ prefix: "/routers" })
	.get("/", routerHandler.getRouters, {
		query: t.Object({
			page: t.Optional(t.Number({ minimum: 1 })),
			limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
			search: t.Optional(t.String({ minLength: 1 })),
			status: t.Optional(t.Union([t.Literal("active"), t.Literal("inactive")])),
			location: t.Optional(t.String({ minLength: 1 })),
		}),
		detail: {
			summary: "Get all routers",
			description: "Retrieve routers with optional filtering and pagination",
			tags: ["Routers"],
		},
	})

	.post("/", routerHandler.createRouter, {
		body: t.Object({
			name: t.String({
				minLength: 3,
				maxLength: 100,
				pattern: "^[a-zA-Z0-9_-\\s]+$",
			}),
			hostname: t.String({
				minLength: 1,
				maxLength: 255,
				description: "Router hostname or IP address",
			}),
			port: t.Number({
				minimum: 1,
				maximum: 65535,
				description: "MikroTik API port (default: 8728)",
			}),
			username: t.String({
				minLength: 1,
				maxLength: 50,
				description: "MikroTik router username",
			}),
			password: t.String({
				minLength: 1,
				description: "MikroTik router password",
			}),
			location: t.Optional(t.String({ maxLength: 255 })),
			description: t.Optional(t.String({ maxLength: 500 })),
			is_active: t.Optional(t.Boolean()),
		}),
		detail: {
			summary: "Create new router",
			description: "Add a new MikroTik router to the system",
			tags: ["Routers"],
		},
	})

	.get("/:id", routerHandler.getRouterById, {
		params: t.Object({
			id: t.String({ pattern: "^[0-9]+$" }),
		}),
		detail: {
			summary: "Get router by ID",
			description: "Retrieve a specific router with related data",
			tags: ["Routers"],
		},
	})

	.put("/:id", routerHandler.updateRouter, {
		params: t.Object({
			id: t.String({ pattern: "^[0-9]+$" }),
		}),
		body: t.Object({
			name: t.Optional(
				t.String({
					minLength: 3,
					maxLength: 100,
					pattern: "^[a-zA-Z0-9_-\\s]+$",
				})
			),
			hostname: t.Optional(
				t.String({
					minLength: 1,
					maxLength: 255,
				})
			),
			port: t.Optional(
				t.Number({
					minimum: 1,
					maximum: 65535,
				})
			),
			username: t.Optional(
				t.String({
					minLength: 1,
					maxLength: 50,
				})
			),
			password: t.Optional(t.String({ minLength: 1 })),
			location: t.Optional(t.String({ maxLength: 255 })),
			description: t.Optional(t.String({ maxLength: 500 })),
			is_active: t.Optional(t.Boolean()),
		}),
		detail: {
			summary: "Update router",
			description: "Update router information",
			tags: ["Routers"],
		},
	})

	.delete("/:id", routerHandler.deleteRouter, {
		params: t.Object({
			id: t.String({ pattern: "^[0-9]+$" }),
		}),
		detail: {
			summary: "Delete router",
			description: "Delete a router (only if no active sessions or customers)",
			tags: ["Routers"],
		},
	})

	.post("/:id/test-connection", routerHandler.testConnection, {
		params: t.Object({
			id: t.String({ pattern: "^[0-9]+$" }),
		}),
		detail: {
			summary: "Test router connection",
			description: "Test connectivity to a specific router",
			tags: ["Routers"],
		},
	})

	.get("/:id/info", routerHandler.getRouterInfo, {
		params: t.Object({
			id: t.String({ pattern: "^[0-9]+$" }),
		}),
		detail: {
			summary: "Get router system information",
			description: "Retrieve router identity, resources, and system info",
			tags: ["Routers"],
		},
	})

	.get("/:id/profiles", routerHandler.getRouterProfiles, {
		params: t.Object({
			id: t.String({ pattern: "^[0-9]+$" }),
		}),
		query: t.Object({
			type: t.Optional(t.Union([t.Literal("pppoe"), t.Literal("hotspot")])),
		}),
		detail: {
			summary: "Get router profiles",
			description: "Retrieve PPPoE and/or Hotspot profiles from the router",
			tags: ["Routers"],
		},
	})

	.get("/:id/interfaces", routerHandler.getRouterInterfaces, {
		params: t.Object({
			id: t.String({ pattern: "^[0-9]+$" }),
		}),
		detail: {
			summary: "Get router interfaces",
			description: "Retrieve all network interfaces from the router",
			tags: ["Routers"],
		},
	})

	.get("/:id/statistics", routerHandler.getRouterStatistics, {
		params: t.Object({
			id: t.String({ pattern: "^[0-9]+$" }),
		}),
		detail: {
			summary: "Get router statistics",
			description: "Retrieve statistics and summary for a specific router",
			tags: ["Routers"],
		},
	})

	.post("/:id/torch", routerHandler.startTorchMonitoring, {
		params: t.Object({
			id: t.String({ pattern: "^[0-9]+$" }),
		}),
		body: t.Object({
			interface: t.String({
				minLength: 1,
				description: "Interface name to monitor",
			}),
		}),
		detail: {
			summary: "Start torch monitoring",
			description: "Start real-time traffic monitoring on specified interface",
			tags: ["Routers"],
		},
	});
