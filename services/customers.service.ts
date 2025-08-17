import { db } from "@/lib/db";
import {
	customers,
	invoices,
	ppp_active_sessions,
	hotspot_active_sessions,
	ppp_users,
	hotspot_users,
} from "@/database/schema/mikrotik";
import {
	service_plans,
	customer_subscriptions,
} from "@/database/schema/service_plans";
import { eq, like, and, count, or, ne } from "drizzle-orm";
import type {
	CustomerQuery,
	CreateCustomerRequest,
	UpdateCustomerRequest,
} from "../types/api.types";
import type { NewCustomer } from "@/database/schema/mikrotik";

export const getAllCustomers = async (
	query: CustomerQuery,
	routerId: number | string
) => {
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
				like(customers.email, `%${search}%`),
				like(customers.phone, `%${search}%`)
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
		.where(and(whereCondition, eq(customers.router_id, routerId as number)));

	// Get customers with pagination
	const customerList = await db.query.customers.findMany({
		where: and(whereCondition, eq(customers.router_id, routerId as number)),
		limit,
		offset,
		with: {
			router: true,
			ppp_users: {
				with: {
					profile: true,
				},
				limit: 5,
			},
			hotspot_users: {
				with: {
					profile: true,
				},
				limit: 5,
			},
		},
		orderBy: (customers, { desc }) => [desc(customers.created_at)],
	});

	return {
		customers: customerList,
		pagination: { page, limit, total },
	};
};

export const getCustomerById = async (id: number, routerId: number) => {
	const customer = await db.query.customers.findFirst({
		where: and(eq(customers.id, id), eq(customers.router_id, routerId)),
		with: {
			router: true,
			ppp_users: {
				with: {
					profile: true,
					active_sessions: true,
				},
			},
			hotspot_users: {
				with: {
					profile: true,
					active_sessions: true,
				},
			},
			ppp_active_sessions: {
				with: {
					ppp_user: {
						with: {
							profile: true,
						},
					},
				},
				limit: 10,
				orderBy: (ppp_active_sessions, { desc }) => [
					desc(ppp_active_sessions.created_at),
				],
			},
			hotspot_active_sessions: {
				with: {
					hotspot_user: {
						with: {
							profile: true,
						},
					},
				},
				limit: 10,
				orderBy: (hotspot_active_sessions, { desc }) => [
					desc(hotspot_active_sessions.created_at),
				],
			},
			invoices: {
				limit: 10,
				orderBy: (invoices, { desc }) => [desc(invoices.created_at)],
				with: {
					payments: true,
				},
			},
		},
	});

	if (!customer) {
		throw new Error("Customer not found");
	}

	return customer;
};

export const createCustomer = async (
	data: CreateCustomerRequest,
	routerId: number
) => {
	// Check if username already exists in this router
	const existingCustomer = await db.query.customers.findFirst({
		where: and(
			eq(customers.username, data.username),
			eq(customers.router_id, routerId)
		),
	});

	if (existingCustomer) {
		throw new Error("Username already exists in this router");
	}

	// Check if email exists in this router (if provided)
	if (data.email) {
		const existingEmail = await db.query.customers.findFirst({
			where: and(
				eq(customers.email, data.email),
				eq(customers.router_id, routerId)
			),
		});

		if (existingEmail) {
			throw new Error("Email already exists in this router");
		}
	}

	// Check if phone exists in this router (if provided)
	if (data.phone) {
		const existingPhone = await db.query.customers.findFirst({
			where: and(
				eq(customers.phone, data.phone),
				eq(customers.router_id, routerId)
			),
		});

		if (existingPhone) {
			throw new Error("Phone number already exists in this router");
		}
	}

	const customerData: NewCustomer = {
		...data,
		router_id: routerId,
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
	router_id: number,
	data: UpdateCustomerRequest
) => {
	// Check if customer exists
	const existingCustomer = await db.query.customers.findFirst({
		where: and(eq(customers.id, id), eq(customers.router_id, router_id)),
	});

	if (!existingCustomer) {
		throw new Error("Customer not found");
	}

	// Check username uniqueness if updating username
	if (data.username && data.username !== existingCustomer.username) {
		const usernameExists = await db.query.customers.findFirst({
			where: and(
				eq(customers.username, data.username),
				ne(customers.id, id),
				eq(customers.router_id, router_id)
			),
		});

		if (usernameExists) {
			throw new Error("Username already exists in this router");
		}
	}

	// Check email uniqueness if updating email
	if (data.email && data.email !== existingCustomer.email) {
		const emailExists = await db.query.customers.findFirst({
			where: and(
				eq(customers.email, data.email),
				ne(customers.id, id),
				eq(customers.router_id, router_id)
			),
		});

		if (emailExists) {
			throw new Error("Email already exists in this router");
		}
	}

	// Check phone uniqueness if updating phone
	if (data.phone && data.phone !== existingCustomer.phone) {
		const phoneExists = await db.query.customers.findFirst({
			where: and(
				eq(customers.phone, data.phone),
				ne(customers.id, id),
				eq(customers.router_id, router_id)
			),
		});

		if (phoneExists) {
			throw new Error("Phone number already exists in this router");
		}
	}

	const [updatedCustomer] = await db
		.update(customers)
		.set({ ...data, updated_at: new Date() })
		.where(and(eq(customers.id, id), eq(customers.router_id, router_id)))
		.returning();

	return updatedCustomer;
};

export const deleteCustomer = async (id: number, router_id: number) => {
	// Check if customer has active PPPoE sessions
	const activePppSessions = await db.query.ppp_active_sessions.findMany({
		where: and(
			eq(ppp_active_sessions.customer_id, id),
			eq(ppp_active_sessions.status, "active"),
			eq(ppp_active_sessions.router_id, router_id)
		),
	});

	if (activePppSessions.length > 0) {
		throw new Error("Cannot delete customer with active PPPoE sessions");
	}

	// Check if customer has active Hotspot sessions
	const activeHotspotSessions = await db.query.hotspot_active_sessions.findMany(
		{
			where: and(
				eq(hotspot_active_sessions.customer_id, id),
				eq(hotspot_active_sessions.status, "active"),
				eq(hotspot_active_sessions.router_id, router_id)
			),
		}
	);

	if (activeHotspotSessions.length > 0) {
		throw new Error("Cannot delete customer with active Hotspot sessions");
	}

	// Check if customer has active subscriptions
	const activeSubscriptions = await db.query.customer_subscriptions.findMany({
		where: and(
			eq(customer_subscriptions.customer_id, id),
			eq(customer_subscriptions.router_id, router_id),
			eq(customer_subscriptions.subscription_status, "active")
		),
	});

	if (activeSubscriptions.length > 0) {
		throw new Error("Cannot delete customer with active subscriptions");
	}

	const [deletedCustomer] = await db
		.delete(customers)
		.where(and(eq(customers.id, id), eq(customers.router_id, router_id)))
		.returning();

	if (!deletedCustomer) {
		throw new Error("Customer not found");
	}

	return deletedCustomer;
};

/**
 * Retrieves all sessions for a customer (both PPPoE and Hotspot)
 */
export const getCustomerSessions = async (
	customerId: number,
	routerId: number
) => {
	const customer = await db.query.customers.findFirst({
		where: and(eq(customers.id, customerId), eq(customers.router_id, routerId)),
	});

	if (!customer) {
		throw new Error("Customer not found");
	}

	const [pppSessions, hotspotSessions] = await Promise.all([
		// Get PPPoE sessions
		db.query.ppp_active_sessions.findMany({
			where: and(
				eq(ppp_active_sessions.customer_id, customerId),
				eq(ppp_active_sessions.router_id, routerId)
			),
			with: {
				ppp_user: {
					with: {
						profile: true,
					},
				},
				router: true,
			},
			orderBy: (ppp_active_sessions, { desc }) => [
				desc(ppp_active_sessions.created_at),
			],
		}),
		// Get Hotspot sessions
		db.query.hotspot_active_sessions.findMany({
			where: and(
				eq(hotspot_active_sessions.customer_id, customerId),
				eq(hotspot_active_sessions.router_id, routerId)
			),
			with: {
				hotspot_user: {
					with: {
						profile: true,
					},
				},
				router: true,
			},
			orderBy: (hotspot_active_sessions, { desc }) => [
				desc(hotspot_active_sessions.created_at),
			],
		}),
	]);

	return {
		ppp_sessions: pppSessions,
		hotspot_sessions: hotspotSessions,
		total_sessions: pppSessions.length + hotspotSessions.length,
	};
};

export const getCustomerStatistics = async (
	customerId: number,
	routerId: number
) => {
	const [customer, pppUsers, hotspotUsers, customerInvoices, subscriptions] =
		await Promise.all([
			db.query.customers.findFirst({
				where: and(
					eq(customers.id, customerId),
					eq(customers.router_id, routerId)
				),
			}),
			db.query.ppp_users.findMany({
				where: and(
					eq(ppp_users.customer_id, customerId),
					eq(ppp_users.router_id, routerId)
				),
				with: {
					active_sessions: true,
				},
			}),
			db.query.hotspot_users.findMany({
				where: and(
					eq(hotspot_users.customer_id, customerId),
					eq(hotspot_users.router_id, routerId)
				),
				with: {
					active_sessions: true,
				},
			}),
			db.query.invoices.findMany({
				where: eq(invoices.customer_id, customerId),
				with: {
					payments: true,
				},
			}),
			db.query.customer_subscriptions.findMany({
				where: and(
					eq(customer_subscriptions.customer_id, customerId),
					eq(customer_subscriptions.router_id, routerId)
				),
				with: {
					plan: true,
				},
			}),
		]);

	if (!customer) {
		throw new Error("Customer not found");
	}

	// Calculate session statistics
	const activePppSessions = pppUsers.reduce(
		(acc, user) => acc + user.active_sessions.length,
		0
	);
	const activeHotspotSessions = hotspotUsers.reduce(
		(acc, user) => acc + user.active_sessions.length,
		0
	);
	const totalActiveSessions = activePppSessions + activeHotspotSessions;

	// Calculate invoice statistics
	const totalInvoices = customerInvoices.length;
	const paidInvoices = customerInvoices.filter(
		(i) => i.status === "paid"
	).length;
	const pendingInvoices = customerInvoices.filter(
		(i) => i.status === "pending"
	).length;
	const overdueInvoices = customerInvoices.filter(
		(i) => i.status === "overdue"
	).length;

	// Calculate subscription statistics
	const activeSubscriptions = subscriptions.filter(
		(s) => s.subscription_status === "active"
	).length;
	const totalDataUsed = subscriptions.reduce(
		(acc, sub) => acc + (sub.data_used || 0),
		0
	);
	const totalUptimeUsed = subscriptions.reduce(
		(acc, sub) => acc + (sub.uptime_used || 0),
		0
	);

	return {
		customer,
		statistics: {
			// Session statistics
			activePppSessions,
			activeHotspotSessions,
			totalActiveSessions,
			totalPppUsers: pppUsers.length,
			totalHotspotUsers: hotspotUsers.length,

			// Invoice statistics
			totalInvoices,
			paidInvoices,
			pendingInvoices,
			overdueInvoices,
			currentBalance: customer.balance,

			// Subscription statistics
			activeSubscriptions,
			totalSubscriptions: subscriptions.length,
			totalDataUsed, // in MB
			totalUptimeUsed, // in seconds
		},
		subscriptions,
	};
};

/**
 * Get customer's service plans and subscriptions
 */
export const getCustomerSubscriptions = async (
	customerId: number,
	routerId: number
) => {
	const customer = await db.query.customers.findFirst({
		where: and(eq(customers.id, customerId), eq(customers.router_id, routerId)),
	});

	if (!customer) {
		throw new Error("Customer not found");
	}

	const subscriptions = await db.query.customer_subscriptions.findMany({
		where: and(
			eq(customer_subscriptions.customer_id, customerId),
			eq(customer_subscriptions.router_id, routerId)
		),
		with: {
			plan: {
				with: {
					features: true,
				},
			},
			router: true,
		},
		orderBy: (customer_subscriptions, { desc }) => [
			desc(customer_subscriptions.created_at),
		],
	});

	return {
		customer,
		subscriptions,
	};
};

/**
 * Get available service plans for a customer
 */
export const getAvailableServicePlans = async (routerId: number) => {
	const plans = await db.query.service_plans.findMany({
		where: and(
			eq(service_plans.router_id, routerId),
			eq(service_plans.is_public, true),
			eq(service_plans.plan_status, "active"),
			eq(service_plans.is_active, true)
		),
		with: {
			features: true,
		},
		orderBy: (service_plans, { asc }) => [asc(service_plans.price)],
	});

	return plans;
};

/**
 * Create a subscription for a customer
 */
export const createCustomerSubscription = async (
	customerId: number,
	planId: number,
	routerId: number,
	subscriptionData: {
		start_date?: Date;
		end_date?: Date;
		monthly_fee?: string;
		auto_renew?: boolean;
		notes?: string;
	} = {}
) => {
	const [customer, plan] = await Promise.all([
		db.query.customers.findFirst({
			where: and(
				eq(customers.id, customerId),
				eq(customers.router_id, routerId)
			),
		}),
		db.query.service_plans.findFirst({
			where: and(
				eq(service_plans.id, planId),
				eq(service_plans.router_id, routerId)
			),
		}),
	]);

	if (!customer) {
		throw new Error("Customer not found");
	}

	if (!plan) {
		throw new Error("Service plan not found");
	}

	if (plan.plan_status !== "active") {
		throw new Error("Service plan is not active");
	}

	// Check if plan has reached max customers limit
	if (
		plan.max_customers &&
		plan.current_customers !== null &&
		plan.current_customers >= plan.max_customers
	) {
		throw new Error("Service plan has reached maximum customer limit");
	}

	const startDate = subscriptionData.start_date || new Date();
	const endDate =
		subscriptionData.end_date ||
		new Date(Date.now() + (plan.validity_days || 30) * 24 * 60 * 60 * 1000);

	const [newSubscription] = await db
		.insert(customer_subscriptions)
		.values({
			customer_id: customerId,
			plan_id: planId,
			router_id: routerId,
			start_date: startDate,
			end_date: endDate,
			monthly_fee: subscriptionData.monthly_fee || plan.price,
			auto_renew: subscriptionData.auto_renew ?? true,
			subscription_status: "active",
			notes: subscriptionData.notes || null,
		})
		.returning();

	// Update plan's current customer count
	await db
		.update(service_plans)
		.set({
			current_customers: (plan.current_customers || 0) + 1,
		})
		.where(eq(service_plans.id, planId));

	return newSubscription;
};
