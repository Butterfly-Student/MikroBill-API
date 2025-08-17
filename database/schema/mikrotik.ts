import {
	pgTable,
	text,
	varchar,
	integer,
	decimal,
	timestamp,
	boolean,
	serial,
	index,
	bigint,
	pgEnum,
	PgEnumColumn,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { routers, users } from "./users";
import { customer_subscriptions } from "./service_plans";

// ============ SHARED MIXINS/HELPERS ============
const timestampFields = {
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
};

const baseEntityFields = {
	id: serial("id").primaryKey(),
	...timestampFields,
};

const statusFields = {
	status: varchar("status", { length: 20 }).default("active"),
	is_active: boolean("is_active").default(true),
};

const mikrotikSyncFields = {
	synced_to_mikrotik: boolean("synced_to_mikrotik").default(false),
};

const contactFields = {
	email: varchar("email", { length: 255 }),
	phone: varchar("phone", { length: 20 }),
	address: text("address"),
};

const nameFields = {
	first_name: varchar("first_name", { length: 50 }),
	last_name: varchar("last_name", { length: 50 }),
};

// ============ ENUMS ============
export const statusEnum = pgEnum("status", ["active", "inactive", "suspended"]);
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
export const voucherStatusEnum = pgEnum("voucher_status", [
	"unused",
	"used",
	"expired",
]);
export const serviceTypeEnum = pgEnum("service_type", ["pppoe", "hotspot"]);

export const expiredModeEnum = pgEnum("expired_mode", [
	"remove",
	"extend",
	"disable",
]);

// ============ COMPANY SETTINGS ============
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
		router_id: integer("router_id").references(() => routers.id),
		balance: decimal("balance", { precision: 15, scale: 2 }).default("0"),

		// Personal Information
		id_number: varchar("id_number", { length: 50 }),
		birth_date: timestamp("birth_date"),
		gender: varchar("gender", { length: 10 }),
		occupation: varchar("occupation", { length: 100 }),

		// Emergency Contact
		emergency_contact_name: varchar("emergency_contact_name", { length: 100 }),
		emergency_contact_phone: varchar("emergency_contact_phone", { length: 20 }),
		emergency_contact_relationship: varchar("emergency_contact_relationship", {
			length: 50,
		}),

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
		index("customers_router_idx").on(table.router_id),
	]
);

// ============ PPPoE PROFILES ============
export const ppp_profiles = pgTable(
	"ppp_profiles",
	{
		...baseEntityFields,
		router_id: integer("router_id")
			.references(() => routers.id)
			.notNull(),
		name: varchar("name", { length: 100 }).notNull(),

		// Pricing
		price: decimal("price", { precision: 15, scale: 2 }).notNull(),
		sell_price: decimal("sell_price", { precision: 15, scale: 2 }).notNull(),

		// Time limits
		session_timeout: integer("session_timeout"), // seconds
		idle_timeout: integer("idle_timeout"), // seconds

		// Rate limits (bandwidth)
		rate_limit_rx: varchar("rate_limit_rx", { length: 20 }), // e.g., "1M/2M"
		rate_limit_tx: varchar("rate_limit_tx", { length: 20 }), // e.g., "1M/2M"

		// Data limits
		uptime_limit: integer("uptime_limit"), // seconds
		bytes_in_limit: bigint("bytes_in_limit", { mode: "number" }),
		bytes_out_limit: bigint("bytes_out_limit", { mode: "number" }),

		// Network settings
		local_address: varchar("local_address", { length: 45 }),
		remote_address: varchar("remote_address", { length: 45 }),
		dns_server: varchar("dns_server", { length: 100 }),

		// Security
		only_one: boolean("only_one").default(false),
		change_tcp_mss: varchar("change_tcp_mss", { length: 20 }),

		mikrotik_profile_id: varchar("mikrotik_profile_id", { length: 50 }),
		comment: text("comment"),
		...mikrotikSyncFields,
		...statusFields,
	},
	(table) => [
		uniqueIndex("ppp_profiles_name_router_unique").on(
			table.name,
			table.router_id
		),
		index("ppp_profiles_name_router_idx").on(table.name, table.router_id),
		index("ppp_profiles_mikrotik_idx").on(table.mikrotik_profile_id),
	]
);

// ============ PPPoE USERS ============
export const ppp_users = pgTable(
	"ppp_users",
	{
		...baseEntityFields,
		router_id: integer("router_id")
			.references(() => routers.id)
			.notNull(),
		profile_id: integer("profile_id")
			.references(() => ppp_profiles.id)
			.notNull(),
		customer_id: integer("customer_id").references(() => customers.id),

		mikrotik_user_id: varchar("mikrotik_user_id", { length: 50 }),

		name: varchar("name", { length: 100 }).notNull(),
		password: varchar("password", { length: 100 }),
		service: varchar("service", { length: 50 }), // ppp, pptp, l2tp, ovpn, etc
		caller_id: varchar("caller_id", { length: 50 }),

		// Override profile settings
		local_address: varchar("local_address", { length: 45 }),
		remote_address: varchar("remote_address", { length: 45 }),
		routes: text("routes"),

		// Time tracking
		expiry_date: timestamp("expiry_date"),
		last_login: timestamp("last_login"),
		last_logout: timestamp("last_logout"),

		// Usage statistics
		total_bytes_in: bigint("total_bytes_in", { mode: "number" }).default(0),
		total_bytes_out: bigint("total_bytes_out", { mode: "number" }).default(0),
		total_uptime: integer("total_uptime").default(0), // seconds
		total_sessions: integer("total_sessions").default(0),

		disabled: boolean("disabled").default(false),
		comment: text("comment"),
		...mikrotikSyncFields,
		...statusFields,
	},
	(table) => [
		index("ppp_users_name_router_idx").on(table.name, table.router_id),
		index("ppp_users_customer_idx").on(table.customer_id),
		index("ppp_users_profile_idx").on(table.profile_id),
		index("ppp_users_expiry_idx").on(table.expiry_date),
	]
);

// ============ PPPoE ACTIVE SESSIONS ============
export const ppp_active_sessions = pgTable(
	"ppp_active_sessions",
	{
		id: serial("id").primaryKey(),
		router_id: integer("router_id")
			.references(() => routers.id)
			.notNull(),
		ppp_user_id: integer("ppp_user_id").references(() => ppp_users.id),
		customer_id: integer("customer_id").references(() => customers.id),

		// Session identification
		session_id: varchar("session_id", { length: 100 }).notNull().unique(),
		username: varchar("username", { length: 50 }).notNull(),
		caller_id: varchar("caller_id", { length: 50 }),

		status: sessionStatusEnum("status").default("active"),

		// Connection details
		service: varchar("service", { length: 20 }),
		address: varchar("address", { length: 45 }),
		uptime: varchar("uptime", { length: 50 }),
		encoding: varchar("encoding", { length: 50 }),

		// Time tracking
		login_time: timestamp("login_time").notNull(),
		last_update: timestamp("last_update").defaultNow(),

		// Real-time usage (current session)
		bytes_in: bigint("bytes_in", { mode: "number" }).default(0),
		bytes_out: bigint("bytes_out", { mode: "number" }).default(0),

		// Rate limiting
		limit_bytes_in: bigint("limit_bytes_in", { mode: "number" }),
		limit_bytes_out: bigint("limit_bytes_out", { mode: "number" }),

		mikrotik_session_id: varchar("mikrotik_session_id", { length: 100 }),

		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		index("ppp_active_sessions_session_id_idx").on(table.session_id),
		index("ppp_active_sessions_username_router_idx").on(
			table.username,
			table.router_id
		),
		index("ppp_active_sessions_customer_idx").on(table.customer_id),
		index("ppp_active_sessions_status_idx").on(table.status),
		index("ppp_active_sessions_mikrotik_idx").on(table.mikrotik_session_id),
	]
);

// ============ PPPoE USAGE SESSIONS ============
export const ppp_usage_sessions = pgTable(
	"ppp_usage_sessions",
	{
		id: serial("id").primaryKey(),
		router_id: integer("router_id")
			.references(() => routers.id)
			.notNull(),
		ppp_user_id: integer("ppp_user_id").references(() => ppp_users.id),
		customer_id: integer("customer_id").references(() => customers.id),
		ppp_active_session_id: integer("ppp_active_session_id").references(
			() => ppp_active_sessions.id
		),

		username: varchar("username", { length: 50 }).notNull(),
		service: varchar("service", { length: 20 }),
		caller_id: varchar("caller_id", { length: 50 }),

		session_id: varchar("session_id", { length: 100 }),
		login_time: timestamp("login_time"),
		logout_time: timestamp("logout_time"),
		uptime: integer("uptime").default(0), // seconds

		bytes_in: bigint("bytes_in", { mode: "number" }).default(0),
		bytes_out: bigint("bytes_out", { mode: "number" }).default(0),

		disconnect_reason: varchar("disconnect_reason", { length: 255 }),
		terminate_cause: varchar("terminate_cause", { length: 100 }),

		created_at: timestamp("created_at").defaultNow(),
	},
	(table) => [
		index("ppp_usage_sessions_router_idx").on(table.router_id),
		index("ppp_usage_sessions_customer_idx").on(table.customer_id),
		index("ppp_usage_sessions_username_idx").on(table.username),
		index("ppp_usage_sessions_login_time_idx").on(table.login_time),
		index("ppp_usage_sessions_session_id_idx").on(table.session_id),
	]
);

// ============ HOTSPOT PROFILES ============
export const hotspot_profiles = pgTable(
	"hotspot_profiles",
	{
		...baseEntityFields,
		router_id: integer("router_id")
			.references(() => routers.id)
			.notNull(),
		name: varchar("name", { length: 100 }).notNull(),

		// Pricing
		price: decimal("price", { precision: 15, scale: 2 }).notNull(),
		sell_price: decimal("sell_price", { precision: 15, scale: 2 }).notNull(),
		validity: varchar("validity", { length: 20 }),
		cron_enabled: boolean("cron_enabled").default(true),

		// Time limits
		session_timeout: varchar("session_timeout", { length: 20 }), // e.g., "1h", "30m"
		idle_timeout: varchar("idle_timeout", { length: 20 }),
		keepalive_timeout: varchar("keepalive_timeout", { length: 20 }),
		auto_refresh: varchar("auto_refresh", { length: 100 }),

		// Rate limits
		rate_limit: varchar("rate_limit", { length: 50 }), // e.g., "1M/2M 1M/2M 1M/2M 10/10"
		shared_users: integer("shared_users").default(1),

		// Advanced settings
		address_pool: varchar("address_pool", { length: 100 }),
		parent_queue: varchar("parent_queue", { length: 100 }),
		on_login_script: text("on_login_script"),
		on_logout_script: text("on_logout_script"),

		//Lock Mode
		lock_to_mac: boolean("lock_to_mac").default(false),
		lock_to_server: boolean("lock_to_server").default(true),
		expired_mode: expiredModeEnum("expired_mode").default("disable"),

		mikrotik_profile_id: varchar("mikrotik_profile_id", { length: 100 }).default(""),
		comment: text("comment"),
		...mikrotikSyncFields,
		...statusFields,
	},
	(table) => [
		uniqueIndex("hotspot_profiles_name_router_unique").on(
			table.name,
			table.router_id
		),
		index("hotspot_profiles_name_router_idx").on(table.name, table.router_id),
		index("hotspot_profiles_mikrotik_idx").on(table.mikrotik_profile_id),
	]
);

// ============ HOTSPOT USERS ============
export const hotspot_users = pgTable(
	"hotspot_users",
	{
		...baseEntityFields,
		router_id: integer("router_id")
			.references(() => routers.id)
			.notNull(),
		profile_id: integer("profile_id")
			.references(() => hotspot_profiles.id)
			.notNull(),
		customer_id: integer("customer_id").references(() => customers.id),

		mikrotik_user_id: varchar("mikrotik_user_id", { length: 50 }),

		name: varchar("name", { length: 100 }).notNull(),
		password: varchar("password", { length: 100 }),

		// MAC binding
		mac_address: varchar("mac_address", { length: 17 }),

		// Address assignment
		address: varchar("address", { length: 45 }),

		// Email for notifications
		email: varchar("email", { length: 255 }),

		// Time limits
		uptime_limit: varchar("uptime_limit", { length: 20 }),
		limit_bytes_total: bigint("bytes_in_limit", { mode: "number" }),
		bytes_out_limit: bigint("bytes_out_limit", { mode: "number" }),

		// Time tracking
		expiry_date: timestamp("expiry_date"),
		last_login: timestamp("last_login"),
		last_logout: timestamp("last_logout"),

		// Usage statistics
		total_bytes_in: bigint("total_bytes_in", { mode: "number" }).default(0),
		total_bytes_out: bigint("total_bytes_out", { mode: "number" }).default(0),
		total_uptime: integer("total_uptime").default(0), // seconds

		disabled: boolean("disabled").default(false),
		comment: text("comment"),
		...mikrotikSyncFields,
		...statusFields,
	},
	(table) => [
		index("hotspot_users_name_router_idx").on(table.name, table.router_id),
		index("hotspot_users_customer_idx").on(table.customer_id),
		index("hotspot_users_profile_idx").on(table.profile_id),
		index("hotspot_users_expiry_idx").on(table.expiry_date),
		index("hotspot_users_mac_idx").on(table.mac_address),
	]
);

// ============ HOTSPOT ACTIVE SESSIONS ============
export const hotspot_active_sessions = pgTable(
	"hotspot_active_sessions",
	{
		id: serial("id").primaryKey(),
		router_id: integer("router_id")
			.references(() => routers.id)
			.notNull(),
		hotspot_user_id: integer("hotspot_user_id").references(
			() => hotspot_users.id
		),
		customer_id: integer("customer_id").references(() => customers.id),

		// Session identification
		session_id: varchar("session_id", { length: 100 }).notNull().unique(),
		username: varchar("username", { length: 50 }).notNull(),

		status: sessionStatusEnum("status").default("active"),

		// Connection details
		address: varchar("address", { length: 45 }),
		mac_address: varchar("mac_address", { length: 17 }),
		uptime: varchar("uptime", { length: 50 }),

		// Server info
		server: varchar("server", { length: 100 }),

		// Time tracking
		login_time: timestamp("login_time").notNull(),
		last_update: timestamp("last_update").defaultNow(),
		idle_time: varchar("idle_time", { length: 20 }),

		// Real-time usage
		bytes_in: bigint("bytes_in", { mode: "number" }).default(0),
		bytes_out: bigint("bytes_out", { mode: "number" }).default(0),
		packets_in: bigint("packets_in", { mode: "number" }).default(0),
		packets_out: bigint("packets_out", { mode: "number" }).default(0),

		// Limits
		limit_uptime: varchar("limit_uptime", { length: 20 }),
		limit_bytes_in: bigint("limit_bytes_in", { mode: "number" }),
		limit_bytes_out: bigint("limit_bytes_out", { mode: "number" }),

		mikrotik_session_id: varchar("mikrotik_session_id", { length: 100 }),

		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		index("hotspot_active_sessions_session_id_idx").on(table.session_id),
		index("hotspot_active_sessions_username_router_idx").on(
			table.username,
			table.router_id
		),
		index("hotspot_active_sessions_customer_idx").on(table.customer_id),
		index("hotspot_active_sessions_status_idx").on(table.status),
		index("hotspot_active_sessions_mac_idx").on(table.mac_address),
		index("hotspot_active_sessions_mikrotik_idx").on(table.mikrotik_session_id),
	]
);

// ============ HOTSPOT USAGE SESSIONS ============
export const hotspot_usage_sessions = pgTable(
	"hotspot_usage_sessions",
	{
		id: serial("id").primaryKey(),
		router_id: integer("router_id")
			.references(() => routers.id)
			.notNull(),
		hotspot_user_id: integer("hotspot_user_id").references(
			() => hotspot_users.id
		),
		customer_id: integer("customer_id").references(() => customers.id),
		hotspot_active_session_id: integer("hotspot_active_session_id").references(
			() => hotspot_active_sessions.id
		),

		username: varchar("username", { length: 50 }).notNull(),
		server: varchar("server", { length: 100 }),

		session_id: varchar("session_id", { length: 100 }),
		login_time: timestamp("login_time"),
		logout_time: timestamp("logout_time"),
		uptime: integer("uptime").default(0), // seconds

		bytes_in: bigint("bytes_in", { mode: "number" }).default(0),
		bytes_out: bigint("bytes_out", { mode: "number" }).default(0),
		packets_in: bigint("packets_in", { mode: "number" }).default(0),
		packets_out: bigint("packets_out", { mode: "number" }).default(0),

		// Connection details
		address: varchar("address", { length: 45 }),
		mac_address: varchar("mac_address", { length: 17 }),

		disconnect_reason: varchar("disconnect_reason", { length: 255 }),
		terminate_cause: varchar("terminate_cause", { length: 100 }),

		created_at: timestamp("created_at").defaultNow(),
	},
	(table) => [
		index("hotspot_usage_sessions_router_idx").on(table.router_id),
		index("hotspot_usage_sessions_customer_idx").on(table.customer_id),
		index("hotspot_usage_sessions_username_idx").on(table.username),
		index("hotspot_usage_sessions_login_time_idx").on(table.login_time),
		index("hotspot_usage_sessions_session_id_idx").on(table.session_id),
		index("hotspot_usage_sessions_mac_idx").on(table.mac_address),
	]
);

// ============ BILLING & FINANCE ============
export const paymentMethods = pgTable("payment_methods", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 50 }).notNull(),
	code: varchar("code", { length: 50 }).notNull().unique(),
	type: varchar("type", { length: 50 }),
	description: text("description"),
	active: integer("active").default(1),
	created_at: timestamp("created_at").defaultNow(),
	updated_at: timestamp("updated_at").defaultNow(),
});

export const invoices = pgTable(
	"invoices",
	{
		...baseEntityFields,
		invoice_number: varchar("invoice_number", { length: 50 })
			.notNull()
			.unique(),
		customer_id: integer("customer_id").references(() => customers.id),

		// Service references (can be either ppp or hotspot profile)
		ppp_profile_id: integer("ppp_profile_id").references(() => ppp_profiles.id),
		hotspot_profile_id: integer("hotspot_profile_id").references(
			() => hotspot_profiles.id
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
		payment_method_id: integer("payment_method_id").references(
			() => paymentMethods.id
		),

		// Xendit integration
		xendit_invoice_id: varchar("xendit_invoice_id", { length: 100 }),
		external_id: varchar("external_id", { length: 100 }),
		invoice_url: text("invoice_url"),
		expiry_date: timestamp("expiry_date"),

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
		router_id: integer("router_id").references(() => routers.id),

		amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
		payment_method_id: integer("payment_method_id").references(
			() => paymentMethods.id
		),
		method: varchar("method", { length: 50 }).notNull(),
		reference: varchar("reference", { length: 100 }),

		status: paymentStatusEnum("status").default("pending"),
		channel: varchar("channel", { length: 50 }),

		gateway_transaction_id: varchar("gateway_transaction_id", { length: 100 }),
		gateway_fee: decimal("gateway_fee", { precision: 15, scale: 2 }).default(
			"0"
		),
		paid_at: timestamp("paid_at"),

		processed_by: integer("processed_by").references(() => users.id),
		processed_at: timestamp("processed_at"),
		notes: text("notes"),
	},
	(table) => [
		index("payments_invoice_idx").on(table.invoice_id),
		index("payments_customer_idx").on(table.customer_id),
		index("payments_status_idx").on(table.status),
	]
);

// ============ VOUCHER MANAGEMENT ============

// Hotspot Voucher Batches
export const voucher_batches = pgTable(
	"voucher_batches",
	{
		...baseEntityFields,
		router_id: integer("router_id")
			.references(() => routers.id)
			.notNull(),
		profile_id: integer("profile_id")
			.references(() => hotspot_profiles.id)
			.notNull(),
		batch_name: varchar("batch_name", { length: 100 }).notNull(),
		length: integer("length").notNull(),

		start_date: timestamp("start_date"),
		end_date: timestamp("end_date"),

		// Generation config fields
		prefix: varchar("prefix", { length: 20 }),
		suffix: varchar("suffix", { length: 20 }),
		username_length: integer("username_length").default(8),
		password_length: integer("password_length").default(8),
		charset: varchar("charset", { length: 100 }).default(
			"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
		),
		password_mode: varchar("password_mode", { length: 20 }).default(
			"same_as_username"
		),
		generation_mode: varchar("generation_mode", { length: 20 }).default(
			"random"
		),

		count: integer("count").notNull(),
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

// Hotspot Vouchers
export const vouchers = pgTable(
	"vouchers",
	{
		...baseEntityFields,
		router_id: integer("router_id")
			.references(() => routers.id)
			.notNull(),
		batch_id: integer("batch_id").references(() => voucher_batches.id),
		profile_id: integer("profile_id")
			.references(() => hotspot_profiles.id)
			.notNull(),
		server: varchar("server", { length: 100 }),

		mikrotik_user_id: varchar("mikrotik_user_id", { length: 100 }),

		// Voucher credentials
		username: varchar("username", { length: 100 }).notNull().unique(),
		password: varchar("password", { length: 100 }).notNull(),

		// Time validity
		validity_hours: integer("validity_hours"), // validity in hours
		start_at: timestamp("start_at"),
		end_at: timestamp("end_at"),

		// Usage limits (inherit from profile if null)
		uptime_limit: varchar("uptime_limit", { length: 20 }),
		bytes_in_limit: bigint("bytes_in_limit", { mode: "number" }),
		bytes_out_limit: bigint("bytes_out_limit", { mode: "number" }),

		// Rate limits override
		rate_limit: varchar("rate_limit", { length: 50 }),

		// MAC binding (optional)
		mac_address: varchar("mac_address", { length: 17 }),

		// Usage statistics
		total_uptime: integer("total_uptime").default(0),
		total_bytes_in: bigint("total_bytes_in", { mode: "number" }).default(0),
		total_bytes_out: bigint("total_bytes_out", { mode: "number" }).default(0),
		total_sessions: integer("total_sessions").default(0),

		// Status tracking
		first_login: timestamp("first_login"),
		last_login: timestamp("last_login"),

		// Cron-related fields
		cron_enabled: boolean("cron_enabled").default(true),
		cron_last_run: timestamp("cron_last_run"),
		cron_next_run: timestamp("cron_next_run"),

		comment: text("comment"),
		voucher_status: voucherStatusEnum("voucher_status").default("unused"),
		status: statusEnum("status").default("active"),

		is_active: boolean("is_active").default(true),

		created_by: integer("created_by").references(() => users.id),
		...mikrotikSyncFields,
	},
	(table) => [
		index("vouchers_username_idx").on(table.username),
		index("vouchers_status_idx").on(table.status),
		index("vouchers_batch_idx").on(table.batch_id),
		index("vouchers_voucher_status_idx").on(table.voucher_status),
		index("vouchers_router_idx").on(table.router_id),
		index("vouchers_mac_idx").on(table.mac_address),
	]
);

// ============ RELATIONS ============

export const customersRelations = relations(customers, ({ one, many }) => ({
	router: one(routers, {
		fields: [customers.router_id],
		references: [routers.id],
	}),
	customer_subscriptions: many(customer_subscriptions),
	ppp_users: many(ppp_users),
	hotspot_users: many(hotspot_users),
	ppp_active_sessions: many(ppp_active_sessions),
	hotspot_active_sessions: many(hotspot_active_sessions),
	ppp_usage_sessions: many(ppp_usage_sessions),
	hotspot_usage_sessions: many(hotspot_usage_sessions),
	invoices: many(invoices),
	payments: many(payments),
}));

// PPPoE Relations
export const ppp_profilesRelations = relations(
	ppp_profiles,
	({ one, many }) => ({
		router: one(routers, {
			fields: [ppp_profiles.router_id],
			references: [routers.id],
		}),
		ppp_users: many(ppp_users),
		invoices: many(invoices),
	})
);

export const ppp_usersRelations = relations(ppp_users, ({ one, many }) => ({
	router: one(routers, {
		fields: [ppp_users.router_id],
		references: [routers.id],
	}),
	profile: one(ppp_profiles, {
		fields: [ppp_users.profile_id],
		references: [ppp_profiles.id],
	}),
	customer: one(customers, {
		fields: [ppp_users.customer_id],
		references: [customers.id],
	}),
	active_sessions: many(ppp_active_sessions),
	usage_sessions: many(ppp_usage_sessions),
}));

export const ppp_active_sessionsRelations = relations(
	ppp_active_sessions,
	({ one }) => ({
		router: one(routers, {
			fields: [ppp_active_sessions.router_id],
			references: [routers.id],
		}),
		ppp_user: one(ppp_users, {
			fields: [ppp_active_sessions.ppp_user_id],
			references: [ppp_users.id],
		}),
		customer: one(customers, {
			fields: [ppp_active_sessions.customer_id],
			references: [customers.id],
		}),
	})
);

export const ppp_usage_sessionsRelations = relations(
	ppp_usage_sessions,
	({ one }) => ({
		router: one(routers, {
			fields: [ppp_usage_sessions.router_id],
			references: [routers.id],
		}),
		ppp_user: one(ppp_users, {
			fields: [ppp_usage_sessions.ppp_user_id],
			references: [ppp_users.id],
		}),
		customer: one(customers, {
			fields: [ppp_usage_sessions.customer_id],
			references: [customers.id],
		}),
		active_session: one(ppp_active_sessions, {
			fields: [ppp_usage_sessions.ppp_active_session_id],
			references: [ppp_active_sessions.id],
		}),
	})
);

// Hotspot Relations
export const hotspot_profilesRelations = relations(
	hotspot_profiles,
	({ one, many }) => ({
		router: one(routers, {
			fields: [hotspot_profiles.router_id],
			references: [routers.id],
		}),
		hotspot_users: many(hotspot_users),
		voucher_batches: many(voucher_batches),
		vouchers: many(vouchers),
		invoices: many(invoices),
	})
);

export const hotspot_usersRelations = relations(
	hotspot_users,
	({ one, many }) => ({
		router: one(routers, {
			fields: [hotspot_users.router_id],
			references: [routers.id],
		}),
		profile: one(hotspot_profiles, {
			fields: [hotspot_users.profile_id],
			references: [hotspot_profiles.id],
		}),
		customer: one(customers, {
			fields: [hotspot_users.customer_id],
			references: [customers.id],
		}),
		active_sessions: many(hotspot_active_sessions),
		usage_sessions: many(hotspot_usage_sessions),
	})
);

export const hotspot_active_sessionsRelations = relations(
	hotspot_active_sessions,
	({ one }) => ({
		router: one(routers, {
			fields: [hotspot_active_sessions.router_id],
			references: [routers.id],
		}),
		hotspot_user: one(hotspot_users, {
			fields: [hotspot_active_sessions.hotspot_user_id],
			references: [hotspot_users.id],
		}),
		customer: one(customers, {
			fields: [hotspot_active_sessions.customer_id],
			references: [customers.id],
		}),
	})
);

export const hotspot_usage_sessionsRelations = relations(
	hotspot_usage_sessions,
	({ one }) => ({
		router: one(routers, {
			fields: [hotspot_usage_sessions.router_id],
			references: [routers.id],
		}),
		hotspot_user: one(hotspot_users, {
			fields: [hotspot_usage_sessions.hotspot_user_id],
			references: [hotspot_users.id],
		}),
		customer: one(customers, {
			fields: [hotspot_usage_sessions.customer_id],
			references: [customers.id],
		}),
		active_session: one(hotspot_active_sessions, {
			fields: [hotspot_usage_sessions.hotspot_active_session_id],
			references: [hotspot_active_sessions.id],
		}),
	})
);

// Hotspot Voucher Relations
export const voucher_batchesRelations = relations(
	voucher_batches,
	({ one, many }) => ({
		router: one(routers, {
			fields: [voucher_batches.router_id],
			references: [routers.id],
		}),
		profile: one(hotspot_profiles, {
			fields: [voucher_batches.profile_id],
			references: [hotspot_profiles.id],
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
	profile: one(hotspot_profiles, {
		fields: [vouchers.profile_id],
		references: [hotspot_profiles.id],
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
	ppp_profile: one(ppp_profiles, {
		fields: [invoices.ppp_profile_id],
		references: [ppp_profiles.id],
	}),
	hotspot_profile: one(hotspot_profiles, {
		fields: [invoices.hotspot_profile_id],
		references: [hotspot_profiles.id],
	}),
	payment_method: one(paymentMethods, {
		fields: [invoices.payment_method_id],
		references: [paymentMethods.id],
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
	router: one(routers, {
		fields: [payments.router_id],
		references: [routers.id],
	}),
	payment_method: one(paymentMethods, {
		fields: [payments.payment_method_id],
		references: [paymentMethods.id],
	}),
	processed_by_user: one(users, {
		fields: [payments.processed_by],
		references: [users.id],
	}),
}));

// Router Relations
export const routersRelations = relations(routers, ({ many }) => ({
	customers: many(customers),
	ppp_profiles: many(ppp_profiles),
	ppp_users: many(ppp_users),
	ppp_active_sessions: many(ppp_active_sessions),
	ppp_usage_sessions: many(ppp_usage_sessions),
	hotspot_profiles: many(hotspot_profiles),
	hotspot_users: many(hotspot_users),
	hotspot_active_sessions: many(hotspot_active_sessions),
	hotspot_usage_sessions: many(hotspot_usage_sessions),
	voucher_batches: many(voucher_batches),
	vouchers: many(vouchers),
	payments: many(payments),
}));

// ============ TYPE-SAFE EXPORTS ============

// Company Settings
export type CompanySetting = typeof company_settings.$inferSelect;
export type NewCompanySetting = typeof company_settings.$inferInsert;

// Customer types
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

// PPPoE types
export type PppProfile = typeof ppp_profiles.$inferSelect;
export type NewPppProfile = typeof ppp_profiles.$inferInsert;

export type PppUser = typeof ppp_users.$inferSelect;
export type NewPppUser = typeof ppp_users.$inferInsert;

export type PppActiveSession = typeof ppp_active_sessions.$inferSelect;
export type NewPppActiveSession = typeof ppp_active_sessions.$inferInsert;

export type PppUsageSession = typeof ppp_usage_sessions.$inferSelect;
export type NewPppUsageSession = typeof ppp_usage_sessions.$inferInsert;

// Hotspot types
export type HotspotProfile = typeof hotspot_profiles.$inferSelect;
export type NewHotspotProfile = typeof hotspot_profiles.$inferInsert;

export type HotspotUser = typeof hotspot_users.$inferSelect;
export type NewHotspotUser = typeof hotspot_users.$inferInsert;

export type HotspotActiveSession = typeof hotspot_active_sessions.$inferSelect;
export type NewHotspotActiveSession =
	typeof hotspot_active_sessions.$inferInsert;

export type HotspotUsageSession = typeof hotspot_usage_sessions.$inferSelect;
export type NewHotspotUsageSession = typeof hotspot_usage_sessions.$inferInsert;

// Payment types
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

// Hotspot Voucher types
export type HotspotVoucherBatch = typeof voucher_batches.$inferSelect;
export type NewHotspotVoucherBatch = typeof voucher_batches.$inferInsert;

export type HotspotVoucher = typeof vouchers.$inferSelect;
export type NewHotspotVoucher = typeof vouchers.$inferInsert;

// Router types
export type Router = typeof routers.$inferSelect;
export type NewRouter = typeof routers.$inferInsert;
