import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { schema } from "@/database/schema/index"; // tetap bisa pakai schema yang sama
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { readMigrationFiles } from "drizzle-orm/migrator";

// Pastikan .env sudah di root folder dan DATABASE_URL diset
const connectionString = Bun.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL is not set in .env");
}

// postgres.js driver
const client = postgres(connectionString, {
	max: 10, // optional, max pool size
	ssl: false, // atau true kalau pakai SSL (cth di Railway, Supabase, dll)
});

// drizzle ORM client
export const db = drizzle(client, { schema });

export interface UserWithRoles {
	id: number;
	email: string;
	username: string;
	name: string | null;
	image: string | null;
	emailVerified: Date | null;
	createdAt: Date;
	updatedAt: Date;
	roles: Array<{
		id: number;
		name: string;
		description: string | null;
		createdAt: Date;
	}>;
	permissions: Array<{
		id: number;
		name: string;
		description: string | null;
		resource: {
			id: number;
			name: string;
		};
		action: {
			id: number;
			name: string;
		};
		createdAt: Date;
	}>;
}

// User functions
export async function getUserById(id: number): Promise<UserWithRoles | null> {
	const user = await db.query.users.findFirst({
		where: eq(schema.users.id, id),
		with: {
			userRoles: {
				with: {
					role: {
						with: {
							rolePermissions: {
								with: {
									permission: {
										with: {
											resource: true,
											action: true,
										},
									},
								},
							},
						},
					},
				},
			},
		},
	});

	if (!user) return null;

	const roles = user.userRoles.map((ur) => ur.role);
	const permissions = user.userRoles.flatMap((ur) =>
		ur.role.rolePermissions.map((rp) => ({
			id: rp.permission.id,
			name: rp.permission.name,
			description: rp.permission.description,
			resource: rp.permission.resource,
			action: rp.permission.action,
			createdAt: rp.permission.createdAt,
		}))
	);

	return {
		id: user.id,
		email: user.email,
		username: user.username,
		name: user.name,
		image: user.image,
		emailVerified: user.emailVerified,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
		roles,
		permissions,
	};
}

export async function getUserByEmail(
	email: string
): Promise<UserWithRoles | null> {
	const user = await db.query.users.findFirst({
		where: eq(schema.users.email, email),
		with: {
			userRoles: {
				with: {
					role: {
						with: {
							rolePermissions: {
								with: {
									permission: {
										with: {
											resource: true,
											action: true,
										},
									},
								},
							},
						},
					},
				},
			},
		},
	});

	if (!user) return null;

	const roles = user.userRoles.map((ur) => ur.role);
	const permissions = user.userRoles.flatMap((ur) =>
		ur.role.rolePermissions.map((rp) => ({
			id: rp.permission.id,
			name: rp.permission.name,
			description: rp.permission.description,
			resource: rp.permission.resource,
			action: rp.permission.action,
			createdAt: rp.permission.createdAt,
		}))
	);

	return {
		id: user.id,
		email: user.email,
		username: user.username,
		name: user.name,
		image: user.image,
		emailVerified: user.emailVerified,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
		roles,
		permissions,
	};
}

export async function getUserByUsername(username: string) {
	return await db.query.users.findFirst({
		where: eq(schema.users.username, username),
	});
}

export async function createUser(
	email: string,
	username: string,
	password: string,
	name: string
) {
	const hashedPassword = await bcrypt.hash(password, 10);

	const newUser: typeof schema.users.$inferInsert = {
		email,
		username,
		password: hashedPassword,
		name,
	};

	const [user] = await db.insert(schema.users).values(newUser).returning();

	// Assign default user role
	await assignRoleToUser(user.id, "user");

	return user;
}

export async function getAllUsers() {
	return await db.query.users.findMany({
		with: {
			userRoles: {
				with: {
					role: true,
				},
			},
		},
	});
}

export async function updateUser(
	id: number,
	data: Partial<typeof schema.users.$inferInsert>
) {
	const updateData = { ...data, updatedAt: new Date() };

	const [updatedUser] = await db
		.update(schema.users)
		.set(updateData)
		.where(eq(schema.users.id, id))
		.returning();

	return updatedUser;
}

export async function deleteUser(id: number) {
	await db.delete(schema.users).where(eq(schema.users.id, id));
}

// Role functions
export async function getAllRoles() {
	return await db.query.roles.findMany({
		with: {
			rolePermissions: {
				with: {
					permission: {
						with: {
							resource: true,
							action: true,
						},
					},
				},
			},
		},
	});
}

export async function createRole(name: string, description?: string) {
	const newRole: typeof schema.roles.$inferInsert = { name, description };

	const [role] = await db.insert(schema.roles).values(newRole).returning();
	return role;
}

export async function updateRole(
	id: number,
	data: Partial<typeof schema.roles.$inferInsert>
) {
	const [updatedRole] = await db
		.update(schema.roles)
		.set(data)
		.where(eq(schema.roles.id, id))
		.returning();

	return updatedRole;
}

export async function deleteRole(id: number) {
	await db.delete(schema.roles).where(eq(schema.roles.id, id));
}

export async function assignRoleToUser(userId: number, roleName: string) {
	const role = await db.query.roles.findFirst({
		where: eq(schema.roles.name, roleName),
	});

	if (role) {
		const userRole: typeof schema.userRoles.$inferInsert = {
			userId,
			roleId: role.id,
		};
		await db.insert(schema.userRoles).values(userRole).onConflictDoNothing();
	}
}

export async function assignRolesToUser(userId: number, roleIds: number[]) {
	// First, remove all existing roles for this user
	await db.delete(schema.userRoles).where(eq(schema.userRoles.userId, userId));

	// Then assign new roles
	if (roleIds.length > 0) {
		const userRoles: (typeof schema.userRoles.$inferInsert)[] = roleIds.map(
			(roleId) => ({ userId, roleId })
		);
		await db.insert(schema.userRoles).values(userRoles);
	}
}

export async function removeRoleFromUser(userId: number, roleId: number) {
	await db
		.delete(schema.userRoles)
		.where(
			and(
				eq(schema.userRoles.userId, userId),
				eq(schema.userRoles.roleId, roleId)
			)
		);
}

// Resource functions
export async function getAllResources() {
	return await db.select().from(schema.resources);
}

export async function createResource(name: string, description?: string) {
	const newResource: typeof schema.resources.$inferInsert = {
		name,
		description,
	};

	const [resource] = await db
		.insert(schema.resources)
		.values(newResource)
		.returning();
	return resource;
}

export async function updateResource(
	id: number,
	data: Partial<typeof schema.resources.$inferInsert>
) {
	const [updatedResource] = await db
		.update(schema.resources)
		.set(data)
		.where(eq(schema.resources.id, id))
		.returning();

	return updatedResource;
}

export async function deleteResource(id: number) {
	await db.delete(schema.resources).where(eq(schema.resources.id, id));
}

// Action functions
export async function getAllActions() {
	return await db.select().from(schema.actions);
}

export async function createAction(name: string, description?: string) {
	const newAction: typeof schema.actions.$inferInsert = {
		name,
		description,
	};

	const [action] = await db
		.insert(schema.actions)
		.values(newAction)
		.returning();
	return action;
}

export async function updateAction(
	id: number,
	data: Partial<typeof schema.actions.$inferInsert>
) {
	const [updatedAction] = await db
		.update(schema.actions)
		.set(data)
		.where(eq(schema.actions.id, id))
		.returning();

	return updatedAction;
}

export async function deleteAction(id: number) {
	await db.delete(schema.actions).where(eq(schema.actions.id, id));
}

// Permission functions
export async function getAllPermissions() {
	return await db.query.permissions.findMany({
		with: {
			resource: true,
			action: true,
		},
	});
}

export async function createPermission(
	name: string,
	description: string,
	resourceId: number,
	actionId: number
) {
	const newPermission: typeof schema.permissions.$inferInsert = {
		name,
		description,
		resourceId,
		actionId,
	};

	const [permission] = await db
		.insert(schema.permissions)
		.values(newPermission)
		.returning();
	return permission;
}

export async function updatePermission(
	id: number,
	data: Partial<typeof schema.permissions.$inferInsert>
) {
	const [updatedPermission] = await db
		.update(schema.permissions)
		.set(data)
		.where(eq(schema.permissions.id, id))
		.returning();

	return updatedPermission;
}

export async function deletePermission(id: number) {
	await db.delete(schema.permissions).where(eq(schema.permissions.id, id));
}

export async function assignPermissionToRole(
	roleId: number,
	permissionId: number
) {
	const rolePermission: typeof schema.rolePermissions.$inferInsert = {
		roleId,
		permissionId,
	};
	await db
		.insert(schema.rolePermissions)
		.values(rolePermission)
		.onConflictDoNothing();
}

export async function assignPermissionsToRole(
	roleId: number,
	permissionIds: number[]
) {
	// First, remove all existing permissions for this role
	await db
		.delete(schema.rolePermissions)
		.where(eq(schema.rolePermissions.roleId, roleId));

	// Then assign new permissions
	if (permissionIds.length > 0) {
		const rolePermissions: (typeof schema.rolePermissions.$inferInsert)[] =
			permissionIds.map((permissionId) => ({
				roleId,
				permissionId,
			}));
		await db.insert(schema.rolePermissions).values(rolePermissions);
	}
}

export async function removePermissionFromRole(
	roleId: number,
	permissionId: number
) {
	await db
		.delete(schema.rolePermissions)
		.where(
			and(
				eq(schema.rolePermissions.roleId, roleId),
				eq(schema.rolePermissions.permissionId, permissionId)
			)
		);
}

export async function hasPermission(
	userId: number,
	permission: string
): Promise<boolean> {
	const user = await getUserById(userId);
	return user?.permissions.some((p) => p.name === permission) || false;
}

// export async function createActivityLog(data: CreateActivityLogData) {
// 	const logData: typeof activityLogs.$inferInsert = {
// 		user_id: data.userId,
// 		action: data.action,
// 		resource_type: data.resourceType,
// 		resource_id: data.resourceId,
// 		details: data.details,
// 		ip_address: data.ipAddress,
// 		user_agent: data.userAgent,
// 	};

// 	const [log] = await db.insert(activityLogs).values(logData).returning();
// 	return log;
// }
