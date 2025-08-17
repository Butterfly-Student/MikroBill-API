import { z } from "zod";

export const createRouterSchema = z.object({
	name: z
		.string()
		.min(1, "Router name is required")
		.max(100, "Router name must be less than 100 characters"),
	ip_address: z.string().ip("Invalid IP address format"),
	username: z
		.string()
		.min(1, "Username is required")
		.max(50, "Username must be less than 50 characters"),
	password: z
		.string()
		.min(1, "Password is required")
		.max(100, "Password must be less than 100 characters"),
	port: z
		.number()
		.int("Port must be an integer")
		.min(1, "Port must be greater than 0")
		.max(65535, "Port must be less than 65536")
		.default(8728),
	timeout: z
		.number()
		.int("Timeout must be an integer")
		.min(1000, "Timeout must be at least 1000ms")
		.max(300000, "Timeout must be less than 300000ms")
		.default(30000),
	keepalive: z.boolean().optional(),
	location: z
		.string()
		.max(200, "Location must be less than 200 characters")
		.optional(),
	description: z
		.string()
		.max(500, "Description must be less than 500 characters")
		.optional(),
});

export const testConnectionSchema = z.object({
	ip_address: z.string().ip("Invalid IP address format"),
	username: z.string().min(1, "Username is required"),
	password: z.string().min(1, "Password is required"),
	port: z
		.number()
		.int("Port must be an integer")
		.min(1, "Port must be greater than 0")
		.max(65535, "Port must be less than 65536")
		.default(8728),
	timeout: z
		.number()
		.int("Timeout must be an integer")
		.min(1000, "Timeout must be at least 1000ms")
		.max(300000, "Timeout must be less than 300000ms")
		.default(30000),
});

export const routerIdSchema = z.object({
	id: z
		.string()
		.regex(/^\d+$/, "Router ID must be a valid number")
		.transform(Number)
		.refine((val) => val > 0, "Router ID must be greater than 0"),
});

export type CreateRouterInput = z.infer<typeof createRouterSchema>;
export type TestConnectionInput = z.infer<typeof testConnectionSchema>;
export type RouterIdInput = z.infer<typeof routerIdSchema>;

// lib/utils/api-response.ts
