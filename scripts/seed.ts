import "dotenv/config";
import * as schema from "@/database/schema/users";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";


async function main() {
	console.log("🌱 Starting database seeding...");

	try {
		// Check if tables exist
		console.log("Checking if tables exist...");

		try {
			await db.query.resources.findFirst();
			console.log("✅ Tables exist, proceeding with seeding...");
		} catch (error) {
			console.error("❌ Tables don't exist! Please run migrations first:");
			console.error("   npx drizzle-kit push:pg");
			console.error("   or");
			console.error("   npx drizzle-kit migrate");
			throw new Error("Database tables not found. Run migrations first.");
		}

		// Create default resources (LENGKAPI SEMUA RESOURCE YANG ADA DI PERMISSIONS)
		console.log("Creating default resources...");
		const resourcesData = [
			{ name: "users", description: "User management and profiles" },
			{ name: "roles", description: "Role management and assignments" },
			{
				name: "permissions",
				description: "Permission management and access control",
			},
			{ name: "projects", description: "Project management and collaboration" },
			{ name: "dashboard", description: "Dashboard and overview features" },
			{ name: "settings", description: "System and user settings" },
			{ name: "analytics", description: "Analytics and reporting features" },
			// TAMBAHKAN RESOURCE YANG HILANG
			{ name: "customers", description: "Customer management" },
			{ name: "vouchers", description: "Voucher management" },
			{ name: "hotspot", description: "Hotspot management" },
			{ name: "pppoe", description: "PPPoE management" },
			{ name: "resellers", description: "Reseller management" },
			{ name: "billing", description: "Billing management" },
			{ name: "finance", description: "Finance management" },
			{ name: "whatsapp", description: "WhatsApp integration" },
			{ name: "reports", description: "Reports and analytics" },
			{ name: "monitoring", description: "System monitoring" },
		];

		const createdResources = [];
		for (const resourceData of resourcesData) {
			const existingResource = await db.query.resources.findFirst({
				where: eq(schema.resources.name, resourceData.name),
			});

			if (!existingResource) {
				const [newResource] = await db
					.insert(schema.resources)
					.values(resourceData)
					.returning();
				createdResources.push(newResource);
				console.log(`✅ Created resource: ${resourceData.name}`);
			} else {
				createdResources.push(existingResource);
				console.log(`⏭️  Resource already exists: ${resourceData.name}`);
			}
		}

		// Create default actions
		console.log("Creating default actions...");
		const actionsData = [
			{ name: "read", description: "View and read access" },
			{ name: "write", description: "Create and edit access" },
			{ name: "delete", description: "Delete and remove access" },
			{ name: "create", description: "Create new items" },
			{ name: "update", description: "Update existing items" },
		];

		const createdActions = [];
		for (const actionData of actionsData) {
			const existingAction = await db.query.actions.findFirst({
				where: eq(schema.actions.name, actionData.name),
			});

			if (!existingAction) {
				const [newAction] = await db
					.insert(schema.actions)
					.values(actionData)
					.returning();
				createdActions.push(newAction);
				console.log(`✅ Created action: ${actionData.name}`);
			} else {
				createdActions.push(existingAction);
				console.log(`⏭️  Action already exists: ${actionData.name}`);
			}
		}

		// Create default roles
		console.log("Creating default roles...");
		const roles = [
			{ name: "admin", description: "Full system access with all permissions" },
			{
				name: "manager",
				description:
					"Management access with limited administrative permissions",
			},
			{
				name: "user",
				description: "Standard user access with basic permissions",
			},
			{ name: "viewer", description: "Read-only access to most resources" },
		];

		const createdRoles = [];
		for (const role of roles) {
			const existingRole = await db.query.roles.findFirst({
				where: eq(schema.roles.name, role.name),
			});

			if (!existingRole) {
				const [newRole] = await db
					.insert(schema.roles)
					.values(role)
					.returning();
				createdRoles.push(newRole);
				console.log(`✅ Created role: ${role.name}`);
			} else {
				createdRoles.push(existingRole);
				console.log(`⏭️  Role already exists: ${role.name}`);
			}
		}

		// Create default permissions
		console.log("Creating default permissions...");
		const permissionsData = [
			// User Management
			{ resource: "users", action: "read", description: "View users" },
			{
				resource: "users",
				action: "write",
				description: "Create and edit users",
			},
			{ resource: "users", action: "delete", description: "Delete users" },
			{ resource: "roles", action: "read", description: "View roles" },
			{
				resource: "roles",
				action: "write",
				description: "Create and edit roles",
			},
			{ resource: "roles", action: "delete", description: "Delete roles" },
			{
				resource: "permissions",
				action: "read",
				description: "View permissions",
			},
			{
				resource: "permissions",
				action: "write",
				description: "Create and edit permissions",
			},
			{
				resource: "permissions",
				action: "delete",
				description: "Delete permissions",
			},
			// Customer Management
			{ resource: "customers", action: "read", description: "View customers" },
			{
				resource: "customers",
				action: "write",
				description: "Create and edit customers",
			},
			{
				resource: "customers",
				action: "delete",
				description: "Delete customers",
			},
			// Voucher Management
			{ resource: "vouchers", action: "read", description: "View vouchers" },
			{
				resource: "vouchers",
				action: "write",
				description: "Create and edit vouchers",
			},
			{
				resource: "vouchers",
				action: "delete",
				description: "Delete vouchers",
			},
			// Hotspot Management
			{ resource: "hotspot", action: "read", description: "View hotspot" },
			{
				resource: "hotspot",
				action: "write",
				description: "Create and edit hotspot",
			},
			{ resource: "hotspot", action: "delete", description: "Delete hotspot" },
			// PPPoE Management
			{ resource: "pppoe", action: "read", description: "View PPPoE" },
			{
				resource: "pppoe",
				action: "write",
				description: "Create and edit PPPoE",
			},
			{ resource: "pppoe", action: "delete", description: "Delete PPPoE" },
			// Reseller Management
			{ resource: "resellers", action: "read", description: "View resellers" },
			{
				resource: "resellers",
				action: "write",
				description: "Create and edit resellers",
			},
			{
				resource: "resellers",
				action: "delete",
				description: "Delete resellers",
			},
			// Billing Management
			{ resource: "billing", action: "read", description: "View billing" },
			{
				resource: "billing",
				action: "write",
				description: "Create and edit billing",
			},
			{ resource: "billing", action: "delete", description: "Delete billing" },
			// Finance Management
			{ resource: "finance", action: "read", description: "View finance" },
			{
				resource: "finance",
				action: "write",
				description: "Create and edit finance",
			},
			{ resource: "finance", action: "delete", description: "Delete finance" },
			// WhatsApp Integration
			{ resource: "whatsapp", action: "read", description: "View WhatsApp" },
			{
				resource: "whatsapp",
				action: "write",
				description: "Create and edit WhatsApp",
			},
			{
				resource: "whatsapp",
				action: "delete",
				description: "Delete WhatsApp",
			},
			// Reports
			{ resource: "reports", action: "read", description: "View reports" },
			{
				resource: "reports",
				action: "write",
				description: "Create and edit reports",
			},
			{ resource: "reports", action: "delete", description: "Delete reports" },
			// Monitoring
			{
				resource: "monitoring",
				action: "read",
				description: "View monitoring",
			},
			{
				resource: "monitoring",
				action: "write",
				description: "Create and edit monitoring",
			},
			{
				resource: "monitoring",
				action: "delete",
				description: "Delete monitoring",
			},
			// Dashboard & Settings
			{ resource: "dashboard", action: "read", description: "View dashboard" },
			{ resource: "settings", action: "read", description: "View settings" },
			{ resource: "settings", action: "write", description: "Modify settings" },
			{ resource: "analytics", action: "read", description: "View analytics" },
		];

		const createdPermissions = [];
		let skippedPermissions = 0;

		for (const permData of permissionsData) {
			const resource = createdResources.find(
				(r) => r.name === permData.resource
			);
			const action = createdActions.find((a) => a.name === permData.action);

			if (!resource) {
				console.log(`❌ Resource not found: ${permData.resource}`);
				skippedPermissions++;
				continue;
			}

			if (!action) {
				console.log(`❌ Action not found: ${permData.action}`);
				skippedPermissions++;
				continue;
			}

			const permissionName = `${resource.name}.${action.name}`;

			const existingPermission = await db.query.permissions.findFirst({
				where: eq(schema.permissions.name, permissionName),
			});

			if (!existingPermission) {
				const [newPermission] = await db
					.insert(schema.permissions)
					.values({
						name: permissionName,
						description: permData.description,
						resourceId: resource.id,
						actionId: action.id,
					})
					.returning();
				createdPermissions.push(newPermission);
				console.log(`✅ Created permission: ${permissionName}`);
			} else {
				createdPermissions.push(existingPermission);
				console.log(`⏭️  Permission already exists: ${permissionName}`);
			}
		}

		if (skippedPermissions > 0) {
			console.log(
				`⚠️  Skipped ${skippedPermissions} permissions due to missing resources/actions`
			);
		}

		// Assign permissions to roles
		console.log("Assigning permissions to roles...");

		// Admin gets all permissions
		const adminRole = createdRoles.find((r) => r.name === "admin")!;
		for (const permission of createdPermissions) {
			const existingAssignment = await db.query.rolePermissions.findFirst({
				where: and(
					eq(schema.rolePermissions.roleId, adminRole.id),
					eq(schema.rolePermissions.permissionId, permission.id)
				),
			});

			if (!existingAssignment) {
				await db.insert(schema.rolePermissions).values({
					roleId: adminRole.id,
					permissionId: permission.id,
				});
			}
		}
		console.log(`✅ Assigned all permissions to admin role`);

		// Manager gets most permissions except sensitive deletions
		const managerRole = createdRoles.find((r) => r.name === "manager")!;
		const managerPermissions = createdPermissions.filter((p) => {
			// Manager can't delete users, roles, or permissions
			const restrictedPermissions = [
				"users.delete",
				"roles.delete",
				"permissions.delete",
			];
			return !restrictedPermissions.includes(p.name);
		});

		for (const permission of managerPermissions) {
			const existingAssignment = await db.query.rolePermissions.findFirst({
				where: and(
					eq(schema.rolePermissions.roleId, managerRole.id),
					eq(schema.rolePermissions.permissionId, permission.id)
				),
			});

			if (!existingAssignment) {
				await db.insert(schema.rolePermissions).values({
					roleId: managerRole.id,
					permissionId: permission.id,
				});
			}
		}
		console.log(
			`✅ Assigned ${managerPermissions.length} permissions to manager role`
		);

		// User gets basic permissions
		const userRole = createdRoles.find((r) => r.name === "user")!;
		const userPermissionNames = [
			"dashboard.read",
			"settings.read",
			"customers.read",
			"vouchers.read",
			"hotspot.read",
			"pppoe.read",
			"reports.read",
			"monitoring.read",
		];

		const userPermissions = createdPermissions.filter((p) =>
			userPermissionNames.includes(p.name)
		);

		for (const permission of userPermissions) {
			const existingAssignment = await db.query.rolePermissions.findFirst({
				where: and(
					eq(schema.rolePermissions.roleId, userRole.id),
					eq(schema.rolePermissions.permissionId, permission.id)
				),
			});

			if (!existingAssignment) {
				await db.insert(schema.rolePermissions).values({
					roleId: userRole.id,
					permissionId: permission.id,
				});
			}
		}
		console.log(
			`✅ Assigned ${userPermissions.length} permissions to user role`
		);

		// Viewer gets read-only permissions
		const viewerRole = createdRoles.find((r) => r.name === "viewer")!;
		const viewerPermissions = createdPermissions.filter((p) =>
			p.name.endsWith(".read")
		);

		for (const permission of viewerPermissions) {
			const existingAssignment = await db.query.rolePermissions.findFirst({
				where: and(
					eq(schema.rolePermissions.roleId, viewerRole.id),
					eq(schema.rolePermissions.permissionId, permission.id)
				),
			});

			if (!existingAssignment) {
				await db.insert(schema.rolePermissions).values({
					roleId: viewerRole.id,
					permissionId: permission.id,
				});
			}
		}
		console.log(
			`✅ Assigned ${viewerPermissions.length} permissions to viewer role`
		);

		// Create default users
		console.log("Creating default users...");

		// Admin user
		const adminUser = {
			email: "admin@example.com",
			username: "admin",
			password: await bcrypt.hash("admin123", 10),
			name: "Administrator",
		};

		const existingAdmin = await db.query.users.findFirst({
			where: eq(schema.users.email, adminUser.email),
		});

		let createdAdmin;
		if (!existingAdmin) {
			const [newAdmin] = await db
				.insert(schema.users)
				.values(adminUser)
				.returning();
			createdAdmin = newAdmin;
			console.log(`✅ Created admin user: ${adminUser.username}`);
		} else {
			createdAdmin = existingAdmin;
			console.log(`⏭️  Admin user already exists: ${adminUser.username}`);
		}

		// Regular user
		const regularUser = {
			email: "user@example.com",
			username: "user",
			password: await bcrypt.hash("user123", 10),
			name: "Regular User",
		};

		const existingUser = await db.query.users.findFirst({
			where: eq(schema.users.email, regularUser.email),
		});

		let createdUser;
		if (!existingUser) {
			const [newUser] = await db
				.insert(schema.users)
				.values(regularUser)
				.returning();
			createdUser = newUser;
			console.log(`✅ Created regular user: ${regularUser.username}`);
		} else {
			createdUser = existingUser;
			console.log(`⏭️  Regular user already exists: ${regularUser.username}`);
		}

		// Assign roles to users
		console.log("Assigning roles to users...");

		// Assign admin role to admin user
		const existingAdminRole = await db.query.userRoles.findFirst({
			where: and(
				eq(schema.userRoles.userId, createdAdmin.id),
				eq(schema.userRoles.roleId, adminRole.id)
			),
		});

		if (!existingAdminRole) {
			await db.insert(schema.userRoles).values({
				userId: createdAdmin.id,
				roleId: adminRole.id,
			});
			console.log(`✅ Assigned admin role to admin user`);
		} else {
			console.log(`⏭️  Admin role already assigned to admin user`);
		}

		// Assign user role to regular user
		const existingUserRole = await db.query.userRoles.findFirst({
			where: and(
				eq(schema.userRoles.userId, createdUser.id),
				eq(schema.userRoles.roleId, userRole.id)
			),
		});

		if (!existingUserRole) {
			await db.insert(schema.userRoles).values({
				userId: createdUser.id,
				roleId: userRole.id,
			});
			console.log(`✅ Assigned user role to regular user`);
		} else {
			console.log(`⏭️  User role already assigned to regular user`);
		}

		console.log("🎉 Database seeding completed successfully!");
		console.log("\n📋 Summary:");
		console.log(`- Resources: ${createdResources.length}`);
		console.log(`- Actions: ${createdActions.length}`);
		console.log(`- Roles: ${createdRoles.length}`);
		console.log(`- Permissions: ${createdPermissions.length}`);
		console.log(`- Users: 2 (admin, user)`);
		console.log("\n🔑 Login Credentials:");
		console.log("Admin: username=admin, password=admin123");
		console.log("User: username=user, password=user123");
	} catch (error) {
		console.error("❌ Error during seeding:", error);
		throw error;
	}
}

main().catch((error) => {
	console.error("❌ Seeding failed:", error);
	process.exit(1);
});
