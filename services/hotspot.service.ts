// Add this function to your existing router.service.ts file

import { createMikrotikHotspot } from "@/services/mikrotik/MikrotikHotspot";

/**
 * Get hotspot profiles for a router
 */
export const getHotspotProfiles = async (routerId: number) => {
	try {
		const hotspotService = await createMikrotikHotspot(routerId);
		return await hotspotService.getProfiles(routerId);
	} catch (error) {
		console.error(
			`Error getting hotspot profiles for router ${routerId}:`,
			error
		);
		throw error;
	}
};

/**
 * Get hotspot users for a router
 */
export const getHotspotUsers = async (routerId: number) => {
	try {
		const hotspotService = await createMikrotikHotspot(routerId);
		return await hotspotService.getUsers(routerId);
	} catch (error) {
		console.error(`Error getting hotspot users for router ${routerId}:`, error);
		throw error;
	}
};

/**
 * Get active hotspot users for a router
 */
export const getHotspotActiveUsers = async (routerId: number) => {
	try {
		const hotspotService = await createMikrotikHotspot(routerId);
		return await hotspotService.getActiveUsers(routerId);
	} catch (error) {
		console.error(
			`Error getting active hotspot users for router ${routerId}:`,
			error
		);
		throw error;
	}
};

/**
 * Get hotspot vouchers for a router
 */
export const getHotspotVouchers = async (routerId: number, limit = 50) => {
	try {
		const hotspotService = await createMikrotikHotspot(routerId);
		return await hotspotService.getActiveVouchers(routerId, limit);
	} catch (error) {
		console.error(
			`Error getting hotspot vouchers for router ${routerId}:`,
			error
		);
		throw error;
	}
};

/**
 * Get hotspot voucher batches for a router
 */
export const getHotspotVoucherBatches = async (routerId: number) => {
	try {
		const hotspotService = await createMikrotikHotspot(routerId);
		return await hotspotService.getVoucherBatches(routerId);
	} catch (error) {
		console.error(
			`Error getting hotspot voucher batches for router ${routerId}:`,
			error
		);
		throw error;
	}
};

/**
 * Get hotspot statistics for a router
 */
export const getHotspotStats = async (routerId: number) => {
	try {
		const hotspotService = await createMikrotikHotspot(routerId);
		return await hotspotService.getHotspotStats(routerId);
	} catch (error) {
		console.error(`Error getting hotspot stats for router ${routerId}:`, error);
		throw error;
	}
};
