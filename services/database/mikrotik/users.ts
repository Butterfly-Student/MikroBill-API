import { and, eq, desc } from "drizzle-orm";
import { schema } from "@/database/schema/index";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type {
  NetworkConfig,
  LimitsConfig,
  UsageStats,
} from "@/types/session.drizzle";
import { Customer, NewSessionUser, SessionUser } from "@/database/schema/mikrotik";

export interface SessionUserWithDetails {
	id: number;
	router_id: number;
	profile_id: number | null;
	customer_id: number | null;
	name: string;
	password: string | null;
	type: string;
	network_config: Partial<NetworkConfig> | null;
	limits: Partial<LimitsConfig> | null;
	expiry_date: Date | null;
	last_login: Date | null;
	usage_stats: UsageStats | null;
	comment: string | null;
	mikrotik_id: string | null;
	synced_to_mikrotik: boolean | null;
	status: string | null;
	is_active: boolean | null;
	created_at: Date;
	updated_at: Date;
	router: {
		id: number;
		name: string;
		hostname: string;
	};
	profile?: {
		id: number;
		name: string;
		type: string;
	} | null;
	customer?: {
		id: number;
		username: string;
		first_name: string | null;
		last_name: string | null;
	} | null;
}

export async function getSessionUserById(
	id: number
): Promise<SessionUserWithDetails | null> {
	const sessionUser = await db.query.session_users.findFirst({
		where: eq(schema.session_users.id, id),
		with: {
			router: {
				columns: {
					id: true,
					name: true,
					hostname: true,
				},
			},
			profile: {
				columns: {
					id: true,
					name: true,
					type: true,
				},
			},
			customer: {
				columns: {
					id: true,
					username: true,
					first_name: true,
					last_name: true,
				},
			},
		},
	});

	return sessionUser as SessionUserWithDetails | null;
}

export async function getSessionUserByName(
	name: string,
	routerId: number
): Promise<SessionUser | null> {
	const sessionUser = await db.query.session_users.findFirst({
		where: and(
			eq(schema.session_users.name, name),
			eq(schema.session_users.router_id, routerId)
		),

  });
  return sessionUser as SessionUser | null;
}

export async function getAllSessionUsers(): Promise<SessionUserWithDetails[]> {
	const sessionUsers = await db.query.session_users.findMany({
		with: {
			router: {
				columns: {
					id: true,
					name: true,
					hostname: true,
				},
			},
			profile: {
				columns: {
					id: true,
					name: true,
					type: true,
				},
			},
			customer: {
				columns: {
					id: true,
					username: true,
					first_name: true,
					last_name: true,
				},
			},
		},
		orderBy: [desc(schema.session_users.created_at)],
	});

	return sessionUsers as SessionUserWithDetails[];
}

export async function getSessionUsersByRouter(
	routerId: number
): Promise<SessionUser[]> {
	return await db.query.session_users.findMany({
		where: eq(schema.session_users.router_id, routerId),
		orderBy: [desc(schema.session_users.created_at)],
	});
}

export async function getSessionUsersByCustomer(
	customerId: number
): Promise<SessionUser[]> {
	return await db.query.session_users.findMany({
		where: eq(schema.session_users.customer_id, customerId),
		orderBy: [desc(schema.session_users.created_at)],
	});
}

export async function getSessionUsersByProfile(
	profileId: number
): Promise<SessionUser[]> {
	return await db.query.session_users.findMany({
		where: eq(schema.session_users.profile_id, profileId),
		orderBy: [desc(schema.session_users.created_at)],
	});
}

export async function createSessionUser(
	data: Omit<NewSessionUser, "id" | "created_at" | "updated_at"> & {
		password?: string;
	}
): Promise<SessionUser> {
	let hashedPassword = null;
	if (data.password) {
		hashedPassword = await bcrypt.hash(data.password, 10);
	}

	const newSessionUser: NewSessionUser = {
		...data,
		password: hashedPassword,
		created_at: new Date(),
		updated_at: new Date(),
	};

	const [sessionUser] = await db
		.insert(schema.session_users)
		.values(newSessionUser)
		.returning();

	return sessionUser;
}

export async function updateSessionUser(
	id: number,
	data: Partial<Omit<NewSessionUser, "id" | "created_at">> & {
		password?: string;
	}
): Promise<SessionUser | null> {
	let updateData: any = { ...data };

	if (data.password) {
		updateData.password = await bcrypt.hash(data.password, 10);
	}

	updateData.updated_at = new Date();

	const [updatedSessionUser] = await db
		.update(schema.session_users)
		.set(updateData)
		.where(eq(schema.session_users.id, id))
		.returning();

	return updatedSessionUser || null;
}

export async function deleteSessionUser(id: number): Promise<void> {
	await db.delete(schema.session_users).where(eq(schema.session_users.id, id));
}

export async function updateSessionUserLastLogin(id: number): Promise<void> {
	await db
		.update(schema.session_users)
		.set({
			last_login: new Date(),
			updated_at: new Date(),
		})
		.where(eq(schema.session_users.id, id));
}

export async function updateSessionUserUsageStats(
	id: number,
	usageStats: UsageStats
): Promise<SessionUser | null> {
	const [updatedSessionUser] = await db
		.update(schema.session_users)
		.set({
			usage_stats: usageStats,
			updated_at: new Date(),
		})
		.where(eq(schema.session_users.id, id))
		.returning();

	return updatedSessionUser || null;
}

// ============ UTILITY FUNCTIONS ============

export async function getActiveSessionUsersByRouter(
	routerId: number
): Promise<SessionUser[]> {
	return await db.query.session_users.findMany({
		where: and(
			eq(schema.session_users.router_id, routerId),
			eq(schema.session_users.is_active, true)
		),
		orderBy: [desc(schema.session_users.last_login)],
	});
}

export async function getExpiredSessionUsers(): Promise<SessionUser[]> {
	const now = new Date();
	return await db.query.session_users.findMany({
		where: and(
			eq(schema.session_users.is_active, true)
			// Assuming expiry_date exists and is less than current time
		),
	});
}

export async function validateSessionUserCredentials(
	name: string,
	password: string,
	routerId: number
): Promise<SessionUser | null> {
	const sessionUser = await db.query.session_users.findFirst({
		where: and(
			eq(schema.session_users.name, name),
			eq(schema.session_users.router_id, routerId),
			eq(schema.session_users.is_active, true)
		),
	});

	if (!sessionUser || !sessionUser.password) {
		return null;
	}

	const isValidPassword = await bcrypt.compare(password, sessionUser.password);
	return isValidPassword ? sessionUser : null;
}

export async function validateCustomerCredentials(
	username: string,
	password: string
): Promise<Customer | null> {
	const customer = await db.query.customers.findFirst({
		where: and(
			eq(schema.customers.username, username),
			eq(schema.customers.is_active, true)
		),
	});

	if (!customer || !customer.password) {
		return null;
	}

	const isValidPassword = await bcrypt.compare(password, customer.password);
	return isValidPassword ? customer : null;
}
