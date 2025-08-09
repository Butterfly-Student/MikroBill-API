import {
  pgTable,
  serial,
  varchar,
  decimal,
  boolean,
  timestamp,
  integer,
  text,
  inet,
  date,
  jsonb,
  time,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { targetAudienceEnum, notificationStatusEnum, sendViaEnum, taskTypeEnum, targetTypeEnum, scheduleTypeEnum, taskStatusEnum, noteCategoryEnum, priorityEnum, adminNoteStatusEnum, recipientRoleEnum, reminderTypeEnum} from "./enum";

// ===== SETTINGS & CONFIGURATION =====

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).unique().notNull(),
  value: text("value"),
  description: text("description"),
  updated_by: integer("updated_by").references(() => users.id),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const systemConfig = pgTable(
  "system_config",
  {
    id: serial("id").primaryKey(),
    mikrotik_host: varchar("mikrotik_host", { length: 255 }),
    mikrotik_username: varchar("mikrotik_username", { length: 100 }),
    mikrotik_password: varchar("mikrotik_password", { length: 255 }),
    mikrotik_port: integer("mikrotik_port").default(8728),
    mikrotik_timeout: integer("mikrotik_timeout").default(10),
    mikrotik_ssl: boolean("mikrotik_ssl").default(false),
    mikrotik_connected: boolean("mikrotik_connected").default(false),
    whatsapp_enabled: boolean("whatsapp_enabled").default(false),
    whatsapp_api_url: varchar("whatsapp_api_url", { length: 500 }),
    whatsapp_api_token: varchar("whatsapp_api_token", { length: 500 }),
    timeout: integer("timeout").default(30000),
    setup_completed: boolean("setup_completed").default(false),
    last_mikrotik_check: timestamp("last_mikrotik_check"),
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    setupCompletedIdx: index("idx_system_config_setup_completed").on(
      table.setup_completed
    ),
    mikrotikConnectedIdx: index("idx_system_config_mikrotik_connected").on(
      table.mikrotik_connected
    ),
  })
);

// ===== SCHEDULED TASKS =====

export const scheduledTasks = pgTable(
  "scheduled_tasks",
  {
    id: serial("id").primaryKey(),
    task_name: varchar("task_name", { length: 255 }).notNull(),
    task_type: taskTypeEnum("task_type").notNull(),
    template_id: integer("template_id").references(() => reminderTemplates.id),
    target_type: targetTypeEnum("target_type").notNull(),
    target_ids: jsonb("target_ids"),
    schedule_type: scheduleTypeEnum("schedule_type").notNull(),
    schedule_time: time("schedule_time").notNull(),
    schedule_date: date("schedule_date"),
    last_run: timestamp("last_run"),
    next_run: timestamp("next_run").notNull(),
    status: taskStatusEnum("status").default("active"),
    created_by: integer("created_by").references(() => users.id),
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    nextRunIdx: index("idx_scheduled_tasks_next_run").on(table.next_run),
    statusIdx: index("idx_scheduled_tasks_status").on(table.status),
    taskTypeIdx: index("idx_scheduled_tasks_task_type").on(table.task_type),
  })
);

// ===== NOTES MANAGEMENT =====

export const adminNotes = pgTable(
  "admin_notes",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    category: noteCategoryEnum("category").default("general"),
    priority: priorityEnum("priority").default("medium"),
    status: adminNoteStatusEnum("status").default("pending"),
    tags: jsonb("tags"),
    visibility: jsonb("visibility").default('["admin"]'),
    is_pinned: boolean("is_pinned").default(false),
    auto_send_wa: boolean("auto_send_wa").default(false),
    wa_recipients: jsonb("wa_recipients"),
    reminder_date: timestamp("reminder_date"),
    completed_at: timestamp("completed_at"),
    completed_by: integer("completed_by").references(() => users.id),
    created_by: integer("created_by").references(() => users.id),
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    categoryIdx: index("idx_admin_notes_category").on(table.category),
    priorityIdx: index("idx_admin_notes_priority").on(table.priority),
    reminderDateIdx: index("idx_admin_notes_reminder_date").on(
      table.reminder_date
    ),
    createdByIdx: index("idx_admin_notes_created_by").on(table.created_by),
  })
);

export const notesNotifications = pgTable(
  "notes_notifications",
  {
    id: serial("id").primaryKey(),
    note_id: integer("note_id").references(() => adminNotes.id, {
      onDelete: "cascade",
    }),
    recipient_phone: varchar("recipient_phone", { length: 20 }).notNull(),
    recipient_name: varchar("recipient_name", { length: 255 }).notNull(),
    recipient_role: recipientRoleEnum("recipient_role").notNull(),
    message: text("message").notNull(),
    status: notificationStatusEnum("status").default("pending"),
    sent_at: timestamp("sent_at"),
    error_message: text("error_message"),
    created_at: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    noteIdIdx: index("idx_notes_notifications_note_id").on(table.note_id),
    statusIdx: index("idx_notes_notifications_status").on(table.status),
    sentAtIdx: index("idx_notes_notifications_sent_at").on(table.sent_at),
  })
);


// Customers table (renamed from users)
export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 50 }).unique().notNull(),
    email: varchar("email", { length: 100 }).unique().notNull(),
    password_hash: varchar("password_hash", { length: 255 }).notNull(),
    full_name: varchar("full_name", { length: 100 }),
    phone: varchar("phone", { length: 20 }),
    address: text("address"),
    balance: decimal("balance", { precision: 10, scale: 2 }).default("0"),
    is_active: boolean("is_active").default(true),
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    usernameIdx: index("idx_customers_username").on(table.username),
    emailIdx: index("idx_customers_email").on(table.email),
    statusIdx: index("idx_customers_status").on(table.is_active),
  })
);

// Resellers table
export const resellers = pgTable(
  "resellers",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 50 }).unique().notNull(),
    email: varchar("email", { length: 100 }).unique().notNull(),
    password_hash: varchar("password_hash", { length: 255 }).notNull(),
    company_name: varchar("company_name", { length: 100 }),
    full_name: varchar("full_name", { length: 100 }),
    phone: varchar("phone", { length: 20 }),
    address: text("address"),
    balance: decimal("balance", { precision: 10, scale: 2 }).default("0"),
    commission_rate: decimal("commission_rate", {
      precision: 5,
      scale: 2,
    }).default("0"),
    credit_limit: decimal("credit_limit", { precision: 10, scale: 2 }).default(
      "0"
    ),
    is_active: boolean("is_active").default(true),
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    usernameIdx: index("idx_resellers_username").on(table.username),
    emailIdx: index("idx_resellers_email").on(table.email),
    statusIdx: index("idx_resellers_status").on(table.is_active),
  })
);

// ===== WHATSAPP INTEGRATION =====

export const whatsappNotifications = pgTable("whatsapp_notifications", {
  id: serial("id").primaryKey(),
  recipient_phone: varchar("recipient_phone", { length: 20 }).notNull(),
  message: text("message").notNull(),
  template_name: varchar("template_name", { length: 50 }),
  status: notificationStatusEnum("status").default("pending"),
  sent_at: timestamp("sent_at"),
  error_message: text("error_message"),
  created_at: timestamp("created_at").defaultNow(),
});

export const reminderTemplates = pgTable("reminder_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: reminderTypeEnum("type").notNull(),
  target_audience: targetAudienceEnum("target_audience").notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  message: text("message").notNull(),
  send_via: sendViaEnum("send_via").default("whatsapp"),
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// ===== MONITORING & LOGS =====

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: serial("id").primaryKey(),
    user_id: integer("user_id").references(() => users.id),
    action: varchar("action", { length: 100 }).notNull(),
    resource_type: varchar("resource_type", { length: 50 }),
    resource_id: integer("resource_id"),
    details: jsonb("details"),
    ip_address: inet("ip_address"),
    user_agent: text("user_agent"),
    created_at: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_activity_logs_user").on(table.user_id),
    createdAtIdx: index("idx_activity_logs_created").on(table.created_at),
  })
);


export type Note = typeof adminNotes.$inferSelect;
export type NewNote = typeof adminNotes.$inferInsert;
export type SystemConfig = typeof systemConfig.$inferSelect;
export type NewSystemConfig = typeof systemConfig.$inferInsert;