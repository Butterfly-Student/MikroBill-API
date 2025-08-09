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
import {
	nas,
	nasreload,
	radacct,
	radcheck,
	radgroupcheck,
	radgroupreply,
	radpostauth,
	radreply,
	radusergroup,
} from "./radius";
import { hotspotProfile, hotspotUser } from "./hotspot";

// ========================================
// CUSTOMER MANAGEMENT TABLES
// ========================================

// Main customer table
export const customers = pgTable(
	"customers",
	{
		id: serial("id").primaryKey(),
		customer_code: varchar("customer_code", { length: 50 }).notNull().unique(),
		full_name: varchar("full_name", { length: 100 }).notNull(),
		email: varchar("email", { length: 100 }),
		phone: varchar("phone", { length: 20 }),
		address: text("address"),
		city: varchar("city", { length: 50 }),
		postal_code: varchar("postal_code", { length: 10 }),
		id_number: varchar("id_number", { length: 50 }),
		customer_type: varchar("customer_type", { length: 20 }).default(
			"residential"
		),
		status: varchar("status", { length: 20 }).default("active"),
		registration_date: timestamp("registration_date", {
			withTimezone: true,
		}).defaultNow(),
		billing_address: text("billing_address"),
		billing_city: varchar("billing_city", { length: 50 }),
		billing_postal_code: varchar("billing_postal_code", { length: 10 }),
		notes: text("notes"),
		created_by: text("created_by"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
		updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [
		check(
			"customer_type_check",
			sql`customer_type IN ('residential', 'business', 'corporate')`
		),
		check(
			"status_check",
			sql`status IN ('active', 'inactive', 'suspended', 'terminated')`
		),
		index("customers_customer_code_idx").on(table.customer_code),
		index("customers_email_idx").on(table.email),
		index("customers_phone_idx").on(table.phone),
		index("customers_status_idx").on(table.status),
	]
);

// ========================================
// PPPOE MANAGEMENT TABLES
// ========================================

// PPPoE service profiles
export const pppoeProfile = pgTable("pppoe_profile", {
	id: serial("id").primaryKey(),
	profile_name: varchar("profile_name", { length: 50 }).notNull().unique(),
	description: text("description"),
	price: integer("price").default(0),
	sell_price: integer("sell_price").default(0),
	download_speed: integer("download_speed").notNull(), // in Kbps
	upload_speed: integer("upload_speed").notNull(), // in Kbps
	download_limit: bigint("download_limit", { mode: "number" }), // in bytes
	upload_limit: bigint("upload_limit", { mode: "number" }), // in bytes
	session_timeout: integer("session_timeout"), // in seconds
	idle_timeout: integer("idle_timeout"), // in seconds
	simultaneous_use: integer("simultaneous_use").default(1),
	pool_name: varchar("pool_name", { length: 50 }),
	dns_primary: inet("dns_primary"),
	dns_secondary: inet("dns_secondary"),
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
	updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// PPPoE service groups
export const pppoeGroup = pgTable("pppoe_group", {
	id: serial("id").primaryKey(),
	group_name: varchar("group_name", { length: 50 }).notNull().unique(),
	description: text("description"),
	default_profile_id: integer("default_profile_id").references(
		() => pppoeProfile.id,
		{
			onDelete: "set null",
		}
	),
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
	updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// PPPoE user accounts
export const pppoeUser = pgTable(
	"pppoe_user",
	{
		id: serial("id").primaryKey(),
		username: varchar("username", { length: 100 }).notNull().unique(),
		password: varchar("password", { length: 100 }).notNull(),
		customer_id: integer("customer_id").references(() => customers.id, {
			onDelete: "cascade",
		}),
		profile_id: integer("profile_id").references(() => pppoeProfile.id, {
			onDelete: "set null",
		}),
		group_id: integer("group_id").references(() => pppoeGroup.id, {
			onDelete: "set null",
		}),
		status: varchar("status", { length: 20 }).default("active"),
		static_ip: inet("static_ip"),
		mac_address: varchar("mac_address", { length: 17 }),
		installation_date: timestamp("installation_date", { withTimezone: true }),
		activation_date: timestamp("activation_date", { withTimezone: true }),
		suspension_date: timestamp("suspension_date", { withTimezone: true }),
		termination_date: timestamp("termination_date", { withTimezone: true }),
		last_login: timestamp("last_login", { withTimezone: true }),
		comment: text("comment"),
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
		updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [
		check(
			"pppoe_status_check",
			sql`status IN ('active', 'inactive', 'suspended', 'terminated')`
		),
		index("pppoe_user_customer_idx").on(table.customer_id),
		index("pppoe_user_profile_idx").on(table.profile_id),
		index("pppoe_user_status_idx").on(table.status),
		index("pppoe_user_radcheck_idx").on(table.radcheck_id),
		index("pppoe_user_radreply_idx").on(table.radreply_id),
		index("pppoe_user_radusergroup_idx").on(table.radusergroup_id),
	]
);

// PPPoE sessions with enhanced tracking
export const pppoeSession = pgTable(
	"pppoe_session",
	{
		id: serial("id").primaryKey(),
		username: varchar("username", { length: 100 }).notNull(),
		acctSessionId: varchar("acct_session_id", { length: 255 }).notNull(),
		acctUniqueId: varchar("acct_unique_id", { length: 255 }).notNull().unique(),
		nasIpAddress: inet("nas_ip_address").notNull(),
		nasPortId: varchar("nas_port_id", { length: 50 }),
		framedIpAddress: inet("framed_ip_address"),
		framedIpv6Address: inet("framed_ipv6_address"),
		callingStationId: varchar("calling_station_id", { length: 100 }),
		calledStationId: varchar("called_station_id", { length: 100 }),
		connectInfo: varchar("connect_info", { length: 255 }),
		startTime: timestamp("start_time", { withTimezone: true }),
		updateTime: timestamp("update_time", { withTimezone: true }),
		stopTime: timestamp("stop_time", { withTimezone: true }),
		inputOctets: bigint("input_octets", { mode: "number" }).default(0),
		outputOctets: bigint("output_octets", { mode: "number" }).default(0),
		inputPackets: bigint("input_packets", { mode: "number" }).default(0),
		outputPackets: bigint("output_packets", { mode: "number" }).default(0),
		sessionTime: bigint("session_time", { mode: "number" }).default(0),
		terminateCause: varchar("terminate_cause", { length: 100 }),
		active: integer("active").default(1),
		serviceCategory: varchar("service_category", { length: 20 }).default(
			"pppoe"
		),
		// FreeRADIUS integration fields
		radacct_id: bigint("radacct_id", { mode: "number" }).references(
			() => radacct.RadAcctId,
			{
				onDelete: "set null",
			}
		),
		pppoe_user_id: integer("pppoe_user_id").references(() => pppoeUser.id, {
			onDelete: "set null",
		}),
		customer_id: integer("customer_id").references(() => customers.id, {
			onDelete: "set null",
		}),
		nas_id: integer("nas_id").references(() => nas.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [
		index("pppoe_session_radacct_idx").on(table.radacct_id),
		index("pppoe_session_user_idx").on(table.pppoe_user_id),
		index("pppoe_session_customer_idx").on(table.customer_id),
		index("pppoe_session_nas_idx").on(table.nas_id),
		index("pppoe_session_active_idx").on(table.active),
		index("pppoe_session_acct_unique_idx").on(table.acctUniqueId),
		index("pppoe_session_username_idx").on(table.username),
	]
);

// PPPoE authentication log
export const pppoeUserAuth = pgTable(
	"pppoe_user_auth",
	{
		id: serial("id").primaryKey(),
		username: varchar("username", { length: 100 }).notNull(),
		auth_result: varchar("auth_result", { length: 20 }).notNull(),
		auth_method: varchar("auth_method", { length: 50 }),
		nas_ip_address: inet("nas_ip_address"),
		nas_port_id: varchar("nas_port_id", { length: 50 }),
		calling_station_id: varchar("calling_station_id", { length: 100 }),
		called_station_id: varchar("called_station_id", { length: 100 }),
		framed_ip_address: inet("framed_ip_address"),
		reply_message: text("reply_message"),
		// FreeRADIUS integration fields
		radpostauth_id: bigint("radpostauth_id", { mode: "number" }).references(
			() => radpostauth.id,
			{
				onDelete: "set null",
			}
		),
		pppoe_user_id: integer("pppoe_user_id").references(() => pppoeUser.id, {
			onDelete: "set null",
		}),
		customer_id: integer("customer_id").references(() => customers.id, {
			onDelete: "set null",
		}),
		nas_id: integer("nas_id").references(() => nas.id, {
			onDelete: "set null",
		}),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [
		check(
			"pppoe_auth_result_check",
			sql`auth_result IN ('success', 'failed', 'rejected')`
		),
		index("pppoe_user_auth_radpostauth_idx").on(table.radpostauth_id),
		index("pppoe_user_auth_user_idx").on(table.pppoe_user_id),
		index("pppoe_user_auth_customer_idx").on(table.customer_id),
		index("pppoe_user_auth_result_idx").on(table.auth_result),
	]
);

// ========================================
// CUSTOMER SERVICE SUBSCRIPTIONS
// ========================================

// Customer service subscriptions (can be PPPoE or Hotspot)
export const customerServices = pgTable(
	"customer_services",
	{
		id: serial("id").primaryKey(),
		customer_id: integer("customer_id").references(() => customers.id, {
			onDelete: "cascade",
		}),
		service_type: varchar("service_type", { length: 20 }).notNull(),
		service_name: varchar("service_name", { length: 100 }).notNull(),
		// PPPoE references
		pppoe_user_id: integer("pppoe_user_id").references(() => pppoeUser.id, {
			onDelete: "set null",
		}),
		pppoe_profile_id: integer("pppoe_profile_id").references(
			() => pppoeProfile.id,
			{
				onDelete: "set null",
			}
		),
		// Hotspot references
		hotspot_user_id: integer("hotspot_user_id").references(
			() => hotspotUser.id,
			{
				onDelete: "set null",
			}
		),
		hotspot_profile_id: integer("hotspot_profile_id").references(
			() => hotspotProfile.id,
			{
				onDelete: "set null",
			}
		),
		status: varchar("status", { length: 20 }).default("active"),
		installation_date: timestamp("installation_date", { withTimezone: true }),
		activation_date: timestamp("activation_date", { withTimezone: true }),
		suspension_date: timestamp("suspension_date", { withTimezone: true }),
		termination_date: timestamp("termination_date", { withTimezone: true }),
		monthly_fee: integer("monthly_fee").default(0),
		installation_fee: integer("installation_fee").default(0),
		deposit: integer("deposit").default(0),
		notes: text("notes"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
		updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [
		check("service_type_check", sql`service_type IN ('pppoe', 'hotspot')`),
		check(
			"service_status_check",
			sql`status IN ('active', 'inactive', 'suspended', 'terminated')`
		),
		index("customer_services_customer_idx").on(table.customer_id),
		index("customer_services_service_type_idx").on(table.service_type),
		index("customer_services_status_idx").on(table.status),
		index("customer_services_pppoe_user_idx").on(table.pppoe_user_id),
		index("customer_services_hotspot_user_idx").on(table.hotspot_user_id),
	]
);

// ========================================
// BILLING SYSTEM
// ========================================


// Customer invoices
export const customerInvoices = pgTable(
	"customer_invoices",
	{
		id: serial("id").primaryKey(),
		invoice_number: varchar("invoice_number", { length: 50 })
			.notNull()
			.unique(),
		customer_id: integer("customer_id").references(() => customers.id, {
			onDelete: "cascade",
		}),
		service_id: integer("service_id").references(() => customerServices.id, {
			onDelete: "set null",
		}),
		invoice_date: timestamp("invoice_date", {
			withTimezone: true,
		}).defaultNow(),
		due_date: timestamp("due_date", { withTimezone: true }),
		period_start: timestamp("period_start", { withTimezone: true }),
		period_end: timestamp("period_end", { withTimezone: true }),
		subtotal: integer("subtotal").default(0),
		tax: integer("tax").default(0),
		discount: integer("discount").default(0),
		total: integer("total").default(0),
		paid_amount: integer("paid_amount").default(0),
		status: varchar("status", { length: 20 }).default("pending"),
		payment_method: varchar("payment_method", { length: 50 }),
		payment_date: timestamp("payment_date", { withTimezone: true }),
		notes: text("notes"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
		updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [
		check(
			"invoice_status_check",
			sql`status IN ('pending', 'paid', 'overdue', 'cancelled')`
		),
		index("customer_invoices_customer_idx").on(table.customer_id),
		index("customer_invoices_service_idx").on(table.service_id),
		index("customer_invoices_status_idx").on(table.status),
		index("customer_invoices_due_date_idx").on(table.due_date),
	]
);

// Customer payments
export const customerPayments = pgTable(
	"customer_payments",
	{
		id: serial("id").primaryKey(),
		payment_number: varchar("payment_number", { length: 50 })
			.notNull()
			.unique(),
		customer_id: integer("customer_id").references(() => customers.id, {
			onDelete: "cascade",
		}),
		invoice_id: integer("invoice_id").references(() => customerInvoices.id, {
			onDelete: "set null",
		}),
		payment_date: timestamp("payment_date", {
			withTimezone: true,
		}).defaultNow(),
		amount: integer("amount").notNull(),
		payment_method: varchar("payment_method", { length: 50 }),
		reference_number: varchar("reference_number", { length: 100 }),
		notes: text("notes"),
		created_by: text("created_by"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [
		index("customer_payments_customer_idx").on(table.customer_id),
		index("customer_payments_invoice_idx").on(table.invoice_id),
		index("customer_payments_payment_date_idx").on(table.payment_date),
	]
);

// ========================================
// RELATIONS
// ========================================

export const customersRelations = relations(customers, ({ many }) => ({
	services: many(customerServices),
	pppoeUsers: many(pppoeUser),
	pppoeSessions: many(pppoeSession),
	pppoeAuthLogs: many(pppoeUserAuth),
	invoices: many(customerInvoices),
	payments: many(customerPayments),
}));

export const pppoeProfileRelations = relations(
	pppoeProfile,
	({ one, many }) => ({
		users: many(pppoeUser),
		groups: many(pppoeGroup),
		services: many(customerServices),
		// FreeRADIUS relations
		radgroupcheck: one(radgroupcheck, {
			fields: [pppoeProfile.radgroupcheck_id],
			references: [radgroupcheck.id],
		}),
		radgroupreply: one(radgroupreply, {
			fields: [pppoeProfile.radgroupreply_id],
			references: [radgroupreply.id],
		}),
		nas: one(nas, {
			fields: [pppoeProfile.nas_id],
			references: [nas.id],
		}),
	})
);

export const pppoeGroupRelations = relations(pppoeGroup, ({ one, many }) => ({
	defaultProfile: one(pppoeProfile, {
		fields: [pppoeGroup.default_profile_id],
		references: [pppoeProfile.id],
	}),
	users: many(pppoeUser),
	// FreeRADIUS relations
	radgroupcheck: one(radgroupcheck, {
		fields: [pppoeGroup.radgroupcheck_id],
		references: [radgroupcheck.id],
	}),
	radgroupreply: one(radgroupreply, {
		fields: [pppoeGroup.radgroupreply_id],
		references: [radgroupreply.id],
	}),
}));

export const pppoeUserRelations = relations(pppoeUser, ({ one, many }) => ({
	customer: one(customers, {
		fields: [pppoeUser.customer_id],
		references: [customers.id],
	}),
	profile: one(pppoeProfile, {
		fields: [pppoeUser.profile_id],
		references: [pppoeProfile.id],
	}),
	group: one(pppoeGroup, {
		fields: [pppoeUser.group_id],
		references: [pppoeGroup.id],
	}),
	sessions: many(pppoeSession),
	authLogs: many(pppoeUserAuth),
	services: many(customerServices),
	// FreeRADIUS relations
	radcheck: one(radcheck, {
		fields: [pppoeUser.radcheck_id],
		references: [radcheck.id],
	}),
	radreply: one(radreply, {
		fields: [pppoeUser.radreply_id],
		references: [radreply.id],
	}),
	radusergroup: one(radusergroup, {
		fields: [pppoeUser.radusergroup_id],
		references: [radusergroup.id],
	}),
}));

export const pppoeSessionRelations = relations(pppoeSession, ({ one }) => ({
	user: one(pppoeUser, {
		fields: [pppoeSession.pppoe_user_id],
		references: [pppoeUser.id],
	}),
	customer: one(customers, {
		fields: [pppoeSession.customer_id],
		references: [customers.id],
	}),
	radacct: one(radacct, {
		fields: [pppoeSession.radacct_id],
		references: [radacct.RadAcctId],
	}),
	nas: one(nas, {
		fields: [pppoeSession.nas_id],
		references: [nas.id],
	}),
}));

export const pppoeUserAuthRelations = relations(pppoeUserAuth, ({ one }) => ({
	user: one(pppoeUser, {
		fields: [pppoeUserAuth.pppoe_user_id],
		references: [pppoeUser.id],
	}),
	customer: one(customers, {
		fields: [pppoeUserAuth.customer_id],
		references: [customers.id],
	}),
	radpostauth: one(radpostauth, {
		fields: [pppoeUserAuth.radpostauth_id],
		references: [radpostauth.id],
	}),
	nas: one(nas, {
		fields: [pppoeUserAuth.nas_id],
		references: [nas.id],
	}),
}));

export const customerServicesRelations = relations(
	customerServices,
	({ one }) => ({
		customer: one(customers, {
			fields: [customerServices.customer_id],
			references: [customers.id],
		}),
		pppoeUser: one(pppoeUser, {
			fields: [customerServices.pppoe_user_id],
			references: [pppoeUser.id],
		}),
		pppoeProfile: one(pppoeProfile, {
			fields: [customerServices.pppoe_profile_id],
			references: [pppoeProfile.id],
		}),
		hotspotUser: one(hotspotUser, {
			fields: [customerServices.hotspot_user_id],
			references: [hotspotUser.id],
		}),
		hotspotProfile: one(hotspotProfile, {
			fields: [customerServices.hotspot_profile_id],
			references: [hotspotProfile.id],
		}),
	})
);

export const customerInvoicesRelations = relations(
	customerInvoices,
	({ one, many }) => ({
		customer: one(customers, {
			fields: [customerInvoices.customer_id],
			references: [customers.id],
		}),
		service: one(customerServices, {
			fields: [customerInvoices.service_id],
			references: [customerServices.id],
		}),
		payments: many(customerPayments),
	})
);

export const customerPaymentsRelations = relations(
	customerPayments,
	({ one }) => ({
		customer: one(customers, {
			fields: [customerPayments.customer_id],
			references: [customers.id],
		}),
		invoice: one(customerInvoices, {
			fields: [customerPayments.invoice_id],
			references: [customerInvoices.id],
		}),
	})
);

// ========================================
// TYPESCRIPT TYPES
// ========================================

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

export type PppoeProfile = typeof pppoeProfile.$inferSelect;
export type NewPppoeProfile = typeof pppoeProfile.$inferInsert;

export type PppoeGroup = typeof pppoeGroup.$inferSelect;
export type NewPppoeGroup = typeof pppoeGroup.$inferInsert;

export type PppoeUser = typeof pppoeUser.$inferSelect;
export type NewPppoeUser = typeof pppoeUser.$inferInsert;

export type PppoeSession = typeof pppoeSession.$inferSelect;
export type NewPppoeSession = typeof pppoeSession.$inferInsert;

export type PppoeUserAuth = typeof pppoeUserAuth.$inferSelect;
export type NewPppoeUserAuth = typeof pppoeUserAuth.$inferInsert;

export type CustomerService = typeof customerServices.$inferSelect;
export type NewCustomerService = typeof customerServices.$inferInsert;

export type CustomerInvoice = typeof customerInvoices.$inferSelect;
export type NewCustomerInvoice = typeof customerInvoices.$inferInsert;

export type CustomerPayment = typeof customerPayments.$inferSelect;
export type NewCustomerPayment = typeof customerPayments.$inferInsert;
