import type { ApiResponse } from "@/types/api.types";

export const createSuccessResponse = <T>(
	data: T,
	message: string = "Success"
): ApiResponse<T> => ({
	success: true,
	message,
	data,
});

export const createErrorResponse = (
	error: string,
	message: string = "Error occurred"
): ApiResponse => ({
	success: false,
	message,
	error,
});

export const createPaginatedResponse = <T>(
	data: T[],
	pagination: {
		page: number;
		limit: number;
		total: number;
	},
	message: string = "Success"
): ApiResponse<T[]> => ({
	success: true,
	message,
	data,
	pagination: {
		...pagination,
		totalPages: Math.ceil(pagination.total / pagination.limit),
	},
});
