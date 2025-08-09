import {
	pgTable,
	serial,
	bigserial,
	text,
	varchar,
	inet,
	timestamp,
	bigint,
	integer,
	boolean,
	primaryKey,
	index,
	check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { nas, nasreload, radacct, radcheck, radgroupcheck, radgroupreply, radpostauth, radreply, radusergroup } from "./radius";
// ========================================
// CUSTOM TABLES WITH FREERADIUS INTEGRATION
// ========================================

// Hotspot profile configuration
export const hotspotProfile = pgTable("hotspot_profile", {
	id: serial("id").primaryKey(),
	profile_name: varchar("profile_name", { length: 50 }).notNull().unique(),
	price: integer("price").default(0),
	sell_price: integer("sell_price").default(0),
	validity_days: integer("validity_days").notNull(),
	session_limit: integer("session_limit"),
	upload_limit: bigint("upload_limit", { mode: "number" }),
	download_limit: bigint("download_limit", { mode: "number" }),
	rate_limit: varchar("rate_limit", { length: 50 }),
	mikrotik_profile: varchar("mikrotik_profile", { length: 50 }),
	// FreeRADIUS integration fields
	radgroupcheck_id: integer("radgroupcheck_id").references(
		() => radgroupcheck.id,
		{
			onDelete: "set null",
		}
	),
	radgroupreply_id: integer("radgroupreply_id").references(
		() => radgroupreply.id,
		{
			onDelete: "set null",
		}
	),
	nas_id: integer("nas_id").references(() => nas.id, {
		onDelete: "set null",
	}),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Hotspot group configuration
export const hotspotGroup = pgTable("hotspot_group", {
	id: serial("id").primaryKey(),
	group_name: varchar("group_name", { length: 50 }).notNull().unique(),
	description: text("description"),
	profile_id: integer("profile_id").references(() => hotspotProfile.id, {
		onDelete: "set null",
	}),
	// FreeRADIUS integration fields
	radgroupcheck_id: integer("radgroupcheck_id").references(
		() => radgroupcheck.id,
		{
			onDelete: "set null",
		}
	),
	radgroupreply_id: integer("radgroupreply_id").references(
		() => radgroupreply.id,
		{
			onDelete: "set null",
		}
	),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Hotspot user accounts
export const hotspotUser = pgTable(
	"hotspot_user",
	{
		id: serial("id").primaryKey(),
		username: varchar("username", { length: 100 }).notNull().unique(),
		password: varchar("password", { length: 100 }).notNull(),
		profile_id: integer("profile_id").references(() => hotspotProfile.id, {
			onDelete: "set null",
		}),
		group_id: integer("group_id").references(() => hotspotGroup.id, {
			onDelete: "set null",
		}),
		status: varchar("status", { length: 20 }).default("active"),
		comment: text("comment"),
		shared_users: integer("shared_users").default(1),
		// FreeRADIUS integration fields
		radcheck_id: integer("radcheck_id").references(() => radcheck.id, {
			onDelete: "set null",
		}),
		radreply_id: integer("radreply_id").references(() => radreply.id, {
			onDelete: "set null",
		}),
		radusergroup_id: integer("radusergroup_id").references(
			() => radusergroup.id,
			{
				onDelete: "set null",
			}
		),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
		expired_at: timestamp("expired_at", { withTimezone: true }),
	},
	(table) => [
		check("status_check", sql`status IN ('active', 'inactive', 'expired')`),
		// Index for FreeRADIUS integration
		index("hotspot_user_radcheck_idx").on(table.radcheck_id),
		index("hotspot_user_radreply_idx").on(table.radreply_id),
		index("hotspot_user_radusergroup_idx").on(table.radusergroup_id),
	]
);

// Hotspot batch voucher generation
export const hotspotBatch = pgTable(
	"hotspot_batch",
	{
		id: serial("id").primaryKey(),
		batch_name: varchar("batch_name", { length: 100 }).notNull(),
		profile_id: integer("profile_id").references(() => hotspotProfile.id, {
			onDelete: "set null",
		}),
		group_id: integer("group_id").references(() => hotspotGroup.id, {
			onDelete: "set null",
		}),
		total_generated: integer("total_generated").default(0),
		length: integer("length").default(6),
		prefix: varchar("prefix", { length: 20 }),
		characters: varchar("characters", { length: 100 }).default(
			"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
		),
		password_mode: varchar("password_mode", { length: 20 }).default(
			"same_as_username"
		),
		comment: text("comment"),
		shared_users: integer("shared_users").default(1),
		disable: boolean("disable").default(false),
		created_by: text("created_by"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [
		check(
			"password_mode_check",
			sql`password_mode IN ('same_as_username', 'random')`
		),
	]
);

// Junction table for user-batch relationship
export const hotspotUserBatch = pgTable(
	"hotspot_user_batch",
	{
		user_id: integer("user_id")
			.notNull()
			.references(() => hotspotUser.id, {
				onDelete: "cascade",
			}),
		batch_id: integer("batch_id")
			.notNull()
			.references(() => hotspotBatch.id, {
				onDelete: "cascade",
			}),
	},
	(table) => [primaryKey({ columns: [table.user_id, table.batch_id] })]
);

// Enhanced hotspot session with better FreeRADIUS integration
export const hotspotSession = pgTable(
	"hotspot_session",
	{
		id: serial("id").primaryKey(),
		username: varchar("username", { length: 100 }).notNull(),
		acctSessionId: varchar("acct_session_id", { length: 255 }).notNull(),
		acctUniqueId: varchar("acct_unique_id", { length: 255 }).notNull().unique(),
		nasIpAddress: inet("nas_ip_address").notNull(),
		framedIpAddress: inet("framed_ip_address"),
		callingStationId: varchar("calling_station_id", { length: 100 }),
		startTime: timestamp("start_time", { withTimezone: true }),
		updateTime: timestamp("update_time", { withTimezone: true }),
		stopTime: timestamp("stop_time", { withTimezone: true }),
		inputOctets: bigint("input_octets", { mode: "number" }).default(0),
		outputOctets: bigint("output_octets", { mode: "number" }).default(0),
		sessionTime: bigint("session_time", { mode: "number" }).default(0),
		terminateCause: varchar("terminate_cause", { length: 100 }),
		active: integer("active").default(1),
		serviceCategory: varchar("service_category", { length: 20 }).default(
			"hotspot"
		),
		// FreeRADIUS integration fields
		radacct_id: bigint("radacct_id", { mode: "number" }).references(
			() => radacct.RadAcctId,
			{
				onDelete: "set null",
			}
		),
		hotspot_user_id: integer("hotspot_user_id").references(
			() => hotspotUser.id,
			{
				onDelete: "set null",
			}
		),
		nas_id: integer("nas_id").references(() => nas.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [
		// Indexes for better performance
		index("hotspot_session_radacct_idx").on(table.radacct_id),
		index("hotspot_session_user_idx").on(table.hotspot_user_id),
		index("hotspot_session_nas_idx").on(table.nas_id),
		index("hotspot_session_active_idx").on(table.active),
		index("hotspot_session_acct_unique_idx").on(table.acctUniqueId),
	]
);

// User authentication log with FreeRADIUS integration
export const hotspotUserAuth = pgTable(
	"hotspot_user_auth",
	{
		id: serial("id").primaryKey(),
		username: varchar("username", { length: 100 }).notNull(),
		auth_result: varchar("auth_result", { length: 20 }).notNull(),
		auth_method: varchar("auth_method", { length: 50 }),
		nas_ip_address: inet("nas_ip_address"),
		calling_station_id: varchar("calling_station_id", { length: 100 }),
		user_agent: text("user_agent"),
		// FreeRADIUS integration fields
		radpostauth_id: bigint("radpostauth_id", { mode: "number" }).references(
			() => radpostauth.id,
			{
				onDelete: "set null",
			}
		),
		hotspot_user_id: integer("hotspot_user_id").references(
			() => hotspotUser.id,
			{
				onDelete: "set null",
			}
		),
		nas_id: integer("nas_id").references(() => nas.id, {
			onDelete: "set null",
		}),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [
		check(
			"auth_result_check",
			sql`auth_result IN ('success', 'failed', 'rejected')`
		),
		// Indexes for performance
		index("hotspot_user_auth_radpostauth_idx").on(table.radpostauth_id),
		index("hotspot_user_auth_user_idx").on(table.hotspot_user_id),
		index("hotspot_user_auth_result_idx").on(table.auth_result),
	]
);

// ========================================
// ENHANCED RELATIONS WITH FREERADIUS
// ========================================

export const hotspotProfileRelations = relations(
	hotspotProfile,
	({ one, many }) => ({
		users: many(hotspotUser),
		groups: many(hotspotGroup),
		batches: many(hotspotBatch),
		// FreeRADIUS relations
		radgroupcheck: one(radgroupcheck, {
			fields: [hotspotProfile.radgroupcheck_id],
			references: [radgroupcheck.id],
		}),
		radgroupreply: one(radgroupreply, {
			fields: [hotspotProfile.radgroupreply_id],
			references: [radgroupreply.id],
		}),
		nas: one(nas, {
			fields: [hotspotProfile.nas_id],
			references: [nas.id],
		}),
	})
);

export const hotspotGroupRelations = relations(
	hotspotGroup,
	({ one, many }) => ({
		defaultProfile: one(hotspotProfile, {
			fields: [hotspotGroup.profile_id],
			references: [hotspotProfile.id],
		}),
		users: many(hotspotUser),
		batches: many(hotspotBatch),
		// FreeRADIUS relations
		radgroupcheck: one(radgroupcheck, {
			fields: [hotspotGroup.radgroupcheck_id],
			references: [radgroupcheck.id],
		}),
		radgroupreply: one(radgroupreply, {
			fields: [hotspotGroup.radgroupreply_id],
			references: [radgroupreply.id],
		}),
	})
);

export const hotspotUserRelations = relations(hotspotUser, ({ one, many }) => ({
	profile: one(hotspotProfile, {
		fields: [hotspotUser.profile_id],
		references: [hotspotProfile.id],
	}),
	group: one(hotspotGroup, {
		fields: [hotspotUser.group_id],
		references: [hotspotGroup.id],
	}),
	batches: many(hotspotUserBatch),
	sessions: many(hotspotSession),
	authLogs: many(hotspotUserAuth),
	// FreeRADIUS relations
	radcheck: one(radcheck, {
		fields: [hotspotUser.radcheck_id],
		references: [radcheck.id],
	}),
	radreply: one(radreply, {
		fields: [hotspotUser.radreply_id],
		references: [radreply.id],
	}),
	radusergroup: one(radusergroup, {
		fields: [hotspotUser.radusergroup_id],
		references: [radusergroup.id],
	}),
}));

export const hotspotBatchRelations = relations(
	hotspotBatch,
	({ one, many }) => ({
		profile: one(hotspotProfile, {
			fields: [hotspotBatch.profile_id],
			references: [hotspotProfile.id],
		}),
		group: one(hotspotGroup, {
			fields: [hotspotBatch.group_id],
			references: [hotspotGroup.id],
		}),
		users: many(hotspotUserBatch),
	})
);

export const hotspotUserBatchRelations = relations(
	hotspotUserBatch,
	({ one }) => ({
		user: one(hotspotUser, {
			fields: [hotspotUserBatch.user_id],
			references: [hotspotUser.id],
		}),
		batch: one(hotspotBatch, {
			fields: [hotspotUserBatch.batch_id],
			references: [hotspotBatch.id],
		}),
	})
);

export const hotspotSessionRelations = relations(hotspotSession, ({ one }) => ({
	user: one(hotspotUser, {
		fields: [hotspotSession.hotspot_user_id],
		references: [hotspotUser.id],
	}),
	radacct: one(radacct, {
		fields: [hotspotSession.radacct_id],
		references: [radacct.RadAcctId],
	}),
	nas: one(nas, {
		fields: [hotspotSession.nas_id],
		references: [nas.id],
	}),
}));

export const hotspotUserAuthRelations = relations(
	hotspotUserAuth,
	({ one }) => ({
		user: one(hotspotUser, {
			fields: [hotspotUserAuth.hotspot_user_id],
			references: [hotspotUser.id],
		}),
		radpostauth: one(radpostauth, {
			fields: [hotspotUserAuth.radpostauth_id],
			references: [radpostauth.id],
		}),
		nas: one(nas, {
			fields: [hotspotUserAuth.nas_id],
			references: [nas.id],
		}),
	})
);

// ========================================
// TYPESCRIPT TYPES
// ========================================

export type RadAcct = typeof radacct.$inferSelect;
export type NewRadAcct = typeof radacct.$inferInsert;

export type RadCheck = typeof radcheck.$inferSelect;
export type NewRadCheck = typeof radcheck.$inferInsert;

export type RadGroupCheck = typeof radgroupcheck.$inferSelect;
export type NewRadGroupCheck = typeof radgroupcheck.$inferInsert;

export type RadGroupReply = typeof radgroupreply.$inferSelect;
export type NewRadGroupReply = typeof radgroupreply.$inferInsert;

export type RadReply = typeof radreply.$inferSelect;
export type NewRadReply = typeof radreply.$inferInsert;

export type RadUserGroup = typeof radusergroup.$inferSelect;
export type NewRadUserGroup = typeof radusergroup.$inferInsert;

export type RadPostAuth = typeof radpostauth.$inferSelect;
export type NewRadPostAuth = typeof radpostauth.$inferInsert;

export type Nas = typeof nas.$inferSelect;
export type NewNas = typeof nas.$inferInsert;

export type NasReload = typeof nasreload.$inferSelect;
export type NewNasReload = typeof nasreload.$inferInsert;

export type HotspotProfile = typeof hotspotProfile.$inferSelect;
export type NewHotspotProfile = typeof hotspotProfile.$inferInsert;

export type HotspotGroup = typeof hotspotGroup.$inferSelect;
export type NewHotspotGroup = typeof hotspotGroup.$inferInsert;

export type HotspotUser = typeof hotspotUser.$inferSelect;
export type NewHotspotUser = typeof hotspotUser.$inferInsert;

export type HotspotBatch = typeof hotspotBatch.$inferSelect;
export type NewHotspotBatch = typeof hotspotBatch.$inferInsert;

export type HotspotUserBatch = typeof hotspotUserBatch.$inferSelect;
export type NewHotspotUserBatch = typeof hotspotUserBatch.$inferInsert;

export type HotspotSession = typeof hotspotSession.$inferSelect;
export type NewHotspotSession = typeof hotspotSession.$inferInsert;

export type HotspotUserAuth = typeof hotspotUserAuth.$inferSelect;
export type NewHotspotUserAuth = typeof hotspotUserAuth.$inferInsert;
