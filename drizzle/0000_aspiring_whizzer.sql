CREATE TYPE "public"."invoice_status" AS ENUM('pending', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."log_level" AS ENUM('info', 'warning', 'error', 'debug');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('connecting', 'active', 'idle', 'disconnecting', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."session_type" AS ENUM('pppoe', 'hotspot', 'vpn', 'bandwidth', 'static_ip', 'others');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('active', 'inactive', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'operator', 'user');--> statement-breakpoint
CREATE TYPE "public"."voucher_status" AS ENUM('unused', 'used', 'expired');--> statement-breakpoint
CREATE TABLE "active_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"router_id" integer NOT NULL,
	"session_user_id" integer,
	"customer_id" integer,
	"profile_id" integer,
	"session_id" varchar(100) NOT NULL,
	"username" varchar(50) NOT NULL,
	"type" "session_type" NOT NULL,
	"status" "session_status" DEFAULT 'active',
	"client_ip" varchar(45),
	"client_mac" varchar(17),
	"nas_ip" varchar(45),
	"nas_port" varchar(20),
	"login_time" timestamp NOT NULL,
	"last_update" timestamp DEFAULT now(),
	"idle_time" integer DEFAULT 0,
	"uptime" integer DEFAULT 0,
	"bytes_in" bigint DEFAULT 0,
	"bytes_out" bigint DEFAULT 0,
	"packets_in" bigint DEFAULT 0,
	"packets_out" bigint DEFAULT 0,
	"rate_limit_rx" varchar(20),
	"rate_limit_tx" varchar(20),
	"caller_id" varchar(50),
	"framed_protocol" varchar(20),
	"service_type" varchar(20),
	"mikrotik_session_id" varchar(100),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "active_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" varchar(100) NOT NULL,
	"logo" varchar(255),
	"currency" varchar(10) DEFAULT 'IDR',
	"timezone" varchar(50) DEFAULT 'Asia/Jakarta',
	"language" varchar(10) DEFAULT 'id',
	"email" varchar(255),
	"phone" varchar(20),
	"address" text,
	"website" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"username" varchar(50) NOT NULL,
	"password" varchar(255),
	"service_plan_id" integer,
	"router_id" integer,
	"balance" numeric(15, 2) DEFAULT '0',
	"personal_info" jsonb,
	"registration_date" timestamp DEFAULT now(),
	"last_login" timestamp,
	"notes" text,
	"first_name" varchar(50),
	"last_name" varchar(50),
	"email" varchar(255),
	"phone" varchar(20),
	"address" text,
	"status" "status" DEFAULT 'active',
	"is_active" boolean DEFAULT true,
	CONSTRAINT "customers_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"customer_id" integer,
	"service_plan_id" integer,
	"amount" numeric(15, 2) NOT NULL,
	"tax" numeric(15, 2) DEFAULT '0',
	"discount" numeric(15, 2) DEFAULT '0',
	"total_amount" numeric(15, 2) NOT NULL,
	"due_date" timestamp NOT NULL,
	"status" "invoice_status" DEFAULT 'pending',
	"paid_at" timestamp,
	"payment_method" varchar(50),
	"description" text,
	"notes" text,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"invoice_id" integer,
	"customer_id" integer,
	"amount" numeric(15, 2) NOT NULL,
	"method" varchar(50) NOT NULL,
	"reference" varchar(100),
	"status" "payment_status" DEFAULT 'pending',
	"processed_by" integer,
	"processed_at" timestamp,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "session_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"router_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "session_type" NOT NULL,
	"price" numeric(15, 2) NOT NULL,
	"sell_price" numeric(15, 2) NOT NULL,
	"network_config" jsonb,
	"bandwidth_config" jsonb,
	"timeout_config" jsonb,
	"limits" jsonb,
	"security_config" jsonb,
	"advanced_config" jsonb,
	"comment" text,
	"mikrotik_id" varchar(50),
	"synced_to_mikrotik" boolean DEFAULT false,
	"status" "status" DEFAULT 'active',
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "session_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"router_id" integer NOT NULL,
	"profile_id" integer,
	"customer_id" integer,
	"name" varchar(100) NOT NULL,
	"password" varchar(100),
	"type" "session_type" NOT NULL,
	"network_config" jsonb,
	"limits" jsonb,
	"expiry_date" timestamp,
	"last_login" timestamp,
	"usage_stats" jsonb,
	"comment" text,
	"mikrotik_id" varchar(50),
	"synced_to_mikrotik" boolean DEFAULT false,
	"status" "status" DEFAULT 'active',
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" varchar(50) NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" jsonb,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"level" "log_level" NOT NULL,
	"message" text NOT NULL,
	"context" jsonb,
	"user_id" integer,
	"ip_address" varchar(45),
	"user_agent" varchar(255),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"type" varchar(50) NOT NULL,
	"priority" "priority" DEFAULT 'medium',
	"status" "task_status" DEFAULT 'pending',
	"assigned_to" integer,
	"customer_id" integer,
	"router_id" integer,
	"due_date" timestamp,
	"completed_at" timestamp,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "usage_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"router_id" integer NOT NULL,
	"session_user_id" integer,
	"customer_id" integer,
	"active_session_id" integer,
	"username" varchar(50) NOT NULL,
	"type" "session_type" NOT NULL,
	"session_id" varchar(100),
	"login_time" timestamp,
	"logout_time" timestamp,
	"uptime" integer DEFAULT 0,
	"bytes_in" bigint DEFAULT 0,
	"bytes_out" bigint DEFAULT 0,
	"packets_in" bigint DEFAULT 0,
	"packets_out" bigint DEFAULT 0,
	"disconnect_reason" varchar(255),
	"client_ip" varchar(45),
	"nas_ip" varchar(45),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voucher_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"router_id" integer NOT NULL,
	"profile_id" integer,
	"batch_name" varchar(100) NOT NULL,
	"generation_config" jsonb,
	"total_generated" integer DEFAULT 0,
	"comment" text,
	"created_by" integer,
	"status" "status" DEFAULT 'active',
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"router_id" integer NOT NULL,
	"batch_id" integer,
	"session_profiles_id" integer,
	"general" jsonb,
	"comment" text,
	"limits" jsonb,
	"statistics" jsonb,
	"status" "voucher_status" DEFAULT 'unused',
	"created_by" integer,
	"mikrotik_id" varchar(50),
	"synced_to_mikrotik" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "actions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"resource_id" integer NOT NULL,
	"action_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resources_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "routers" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"username" varchar(50) NOT NULL,
	"password" varchar(255) NOT NULL,
	"keepalive" boolean DEFAULT true,
	"timeout" integer DEFAULT 300000,
	"port" integer DEFAULT 8728,
	"location" varchar(100),
	"description" text,
	"is_active" boolean DEFAULT true,
	"last_seen" timestamp,
	"status" varchar(20) DEFAULT 'offline',
	"version" varchar(50),
	"uptime" varchar(50),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "routers_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"assigned_by" integer,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"name" varchar(255),
	"image" text,
	"email_verified" timestamp,
	"first_name" varchar(50),
	"last_name" varchar(50),
	"phone" varchar(20),
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "active_sessions" ADD CONSTRAINT "active_sessions_router_id_routers_id_fk" FOREIGN KEY ("router_id") REFERENCES "public"."routers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_sessions" ADD CONSTRAINT "active_sessions_session_user_id_session_users_id_fk" FOREIGN KEY ("session_user_id") REFERENCES "public"."session_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_sessions" ADD CONSTRAINT "active_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_sessions" ADD CONSTRAINT "active_sessions_profile_id_session_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."session_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_service_plan_id_session_profiles_id_fk" FOREIGN KEY ("service_plan_id") REFERENCES "public"."session_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_router_id_routers_id_fk" FOREIGN KEY ("router_id") REFERENCES "public"."routers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_service_plan_id_session_profiles_id_fk" FOREIGN KEY ("service_plan_id") REFERENCES "public"."session_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_profiles" ADD CONSTRAINT "session_profiles_router_id_routers_id_fk" FOREIGN KEY ("router_id") REFERENCES "public"."routers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_users" ADD CONSTRAINT "session_users_router_id_routers_id_fk" FOREIGN KEY ("router_id") REFERENCES "public"."routers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_users" ADD CONSTRAINT "session_users_profile_id_session_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."session_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_users" ADD CONSTRAINT "session_users_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_router_id_routers_id_fk" FOREIGN KEY ("router_id") REFERENCES "public"."routers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_sessions" ADD CONSTRAINT "usage_sessions_router_id_routers_id_fk" FOREIGN KEY ("router_id") REFERENCES "public"."routers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_sessions" ADD CONSTRAINT "usage_sessions_session_user_id_session_users_id_fk" FOREIGN KEY ("session_user_id") REFERENCES "public"."session_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_sessions" ADD CONSTRAINT "usage_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_sessions" ADD CONSTRAINT "usage_sessions_active_session_id_active_sessions_id_fk" FOREIGN KEY ("active_session_id") REFERENCES "public"."active_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_batches" ADD CONSTRAINT "voucher_batches_router_id_routers_id_fk" FOREIGN KEY ("router_id") REFERENCES "public"."routers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_batches" ADD CONSTRAINT "voucher_batches_profile_id_session_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."session_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_batches" ADD CONSTRAINT "voucher_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_router_id_routers_id_fk" FOREIGN KEY ("router_id") REFERENCES "public"."routers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_batch_id_voucher_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."voucher_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_session_profiles_id_session_profiles_id_fk" FOREIGN KEY ("session_profiles_id") REFERENCES "public"."session_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "active_sessions_session_id_idx" ON "active_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "active_sessions_username_router_idx" ON "active_sessions" USING btree ("username","router_id");--> statement-breakpoint
CREATE INDEX "active_sessions_customer_idx" ON "active_sessions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "active_sessions_status_idx" ON "active_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "active_sessions_login_time_idx" ON "active_sessions" USING btree ("login_time");--> statement-breakpoint
CREATE INDEX "active_sessions_mikrotik_idx" ON "active_sessions" USING btree ("mikrotik_session_id");--> statement-breakpoint
CREATE INDEX "active_sessions_type_router_idx" ON "active_sessions" USING btree ("type","router_id");--> statement-breakpoint
CREATE INDEX "customers_username_idx" ON "customers" USING btree ("username");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "customers_status_idx" ON "customers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "customers_service_plan_idx" ON "customers" USING btree ("service_plan_id");--> statement-breakpoint
CREATE INDEX "customers_router_idx" ON "customers" USING btree ("router_id");--> statement-breakpoint
CREATE INDEX "invoices_customer_idx" ON "invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_due_date_idx" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_customer_idx" ON "payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "session_profiles_type_router_idx" ON "session_profiles" USING btree ("type","router_id");--> statement-breakpoint
CREATE INDEX "session_profiles_name_router_idx" ON "session_profiles" USING btree ("name","router_id");--> statement-breakpoint
CREATE INDEX "session_profiles_mikrotik_idx" ON "session_profiles" USING btree ("mikrotik_id");--> statement-breakpoint
CREATE INDEX "session_users_type_router_idx" ON "session_users" USING btree ("type","router_id");--> statement-breakpoint
CREATE INDEX "session_users_name_router_idx" ON "session_users" USING btree ("name","router_id");--> statement-breakpoint
CREATE INDEX "session_users_customer_idx" ON "session_users" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "session_users_profile_idx" ON "session_users" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "session_users_expiry_idx" ON "session_users" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "settings_category_key_idx" ON "settings" USING btree ("category","key");--> statement-breakpoint
CREATE INDEX "system_logs_level_idx" ON "system_logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "system_logs_user_idx" ON "system_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "system_logs_date_idx" ON "system_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tasks_assigned_idx" ON "tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_priority_idx" ON "tasks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "usage_sessions_router_idx" ON "usage_sessions" USING btree ("router_id");--> statement-breakpoint
CREATE INDEX "usage_sessions_customer_idx" ON "usage_sessions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "usage_sessions_username_idx" ON "usage_sessions" USING btree ("username");--> statement-breakpoint
CREATE INDEX "usage_sessions_login_time_idx" ON "usage_sessions" USING btree ("login_time");--> statement-breakpoint
CREATE INDEX "usage_sessions_session_id_idx" ON "usage_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "voucher_batches_router_idx" ON "voucher_batches" USING btree ("router_id");--> statement-breakpoint
CREATE INDEX "voucher_batches_profile_idx" ON "voucher_batches" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "vouchers_status_idx" ON "vouchers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vouchers_batch_idx" ON "vouchers" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "routers_ip_idx" ON "routers" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "routers_status_idx" ON "routers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "routers_active_idx" ON "routers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "user_roles_user_id_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_id_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");