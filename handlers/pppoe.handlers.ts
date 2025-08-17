import { createMikrotikPppoe } from "@/services/mikrotik/MikrotikPppoe";
import { createErrorResponse, createSuccessResponse } from "@/utils/response.utils";

export const getRouterPppoeInactiveUsers = async ({
	params,
  query
}: {
	params: { router_id: number };
	query: { search?: string };
}) => {
	try {
		const routerId: number = params.router_id;

		if (isNaN(routerId)) {
			return createErrorResponse("Invalid router ID", "Validation error");
		}

		const pppoeService = await createMikrotikPppoe(routerId);
    console.log("Params", query.search)
    await pppoeService.initActiveUsers();
		const users = await pppoeService.searchInactive(query.search);
    console.log("Users",users);

		return createSuccessResponse(
			users,
			"Hotspot profiles retrieved successfully"
		);
	} catch (error: any) {
		return createErrorResponse(
			error.message,
			"Failed to retrieve hotspot profiles"
		);
	}
};