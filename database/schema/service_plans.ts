// ============ SERVICE PLANS SCHEMA ============
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
	pgEnum,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { routers } from "./users";
import { customers } from "./mikrotik";

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

// Service plan enums
export const planTypeEnum = pgEnum("plan_type", ["prepaid", "postpaid"]);
export const planStatusEnum = pgEnum("plan_status", [
	"active",
	"inactive",
	"archived",
]);
export const planServiceEnum = pgEnum("plan_service", [
	"pppoe",
	"hotspot",
	"both",
]);
export const billingCycleEnum = pgEnum("billing_cycle", [
	"daily",
	"weekly",
	"monthly",
	"quarterly",
	"yearly",
]);

// ============ SERVICE PLANS ============
export const service_plans = pgTable(
	"service_plans",
	{
		...baseEntityFields,
		router_id: integer("router_id").references(() => routers.id),

		// Basic plan information
		name: varchar("name", { length: 100 }).notNull(),
		description: text("description"),
		plan_type: planTypeEnum("plan_type").notNull(),
		service_type: planServiceEnum("service_type").notNull(),

		// Pricing
		price: decimal("price", { precision: 15, scale: 2 }).notNull(),
		setup_fee: decimal("setup_fee", { precision: 15, scale: 2 }).default("0"),
		billing_cycle: billingCycleEnum("billing_cycle").default("monthly"),

		// Bandwidth limits
		download_speed: varchar("download_speed", { length: 20 }), // e.g., "10M", "1G"
		upload_speed: varchar("upload_speed", { length: 20 }),
		burst_download: varchar("burst_download", { length: 20 }),
		burst_upload: varchar("burst_upload", { length: 20 }),

		// Data limits
		data_limit: integer("data_limit"), // in MB
		data_limit_unit: varchar("data_limit_unit", { length: 10 }).default("MB"), // MB, GB, TB

		// Time limits
		session_timeout: integer("session_timeout"), // in seconds
		idle_timeout: integer("idle_timeout"), // in seconds
		uptime_limit: integer("uptime_limit"), // daily uptime limit in seconds
		validity_days: integer("validity_days"), // plan validity in days

		// Connection limits
		simultaneous_sessions: integer("simultaneous_sessions").default(1),
		shared_users: integer("shared_users").default(1),

		// Features
		static_ip: boolean("static_ip").default(false),
		public_ip: boolean("public_ip").default(false),

		// Quality of Service
		priority: integer("priority").default(5), // 1-10, 1 highest
		queue_type: varchar("queue_type", { length: 20 }).default("simple"), // simple, tree

		// Auto actions
		auto_suspend_on_limit: boolean("auto_suspend_on_limit").default(true),
		auto_extend_on_payment: boolean("auto_extend_on_payment").default(true),
		grace_period_days: integer("grace_period_days").default(0),

		// Fair Usage Policy
		fup_enabled: boolean("fup_enabled").default(false),
		fup_threshold: integer("fup_threshold"), // percentage of data limit
		fup_download_speed: varchar("fup_download_speed", { length: 20 }),
		fup_upload_speed: varchar("fup_upload_speed", { length: 20 }),

		// Hotspot specific
		hotspot_redirect_url: varchar("hotspot_redirect_url", { length: 255 }),
		mac_binding: boolean("mac_binding").default(false),

		// PPPoE specific
		pppoe_pool: varchar("pppoe_pool", { length: 100 }),
		dns_servers: varchar("dns_servers", { length: 255 }),
		routes: text("routes"),

		// Promotional
		is_promotional: boolean("is_promotional").default(false),
		promo_start_date: timestamp("promo_start_date"),
		promo_end_date: timestamp("promo_end_date"),
		promo_discount: decimal("promo_discount", {
			precision: 5,
			scale: 2,
		}).default("0"),

		// Availability
		is_public: boolean("is_public").default(true), // visible to customers
		max_customers: integer("max_customers"), // null = unlimited
		current_customers: integer("current_customers").default(0),

		plan_status: planStatusEnum("plan_status").default("active"),
		...statusFields,
	},
	(table) => [
		uniqueIndex("service_plans_name_router_unique").on(
			table.name,
			table.router_id
		),
		index("service_plans_router_idx").on(table.router_id),
		index("service_plans_type_idx").on(table.plan_type),
		index("service_plans_service_idx").on(table.service_type),
		index("service_plans_status_idx").on(table.plan_status),
		index("service_plans_public_idx").on(table.is_public),
		index("service_plans_price_idx").on(table.price),
	]
);

// ============ PLAN FEATURES ============
export const plan_features = pgTable(
	"plan_features",
	{
		...baseEntityFields,
		plan_id: integer("plan_id")
			.references(() => service_plans.id)
			.notNull(),
		feature_name: varchar("feature_name", { length: 100 }).notNull(),
		feature_value: varchar("feature_value", { length: 255 }),
		is_enabled: boolean("is_enabled").default(true),
		description: text("description"),
	},
	(table) => [
		index("plan_features_plan_idx").on(table.plan_id),
		index("plan_features_name_idx").on(table.feature_name),
	]
);

// ============ CUSTOMER SUBSCRIPTIONS ============
export const customer_subscriptions = pgTable(
	"customer_subscriptions",
	{
		...baseEntityFields,
		customer_id: integer("customer_id")
			.references(() => customers.id)
			.notNull(),
		plan_id: integer("plan_id")
			.references(() => service_plans.id)
			.notNull(),
		router_id: integer("router_id")
			.references(() => routers.id)
			.notNull(),

		// Subscription period
		start_date: timestamp("start_date").notNull(),
		end_date: timestamp("end_date").notNull(),
		last_billed: timestamp("last_billed"),
		next_billing: timestamp("next_billing"),

		// Pricing (can override plan pricing)
		monthly_fee: decimal("monthly_fee", { precision: 15, scale: 2 }).notNull(),
		setup_fee_paid: decimal("setup_fee_paid", {
			precision: 15,
			scale: 2,
		}).default("0"),

		// Usage tracking
		data_used: integer("data_used").default(0), // in MB
		uptime_used: integer("uptime_used").default(0), // in seconds
		session_count: integer("session_count").default(0),

		// Status
		subscription_status: varchar("subscription_status", { length: 20 }).default(
			"active"
		),
		auto_renew: boolean("auto_renew").default(true),

		// Grace period
		grace_period_end: timestamp("grace_period_end"),
		suspend_reason: varchar("suspend_reason", { length: 255 }),

		notes: text("notes"),
	},
	(table) => [
		index("customer_subscriptions_customer_idx").on(table.customer_id),
		index("customer_subscriptions_plan_idx").on(table.plan_id),
		index("customer_subscriptions_router_idx").on(table.router_id),
		index("customer_subscriptions_status_idx").on(table.subscription_status),
		index("customer_subscriptions_end_date_idx").on(table.end_date),
		index("customer_subscriptions_billing_idx").on(table.next_billing),
	]
);

// ============ RELATIONS ============
export const service_plansRelations = relations(
	service_plans,
	({ one, many }) => ({
		router: one(routers, {
			fields: [service_plans.router_id],
			references: [routers.id],
		}),
		features: many(plan_features),
		subscriptions: many(customer_subscriptions),
	})
);

export const plan_featuresRelations = relations(plan_features, ({ one }) => ({
	plan: one(service_plans, {
		fields: [plan_features.plan_id],
		references: [service_plans.id],
	}),
}));

export const customer_subscriptionsRelations = relations(
	customer_subscriptions,
	({ one }) => ({
		customer: one(customers, {
			fields: [customer_subscriptions.customer_id],
			references: [customers.id],
		}),
		plan: one(service_plans, {
			fields: [customer_subscriptions.plan_id],
			references: [service_plans.id],
		}),
		router: one(routers, {
			fields: [customer_subscriptions.router_id],
			references: [routers.id],
		}),
	})
);

// ============ TYPE EXPORTS ============
export type ServicePlan = typeof service_plans.$inferSelect;
export type NewServicePlan = typeof service_plans.$inferInsert;

export type PlanFeature = typeof plan_features.$inferSelect;
export type NewPlanFeature = typeof plan_features.$inferInsert;

export type CustomerSubscription = typeof customer_subscriptions.$inferSelect;
export type NewCustomerSubscription =
	typeof customer_subscriptions.$inferInsert;
