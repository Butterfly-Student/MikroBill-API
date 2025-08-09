import { pgEnum } from "drizzle-orm/pg-core";

// ===== ENUMS =====
export const transactionTypeEnum = pgEnum("transaction_type", [
  "income",
  "expense",
]);
export const referenceTypeEnum = pgEnum("reference_type", [
  "payment",
  "voucher_sale",
  "commission",
  "expense",
  "other",
]);
export const customerTypeEnum = pgEnum("customer_type", ["hotspot", "pppoe"]);
export const statusEnum = pgEnum("status", [
  "pending",
  "paid",
  "overdue",
  "cancelled",
]);
export const reminderTypeEnum = pgEnum("reminder_type", [
  "payment_reminder",
  "expiry_warning",
  "welcome",
  "custom",
]);
export const targetAudienceEnum = pgEnum("target_audience", [
  "pppoe",
  "hotspot",
  "reseller",
  "admin",
]);
export const sendViaEnum = pgEnum("send_via", [
  "whatsapp",
  "email",
  "sms",
  "notification",
]);
export const taskTypeEnum = pgEnum("task_type", [
  "reminder",
  "billing",
  "report",
  "maintenance",
]);
export const targetTypeEnum = pgEnum("target_type", [
  "specific",
  "group",
  "all",
]);
export const scheduleTypeEnum = pgEnum("schedule_type", [
  "once",
  "daily",
  "weekly",
  "monthly",
]);
export const taskStatusEnum = pgEnum("task_status", [
  "active",
  "paused",
  "completed",
  "failed",
]);
export const noteCategoryEnum = pgEnum("note_category", [
  "general",
  "customer",
  "technical",
  "financial",
  "reminder",
]);
export const priorityEnum = pgEnum("priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);
export const adminNoteStatusEnum = pgEnum("admin_note_status", [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);
export const recipientRoleEnum = pgEnum("recipient_role", [
  "admin",
  "operator",
  "viewer",
]);
export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "sent",
  "failed",
]);
export const userStatusEnum = pgEnum("user_status", [
  "active",
  "disabled",
  "expired",
]);
export const profileTypeEnum = pgEnum("profile_type", ["hotspot", "pppoe"]);
export const expiredModeEnum = pgEnum("expired_mode", [
  "remove",
  "notice",
  "grace",
]);
export const voucherStatusEnum = pgEnum("voucher_status", [
  "unused",
  "used",
  "expired",
]);
export const accountTypeEnum = pgEnum("account_type", [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
]);