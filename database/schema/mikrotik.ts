import {
	pgTable,
	text,
	varchar,
	integer,
	decimal,
	timestamp,
	boolean,
	serial,
	jsonb,
	index,
	bigint,
	pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { routers, users } from "./users";

// ============ ENUMS ============
export const statusEnum = pgEnum("status", ["active", "inactive", "suspended"]);
export const voucherStatusEnum = pgEnum("voucher_status", [
	"unused",
	"used",
	"expired",
]);
export const sessionTypeEnum = pgEnum("session_type", [
	"pppoe",
	"hotspot",
	"vpn",
	"bandwidth",
	"static_ip",
	"others",
]);
export const sessionStatusEnum = pgEnum("session_status", [
	"connecting",
	"active",
	"idle",
	"disconnecting",
	"terminated",
]);
export const userRoleEnum = pgEnum("user_role", ["admin", "operator", "user"]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
	"pending",
	"paid",
	"overdue",
	"cancelled",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
	"pending",
	"completed",
	"failed",
]);
export const taskStatusEnum = pgEnum("task_status", [
	"pending",
	"in_progress",
	"completed",
	"cancelled",
]);
export const priorityEnum = pgEnum("priority", [
	"low",
	"medium",
	"high",
	"urgent",
]);
export const logLevelEnum = pgEnum("log_level", [
	"info",
	"warning",
	"error",
	"debug",
]);

// ============ SHARED MIXINS/HELPERS ============
// Base timestamps mixin
const timestampFields = {
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
};

// Base entity with UUID
const baseEntityFields = {
	id: serial("id").primaryKey(),
	// uuid: uuid("uuid").defaultRandom().notNull().unique(),
	...timestampFields,
};

// Status mixin
const statusFields = {
	status: statusEnum("status").default("active"),
	is_active: boolean("is_active").default(true),
};

// Mikrotik sync mixin
const mikrotikSyncFields = {
	mikrotik_id: varchar("mikrotik_id", { length: 50 }),
	synced_to_mikrotik: boolean("synced_to_mikrotik").default(false),
};

// Address/Contact mixin
const contactFields = {
	email: varchar("email", { length: 255 }),
	phone: varchar("phone", { length: 20 }),
	address: text("address"),
};

// Name mixin
const nameFields = {
	first_name: varchar("first_name", { length: 50 }),
	last_name: varchar("last_name", { length: 50 }),
};



// Company Settings
export const company_settings = pgTable("company_settings", {
	id: serial("id").primaryKey(),
	company_name: varchar("company_name", { length: 100 }).notNull(),
	logo: varchar("logo", { length: 255 }),
	currency: varchar("currency", { length: 10 }).default("IDR"),
	timezone: varchar("timezone", { length: 50 }).default("Asia/Jakarta"),
	language: varchar("language", { length: 10 }).default("id"),
	...contactFields,
	website: varchar("website", { length: 100 }),
	...timestampFields,
});

// ============ CUSTOMERS ============
export const customers = pgTable(
	"customers",
	{
		...baseEntityFields,
		username: varchar("username", { length: 50 }).notNull().unique(),
		password: varchar("password", { length: 255 }),
		service_plan_id: integer("service_plan_id").references(
			() => session_profiles.id
		),
		router_id: integer("router_id").references(() => routers.id),
		balance: decimal("balance", { precision: 15, scale: 2 }).default("0"),
		personal_info: jsonb("personal_info"), // id_number, birth_date, gender
		registration_date: timestamp("registration_date").defaultNow(),
		last_login: timestamp("last_login"),
		notes: text("notes"),
		...nameFields,
		...contactFields,
		...statusFields,
	},
	(table) => [
		index("customers_username_idx").on(table.username),
		index("customers_email_idx").on(table.email),
		index("customers_phone_idx").on(table.phone),
		index("customers_status_idx").on(table.status),
		index("customers_service_plan_idx").on(table.service_plan_id),
		index("customers_router_idx").on(table.router_id),
	]
);

// ============ UNIFIED SESSION MANAGEMENT ============
export const session_profiles = pgTable(
	"session_profiles",
	{
		...baseEntityFields,
		router_id: integer("router_id")
			.references(() => routers.id)
			.notNull(),
		name: varchar("name", { length: 100 }).notNull(),
		type: sessionTypeEnum("type").notNull(),
		price: decimal("price", { precision: 15, scale: 2 }).notNull(),
		sell_price: decimal("sell_price", { precision: 15, scale: 2 }).notNull(),

		// Network configuration stored as JSON for flexibility
		// PPPoE: bridgeLearning, useIpv6, useMpls, changeTcpMss, useUpnp, addressList, onUp, onDown
		network_config: jsonb("network_config"),

		// Bandwidth configuration
		// Common: rateLimit, downloadSpeed, uploadSpeed, burstRate, burstThreshold, burstTime, priority, limitAt
		bandwidth_config: jsonb("bandwidth_config"),

		// Timeout configuration
		// Common: sessionTimeout, idleTimeout
		// Hotspot specific: keepaliveTimeout, statusAutorefresh, macCookieTimeout
		timeout_config: jsonb("timeout_config"),

		// Limits configuration
		// Common: dataLimit, timeLimit, validity
		// PPPoE: useCompression, useEncryption, onlyOne
		// Hotspot: addressList, transparentProxy
		limits: jsonb("limits"),

		// Security configuration
		// PPPoE: useCompression, useEncryption, onlyOne
		// Hotspot: addressList, transparentProxy
		security_config: jsonb("security_config"),

		// Advanced configuration
		// Hotspot: sharedUsers, addMacCookie
		advanced_config: jsonb("advanced_config"),

		comment: text("comment"),
		...mikrotikSyncFields,
		...statusFields,
	},
	(table) => [
		index("session_profiles_type_router_idx").on(table.type, table.router_id),
		index("session_profiles_name_router_idx").on(table.name, table.router_id),
		index("session_profiles_mikrotik_idx").on(table.mikrotik_id),
	]
);

export const session_users = pgTable(
	"session_users",
	{
		...baseEntityFields,
		router_id: integer("router_id")
			.references(() => routers.id)
			.notNull(),
		profile_id: integer("profile_id").references(() => session_profiles.id),
		customer_id: integer("customer_id").references(() => customers.id),

		name: varchar("name", { length: 100 }).notNull(),
		password: varchar("password", { length: 100 }),
		type: sessionTypeEnum("type").notNull(),

		// Configuration overrides (inherits from profile if null)
		network_config: jsonb("network_config"),
		limits: jsonb("limits"), // bytes, uptime limits

		// Session tracking
		expiry_date: timestamp("expiry_date"),
		last_login: timestamp("last_login"),
		usage_stats: jsonb("usage_stats"), // bytes in/out, session count, etc.

		comment: text("comment"),
		...mikrotikSyncFields,
		...statusFields,
	},
	(table) => [
		index("session_users_type_router_idx").on(table.type, table.router_id),
		index("session_users_name_router_idx").on(table.name, table.router_id),
		index("session_users_customer_idx").on(table.customer_id),
		index("session_users_profile_idx").on(table.profile_id),
		index("session_users_expiry_idx").on(table.expiry_date),
	]
);

// ============ ACTIVE SESSIONS ============
export const active_sessions = pgTable(
	"active_sessions",
	{
		id: serial("id").primaryKey(),
		router_id: integer("router_id")
			.references(() => routers.id)
			.notNull(),
		session_user_id: integer("session_user_id").references(
			() => session_users.id
		),
		customer_id: integer("customer_id").references(() => customers.id),
		profile_id: integer("profile_id").references(() => session_profiles.id),

		// Session identification
		session_id: varchar("session_id", { length: 100 }).notNull().unique(),
		username: varchar("username", { length: 50 }).notNull(),
		type: sessionTypeEnum("type").notNull(),
		status: sessionStatusEnum("status").default("active"),

		// Connection details
		client_ip: varchar("client_ip", { length: 45 }),
		client_mac: varchar("client_mac", { length: 17 }),
		nas_ip: varchar("nas_ip", { length: 45 }),
		nas_port: varchar("nas_port", { length: 20 }),

		// Time tracking
		login_time: timestamp("login_time").notNull(),
		last_update: timestamp("last_update").defaultNow(),
		idle_time: integer("idle_time").default(0), // seconds
		uptime: integer("uptime").default(0), // seconds

		// Real-time usage (current session)
		bytes_in: bigint("bytes_in", { mode: "number" }).default(0),
		bytes_out: bigint("bytes_out", { mode: "number" }).default(0),
		packets_in: bigint("packets_in", { mode: "number" }).default(0),
		packets_out: bigint("packets_out", { mode: "number" }).default(0),

		// Rate limiting info
		rate_limit_rx: varchar("rate_limit_rx", { length: 20 }),
		rate_limit_tx: varchar("rate_limit_tx", { length: 20 }),

		// Additional session info
		caller_id: varchar("caller_id", { length: 50 }),
		framed_protocol: varchar("framed_protocol", { length: 20 }),
		service_type: varchar("service_type", { length: 20 }),

		// Mikrotik specific fields
		mikrotik_session_id: varchar("mikrotik_session_id", { length: 100 }),

		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		index("active_sessions_session_id_idx").on(table.session_id),
		index("active_sessions_username_router_idx").on(
			table.username,
			table.router_id
		),
		index("active_sessions_customer_idx").on(table.customer_id),
		index("active_sessions_status_idx").on(table.status),
		index("active_sessions_login_time_idx").on(table.login_time),
		index("active_sessions_mikrotik_idx").on(table.mikrotik_session_id),
		index("active_sessions_type_router_idx").on(table.type, table.router_id),
	]
);

// ============ VOUCHER MANAGEMENT ============
export const voucher_batches = pgTable(
	"voucher_batches",
	{
		...baseEntityFields,
		router_id: integer("router_id")
			.references(() => routers.id)
			.notNull(),
		profile_id: integer("profile_id").references(() => session_profiles.id),
		batch_name: varchar("batch_name", { length: 100 }).notNull(),
		generation_config: jsonb("generation_config"), // length, prefix, characters, etc.
		total_generated: integer("total_generated").default(0),
		comment: text("comment"),
		created_by: integer("created_by").references(() => users.id),
		...statusFields,
	},
	(table) => [
		index("voucher_batches_router_idx").on(table.router_id),
		index("voucher_batches_profile_idx").on(table.profile_id),
	]
);

export const vouchers = pgTable(
	"vouchers",
	{
		...baseEntityFields,
		router_id: integer("router_id")
			.references(() => routers.id)
			.notNull(),
		batch_id: integer("batch_id").references(() => voucher_batches.id),
		session_profiles_id: integer("session_profiles_id").references(
			() => session_profiles.id
		),
		general: jsonb("general"), // {name, password}
		comment: text("comment"),
		limits: jsonb("limits"), // {limit_uptime, limit_bytes_in, limit_bytes_out, limit_bytes_total}
		statistics: jsonb("statistics"), // {used_count, used_bytes_in, used_bytes_out, last_used}
		status: voucherStatusEnum("status").default("unused"),

		created_by: integer("created_by").references(() => users.id),
		...mikrotikSyncFields,
	},
	(table) => [
		index("vouchers_status_idx").on(table.status),
		index("vouchers_batch_idx").on(table.batch_id),
	]
);

// ============ BILLING & FINANCE ============
export const invoices = pgTable(
	"invoices",
	{
		...baseEntityFields,
		invoice_number: varchar("invoice_number", { length: 50 })
			.notNull()
			.unique(),
		customer_id: integer("customer_id").references(() => customers.id),
		service_plan_id: integer("service_plan_id").references(
			() => session_profiles.id
		),

		amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
		tax: decimal("tax", { precision: 15, scale: 2 }).default("0"),
		discount: decimal("discount", { precision: 15, scale: 2 }).default("0"),
		total_amount: decimal("total_amount", {
			precision: 15,
			scale: 2,
		}).notNull(),

		due_date: timestamp("due_date").notNull(),
		status: invoiceStatusEnum("status").default("pending"),
		paid_at: timestamp("paid_at"),
		payment_method: varchar("payment_method", { length: 50 }),

		description: text("description"),
		notes: text("notes"),
	},
	(table) => [
		index("invoices_customer_idx").on(table.customer_id),
		index("invoices_status_idx").on(table.status),
		index("invoices_due_date_idx").on(table.due_date),
	]
);

export const payments = pgTable(
	"payments",
	{
		...baseEntityFields,
		invoice_id: integer("invoice_id").references(() => invoices.id),
		customer_id: integer("customer_id").references(() => customers.id),

		amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
		method: varchar("method", { length: 50 }).notNull(),
		reference: varchar("reference", { length: 100 }),
		status: paymentStatusEnum("status").default("pending"),

		processed_by: integer("processed_by").references(() => users.id),
		processed_at: timestamp("processed_at"),
		notes: text("notes"),
		created_at: timestamp("created_at").defaultNow(),
	},
	(table) => [
		index("payments_invoice_idx").on(table.invoice_id),
		index("payments_customer_idx").on(table.customer_id),
		index("payments_status_idx").on(table.status),
	]
);

// ============ USAGE TRACKING ============
export const usage_sessions = pgTable(
	"usage_sessions",
	{
		id: serial("id").primaryKey(),
		router_id: integer("router_id")
			.references(() => routers.id)
			.notNull(),
		session_user_id: integer("session_user_id").references(
			() => session_users.id
		),
		customer_id: integer("customer_id").references(() => customers.id),
		active_session_id: integer("active_session_id").references(
			() => active_sessions.id
		),

		username: varchar("username", { length: 50 }).notNull(),
		type: sessionTypeEnum("type").notNull(),

		session_id: varchar("session_id", { length: 100 }),
		login_time: timestamp("login_time"),
		logout_time: timestamp("logout_time"),
		uptime: integer("uptime").default(0), // seconds

		bytes_in: bigint("bytes_in", { mode: "number" }).default(0),
		bytes_out: bigint("bytes_out", { mode: "number" }).default(0),
		packets_in: bigint("packets_in", { mode: "number" }).default(0),
		packets_out: bigint("packets_out", { mode: "number" }).default(0),

		disconnect_reason: varchar("disconnect_reason", { length: 255 }),
		client_ip: varchar("client_ip", { length: 45 }),
		nas_ip: varchar("nas_ip", { length: 45 }),

		created_at: timestamp("created_at").defaultNow(),
	},
	(table) => [
		index("usage_sessions_router_idx").on(table.router_id),
		index("usage_sessions_customer_idx").on(table.customer_id),
		index("usage_sessions_username_idx").on(table.username),
		index("usage_sessions_login_time_idx").on(table.login_time),
		index("usage_sessions_session_id_idx").on(table.session_id),
	]
);

// ============ SYSTEM MANAGEMENT ============
export const tasks = pgTable(
	"tasks",
	{
		...baseEntityFields,
		title: varchar("title", { length: 200 }).notNull(),
		description: text("description"),
		type: varchar("type", { length: 50 }).notNull(),
		priority: priorityEnum("priority").default("medium"),
		status: taskStatusEnum("status").default("pending"),

		assigned_to: integer("assigned_to").references(() => users.id),
		customer_id: integer("customer_id").references(() => customers.id),
		router_id: integer("router_id").references(() => routers.id),

		due_date: timestamp("due_date"),
		completed_at: timestamp("completed_at"),
		created_by: integer("created_by").references(() => users.id),
	},
	(table) => [
		index("tasks_assigned_idx").on(table.assigned_to),
		index("tasks_status_idx").on(table.status),
		index("tasks_priority_idx").on(table.priority),
	]
);

export const system_logs = pgTable(
	"system_logs",
	{
		id: serial("id").primaryKey(),
		level: logLevelEnum("level").notNull(),
		message: text("message").notNull(),
		context: jsonb("context"),
		user_id: integer("user_id").references(() => users.id),
		ip_address: varchar("ip_address", { length: 45 }),
		user_agent: varchar("user_agent", { length: 255 }),
		created_at: timestamp("created_at").defaultNow(),
	},
	(table) => [
		index("system_logs_level_idx").on(table.level),
		index("system_logs_user_idx").on(table.user_id),
		index("system_logs_date_idx").on(table.created_at),
	]
);

// ============ CONFIGURATION TABLES ============
export const settings = pgTable(
	"settings",
	{
		id: serial("id").primaryKey(),
		category: varchar("category", { length: 50 }).notNull(),
		key: varchar("key", { length: 100 }).notNull(),
		value: jsonb("value"),
		description: text("description"),
		...timestampFields,
	},
	(table) => [index("settings_category_key_idx").on(table.category, table.key)]
);

// ============ RELATIONS ============

export const routersRelations = relations(routers, ({ many }) => ({
	customers: many(customers),
	session_profiles: many(session_profiles),
	session_users: many(session_users),
	active_sessions: many(active_sessions),
	voucher_batches: many(voucher_batches),
	vouchers: many(vouchers),
	usage_sessions: many(usage_sessions),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
	service_plan: one(session_profiles, {
		fields: [customers.service_plan_id],
		references: [session_profiles.id],
	}),
	router: one(routers, {
		fields: [customers.router_id],
		references: [routers.id],
	}),
	session_users: many(session_users),
	active_sessions: many(active_sessions),
	invoices: many(invoices),
	payments: many(payments),
	usage_sessions: many(usage_sessions),
	tasks: many(tasks),
}));

export const session_profilesRelations = relations(
	session_profiles,
	({ one, many }) => ({
		router: one(routers, {
			fields: [session_profiles.router_id],
			references: [routers.id],
		}),
		session_users: many(session_users),
		active_sessions: many(active_sessions),
	})
);

export const session_usersRelations = relations(
	session_users,
	({ one, many }) => ({
		router: one(routers, {
			fields: [session_users.router_id],
			references: [routers.id],
		}),
		profile: one(session_profiles, {
			fields: [session_users.profile_id],
			references: [session_profiles.id],
		}),
		customer: one(customers, {
			fields: [session_users.customer_id],
			references: [customers.id],
		}),
		active_sessions: many(active_sessions),
		vouchers: many(vouchers),
		usage_sessions: many(usage_sessions),
	})
);

export const active_sessionsRelations = relations(
	active_sessions,
	({ one }) => ({
		router: one(routers, {
			fields: [active_sessions.router_id],
			references: [routers.id],
		}),
		session_user: one(session_users, {
			fields: [active_sessions.session_user_id],
			references: [session_users.id],
		}),
		customer: one(customers, {
			fields: [active_sessions.customer_id],
			references: [customers.id],
		}),
		profile: one(session_profiles, {
			fields: [active_sessions.profile_id],
			references: [session_profiles.id],
		}),
	})
);

export const voucher_batchesRelations = relations(
	voucher_batches,
	({ one, many }) => ({
		router: one(routers, {
			fields: [voucher_batches.router_id],
			references: [routers.id],
		}),
		profile: one(session_profiles, {
			fields: [voucher_batches.profile_id],
			references: [session_profiles.id],
		}),
		created_by_user: one(users, {
			fields: [voucher_batches.created_by],
			references: [users.id],
		}),
		vouchers: many(vouchers),
	})
);

export const vouchersRelations = relations(vouchers, ({ one }) => ({
	router: one(routers, {
		fields: [vouchers.router_id],
		references: [routers.id],
	}),
	batch: one(voucher_batches, {
		fields: [vouchers.batch_id],
		references: [voucher_batches.id],
	}),
	session_profiles: one(session_users, {
		fields: [vouchers.session_profiles_id],
		references: [session_users.id],
	}),
	created_by_user: one(users, {
		fields: [vouchers.created_by],
		references: [users.id],
	}),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
	customer: one(customers, {
		fields: [invoices.customer_id],
		references: [customers.id],
	}),
	service_plan: one(session_profiles, {
		fields: [invoices.service_plan_id],
		references: [session_profiles.id],
	}),
	payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
	invoice: one(invoices, {
		fields: [payments.invoice_id],
		references: [invoices.id],
	}),
	customer: one(customers, {
		fields: [payments.customer_id],
		references: [customers.id],
	}),
	processed_by_user: one(users, {
		fields: [payments.processed_by],
		references: [users.id],
	}),
}));

export const usage_sessionsRelations = relations(usage_sessions, ({ one }) => ({
	router: one(routers, {
		fields: [usage_sessions.router_id],
		references: [routers.id],
	}),
	session_user: one(session_users, {
		fields: [usage_sessions.session_user_id],
		references: [session_users.id],
	}),
	customer: one(customers, {
		fields: [usage_sessions.customer_id],
		references: [customers.id],
	}),
	active_session: one(active_sessions, {
		fields: [usage_sessions.active_session_id],
		references: [active_sessions.id],
	}),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
	assigned_to_user: one(users, {
		fields: [tasks.assigned_to],
		references: [users.id],
	}),
	customer: one(customers, {
		fields: [tasks.customer_id],
		references: [customers.id],
	}),
	router: one(routers, {
		fields: [tasks.router_id],
		references: [routers.id],
	}),
	created_by_user: one(users, {
		fields: [tasks.created_by],
		references: [users.id],
	}),
}));

export const system_logsRelations = relations(system_logs, ({ one }) => ({
	user: one(users, {
		fields: [system_logs.user_id],
		references: [users.id],
	}),
}));

// ============ TYPE EXPORTS ============
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Router = typeof routers.$inferSelect;
export type NewRouter = typeof routers.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type SessionProfile = typeof session_profiles.$inferSelect;
export type NewSessionProfile = typeof session_profiles.$inferInsert;
export type SessionUser = typeof session_users.$inferSelect;
export type NewSessionUser = typeof session_users.$inferInsert;
export type ActiveSession = typeof active_sessions.$inferSelect;
export type NewActiveSession = typeof active_sessions.$inferInsert;
export type VoucherBatch = typeof voucher_batches.$inferSelect;
export type NewVoucherBatch = typeof voucher_batches.$inferInsert;
export type Voucher = typeof vouchers.$inferSelect;
export type NewVoucher = typeof vouchers.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type UsageSession = typeof usage_sessions.$inferSelect;
export type NewUsageSession = typeof usage_sessions.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type SystemLog = typeof system_logs.$inferSelect;
export type NewSystemLog = typeof system_logs.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type CompanySetting = typeof company_settings.$inferSelect;
export type NewCompanySetting = typeof company_settings.$inferInsert;
