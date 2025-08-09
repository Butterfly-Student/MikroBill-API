import { Elysia } from "elysia";
import { createErrorResponse } from "@/utils/response.utils";

export const errorHandler = new Elysia()
	.onError({ as: "global" }, ({ code, error, set }) => {
		if (error instanceof Error) {
			console.error(`[${new Date().toISOString()}] API Error:`, {
				code,
				message: error.message,
				stack: error.stack,
			});
		} else {
			console.error(`[${new Date().toISOString()}] API Error:`, {
				code,
				error,
			});
		}

		switch (code) {
			case "VALIDATION":
				set.status = 400;
				return createErrorResponse(
					`Validation failed: ${error.message}`,
					"Invalid input data"
				);

			case "NOT_FOUND":
				set.status = 404;
				return createErrorResponse(
					"The requested resource was not found",
					"Resource not found"
				);

			case "PARSE":
				set.status = 400;
				return createErrorResponse("Invalid JSON format", "Parse error");

			case "INTERNAL_SERVER_ERROR":
				set.status = 500;
				return createErrorResponse(
					"An internal server error occurred",
					"Internal server error"
				);

			case "UNKNOWN":
			default:
				set.status = 500;
				if (error instanceof Error) {
					return createErrorResponse(
						error.message || "An unexpected error occurred",
						"Server error"
					);
				} else {
					return createErrorResponse(
						"An unexpected error occurred",
						"Server error"
					);
				}
		}
	})

	.onBeforeHandle(({ set }) => {
		// Add security headers
		set.headers["X-Content-Type-Options"] = "nosniff";
		set.headers["X-Frame-Options"] = "DENY";
		set.headers["X-XSS-Protection"] = "1; mode=block";
	});
