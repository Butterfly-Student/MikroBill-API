import { db } from "@/lib/db";
import { customers, invoices, session_users } from "@/database/schema/mikrotik";
import { eq, like, and, count, or, ne } from "drizzle-orm";
import type {
	CustomerQuery,
	CreateCustomerRequest,
	UpdateCustomerRequest,
} from "../types/api.types";
import type { NewCustomer } from "@/database/schema/mikrotik";

export const getAllCustomers = async (query: CustomerQuery) => {
	const { page = 1, limit = 10, search, status, router_id } = query;
	const offset = (page - 1) * limit;

	// Build where conditions
	const conditions = [];

	if (search) {
		conditions.push(
			or(
				like(customers.username, `%${search}%`),
				like(customers.first_name, `%${search}%`),
				like(customers.last_name, `%${search}%`),
				like(customers.email, `%${search}%`)
			)
		);
	}

	if (status) {
		conditions.push(eq(customers.status, status));
	}

	if (router_id) {
		conditions.push(eq(customers.router_id, router_id));
	}

	const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

	// Get total count
	const [{ total }] = await db
		.select({ total: count() })
		.from(customers)
		.where(whereCondition);

	// Get customers with pagination
	const customerList = await db.query.customers.findMany({
		where: whereCondition,
		limit,
		offset,
		with: {
			service_plan: true,
			router: true,
		},
		orderBy: (customers, { desc }) => [desc(customers.created_at)],
	});

	return {
		customers: customerList,
		pagination: { page, limit, total },
	};
};

export const getCustomerById = async (id: number) => {
	const customer = await db.query.customers.findFirst({
		where: eq(customers.id, id),
		with: {
			service_plan: true,
			router: true,
			session_users: true,
			invoices: {
				limit: 10,
				orderBy: (invoices, { desc }) => [desc(invoices.created_at)],
			},
		},
	});

	if (!customer) {
		throw new Error("Customer not found");
	}

	return customer;
};

export const createCustomer = async (data: CreateCustomerRequest) => {
	// Check if username already exists
	const existingCustomer = await db.query.customers.findFirst({
		where: eq(customers.username, data.username),
	});

	if (existingCustomer) {
		throw new Error("Username already exists");
	}

	// Check if email exists (if provided)
	if (data.email) {
		const existingEmail = await db.query.customers.findFirst({
			where: eq(customers.email, data.email),
		});

		if (existingEmail) {
			throw new Error("Email already exists");
		}
	}

	const customerData: NewCustomer = {
		...data,
		status: "active",
		is_active: true,
		registration_date: new Date(),
		balance: "0",
	};

	const [newCustomer] = await db
		.insert(customers)
		.values(customerData)
		.returning();
	return newCustomer;
};

export const updateCustomer = async (
	id: number,
	data: UpdateCustomerRequest
) => {
	// Check if customer exists
	const existingCustomer = await db.query.customers.findFirst({
		where: eq(customers.id, id),
	});

	if (!existingCustomer) {
		throw new Error("Customer not found");
	}

	// Check username uniqueness if updating username
	if (data.username && data.username !== existingCustomer.username) {
		const usernameExists = await db.query.customers.findFirst({
			where: and(eq(customers.username, data.username), ne(customers.id, id)),
		});

		if (usernameExists) {
			throw new Error("Username already exists");
		}
	}

	// Check email uniqueness if updating email
	if (data.email && data.email !== existingCustomer.email) {
		const emailExists = await db.query.customers.findFirst({
			where: and(eq(customers.email, data.email), ne(customers.id, id)),
		});

		if (emailExists) {
			throw new Error("Email already exists");
		}
	}

	const [updatedCustomer] = await db
		.update(customers)
		.set({ ...data, updated_at: new Date() })
		.where(eq(customers.id, id))
		.returning();

	return updatedCustomer;
};

export const deleteCustomer = async (id: number) => {
	// Check if customer has active sessions
	const activeSessions = await db.query.session_users.findMany({
		where: and(
			eq(session_users.customer_id, id),
			eq(session_users.is_active, true)
		),
	});

	if (activeSessions.length > 0) {
		throw new Error("Cannot delete customer with active sessions");
	}

	const [deletedCustomer] = await db
		.delete(customers)
		.where(eq(customers.id, id))
		.returning();

	if (!deletedCustomer) {
		throw new Error("Customer not found");
	}

	return deletedCustomer;
};

export const getCustomerSessions = async (customerId: number) => {
	const customer = await db.query.customers.findFirst({
		where: eq(customers.id, customerId),
	});

	if (!customer) {
		throw new Error("Customer not found");
	}

	return db.query.session_users.findMany({
		where: eq(session_users.customer_id, customerId),
		with: {
			profile: true,
			router: true,
		},
		orderBy: (session_users, { desc }) => [desc(session_users.created_at)],
	});
};

export const getCustomerStatistics = async (customerId: number) => {
	const [customer, sessions, invoice] = await Promise.all([
		db.query.customers.findFirst({
			where: eq(customers.id, customerId),
		}),
		db.query.session_users.findMany({
			where: eq(session_users.customer_id, customerId),
		}),
		db.query.invoices.findMany({
			where: eq(invoices.customer_id, customerId),
			with: {
				payments: true,
			},
		}),
	]);

	if (!customer) {
		throw new Error("Customer not found");
	}

	const activeSessions = sessions.filter((s) => s.is_active).length;
	const totalInvoices = invoice.length;
	const paidInvoices = invoice.filter((i) => i.status === "paid").length;
	const pendingInvoices = invoice.filter((i) => i.status === "pending").length;
	const overdueInvoices = invoice.filter((i) => i.status === "overdue").length;

	return {
		customer,
		statistics: {
			activeSessions,
			totalSessions: sessions.length,
			totalInvoices,
			paidInvoices,
			pendingInvoices,
			overdueInvoices,
			currentBalance: customer.balance,
		},
	};
};
