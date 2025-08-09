import { Elysia, t } from "elysia";
import * as customerHandler from "@/handlers/customers.handlers";

export const customerRoutes = new Elysia({ prefix: "/customers" })
	.get("/", customerHandler.getCustomers, {
		query: t.Object({
			page: t.Optional(t.Number({ minimum: 1 })),
			limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
			search: t.Optional(t.String({ minLength: 1 })),
			status: t.Optional(
				t.Union([
					t.Literal("active"),
					t.Literal("inactive"),
					t.Literal("suspended"),
				])
			),
			router_id: t.Optional(t.Number({ minimum: 1 })),
		}),
		detail: {
			summary: "Get all customers",
			description: "Retrieve customers with optional filtering and pagination",
			tags: ["Customers"],
		},
	})

	.post("/", customerHandler.createCustomer, {
		body: t.Object({
			username: t.String({
				minLength: 3,
				maxLength: 50,
				pattern: "^[a-zA-Z0-9_-]+$",
			}),
			password: t.Optional(t.String({ minLength: 6 })),
			first_name: t.Optional(t.String({ maxLength: 50 })),
			last_name: t.Optional(t.String({ maxLength: 50 })),
			email: t.Optional(t.String({ format: "email", maxLength: 255 })),
			phone: t.Optional(t.String({ maxLength: 20 })),
			address: t.Optional(t.String({ maxLength: 500 })),
			service_plan_id: t.Optional(t.Number({ minimum: 1 })),
			router_id: t.Optional(t.Number({ minimum: 1 })),
			notes: t.Optional(t.String({ maxLength: 1000 })),
		}),
		detail: {
			summary: "Create new customer",
			description: "Create a new customer account",
			tags: ["Customers"],
		},
	})

	.get("/:id", customerHandler.getCustomerById, {
		params: t.Object({
			id: t.String({ pattern: "^[0-9]+$" }),
		}),
		detail: {
			summary: "Get customer by ID",
			description: "Retrieve a specific customer with related data",
			tags: ["Customers"],
		},
	})

	.put("/:id", customerHandler.updateCustomer, {
		params: t.Object({
			id: t.String({ pattern: "^[0-9]+$" }),
		}),
		body: t.Object({
			username: t.Optional(
				t.String({
					minLength: 3,
					maxLength: 50,
					pattern: "^[a-zA-Z0-9_-]+$",
				})
			),
			password: t.Optional(t.String({ minLength: 6 })),
			first_name: t.Optional(t.String({ maxLength: 50 })),
			last_name: t.Optional(t.String({ maxLength: 50 })),
			email: t.Optional(t.String({ format: "email", maxLength: 255 })),
			phone: t.Optional(t.String({ maxLength: 20 })),
			address: t.Optional(t.String({ maxLength: 500 })),
			service_plan_id: t.Optional(t.Number({ minimum: 1 })),
			router_id: t.Optional(t.Number({ minimum: 1 })),
			notes: t.Optional(t.String({ maxLength: 1000 })),
			status: t.Optional(
				t.Union([
					t.Literal("active"),
					t.Literal("inactive"),
					t.Literal("suspended"),
				])
			),
			is_active: t.Optional(t.Boolean()),
		}),
		detail: {
			summary: "Update customer",
			description: "Update customer information",
			tags: ["Customers"],
		},
	})

	.delete("/:id", customerHandler.deleteCustomer, {
		params: t.Object({
			id: t.String({ pattern: "^[0-9]+$" }),
		}),
		detail: {
			summary: "Delete customer",
			description: "Delete a customer account (only if no active sessions)",
			tags: ["Customers"],
		},
	})

	.get("/:id/sessions", customerHandler.getCustomerSessions, {
		params: t.Object({
			id: t.String({ pattern: "^[0-9]+$" }),
		}),
		detail: {
			summary: "Get customer sessions",
			description: "Retrieve all sessions for a specific customer",
			tags: ["Customers"],
		},
	})

	.get("/:id/statistics", customerHandler.getCustomerStatistics, {
		params: t.Object({
			id: t.String({ pattern: "^[0-9]+$" }),
		}),
		detail: {
			summary: "Get customer statistics",
			description: "Retrieve statistics and summary for a specific customer",
			tags: ["Customers"],
		},
	});
