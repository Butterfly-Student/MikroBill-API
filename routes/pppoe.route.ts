import { Elysia, t } from "elysia";
import * as routerPppoeHandler from "@/handlers/pppoe.handlers";

export const routerPppoeRoutes = new Elysia({
	prefix: "/routers/:router_id/pppoe",
})

	// ============ PROFILE ROUTES ============
	.get("/inactive/users", routerPppoeHandler.getRouterPppoeInactiveUsers, {
		params: t.Object({
			router_id: t.Number({ minimum: 1 }),
		}),
		query: t.Object({
			search: t.String({ minLength: 1, maxLength: 100 }),
		}),
		detail: {
			summary: "Get pppoe inactieve users",
			description: "Retrieve all pppoe inactieve users from database",
			tags: ["Routers", "Pppoe", "users"],
		},
	});
