import { hostname } from 'os';
import { customers, NewRouter, session_users } from "@/database/schema/mikrotik";
import { routers } from "@/database/schema/users";
import { db } from "@/lib/db";
import { createMikrotikClient } from "@/lib/mikrotik/client";
import { PaginationQuery } from "@/types/api.types";
import { eq, like, and, count, or, ne } from "drizzle-orm";


interface RouterQuery extends PaginationQuery {
	search?: string;
	status?: "active" | "inactive";
	location?: string;
}


interface UpdateRouterRequest extends Partial<NewRouter> {}


export const getAllRouters = async (query: RouterQuery) => {
	const { page = 1, limit = 10, search, status, location } = query;
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
		const isActive = status === "active";
		conditions.push(eq(routers.is_active, isActive));
	}

	if (location) {
		conditions.push(like(routers.location, `%${location}%`));
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
			session_users: {
				where: (session_users, { eq }) => eq(session_users.is_active, true),
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
			session_users: {
				with: {
					customer: true,
					profile: true,
				},
				orderBy: (session_users, { desc }) => [desc(session_users.created_at)],
			},
		},
	});

	if (!router) {
		throw new Error("Router not found");
	}

	return router;
};

export const createRouter = async (data: NewRouter) => {
	// Check if name already exists
	const existingName = await db.query.routers.findFirst({
		where: eq(routers.name, data.name),
	});

	if (existingName) {
		throw new Error("Router name already exists");
	}

	// Check if hostname:port combination already exists
	const existingHost = await db.query.routers.findFirst({
		where: and(
			eq(routers.hostname, data.hostname),
			eq(routers.port, data.port ?? 0)
		),
	});

	if (existingHost) {
		throw new Error("Router with this hostname and port already exists");
	}

	const routerData: NewRouter = {
		...data,
		is_active: data.is_active ?? true,
		last_seen: null,
		status: "unknown",
	};

	const [newRouter] = await db.insert(routers).values(routerData).returning();

	// Test connection after creating
  const client = await createMikrotikClient(newRouter.id);

	try {
		const connectionTest = await client.getSystemInfo();
		if (connectionTest) {
			await db
				.update(routers)
				.set({
					status: "connected",
					last_seen: new Date(),
				})
				.where(eq(routers.id, newRouter.id));
		}
	} catch (error:any) {
		console.warn(
			`Failed to test connection for new router ${newRouter.id}:`,
			error.message
		);
	}

	return newRouter;
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
				ne(routers.id, id)
			),
		});

		if (hostExists) {
			throw new Error("Router with this hostname and port already exists");
		}
	}

	const [updatedRouter] = await db
		.update(routers)
		.set({ ...data, updated_at: new Date() })
		.where(eq(routers.id, id))
		.returning();

	return updatedRouter;
};

export const deleteRouter = async (id: number) => {
	// Check if router has active sessions
	const activeSessions = await db.query.session_users.findMany({
		where: and(
			eq(session_users.router_id, id),
			eq(session_users.is_active, true)
		),
	});

	if (activeSessions.length > 0) {
		throw new Error("Cannot delete router with active sessions");
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

	const connectionTest = await client.getSystemInfo();

	// Update router connection status
	await db
		.update(routers)
		.set({
			status: connectionTest.connected
				? "connected"
				: "disconnected",
			last_seen: connectionTest.connected ? new Date() : router.last_seen,
		})
		.where(eq(routers.id, id));

	return connectionTest;
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

		// Update last seen
		await db
			.update(routers)
			.set({
				status: "connected",
				last_seen: new Date(),
			})
			.where(eq(routers.id, id));

		return {
			router,
			...routerInfo,
		};
	} catch (error) {
		// Update connection status to disconnected
		await db
			.update(routers)
			.set({
				status: "disconnected",
			})
			.where(eq(routers.id, id));

		throw error;
	}
};

export const getRouterProfiles = async (
	id: number,
	type?: "pppoe" | "hotspot"
) => {
	const router = await db.query.routers.findFirst({
		where: eq(routers.id, id),
	});

	if (!router) {
		throw new Error("Router not found");
	}

    const client = await createMikrotikClient(id);

	try {
		let profiles = [];

		if (!type || type === "pppoe") {
			const pppoeProfiles = await client.getPPPoEProfiles();
			profiles = [...profiles, ...pppoeProfiles];
		}

		if (!type || type === "hotspot") {
			const hotspotProfiles = await client.getHotspotProfiles();
			profiles = [...profiles, ...hotspotProfiles];
		}

		return profiles;
	} catch (error: any) {
		throw new Error(`Failed to get router profiles: ${error.message}`);
	}
};

export const getRouterInterfaces = async (id: number) => {
	const router = await db.query.routers.findFirst({
		where: eq(routers.id, id),
	});
    const client = await createMikrotikClient(id);


	if (!router) {
		throw new Error("Router not found");
	}

	return await client.getInterfaces();
};

export const getRouterStatistics = async (id: number) => {
	const [router, customer, activeSessions, allSessions] = await Promise.all([
		db.query.routers.findFirst({
			where: eq(routers.id, id),
		}),
		db.query.customers.findMany({
			where: eq(customers.router_id, id),
		}),
		db.query.session_users.findMany({
			where: and(
				eq(session_users.router_id, id),
				eq(session_users.is_active, true)
			),
		}),
		db.query.session_users.findMany({
			where: eq(session_users.router_id, id),
		}),
	]);

	if (!router) {
		throw new Error("Router not found");
	}

	const activeCustomers = customer.filter((c) => c.is_active).length;
	const pppoeUsers = allSessions.filter(
		(s) => s.type === "pppoe"
	).length;
	const hotspotUsers = allSessions.filter(
		(s) => s.type === "hotspot"
	).length;
	const vpnUsers = allSessions.filter((s) => s.type === "vpn").length;

	return {
		router,
		statistics: {
			totalCustomers: customer.length,
			activeCustomers,
			activeSessions: activeSessions.length,
			totalSessions: allSessions.length,
			sessionTypes: {
				pppoe: pppoeUsers,
				hotspot: hotspotUsers,
				vpn: vpnUsers,
			},
			connectionStatus: router.status,
			lastSeen: router.last_seen,
		},
	};
};
