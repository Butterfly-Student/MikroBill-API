import { and, eq, desc } from "drizzle-orm";
import { schema } from "@/database/schema/index";
import { db } from "@/lib/db";
import type {
	NetworkConfig,
	BandwidthConfig,
	TimeoutConfig,
	LimitsConfig,
	SecurityConfig,
	AdvancedConfig,
} from "@/types/session.drizzle";
import { NewSessionProfile, SessionProfile } from "@/database/schema/mikrotik";

// ============ SESSION PROFILES CRUD ============

export interface SessionProfileWithRouter {
	id: number;
	router_id: number;
	name: string;
	type: string;
	price: string;
	sell_price: string;
	network_config: NetworkConfig | null;
	bandwidth_config: BandwidthConfig | null;
	timeout_config: TimeoutConfig | null;
	limits: LimitsConfig | null;
	security_config: SecurityConfig | null;
	advanced_config: AdvancedConfig | null;
	comment: string | null;
	mikrotik_id: string | null;
	synced_to_mikrotik: boolean;
	status: string | null;
	is_active: boolean;
	created_at: Date;
	updated_at: Date;
	router: {
		id: number;
		name: string;
		hostname: string;
	};
}

export async function getSessionProfileById(
	id: number
): Promise<SessionProfileWithRouter | null> {
	const profile = await db.query.session_profiles.findFirst({
		where: eq(schema.session_profiles.id, id),
		with: {
			router: {
				columns: {
					id: true,
					name: true,
					hostname: true,
				},
			},
		},
	});

	return profile as SessionProfileWithRouter | null;
}

export async function getSessionProfilesByRouter(
	routerId: number
): Promise<SessionProfile[]> {
	return await db.query.session_profiles.findMany({
		where: eq(schema.session_profiles.router_id, routerId),
		orderBy: [desc(schema.session_profiles.created_at)],
	});
}

export async function getAllSessionProfiles(): Promise<
	SessionProfileWithRouter[]
> {
	const profiles = await db.query.session_profiles.findMany({
		with: {
			router: {
				columns: {
					id: true,
					name: true,
					hostname: true,
				},
			},
		},
		orderBy: [desc(schema.session_profiles.created_at)],
	});

	return profiles as SessionProfileWithRouter[];
}

export async function createSessionProfile(
	data: Omit<NewSessionProfile, "id" | "created_at" | "updated_at">
): Promise<SessionProfile> {
	const newProfile: NewSessionProfile = {
		...data,
		created_at: new Date(),
		updated_at: new Date(),
	};

	const [profile] = await db
		.insert(schema.session_profiles)
		.values(newProfile)
		.returning();

	return profile;
}

export async function updateSessionProfile(
	id: number,
	data: Partial<Omit<NewSessionProfile, "id" | "created_at">>
): Promise<SessionProfile | null> {
	const updateData = {
		...data,
		updated_at: new Date(),
	};

	const [updatedProfile] = await db
		.update(schema.session_profiles)
		.set(updateData)
		.where(eq(schema.session_profiles.id, id))
		.returning();

	return updatedProfile || null;
}

export async function deleteSessionProfile(id: number): Promise<void> {
	await db
		.delete(schema.session_profiles)
		.where(eq(schema.session_profiles.id, id));
}

export async function getSessionProfileByName(
	name: string,
	routerId: number
): Promise<SessionProfile | null> {
	const result = await db.query.session_profiles.findFirst({
		where: and(
			eq(schema.session_profiles.name, name),
			eq(schema.session_profiles.router_id, routerId)
		),
	});
	return result || null;
}
