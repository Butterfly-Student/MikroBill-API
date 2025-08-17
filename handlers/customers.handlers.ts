import * as customerService from "@/services/customers.service";
import {
	createSuccessResponse,
	createErrorResponse,
	createPaginatedResponse,
} from "@/utils/response.utils";
import type {
	CustomerQuery,
	CreateCustomerRequest,
	UpdateCustomerRequest,
} from "../types/api.types";

export const getCustomers = async (
	{ 
		query,
		params
	}: 
	{
		query: CustomerQuery;
		params: { router_id: number };
	}) => {
	try {
		const { customers, pagination } = await customerService.getAllCustomers(
			query,
			params.router_id
		);
		return createPaginatedResponse(
			customers,
			pagination,
			"Customers retrieved successfully"
		);
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to retrieve customers");
	}
};

export const getCustomerById = async ({
	params,
}: {
	params: { id: string, router_id: number };
}) => {
	try {
		const customerId = parseInt(params.id);

		if (isNaN(customerId)) {
			return createErrorResponse("Invalid customer ID", "Validation error");
		}

		const customer = await customerService.getCustomerById(customerId, params.router_id);
		return createSuccessResponse(customer, "Customer retrieved successfully");
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to retrieve customer");
	}
};

export const createCustomer = async ({
	body,
	params
}: {
	body: CreateCustomerRequest;
	params: { router_id: number };
}) => {
	try {
		const customer = await customerService.createCustomer(body, params.router_id);
		return createSuccessResponse(customer, "Customer created successfully");
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to create customer");
	}
};

export const updateCustomer = async ({
	params,
	body,
}: {
	params: { id: string, router_id: number };
	body: UpdateCustomerRequest;
}) => {
	try {
		const customerId = parseInt(params.id);

		if (isNaN(customerId)) {
			return createErrorResponse("Invalid customer ID", "Validation error");
		}

		const customer = await customerService.updateCustomer(customerId, params.router_id, body);
		return createSuccessResponse(customer, "Customer updated successfully");
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to update customer");
	}
};

export const deleteCustomer = async ({
	params,
}: {
	params: { id: string, router_id: number };
}) => {
	try {
		const customerId = parseInt(params.id);

		if (isNaN(customerId)) {
			return createErrorResponse("Invalid customer ID", "Validation error");
		}

		await customerService.deleteCustomer(customerId, params.router_id);
		return createSuccessResponse(null, "Customer deleted successfully");
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to delete customer");
	}
};

export const getCustomerSessions = async ({
	params,
}: {
	params: { id: string, router_id: number };
}) => {
	try {
		const customerId = parseInt(params.id);

		if (isNaN(customerId)) {
			return createErrorResponse("Invalid customer ID", "Validation error");
		}

		const sessions = await customerService.getCustomerSessions(customerId, params.router_id);
		return createSuccessResponse(
			sessions,
			"Customer sessions retrieved successfully"
		);
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to retrieve customer sessions"
		);
	}
};

export const getCustomerStatistics = async ({
	params,
}: {
	params: { id: string, router_id: number };
}) => {
	try {
		const customerId = parseInt(params.id);

		if (isNaN(customerId)) {
			return createErrorResponse("Invalid customer ID", "Validation error");
		}

		const statistics = await customerService.getCustomerStatistics(customerId, params.router_id);
		return createSuccessResponse(
			statistics,
			"Customer statistics retrieved successfully"
		);
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to retrieve customer statistics"
		);
	}
};
