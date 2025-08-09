import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
	public statusCode: number;
	public code: string;

	constructor(
		message: string,
		statusCode: number = 500,
		code: string = "INTERNAL_ERROR"
	) {
		super(message);
		this.statusCode = statusCode;
		this.code = code;
		this.name = "ApiError";
	}
}

export function handleApiError(error: unknown) {
	console.error("API Error:", error);

	if (error instanceof ZodError) {
		return NextResponse.json(
			{
				success: false,
				error: "Validation failed",
				code: "VALIDATION_ERROR",
				details: error.errors.map((err) => ({
					field: err.path.join("."),
					message: err.message,
				})),
			},
			{ status: 400 }
		);
	}

	if (error instanceof ApiError) {
		return NextResponse.json(
			{
				success: false,
				error: error.message,
				code: error.code,
			},
			{ status: error.statusCode }
		);
	}

	// Database errors
	if (error && typeof error === "object" && "code" in error) {
		const dbError = error as { code: string; message: string };

		switch (dbError.code) {
			case "23505": // Unique violation
				return NextResponse.json(
					{
						success: false,
						error: "Resource already exists",
						code: "DUPLICATE_RESOURCE",
					},
					{ status: 409 }
				);
			case "23503": // Foreign key violation
				return NextResponse.json(
					{
						success: false,
						error: "Referenced resource not found",
						code: "FOREIGN_KEY_VIOLATION",
					},
					{ status: 400 }
				);
			case "23502": // Not null violation
				return NextResponse.json(
					{
						success: false,
						error: "Required field is missing",
						code: "MISSING_REQUIRED_FIELD",
					},
					{ status: 400 }
				);
			default:
				return NextResponse.json(
					{
						success: false,
						error: "Database error occurred",
						code: "DATABASE_ERROR",
					},
					{ status: 500 }
				);
		}
	}

	// Generic error
	return NextResponse.json(
		{
			success: false,
			error: "An unexpected error occurred",
			code: "INTERNAL_ERROR",
		},
		{ status: 500 }
	);
}

export function successResponse<T>(data: T, status: number = 200) {
	return NextResponse.json(
		{
			success: true,
			data,
		},
		{ status }
	);
}
