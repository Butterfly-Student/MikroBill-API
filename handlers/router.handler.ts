import { NewRouter } from "@/database/schema/mikrotik";
import * as routerService from "../services/router.service";
import {
	createSuccessResponse,
	createErrorResponse,
	createPaginatedResponse,
} from "@/utils/response.utils";
import { PaginationQuery } from "@/types/api.types";

interface RouterQuery extends PaginationQuery {
	search?: string;
	status?: "online" | "offline" | "error";
	location?: string;
	is_active?: boolean;
}

interface CreateRouterRequest {
	name: string;
	hostname: string;
	username: string;
	password: string;
	location?: string;
	description?: string;
	is_active?: boolean;
}

interface UpdateRouterRequest extends Partial<CreateRouterRequest> {}

export const getRouters = async ({ query }: { query: RouterQuery }) => {
	try {
		const { routers, pagination } = await routerService.getAllRouters(query);
		return createPaginatedResponse(
			routers,
			pagination,
			"Routers retrieved successfully"
		);
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to retrieve routers");
	}
};

export const getRouterById = async ({ params }: { params: { id: string } }) => {
	try {
		const routerId = parseInt(params.id);

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const router = await routerService.getRouterById(routerId);
		return createSuccessResponse(router, "Router retrieved successfully");
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to retrieve router");
	}
};

export const createRouter = async ({ body }: { body: NewRouter }) => {
	try {
		const router = await routerService.createRouter(body);
		return createSuccessResponse(router, "Router created successfully");
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to create router");
	}
};

export const updateRouter = async ({
	params,
	body,
}: {
	params: { router_id: number };
	body: UpdateRouterRequest;
}) => {
	try {
		const routerId = params.router_id;

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const router = await routerService.updateRouter(routerId, body);
		return createSuccessResponse(router, "Router updated successfully");
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to update router");
	}
};

export const deleteRouter = async ({ params }: { params: { router_id: number } }) => {
	try {
		const routerId = params.router_id;

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		await routerService.deleteRouter(routerId);
		return createSuccessResponse(null, "Router deleted successfully");
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to delete router");
	}
};

export const testConnection = async ({
	params,
}: {
	params: { id: string };
}) => {
	try {
		const routerId = parseInt(params.id);

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const result = await routerService.testRouterConnection(routerId);
		return createSuccessResponse(result, "Connection test completed");
	} catch (error: any) {
		return createErrorResponse(error.message, "Failed to test connection");
	}
};

export const getRouterInfo = async ({ params }: { params: { id: string } }) => {
	try {
		const routerId = parseInt(params.id);

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const info = await routerService.getRouterInfo(routerId);
		return createSuccessResponse(
			info,
			"Router information retrieved successfully"
		);
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to retrieve router information"
		);
	}
};


export const getRouterInterfaces = async ({
	params,
}: {
	params: { id: string };
}) => {
	try {
		const routerId = parseInt(params.id);

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const interfaces = await routerService.getRouterInterfaces(routerId);
		return createSuccessResponse(
			interfaces,
			"Router interfaces retrieved successfully"
		);
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to retrieve router interfaces"
		);
	}
};

// PPPoE
export const getRouterPPPoEProfiles = async ({
	params,
}: {
	params: { id: string };
}) => {
	try {
		const routerId = parseInt(params.id);

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const profiles = await routerService.getPPPoEProfiles(routerId);

		return createSuccessResponse(
			profiles,
			"PPPoE profiles retrieved successfully"
		);
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to retrieve PPPoE profiles"
		);
	}
};

// Hotspot
export const getRouterHotspotProfiles = async ({
	params,
}: {
	params: { id: string };
}) => {
	try {
		const routerId = parseInt(params.id);

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const profiles = await routerService.getHotspotProfiles(routerId);

		return createSuccessResponse(
			profiles,
			"Hotspot profiles retrieved successfully"
		);
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to retrieve Hotspot profiles"
		);
	}
};


export const startTorchMonitoring = async ({
	params,
	body,
}: {
	params: { id: string };
	body: { interface: string };
}) => {
	try {
		const routerId = parseInt(params.id);

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		// This would typically be handled via WebSocket for real-time monitoring
		// For now, return a success message indicating monitoring started
		return createSuccessResponse(
			{ routerId, interface: body.interface, status: "monitoring_started" },
			"Torch monitoring started successfully"
		);
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to start torch monitoring"
		);
	}
};
