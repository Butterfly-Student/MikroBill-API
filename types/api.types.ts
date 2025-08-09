export interface ApiResponse<T = any> {
	success: boolean;
	message: string;
	data?: T;
	error?: string;
	pagination?: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export interface PaginationQuery {
	page?: number;
	limit?: number;
}

export interface CustomerQuery extends PaginationQuery {
	search?: string;
	status?: "active" | "inactive" | "suspended";
	router_id?: number;
}

export interface SessionUserQuery extends PaginationQuery {
	customer_id?: number;
	router_id?: number;
	type?: "pppoe" | "hotspot" | "vpn";
	status?: "active" | "inactive";
}

export interface CreateCustomerRequest {
	username: string;
	password?: string;
	first_name?: string;
	last_name?: string;
	email?: string;
	phone?: string;
	address?: string;
	service_plan_id?: number;
	router_id?: number;
	notes?: string;
}

export interface UpdateCustomerRequest extends Partial<CreateCustomerRequest> {
	status?: string;
	is_active?: boolean;
}
