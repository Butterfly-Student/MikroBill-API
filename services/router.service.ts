// router.service.ts

import { customers, hotspot_active_sessions, NewRouter, ppp_active_sessions } from "@/database/schema/mikrotik";
import { routers } from "@/database/schema/users";
import { db } from "@/lib/db";
import { createMikrotikClient } from "@/lib/mikrotik/client";
import { PaginationQuery } from "@/types/api.types";
import { eq, like, and, count, or, ne } from "drizzle-orm";

interface RouterQuery extends PaginationQuery {
	search?: string;
	status?: "online" | "offline" | "error";
	location?: string;
	is_active?: boolean;
}

interface UpdateRouterRequest extends Partial<NewRouter> {}

export const getAllRouters = async (query: RouterQuery) => {
	const { page = 1, limit = 10, search, status, location, is_active } = query;
	const offset = (page - 1) * limit;

	// Build where conditions
	const conditions = [];

	if (search) {
		conditions.push(
			or(
				like(routers.name, `%${search}%`),
				like(routers.hostname, `%${search}%`),
				like(routers.location, `%${search}%`),
				like(routers.description, `%${search}%`)
			)
		);
	}

	if (status) {
		conditions.push(eq(routers.status, status));
	}

	if (location) {
		conditions.push(like(routers.location, `%${location}%`));
	}

	if (is_active !== undefined) {
		conditions.push(eq(routers.is_active, is_active));
	}

	const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

	// Get total count
	const [{ total }] = await db
		.select({ total: count() })
		.from(routers)
		.where(whereCondition);

	// Get routers with pagination
	const routerList = await db.query.routers.findMany({
		where: whereCondition,
		limit,
		offset,
		with: {
			customers: {
				limit: 5,
				orderBy: (customers, { desc }) => [desc(customers.created_at)],
			},
			ppp_active_sessions: {
				where: (ppp_active_sessions, { eq }) =>
					eq(ppp_active_sessions.status, "active"),
				limit: 10,
			},
			hotspot_active_sessions: {
				where: (hotspot_active_sessions, { eq }) =>
					eq(hotspot_active_sessions.status, "active"),
				limit: 10,
			},
		},
		orderBy: (routers, { desc }) => [desc(routers.created_at)],
	});

	return {
		routers: routerList,
		pagination: { page, limit, total },
	};
};

export const getRouterById = async (id: number) => {
	const router = await db.query.routers.findFirst({
		where: eq(routers.id, id),
		with: {
			customers: {
				orderBy: (customers, { desc }) => [desc(customers.created_at)],
			},
			ppp_active_sessions: {
				with: {
					customer: true,
					ppp_user: {
						with: {
							profile: true,
						},
					},
				},
				orderBy: (ppp_active_sessions, { desc }) => [
					desc(ppp_active_sessions.created_at),
				],
			},
			hotspot_active_sessions: {
				with: {
					customer: true,
					hotspot_user: {
						with: {
							profile: true,
						},
					},
				},
				orderBy: (hotspot_active_sessions, { desc }) => [
					desc(hotspot_active_sessions.created_at),
				],
			},
		},
	});

	if (!router) {
		throw new Error("Router not found");
	}

	return router;
};

export const createRouter = async (data: NewRouter) => {
	// Cek name unik
	const existingName = await db.query.routers.findFirst({
		where: eq(routers.name, data.name),
	});
	if (existingName) throw new Error("Router name already exists");

	// Cek host+port unik
	const existingHost = await db.query.routers.findFirst({
		where: and(
			eq(routers.hostname, data.hostname),
			eq(routers.port, data.port ?? 8728)
		),
	});
	if (existingHost)
		throw new Error("Router with this hostname and port already exists");

	// Insert awal
	const [newRouter] = await db
		.insert(routers)
		.values({
			...data,
			is_active: data.is_active ?? true,
			last_seen: null,
			status: "offline", // default
			port: data.port ?? 8728,
			timeout: data.timeout ?? 300000,
			keepalive: data.keepalive ?? true,
		})
		.returning();

	let statusUpdate: Partial<typeof routers.$inferInsert> = { status: "error" };

	try {
		const client = await createMikrotikClient(newRouter.id);
		const connectionTest = await client.getSystemInfo();

		if (connectionTest) {
			statusUpdate = {
				status: "online",
				last_seen: new Date(),
				version: connectionTest.version ?? null,
				uptime: connectionTest.uptime ?? null,
			};
		}
	} catch (err: any) {
		console.warn(
			`Failed to test connection for router ${newRouter.id}:`,
			err.message
		);
	}

	// update status
	await db
		.update(routers)
		.set(statusUpdate)
		.where(eq(routers.id, newRouter.id));

	// fetch ulang - PERBAIKAN: simpan hasil query ke variabel
	const updatedRouter = await db.query.routers.findFirst({
		where: eq(routers.id, newRouter.id),
		with: {
			customers: true,
			ppp_active_sessions: true,
			hotspot_active_sessions: true,
		},
	});

	// ⬇️ hanya 1 kali return
	return updatedRouter
};

export const updateRouter = async (id: number, data: UpdateRouterRequest) => {
	// Check if router exists
	const existingRouter = await db.query.routers.findFirst({
		where: eq(routers.id, id),
	});

	if (!existingRouter) {
		throw new Error("Router not found");
	}

	// Check name uniqueness if updating name
	if (data.name && data.name !== existingRouter.name) {
		const nameExists = await db.query.routers.findFirst({
			where: and(eq(routers.name, data.name), ne(routers.id, id)),
		});

		if (nameExists) {
			throw new Error("Router name already exists");
		}
	}

	// Check hostname:port uniqueness if updating either
	if (
		(data.hostname || data.port) &&
		(data.hostname !== existingRouter.hostname ||
			data.port !== existingRouter.port)
	) {
		const hostname = data.hostname || existingRouter.hostname;
		const port = data.port || existingRouter.port;

		const hostExists = await db.query.routers.findFirst({
			where: and(
				eq(routers.hostname, hostname),
				eq(routers.port, port ?? 8728),
				ne(routers.id, id)
			),
		});

		if (hostExists) {
			throw new Error("Router with this hostname and port already exists");
		}
	}

	// Update router
	const [updatedRouter] = await db
		.update(routers)
		.set({ ...data, updated_at: new Date() })
		.where(eq(routers.id, id))
		.returning();

	let statusUpdate: Partial<typeof routers.$inferInsert> = {};

	// Test connection after updating if connection details changed
	if (data.hostname || data.port || data.username || data.password) {
		try {
			const client = await createMikrotikClient(updatedRouter.id);
			const connectionTest = await client.getSystemInfo();

			if (connectionTest) {
				statusUpdate = {
					status: "online",
					last_seen: new Date(),
					version: connectionTest.version || null,
					uptime: connectionTest.uptime || null,
				};
			}
		} catch (error: any) {
			console.warn(
				`Failed to test connection for updated router ${updatedRouter.id}:`,
				error.message
			);

			// Update status to error if connection fails
			statusUpdate = {
				status: "error",
			};
		}

		// Update status jika ada perubahan koneksi
		if (Object.keys(statusUpdate).length > 0) {
			await db
				.update(routers)
				.set(statusUpdate)
				.where(eq(routers.id, updatedRouter.id));
		}
	}

	// Fetch ulang dengan relasi seperti createRouter
	const finalRouter = await db.query.routers.findFirst({
		where: eq(routers.id, updatedRouter.id),
		with: {
			customers: true,
			ppp_active_sessions: true,
			hotspot_active_sessions: true,
		},
	});

	// Return dengan format yang sama seperti createRouter
	return finalRouter;
};

export const deleteRouter = async (id: number) => {
	// Check if router has active PPPoE sessions
	const activePppSessions = await db.query.ppp_active_sessions.findMany({
		where: and(
			eq(ppp_active_sessions.router_id, id),
			eq(ppp_active_sessions.status, "active")
		),
	});

	if (activePppSessions.length > 0) {
		throw new Error("Cannot delete router with active PPPoE sessions");
	}

	// Check if router has active Hotspot sessions
	const activeHotspotSessions = await db.query.hotspot_active_sessions.findMany(
		{
			where: and(
				eq(hotspot_active_sessions.router_id, id),
				eq(hotspot_active_sessions.status, "active")
			),
		}
	);

	if (activeHotspotSessions.length > 0) {
		throw new Error("Cannot delete router with active Hotspot sessions");
	}

	// Check if router has customers
	const routerCustomers = await db.query.customers.findMany({
		where: eq(customers.router_id, id),
	});

	if (routerCustomers.length > 0) {
		throw new Error("Cannot delete router with assigned customers");
	}

	const [deletedRouter] = await db
		.delete(routers)
		.where(eq(routers.id, id))
		.returning();

	if (!deletedRouter) {
		throw new Error("Router not found");
	}

	return deletedRouter;
};

export const testRouterConnection = async (id: number) => {
	const router = await db.query.routers.findFirst({
		where: eq(routers.id, id),
	});

	if (!router) {
		throw new Error("Router not found");
	}

	const client = await createMikrotikClient(id);

	try {
		const connectionTest = await client.getSystemInfo();

		// Update router connection status
		await db
			.update(routers)
			.set({
				status: connectionTest.connected ? "online" : "offline",
				last_seen: connectionTest.connected ? new Date() : router.last_seen,
				version: connectionTest.version || router.version,
				uptime: connectionTest.uptime || router.uptime,
			})
			.where(eq(routers.id, id));

		return connectionTest;
	} catch (error) {
		// Update connection status to error
		await db
			.update(routers)
			.set({
				status: "error",
			})
			.where(eq(routers.id, id));

		throw error;
	}
};

export const getRouterInfo = async (id: number) => {
	const router = await db.query.routers.findFirst({
		where: eq(routers.id, id),
	});

	if (!router) {
		throw new Error("Router not found");
	}

	const client = await createMikrotikClient(id);

	try {
		const routerInfo = await client.getIdentity();

		// Update last seen and status
		await db
			.update(routers)
			.set({
				status: "online",
				last_seen: new Date(),
			})
			.where(eq(routers.id, id));

		return {
			router,
			...routerInfo,
		};
	} catch (error) {
		// Update connection status to error
		await db
			.update(routers)
			.set({
				status: "error",
			})
			.where(eq(routers.id, id));

		throw error;
	}
};

export const getPPPoEProfiles = async (id: number) => {
	const client = await createMikrotikClient(id);
	return await client.getPPPoEProfiles();
};

export const getHotspotProfiles = async (id: number) => {
	const client = await createMikrotikClient(id);
	return await client.getHotspotProfiles();
};

export const getRouterInterfaces = async (id: number) => {
	const client = await createMikrotikClient(id);
	return await client.getInterfaces();
};

export const getRouterStats = async (id: number) => {
	const router = await db.query.routers.findFirst({
		where: eq(routers.id, id),
		with: {
			customers: true,
			ppp_active_sessions: {
				where: (ppp_active_sessions, { eq }) =>
					eq(ppp_active_sessions.status, "active"),
			},
			hotspot_active_sessions: {
				where: (hotspot_active_sessions, { eq }) =>
					eq(hotspot_active_sessions.status, "active"),
			},
		},
	});

	if (!router) {
		throw new Error("Router not found");
	}

	return {
		total_customers: router.customers.length,
		active_ppp_sessions: router.ppp_active_sessions.length,
		active_hotspot_sessions: router.hotspot_active_sessions.length,
		total_active_sessions:
			router.ppp_active_sessions.length + router.hotspot_active_sessions.length,
		router_info: {
			id: router.id,
			name: router.name,
			hostname: router.hostname,
			status: router.status,
			last_seen: router.last_seen,
			version: router.version,
			uptime: router.uptime,
		},
	};
};
