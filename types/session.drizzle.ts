import { timestamp } from 'drizzle-orm/pg-core';
// ============ BASE CONFIGURATION TYPES ============

import { SessionProfile } from "@/database/schema/mikrotik";
import { z } from "zod";

// Common bandwidth configuration
export interface BaseBandwidthConfig {
	downloadSpeed?: string; // "10M", "1024k"
	uploadSpeed?: string;
	burstRate?: string;
	burstThreshold?: string;
	burstTime?: string;
	priority?: number; // 1-8
	limitAt?: string;
}

// Common timeout configuration
export interface BaseTimeoutConfig {
	sessionTimeout?: number | string; // seconds
	idleTimeout?: number | string; // seconds
}

// Common limits configuration
export interface BaseLimitsConfig {
	dataLimit?: number; // bytes
	timeLimit?: number; // seconds
	validity?: number; // days
}

// ============ PPPOE/PPP SPECIFIC TYPES (Based on /ppp profile) ============

export interface PPPoENetworkConfig {
	// Bridge settings
	bridge?: string; // Name of the bridge interface
	bridgeHorizon?: number; // 0..429496729
	bridgeLearning?: "default" | "no" | "yes"; // Default: default
	bridgePathCost?: number; // 0..429496729
	bridgePortPriority?: number; // 0..240

	// Network settings
	addressList?: string; // Address list name
	changeTcpMss?: "yes" | "no" | "default"; // Default: default
	dnsServer?: string; // IP address
	winsServer?: string; // IP address
	localAddress?: string; // IP address or pool name
	remoteAddress?: string; // IP address or pool name
	remoteIpv6PrefixPool?: string; // IPv6 pool name
	dhcpv6PdPool?: string; // DHCPv6-PD pool name

	// Protocol settings
	useIpv6?: "yes" | "no" | "default" | "require"; // Default: default
	useMpls?: "yes" | "no" | "default" | "require"; // Default: default
	useVjCompression?: "yes" | "no" | "default"; // Default: default

	// Scripts
	onUp?: string; // Script name
	onDown?: string; // Script name
}

export interface PPPoEBandwidthConfig extends BaseBandwidthConfig {
	rateLimit?: string; // "rx-rate[/tx-rate] [rx-burst-rate[/tx-burst-rate]...]"
}

export interface PPPoETimeoutConfig extends BaseTimeoutConfig {
	// PPPoE specific timeouts
}

export interface PPPoELimitsConfig extends BaseLimitsConfig {
	useCompression?: "yes" | "no" | "default"; // Default: default
	useEncryption?: "yes" | "no" | "default" | "require"; // Default: default
	onlyOne?: "yes" | "no" | "default"; // Default: default
}

export interface PPPoESecurityConfig {
	useCompression?: "yes" | "no" | "default";
	useEncryption?: "yes" | "no" | "default" | "require";
	incomingFilter?: string; // Firewall chain name
	outgoingFilter?: string; // Firewall chain name
	callerId?: string; // IP address for PPTP/L2TP, MAC for PPPoE
}

export interface PPPoEAdvancedConfig {
	// PPP Secret specific settings
	service?:
		| "any"
		| "async"
		| "isdn"
		| "l2tp"
		| "pppoe"
		| "pptp"
		| "ovpn"
		| "sstp";
	routes?: string; // Route format: "dst-address gateway metric"
	remoteIpv6Prefix?: string; // IPv6 prefix
	comment?: string;
}

// ============ HOTSPOT SPECIFIC TYPES (Based on /ip hotspot user profile) ============

export interface HotspotNetworkConfig {
	// Address and pool settings
	addressList?: string; // Address list name
	addressPool?: string | "none"; // IP pool name, "none" for none

	// Proxy settings
	transparentProxy?: boolean; // Default: true

	// Advertisement settings
	advertise?: boolean; // Default: false
	advertiseInterval?: string; // Time intervals, e.g., "30m,10m"
	advertiseTimeout?: "time" | "immediately" | "never" | "1m"; // "time" | "immediately" | "never", Default: "1m"
	advertiseUrl?: string[]; // Comma-separated URLs
	lockToMac?: boolean;
	lockToServer?: boolean;
}

export interface HotspotBandwidthConfig extends BaseBandwidthConfig {
	sharedUsers?: number; // Default: 1
	rateLimit?: string; // Rate limit format for simple queue
}

export interface HotspotTimeoutConfig extends BaseTimeoutConfig {
	keepaliveTimeout?: string; // "time" | "none"
	idleTimeout?: string | number; // "time" | "none", Default: "none"
	macCookieTimeout?: string; // Default: "3d"
	statusAutorefresh?: string; // "time" | "none", Default: "none"
}

export interface HotspotLimitsConfig extends BaseLimitsConfig {
	macCookieTimeout?: string;
	sharedUsers?: number;
}

export interface HotspotSecurityConfig {
	// MAC cookie settings
	addMacCookie?: boolean; // Default: true
	macCookieTimeout?: string; // Default: "3d"

	// Firewall settings
	incomingFilter?: string; // Firewall chain name
	outgoingFilter?: string; // Firewall chain name
	incomingPacketMark?: string; // Packet mark for incoming packets
	outgoingPacketMark?: string; // Packet mark for outgoing packets
}

export interface HotspotAdvancedConfig {
	// Session settings
	sharedUsers?: number; // Default: 1
	sessionTimeout?: string; // Time, Default: "0s"

	// Status page settings
	openStatusPage?: "always" | "http-login"; // Default: "always"
	statusAutorefresh?: string; // "time" | "none"

	// Cookie settings
	addMacCookie?: boolean;
	macCookieTimeout?: string;

	// Scripts
	onLogin?: string; // Script name
	onLogout?: string; // Script name

	//custom
	ExpiredMode?: "disable" | "remove"; // What to do when expired
	autoExpiry?: boolean; // Auto handle expiry
}

// ============ HOTSPOT USER SPECIFIC TYPES ============

export interface HotspotUserConfig {
	// Basic user info
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

export interface HotspotUseerLimitsConfig {
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

// ============ PPP SECRET USER SPECIFIC TYPES ============

export interface PPPSecretUserConfig {
	// Basic user info
	name: string;
	password?: string;
	comment?: string;
	disabled?: boolean; // Default: false

	// Network settings
	localAddress?: string; // IP address
	remoteAddress?: string; // IP address
	callerId?: string; // IP for PPTP/L2TP, MAC for PPPoE

	// Limits
	limitBytesIn?: number; // Default: 0
	limitBytesOut?: number; // Default: 0

	// Service and profile
	service?:
		| "any"
		| "async"
		| "isdn"
		| "l2tp"
		| "pppoe"
		| "pptp"
		| "ovpn"
		| "sstp";
	profile?: string; // Default: "default"
	routes?: string; // Route format
	remoteIpv6Prefix?: string; // IPv6 prefix
}

// ============ VPN SPECIFIC TYPES ============

export interface VPNNetworkConfig {
	protocol?: "pptp" | "l2tp" | "sstp" | "ovpn" | "ipsec";
	localAddress?: string;
	remoteAddress?: string;
	dnsServer?: string;
	winsServer?: string;
	routes?: Array<{
		destination: string;
		gateway?: string;
		distance?: number;
	}>;
}

export interface VPNBandwidthConfig extends BaseBandwidthConfig {
	rateLimit?: string;
}

export interface VPNTimeoutConfig extends BaseTimeoutConfig {
	connectTimeout?: number;
	keepaliveTimeout?: number;
}

export interface VPNLimitsConfig extends BaseLimitsConfig {
	maxConnections?: number;
	simultaneousConnections?: number;
	useCompression?: "yes" | "no" | "default";
	useEncryption?: "yes" | "no" | "default" | "require";
}

export interface VPNSecurityConfig {
	encryption?: string[];
	authentication?: string[];
	certificate?: string;
	caCertificate?: string;
	requireClientCert?: boolean;
	incomingFilter?: string;
	outgoingFilter?: string;
}

export interface VPNAdvancedConfig {
	service?:
		| "any"
		| "async"
		| "isdn"
		| "l2tp"
		| "pppoe"
		| "pptp"
		| "ovpn"
		| "sstp";
	onlyOne?: "yes" | "no" | "default";
	useIpv6?: "yes" | "no" | "default" | "require";
	useMpls?: "yes" | "no" | "default" | "require";
	useVjCompression?: "yes" | "no" | "default";
}

// ============ BANDWIDTH PROFILE SPECIFIC TYPES ============

export interface BandwidthNetworkConfig {
	target?: string[]; // IP addresses or subnets
	interface?: string;
	direction?: "upload" | "download" | "both";
}

export interface BandwidthBandwidthConfig extends BaseBandwidthConfig {
	maxLimit?: string;
	guaranteedRate?: string;
	burstLimit?: string;
}

export interface BandwidthLimitsConfig extends BaseLimitsConfig {
	// Bandwidth specific limits
}

// ============ STATIC IP SPECIFIC TYPES ============

export interface StaticIPNetworkConfig {
	ipAddress?: string;
	netmask?: string;
	gateway?: string;
	dnsServers?: string[];
	routes?: Array<{
		destination: string;
		gateway: string;
		distance?: number;
	}>;
}

export interface StaticIPBandwidthConfig extends BaseBandwidthConfig {
	// Static IP specific bandwidth
}

export interface StaticIPLimitsConfig extends BaseLimitsConfig {
	// Static IP specific limits
}

// ============ USAGE STATISTICS TYPES ============

export interface UsageStats {
	totalSessions?: number;
	totalBytesIn?: number;
	totalBytesOut?: number;
	totalUptime?: number; // seconds
	lastSessionDate?: string; // ISO date
	averageSessionDuration?: number;
	peakBandwidthUsage?: {
		download: number;
		upload: number;
		timestamp: string;
	};
}

// ============ VOUCHER SPECIFIC TYPES ============

export interface VoucherGeneral {
	name: string;
	password?: string;
	comment?: string;
}

export interface VoucherLimits {
	limitUptime?: number; // seconds
	limitBytesIn?: number;
	limitBytesOut?: number;
	limitBytesTotal?: number;
	expiryDate?: string; // ISO date
}

export interface VoucherStatistics {
	usedCount?: number;
	usedBytesIn?: number;
	usedBytesOut?: number;
	lastUsed?: string | undefined; // ISO date
	firstUsed?: string; // ISO date
	remainingTime?: number; // seconds
	remainingData?: number; // bytes
}

export interface VoucherGenerationConfig {
	length?: number; // code length
	prefix?: string;
	suffix?: string;
	characters?: string;
	customCharset?: string;
	quantity?: number;
	passwordMode: "same_as_username" | "random" | "custom";
	generationMode: "random" | "sequential";
	count: number;
}

// ============ UNION TYPES FOR DIFFERENT SESSION TYPES ============

export type NetworkConfig =
	| PPPoENetworkConfig
	| HotspotNetworkConfig
	| VPNNetworkConfig
	| BandwidthNetworkConfig
	| StaticIPNetworkConfig;

export type BandwidthConfig =
	| PPPoEBandwidthConfig
	| HotspotBandwidthConfig
	| VPNBandwidthConfig
	| BandwidthBandwidthConfig
	| StaticIPBandwidthConfig;

export type TimeoutConfig =
	| PPPoETimeoutConfig
	| HotspotTimeoutConfig
	| VPNTimeoutConfig
	| BaseTimeoutConfig;

export type LimitsConfig =
	| PPPoELimitsConfig
	| HotspotLimitsConfig
	| VPNLimitsConfig
	| BandwidthLimitsConfig
	| StaticIPLimitsConfig;

export type SecurityConfig =
	| PPPoESecurityConfig
	| HotspotSecurityConfig
	| VPNSecurityConfig;

export type AdvancedConfig =
	| PPPoEAdvancedConfig
	| HotspotAdvancedConfig
	| VPNAdvancedConfig;

// ============ SESSION TYPE DEFINITION ============

export type SessionType =
	| "pppoe"
	| "hotspot"
	| "vpn"
	| "bandwidth"
	| "static_ip"
	| "others";

// ============ TYPE-SAFE SESSION PROFILE TYPES ============

export interface TypedSessionProfile<T extends SessionType = SessionType> {
	id?: number;
	router_id: number;
	name: string;
	type: T;
	price: string; // Custom field - keep as string for decimal precision
	sell_price: string; // Custom field - keep as string for decimal precision
	mikrotik_profile_id?: string;
	validity: string;
	cron_enabled?: boolean;

	network_config: T extends "pppoe"
		? PPPoENetworkConfig
		: T extends "hotspot"
		? HotspotNetworkConfig
		: T extends "vpn"
		? VPNNetworkConfig
		: T extends "bandwidth"
		? BandwidthNetworkConfig
		: T extends "static_ip"
		? StaticIPNetworkConfig
		: NetworkConfig;
	bandwidth_config: T extends "pppoe"
		? PPPoEBandwidthConfig
		: T extends "hotspot"
		? HotspotBandwidthConfig
		: T extends "vpn"
		? VPNBandwidthConfig
		: T extends "bandwidth"
		? BandwidthBandwidthConfig
		: T extends "static_ip"
		? StaticIPBandwidthConfig
		: BandwidthConfig;
	timeout_config: T extends "pppoe"
		? PPPoETimeoutConfig
		: T extends "hotspot"
		? HotspotTimeoutConfig
		: T extends "vpn"
		? VPNTimeoutConfig
		: TimeoutConfig;
	limits: T extends "pppoe"
		? PPPoELimitsConfig
		: T extends "hotspot"
		? HotspotLimitsConfig
		: T extends "vpn"
		? VPNLimitsConfig
		: T extends "bandwidth"
		? BandwidthLimitsConfig
		: T extends "static_ip"
		? StaticIPLimitsConfig
		: LimitsConfig;
	security_config?: T extends "pppoe"
		? PPPoESecurityConfig
		: T extends "hotspot"
		? HotspotSecurityConfig
		: T extends "vpn"
		? VPNSecurityConfig
		: SecurityConfig;
	advanced_config?: T extends "pppoe"
		? PPPoEAdvancedConfig
		: T extends "hotspot"
		? HotspotAdvancedConfig
		: T extends "vpn"
		? VPNAdvancedConfig
		: AdvancedConfig;
	comment?: string; // Custom field
	synced_to_mikrotik?: boolean; // Custom field
	status?: "active" | "inactive" | "suspended"; // Custom field
	is_active?: boolean; // Custom field
	created_at?: Date; // Custom field
	updated_at?: Date; // Custom field
}

// ============ SPECIFIC PROFILE TYPES ============

export type PPPoEProfile = TypedSessionProfile<"pppoe">;
export type HotspotProfile = TypedSessionProfile<"hotspot">;
export type VPNProfile = TypedSessionProfile<"vpn">;
export type BandwidthProfile = TypedSessionProfile<"bandwidth">;
export type StaticIPProfile = TypedSessionProfile<"static_ip">;

// ============ USER CONFIGURATION TYPES ============

export interface HotspotUserProfile extends HotspotUserConfig {
	profileName: string; // References the profile name
}

export interface PPPSecretUserProfile extends PPPSecretUserConfig {
	profileName: string; // References the profile name
}

// ============ HELPER TYPES FOR FORM VALIDATION ============

export interface SessionProfileFormData<T extends SessionType> {
	name: string;
	type: T;
	price: number;
	sell_price: number;
	network_config: TypedSessionProfile<T>["network_config"];
	bandwidth_config: TypedSessionProfile<T>["bandwidth_config"];
	timeout_config: TypedSessionProfile<T>["timeout_config"];
	limits: TypedSessionProfile<T>["limits"];
	security_config?: TypedSessionProfile<T>["security_config"];
	advanced_config?: TypedSessionProfile<T>["advanced_config"];
	comment?: string;
}

// ============ ZOD VALIDATION SCHEMAS ============

// Base schemas
export const BaseBandwidthConfigSchema = z.object({
	downloadSpeed: z.string().optional(),
	uploadSpeed: z.string().optional(),
	burstRate: z.string().optional(),
	burstThreshold: z.string().optional(),
	burstTime: z.string().optional(),
	priority: z.number().min(1).max(8).optional(),
	limitAt: z.string().optional(),
});

export const BaseTimeoutConfigSchema = z.object({
	sessionTimeout: z.number().positive().optional(),
	idleTimeout: z.number().positive().optional(),
});

export const BaseLimitsConfigSchema = z.object({
	dataLimit: z.number().positive().optional(),
	timeLimit: z.number().positive().optional(),
	validity: z.number().positive().optional(),
});

// PPPoE schemas - Updated to match Mikrotik specifications
export const PPPoENetworkConfigSchema = z.object({
	bridge: z.string().optional(),
	bridgeHorizon: z.number().min(0).max(429496729).optional(),
	bridgeLearning: z.enum(["default", "no", "yes"]).optional(),
	bridgePathCost: z.number().min(0).max(429496729).optional(),
	bridgePortPriority: z.number().min(0).max(240).optional(),
	addressList: z.string().optional(),
	changeTcpMss: z.enum(["yes", "no", "default"]).optional(),
	dnsServer: z.string().ip().optional(),
	winsServer: z.string().ip().optional(),
	localAddress: z.string().optional(),
	remoteAddress: z.string().optional(),
	remoteIpv6PrefixPool: z.string().optional(),
	dhcpv6PdPool: z.string().optional(),
	useIpv6: z.enum(["yes", "no", "default", "require"]).optional(),
	useMpls: z.enum(["yes", "no", "default", "require"]).optional(),
	useVjCompression: z.enum(["yes", "no", "default"]).optional(),
	onUp: z.string().optional(),
	onDown: z.string().optional(),
});

export const PPPoEBandwidthConfigSchema = BaseBandwidthConfigSchema.extend({
	rateLimit: z.string().optional(),
});

export const PPPoELimitsConfigSchema = BaseLimitsConfigSchema.extend({
	useCompression: z.enum(["yes", "no", "default"]).optional(),
	useEncryption: z.enum(["yes", "no", "default", "require"]).optional(),
	onlyOne: z.enum(["yes", "no", "default"]).optional(),
});

export const PPPoESecurityConfigSchema = z.object({
	useCompression: z.enum(["yes", "no", "default"]).optional(),
	useEncryption: z.enum(["yes", "no", "default", "require"]).optional(),
	incomingFilter: z.string().optional(),
	outgoingFilter: z.string().optional(),
	callerId: z.string().optional(),
});

// Hotspot schemas - Updated to match Mikrotik specifications
export const HotspotNetworkConfigSchema = z.object({
	addressList: z.string().optional(),
	addressPool: z.string().optional(),
	transparentProxy: z.boolean().optional(),
	advertise: z.boolean().optional(),
	advertiseInterval: z.string().optional(),
	advertiseTimeout: z.string().optional(),
	advertiseUrl: z.string().optional(),
});

export const HotspotBandwidthConfigSchema = BaseBandwidthConfigSchema.extend({
	sharedUsers: z.number().positive().optional(),
	rateLimit: z.string().optional(),
});

export const HotspotTimeoutConfigSchema = BaseTimeoutConfigSchema.extend({
	keepaliveTimeout: z.string().optional(),
	idleTimeout: z.string().optional(),
	macCookieTimeout: z.string().optional(),
	statusAutorefresh: z.string().optional(),
});

export const HotspotSecurityConfigSchema = z.object({
	addMacCookie: z.boolean().optional(),
	macCookieTimeout: z.string().optional(),
	incomingFilter: z.string().optional(),
	outgoingFilter: z.string().optional(),
	incomingPacketMark: z.string().optional(),
	outgoingPacketMark: z.string().optional(),
});

// Hotspot User Config Schema
export const HotspotUserConfigSchema = z.object({
	name: z.string().min(1),
	password: z.string().optional(),
	email: z.string().email().optional(),
	comment: z.string().optional(),
	address: z.string().ip().optional(),
	macAddress: z.string().optional(),
	limitBytesIn: z.number().nonnegative().optional(),
	limitBytesOut: z.number().nonnegative().optional(),
	limitBytesTotal: z.number().nonnegative().optional(),
	limitUptime: z.string().optional(),
	server: z.string().optional(),
	profile: z.string().optional(),
	routes: z.string().optional(),
});

// PPP Secret User Config Schema
export const PPPSecretUserConfigSchema = z.object({
	name: z.string().min(1),
	password: z.string().optional(),
	comment: z.string().optional(),
	disabled: z.boolean().optional(),
	localAddress: z.string().optional(),
	remoteAddress: z.string().optional(),
	callerId: z.string().optional(),
	limitBytesIn: z.number().nonnegative().optional(),
	limitBytesOut: z.number().nonnegative().optional(),
	service: z
		.enum(["any", "async", "isdn", "l2tp", "pppoe", "pptp", "ovpn", "sstp"])
		.optional(),
	profile: z.string().optional(),
	routes: z.string().optional(),
	remoteIpv6Prefix: z.string().optional(),
});

// ============ TYPE GUARDS ============

export function isPPPoEProfile(
	profile: TypedSessionProfile
): profile is PPPoEProfile {
	return profile.type === "pppoe";
}

export function isHotspotProfile(
	profile: TypedSessionProfile
): profile is HotspotProfile {
	return profile.type === "hotspot";
}

export function isVPNProfile(
	profile: TypedSessionProfile
): profile is VPNProfile {
	return profile.type === "vpn";
}

export function isBandwidthProfile(
	profile: TypedSessionProfile
): profile is BandwidthProfile {
	return profile.type === "bandwidth";
}

export function isStaticIPProfile(
	profile: TypedSessionProfile
): profile is StaticIPProfile {
	return profile.type === "static_ip";
}

// ============ FACTORY FUNCTIONS ============

export function createPPPoEProfile(
	data: Partial<PPPoEProfile>
): Omit<PPPoEProfile, "id" | "created_at" | "updated_at"> {
	return {
		router_id: data.router_id || 0,
		name: data.name || "",
		type: "pppoe",
		price: data.price || "0",
		sell_price: data.sell_price || "0",
		validity: data.validity || "",
		cron_enabled: data.cron_enabled || true,
		network_config: data.network_config || {},
		bandwidth_config: data.bandwidth_config || {},
		timeout_config: data.timeout_config || {},
		limits: data.limits || {},
		security_config: data.security_config,
		advanced_config: data.advanced_config,
		comment: data.comment,
		synced_to_mikrotik: data.synced_to_mikrotik || false,
		status: data.status || "active",
		is_active: data.is_active ?? true,
	};
}

export function createHotspotProfile(
	data: Partial<HotspotProfile>
): Omit<HotspotProfile, "id" | "created_at" | "updated_at"> {
	return {
		router_id: data.router_id || 0,
		name: data.name || "",
		type: "hotspot",
		price: data.price || "0",
		sell_price: data.sell_price || "0",
		validity: data.validity || "",
		network_config: data.network_config || {},
		bandwidth_config: data.bandwidth_config || {},
		timeout_config: data.timeout_config || {},
		limits: data.limits || {},
		security_config: data.security_config,
		advanced_config: data.advanced_config,
		comment: data.comment,
		synced_to_mikrotik: data.synced_to_mikrotik || false,
		status: data.status || "active",
		is_active: data.is_active ?? true,
	};
}

// ============ VALIDATION FUNCTIONS ============

export function validateSessionProfile<T extends SessionType>(
	type: T,
	profile: Partial<TypedSessionProfile<T>>
): { isValid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!profile.name?.trim()) {
		errors.push("Profile name is required");
	}

	if (!profile.price || parseFloat(profile.price) < 0) {
		errors.push("Price must be a positive number");
	}

	if (!profile.sell_price || parseFloat(profile.sell_price) < 0) {
		errors.push("Sell price must be a positive number");
	}

	// Type-specific validations based on Mikrotik specs
	switch (type) {
		case "pppoe":
			if (
				profile.bandwidth_config &&
				typeof profile.bandwidth_config === "object" &&
				"priority" in profile.bandwidth_config &&
				profile.bandwidth_config.priority &&
				(profile.bandwidth_config.priority < 1 ||
					profile.bandwidth_config.priority > 8)
			) {
				errors.push("Priority must be between 1 and 8");
			}
			break;
		case "hotspot":
			if (
				profile.bandwidth_config &&
				typeof profile.bandwidth_config === "object" &&
				"sharedUsers" in profile.bandwidth_config &&
				profile.bandwidth_config.sharedUsers &&
				profile.bandwidth_config.sharedUsers < 1
			) {
				errors.push("Shared users must be at least 1");
			}
			break;
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

// ============ UTILITY FUNCTIONS ============

export function formatBandwidthValue(value: string): string {
	// Convert various formats to standard Mikrotik format
	const match = value.match(/^(\d+(?:\.\d+)?)\s*([KMG]?)(?:bps)?$/i);
	if (!match) return value;

	const [, number, unit] = match;
	const unitMap: Record<string, string> = {
		K: "k",
		M: "M",
		G: "G",
	};

	return `${number}${unitMap[unit?.toUpperCase()] || ""}`;
}

export function parseBandwidthValue(value: string): number {
	// Convert to bytes per second
	const match = value.match(/^(\d+(?:\.\d+)?)\s*([KMG]?)$/i);
	if (!match) return 0;

	const [, number, unit] = match;
	const multipliers: Record<string, number> = {
		"": 1,
		K: 1024,
		M: 1024 * 1024,
		G: 1024 * 1024 * 1024,
	};

	return parseFloat(number) * (multipliers[unit?.toUpperCase()] || 1);
}

// ============ DEFAULT CONFIGURATIONS ============

export const defaultPPPoEConfig: PPPoEProfile["network_config"] = {
	bridgeLearning: "default",
	useIpv6: "default",
	useMpls: "default",
	changeTcpMss: "default",
	addressList: undefined,
};

export const defaultHotspotConfig: HotspotProfile["network_config"] = {
	transparentProxy: true,
	advertise: false,
	addressList: undefined,
	addressPool: "none",
};

export const defaultBandwidthConfig: BaseBandwidthConfig = {
	priority: 8,
	burstTime: "8",
};

export const defaultTimeoutConfig: BaseTimeoutConfig = {
	sessionTimeout: 0, // unlimited
	idleTimeout: 0, // unlimited
};

export const defaultHotspotUserConfig: HotspotUserConfig = {
	name: "",
	address: "0.0.0.0",
	macAddress: "00:00:00:00:00:00",
	limitBytesIn: 0,
	limitBytesOut: 0,
	limitBytesTotal: 0,
	limitUptime: "0",
	server: "all",
	profile: "default",
};

export const defaultPPPSecretUserConfig: PPPSecretUserConfig = {
	name: "",
	disabled: false,
	limitBytesIn: 0,
	limitBytesOut: 0,
	service: "any",
	profile: "default",
};

// ============ MIKROTIK FIELD MAPPING ============

// Maps our custom fields to Mikrotik RouterOS fields
export const MIKROTIK_FIELD_MAPPING = {
	// PPP Profile mappings
	PPP_PROFILE: {
		"address-list": "addressList",
		bridge: "bridge",
		"bridge-horizon": "bridgeHorizon",
		"bridge-learning": "bridgeLearning",
		"bridge-path-cost": "bridgePathCost",
		"bridge-port-priority": "bridgePortPriority",
		"change-tcp-mss": "changeTcpMss",
		comment: "comment",
		"dhcpv6-pd-pool": "dhcpv6PdPool",
		"dns-server": "dnsServer",
		"idle-timeout": "idleTimeout",
		"incoming-filter": "incomingFilter",
		"local-address": "localAddress",
		name: "name",
		"only-one": "onlyOne",
		"outgoing-filter": "outgoingFilter",
		"rate-limit": "rateLimit",
		"remote-address": "remoteAddress",
		"remote-ipv6-prefix-pool": "remoteIpv6PrefixPool",
		"session-timeout": "sessionTimeout",
		"use-compression": "useCompression",
		"use-encryption": "useEncryption",
		"use-ipv6": "useIpv6",
		"use-mpls": "useMpls",
		"use-vj-compression": "useVjCompression",
		"on-up": "onUp",
		"on-down": "onDown",
		"wins-server": "winsServer",
	},

	// PPP Secret mappings
	PPP_SECRET: {
		"caller-id": "callerId",
		comment: "comment",
		disabled: "disabled",
		"limit-bytes-in": "limitBytesIn",
		"limit-bytes-out": "limitBytesOut",
		"local-address": "localAddress",
		name: "name",
		password: "password",
		profile: "profile",
		"remote-address": "remoteAddress",
		"remote-ipv6-prefix": "remoteIpv6Prefix",
		routes: "routes",
		service: "service",
	},

	// Hotspot User Profile mappings
	HOTSPOT_USER_PROFILE: {
		"add-mac-cookie": "addMacCookie",
		"address-list": "addressList",
		"address-pool": "addressPool",
		advertise: "advertise",
		"advertise-interval": "advertiseInterval",
		"advertise-timeout": "advertiseTimeout",
		"advertise-url": "advertiseUrl",
		"idle-timeout": "idleTimeout",
		"incoming-filter": "incomingFilter",
		"incoming-packet-mark": "incomingPacketMark",
		"keepalive-timeout": "keepaliveTimeout",
		"mac-cookie-timeout": "macCookieTimeout",
		name: "name",
		"on-login": "onLogin",
		"on-logout": "onLogout",
		"open-status-page": "openStatusPage",
		"outgoing-filter": "outgoingFilter",
		"outgoing-packet-mark": "outgoingPacketMark",
		"rate-limit": "rateLimit",
		"session-timeout": "sessionTimeout",
		"shared-users": "sharedUsers",
		"status-autorefresh": "statusAutorefresh",
		"transparent-proxy": "transparentProxy",
	},

	// Hotspot User mappings
	HOTSPOT_USER: {
		address: "address",
		comment: "comment",
		email: "email",
		"limit-bytes-in": "limitBytesIn",
		"limit-bytes-out": "limitBytesOut",
		"limit-bytes-total": "limitBytesTotal",
		"limit-uptime": "limitUptime",
		"mac-address": "macAddress",
		name: "name",
		password: "password",
		profile: "profile",
		routes: "routes",
		server: "server",
	},
} as const;

