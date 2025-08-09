// ===== RELATIONS =====

import { relations } from "drizzle-orm";
import { activityLogs, adminNotes, customers, notesNotifications, reminderTemplates, resellers, scheduledTasks, settings } from "./system";

// import { billItems, chartOfAccounts, customerBills, financialTransactions, payments, transactionDetails, transactions } from "./billing";
import { roles, userRoles, users } from "./users";


// export const customerBillsRelations = relations(
// 	customerBills,
// 	({ one, many }) => ({
// 		customer: one(customers, {
// 			fields: [customerBills.customer_id],
// 			references: [customers.id],
// 		}),
// 		creator: one(users, {
// 			fields: [customerBills.created_by],
// 			references: [users.id],
// 		}),
// 		items: many(billItems),
// 		payments: many(payments),
// 	})
// );

// export const billItemsRelations = relations(billItems, ({ one }) => ({
// 	bill: one(customerBills, {
// 		fields: [billItems.bill_id],
// 		references: [customerBills.id],
// 	}),
// }));

// export const paymentsRelations = relations(payments, ({ one }) => ({
// 	bill: one(customerBills, {
// 		fields: [payments.bill_id],
// 		references: [customerBills.id],
// 	}),
// 	creator: one(users, {
// 		fields: [payments.created_by],
// 		references: [users.id],
// 	}),
// }));

// export const chartOfAccountsRelations = relations(
// 	chartOfAccounts,
// 	({ one, many }) => ({
// 		parent: one(chartOfAccounts, {
// 			fields: [chartOfAccounts.parent_id],
// 			references: [chartOfAccounts.id],
// 		}),
// 		children: many(chartOfAccounts),
// 		transactionDetails: many(transactionDetails),
// 	})
// );

// export const financialTransactionsRelations = relations(
// 	financialTransactions,
// 	({ one, many }) => ({
// 		creator: one(users, {
// 			fields: [financialTransactions.created_by],
// 			references: [users.id],
// 		}),
// 		details: many(transactionDetails),
// 	})
// );

// export const transactionDetailsRelations = relations(
// 	transactionDetails,
// 	({ one }) => ({
// 		transaction: one(financialTransactions, {
// 			fields: [transactionDetails.transaction_id],
// 			references: [financialTransactions.id],
// 		}),
// 		account: one(chartOfAccounts, {
// 			fields: [transactionDetails.account_id],
// 			references: [chartOfAccounts.id],
// 		}),
// 	})
// );

// export const transactionsRelations = relations(transactions, ({ one }) => ({
// 	user: one(customers, {
// 		fields: [transactions.user_id],
// 		references: [customers.id],
// 	}),
// }));

export const scheduledTasksRelations = relations(scheduledTasks, ({ one }) => ({
	template: one(reminderTemplates, {
		fields: [scheduledTasks.template_id],
		references: [reminderTemplates.id],
	}),
	creator: one(users, {
		fields: [scheduledTasks.created_by],
		references: [users.id],
	}),
}));

export const reminderTemplatesRelations = relations(
	reminderTemplates,
	({ many }) => ({
		scheduledTasks: many(scheduledTasks),
	})
);

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
	user: one(users, {
		fields: [activityLogs.user_id],
		references: [users.id],
	}),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
	userRoles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
	user: one(users, {
		fields: [userRoles.userId],
		references: [users.id],
	}),
	role: one(roles, {
		fields: [userRoles.roleId],
		references: [roles.id],
	}),
	assignedBy: one(users, {
		fields: [userRoles.assigned_by],
		references: [users.id],
	}),
}));

export const adminNotesRelations = relations(adminNotes, ({ one, many }) => ({
	creator: one(users, {
		fields: [adminNotes.created_by],
		references: [users.id],
	}),
	completedBy: one(users, {
		fields: [adminNotes.completed_by],
		references: [users.id],
		relationName: "completedBy",
	}),
	notifications: many(notesNotifications),
}));

export const notesNotificationsRelations = relations(
	notesNotifications,
	({ one }) => ({
		note: one(adminNotes, {
			fields: [notesNotifications.note_id],
			references: [adminNotes.id],
		}),
	})
);

export const settingsRelations = relations(settings, ({ one }) => ({
	updatedBy: one(users, {
		fields: [settings.updated_by],
		references: [users.id],
	}),
}));