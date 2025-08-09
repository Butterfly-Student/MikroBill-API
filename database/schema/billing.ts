// import {
//   pgTable,
//   serial,
//   varchar,
//   decimal,
//   boolean,
//   timestamp,
//   integer,
//   text,
//   date,
//   index,
//   foreignKey,
// } from "drizzle-orm/pg-core";
// import { customers } from "./system";
// import { accountTypeEnum, customerTypeEnum, referenceTypeEnum, statusEnum, transactionTypeEnum } from "./enum";
// import { users } from "./users";


// export const customerBills = pgTable(
//   "customer_bills",
//   {
//     id: serial("id").primaryKey(),
//     customer_id: integer("customer_id").references(() => customers.id),
//     bill_number: varchar("bill_number", { length: 100 }).unique().notNull(),
//     bill_date: date("bill_date").notNull(),
//     due_date: date("due_date").notNull(),
//     subtotal: decimal("subtotal", { precision: 15, scale: 2 }).notNull(),
//     tax_amount: decimal("tax_amount", { precision: 15, scale: 2 }).default("0"),
//     discount_amount: decimal("discount_amount", {
//       precision: 15,
//       scale: 2,
//     }).default("0"),
//     total_amount: decimal("total_amount", {
//       precision: 15,
//       scale: 2,
//     }).notNull(),
//     paid_amount: decimal("paid_amount", { precision: 15, scale: 2 }).default(
//       "0"
//     ),
//     status: statusEnum("status").default("pending"),
//     notes: text("notes"),
//     created_by: integer("created_by").references(() => users.id),
//     created_at: timestamp("created_at").defaultNow(),
//     updated_at: timestamp("updated_at").defaultNow(),
//   },
//   (table) => [
//     index("idx_bills_customer").on(table.customer_id),
//     index("idx_bills_status").on(table.status),
//     index("idx_bills_due_date").on(table.due_date),
//   ]
// );

// export const billItems = pgTable("bill_items", {
//   id: serial("id").primaryKey(),
//   bill_id: integer("bill_id").references(() => customerBills.id, {
//     onDelete: "cascade",
//   }),
//   description: text("description").notNull(),
//   quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1"),
//   unit_price: decimal("unit_price", { precision: 15, scale: 2 }).notNull(),
//   total_price: decimal("total_price", { precision: 15, scale: 2 }).notNull(),
// });

// export const monthlyBills = pgTable(
//   "monthly_bills",
//   {
//     id: serial("id").primaryKey(),
//     customer_id: integer("customer_id").notNull(),
//     customer_type: customerTypeEnum("customer_type").notNull(),
//     customer_name: varchar("customer_name", { length: 255 }).notNull(),
//     profile_name: varchar("profile_name", { length: 255 }).notNull(),
//     amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
//     billing_month: varchar("billing_month", { length: 7 }).notNull(), // YYYY-MM
//     due_date: date("due_date").notNull(),
//     status: statusEnum("status").default("pending"),
//     paid_at: timestamp("paid_at"),
//     paid_amount: decimal("paid_amount", { precision: 10, scale: 2 }).default(
//       "0"
//     ),
//     payment_method: varchar("payment_method", { length: 50 }),
//     notes: text("notes"),
//     created_at: timestamp("created_at").defaultNow(),
//     updated_at: timestamp("updated_at").defaultNow(),
//   },
//   (table) => [
//     index("idx_monthly_bills_customer").on(
//       table.customer_id,
//       table.customer_type
//     ),
//     index("idx_monthly_bills_billing_month").on(
//       table.billing_month
//     ),
//     index("idx_monthly_bills_status").on(table.status),
//     index("idx_monthly_bills_due_date").on(table.due_date),
//   ]
// );

// export const payments = pgTable(
//   "payments",
//   {
//     id: serial("id").primaryKey(),
//     bill_id: integer("bill_id").references(() => customerBills.id),
//     payment_date: date("payment_date").notNull(),
//     payment_method: varchar("payment_method", { length: 50 }).notNull(),
//     amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
//     reference_number: varchar("reference_number", { length: 100 }),
//     notes: text("notes"),
//     created_by: integer("created_by").references(() => users.id),
//     created_at: timestamp("created_at").defaultNow(),
//   },
//   (table) => [
//     index("idx_payments_bill").on(table.bill_id),
//   ]
// );

// // ===== FINANCIAL MANAGEMENT =====

// export const chartOfAccounts = pgTable(
//   "chart_of_accounts",
//   {
//     id: serial("id").primaryKey(),
//     code: varchar("code", { length: 20 }).unique().notNull(),
//     name: varchar("name", { length: 200 }).notNull(),
//     account_type: accountTypeEnum("account_type").notNull(),
//     parent_id: integer("parent_id"),
//     is_active: boolean("is_active").default(true),
//     created_at: timestamp("created_at").defaultNow(),
//   },
//   (table) => [
//     foreignKey({
//       columns: [table.parent_id],
//       foreignColumns: [table.id],
//       name: "fk_user_parent", // opsional
//     }),
//     index("idx_chart_of_accounts_code").on(table.code),
//   ]
// );

// export const financialTransactions = pgTable(
//   "financial_transactions",
//   {
//     id: serial("id").primaryKey(),
//     transaction_date: date("transaction_date").notNull(),
//     reference_number: varchar("reference_number", { length: 100 }),
//     description: text("description").notNull(),
//     total_amount: decimal("total_amount", {
//       precision: 15,
//       scale: 2,
//     }).notNull(),
//     transaction_type: transactionTypeEnum("transaction_type").notNull(),
//     category: varchar("category", { length: 100 }).notNull(),
//     reference_type: referenceTypeEnum("reference_type").default("other"),
//     reference_id: integer("reference_id"),
//     created_by: integer("created_by").references(() => users.id),
//     created_at: timestamp("created_at").defaultNow(),
//     updated_at: timestamp("updated_at").defaultNow(),
//   },
//   (table) => [
//     index("idx_financial_transactions_date").on(table.transaction_date),
//     index("idx_financial_transaction_type").on(table.transaction_type),
//     index("idx_financial_category").on(table.category),
//     index("idx_financial_created_at").on(table.created_at),
//   ]
// );


// export const transactionDetails = pgTable("transaction_details", {
//   id: serial("id").primaryKey(),
//   transaction_id: integer("transaction_id").references(
//     () => financialTransactions.id,
//     { onDelete: "cascade" }
//   ),
//   account_id: integer("account_id").references(() => chartOfAccounts.id),
//   debit_amount: decimal("debit_amount", { precision: 15, scale: 2 }).default(
//     "0"
//   ),
//   credit_amount: decimal("credit_amount", { precision: 15, scale: 2 }).default(
//     "0"
//   ),
//   description: text("description"),
// });

// export const transactions = pgTable("transactions", {
//   id: serial("id").primaryKey(),
//   user_id: integer("user_id").references(() => customers.id),
//   type: varchar("type", { length: 20 }).notNull(), // topup, purchase, commission, refund
//   amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
//   balance_before: decimal("balance_before", { precision: 10, scale: 2 }),
//   balance_after: decimal("balance_after", { precision: 10, scale: 2 }),
//   description: text("description"),
//   reference_id: varchar("reference_id", { length: 100 }),
//   created_at: timestamp("created_at").defaultNow(),
// });
