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

export const getCustomers = async ({ query }: { query: CustomerQuery }) => {
	try {
		const { customers, pagination } = await customerService.getAllCustomers(
			query
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
	params: { id: string };
}) => {
	try {
		const customerId = parseInt(params.id);

		if (isNaN(customerId)) {
			return createErrorResponse("Invalid customer ID", "Validation error");
		}

		const customer = await customerService.getCustomerById(customerId);
		return createSuccessResponse(customer, "Customer retrieved successfully");
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to retrieve customer");
	}
};

export const createCustomer = async ({
	body,
}: {
	body: CreateCustomerRequest;
}) => {
	try {
		const customer = await customerService.createCustomer(body);
		return createSuccessResponse(customer, "Customer created successfully");
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to create customer");
	}
};

export const updateCustomer = async ({
	params,
	body,
}: {
	params: { id: string };
	body: UpdateCustomerRequest;
}) => {
	try {
		const customerId = parseInt(params.id);

		if (isNaN(customerId)) {
			return createErrorResponse("Invalid customer ID", "Validation error");
		}

		const customer = await customerService.updateCustomer(customerId, body);
		return createSuccessResponse(customer, "Customer updated successfully");
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to update customer");
	}
};

export const deleteCustomer = async ({
	params,
}: {
	params: { id: string };
}) => {
	try {
		const customerId = parseInt(params.id);

		if (isNaN(customerId)) {
			return createErrorResponse("Invalid customer ID", "Validation error");
		}

		await customerService.deleteCustomer(customerId);
		return createSuccessResponse(null, "Customer deleted successfully");
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to delete customer");
	}
};

export const getCustomerSessions = async ({
	params,
}: {
	params: { id: string };
}) => {
	try {
		const customerId = parseInt(params.id);

		if (isNaN(customerId)) {
			return createErrorResponse("Invalid customer ID", "Validation error");
		}

		const sessions = await customerService.getCustomerSessions(customerId);
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
	params: { id: string };
}) => {
	try {
		const customerId = parseInt(params.id);

		if (isNaN(customerId)) {
			return createErrorResponse("Invalid customer ID", "Validation error");
		}

		const statistics = await customerService.getCustomerStatistics(customerId);
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
