export interface HotspotUserConfig {
	// Basic user info
  id?: number;
	name: string; // Username
	password?: string;
	email?: string;
	comment?: string;

	// Network settings
	address?: string; // IP address, Default: "0.0.0.0"
	macAddress?: string; // MAC address, Default: "00:00:00:00:00:00"

	// Limits
	limitBytesIn?: number; // Default: 0
	limitBytesOut?: number; // Default: 0
	limitBytesTotal?: number; // Default: 0
	limitUptime?: string; // Time format, Default: "0"

	// Server and profile
	server?: string; // "string" | "all", Default: "all"
	profile?: string; // Default: "default"
	routes?: string; // Route format
}

export interface HotspotUserNetworkConfig {
	address?: string; // IP address, Default: "0.0.0.0"
	macAddress?: string; // MAC address, Default: "00:00:00:00:00:00"
}

export interface HotspotUserUsagesConfig {
	bytesIn?: number; // Default: 0
	bytesOut?: number;
	packetsIn?: number; // Default: 0
	packetsOut?: number;
	uptime?: string;
}

export interface HotspotUserLimitsConfig {
	limitBytesIn?: number; // Default: 0
	limitBytesOut?: number; // Default: 0
	limitBytesTotal?: number; // Default: 0
	limitUptime?: string; // Time format, Default: "0"
}

export interface HotspotUserAdvancedConfig {
	// Server and profile
	server?: string | "all"; // "string" | "all", Default: "all"
	profile?: string | "default"; // Default: "default"
	routes?: string; // Route format
}


export interface PPPSecretUser {
	// Basic identification
	id?: number;
	name: string; // Username for authentication
	password?: string; // Password for authentication

	// Profile reference
	profile?: string; // Default: "default"

	// Network configuration
	localAddress?: string; // IP address set locally on ppp interface
	remoteAddress?: string; // IP address assigned to remote ppp interface
	callerId?: string; // IP for PPTP/L2TP, MAC (CAPITAL) for PPPoE, caller number for ISDN

	// Service configuration
	service?:
		| "any"
		| "async"
		| "isdn"
		| "l2tp"
		| "pppoe"
		| "pptp"
		| "ovpn"
		| "sstp"; // Default: "any"

	// Limits
	limitBytesIn?: number; // Max bytes client can upload per session (Default: 0)
	limitBytesOut?: number; // Max bytes client can download per session (Default: 0)

	// IPv6 configuration
	remoteIpv6Prefix?: string; // IPv6 prefix assigned to ppp client

	// Routing
	routes?: string; // Routes format: "dst-address gateway metric" (comma separated)

	// Administrative
	comment?: string; // Short description
	disabled?: boolean; // Default: false

	// Custom fields (not in Mikrotik)
	routerId?: number; // Reference to router
	createdAt?: Date;
	updatedAt?: Date;
	isActive?: boolean;
	tags?: string[]; // For grouping/categorization
}

export interface HotspotUserConfig {
	id?: number;
	router_id?: number;
	profile_id: number;
	customer_id: number;

	mikrotik_user_id?: string;
	name: string;
	password?: string;
	type: "pppoe" | "hotspot" | "vpn" | "bandwidth" | "static_ip" | "others"; 
	network_config?: HotspotUserNetworkConfig;
	usages_config?: HotspotUserUsagesConfig;
	limits_config?: HotspotUserLimitsConfig;
	advanced_config?: HotspotUserAdvancedConfig;
	usage_stats?: HotspotUserUsagesConfig;
  comment?: string;
  sync_to_mikrotik: boolean;
  status: string;
  is_active: boolean;
}