import { MikrotikClient, createMikrotikClient } from "@/lib/mikrotik/client";
import type { StreamData } from "@/lib/mikrotik/client";

export const getRouterInfo = async (routerId: number) => {
	const client = await createMikrotikClient(routerId);

	try {
		const [identity, resources, interfaces] = await Promise.all([
			client.getIdentity(),
			client.getResources(),
			client.getInterfaces(),
		]);

		return {
			identity,
			resources,
			interfaces: interfaces.length,
			connectionStatus: "connected",
		};
	} catch (error: any) {
		throw new Error(`Failed to get router info: ${error.message}`);
	}
};

export const getPPPoEProfiles = async (routerId: number) => {
	const client = await createMikrotikClient(routerId);

	try {
		const profiles = await client.getPPPoEProfiles();
		return profiles.map((profile) => ({
			...profile,
			type: "pppoe",
		}));
	} catch (error: any) {
		throw new Error(`Failed to get PPPoE profiles: ${error.message}`);
	}
};

export const getPPPoESecrets = async (routerId: number) => {
	const client = await createMikrotikClient(routerId);

	try {
		return await client.getPPPoESecrets();
	} catch (error: any) {
		throw new Error(`Failed to get PPPoE secrets: ${error.message}`);
	}
};

export const getHotspotProfiles = async (routerId: number) => {
	const client = await createMikrotikClient(routerId);

	try {
		const profiles = await client.getHotspotProfiles();
		return profiles.map((profile) => ({
			...profile,
			type: "hotspot",
		}));
	} catch (error: any) {
		throw new Error(`Failed to get Hotspot profiles: ${error.message}`);
	}
};

export const startTorchMonitoring = async (
	routerId: number,
	interfaceName: string,
	callback: (data: StreamData) => void,
	errorCallback?: (error: any) => void
) => {
	const client = await createMikrotikClient(routerId);

	try {
		return await client.startTorchStream(
			interfaceName,
			callback,
			errorCallback
		);
	} catch (error: any) {
		throw new Error(`Failed to start torch monitoring: ${error.message}`);
	}
};

export const stopMonitoring = async (routerId: number, streamId: string) => {
	const client = MikrotikClient.getCachedClient(routerId);

	if (!client) {
		throw new Error("Router client not found");
	}

	const stopped = client.stopStream(streamId);

	if (!stopped) {
		throw new Error("Failed to stop monitoring stream");
	}

	return { stopped: true, streamId };
};

export const getConnectionStats = () => {
	return MikrotikClient.getConnectionStats();
};

export const testConnection = async (routerId: number) => {
	try {
		const client = await createMikrotikClient(routerId);
		const identity = await client.getIdentity();

		return {
			connected: true,
			identity,
			timestamp: new Date(),
		};
	} catch (error: any) {
		return {
			connected: false,
			error: error.message,
			timestamp: new Date(),
		};
	}
};

export const getRouterInterfaces = async (routerId: number) => {
	const client = await createMikrotikClient(routerId);

	try {
		const interfaces = await client.getInterfaces();

		return interfaces.map((iface) => ({
			name: iface.name,
			type: iface.type,
			running: iface.running === "true",
			disabled: iface.disabled === "true",
			rxBytes: parseInt(iface["rx-byte"] || "0"),
			txBytes: parseInt(iface["tx-byte"] || "0"),
			rxPackets: parseInt(iface["rx-packet"] || "0"),
			txPackets: parseInt(iface["tx-packet"] || "0"),
		}));
	} catch (error: any) {
		throw new Error(`Failed to get router interfaces: ${error.message}`);
	}
};
