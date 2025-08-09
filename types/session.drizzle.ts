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
	sessionTimeout?: number; // seconds
	idleTimeout?: number; // seconds
}

// Common limits configuration
export interface BaseLimitsConfig {
	dataLimit?: number; // bytes
	timeLimit?: number; // seconds
	validity?: number; // days
}

// ============ PPPOE SPECIFIC TYPES ============

export interface PPPoENetworkConfig {
	bridgeLearning?: boolean;
	useIpv6?: boolean;
	useMpls?: boolean;
	changeTcpMss?: boolean;
	useUpnp?: boolean;
	addressList?: string[];
	onUp?: string; // script
	onDown?: string; // script
}

export interface PPPoEBandwidthConfig extends BaseBandwidthConfig {
	rateLimit?: string; // "rx-rate/tx-rate"
}

export interface PPPoETimeoutConfig extends BaseTimeoutConfig {
	// PPPoE specific timeouts if any
}

export interface PPPoELimitsConfig extends BaseLimitsConfig {
	useCompression?: boolean;
	useEncryption?: boolean;
	onlyOne?: boolean; // only one session per user
}

export interface PPPoESecurityConfig {
	useCompression?: boolean;
	useEncryption?: boolean;
	allowedAddress?: string[];
	callerIdFilter?: string[];
}

export interface PPPoEAdvancedConfig {
	serviceName?: string;
	acName?: string;
	interfaceList?: string;
	maxMru?: number;
	maxMtu?: number;
	mrru?: number;
}

// ============ HOTSPOT SPECIFIC TYPES ============

export interface HotspotNetworkConfig {
	addressList?: string[];
	transparentProxy?: boolean;
	httpProxy?: string;
	httpsProxy?: string;
	ftp?: boolean;
	bypass?: boolean;
}

export interface HotspotBandwidthConfig extends BaseBandwidthConfig {
	sharedUsers?: number;
	rateLimit?: string;
}

export interface HotspotTimeoutConfig extends BaseTimeoutConfig {
	keepaliveTimeout?: number;
	statusAutorefresh?: number;
	macCookieTimeout?: number;
}

export interface HotspotLimitsConfig extends BaseLimitsConfig {
	macCookieTimeout?: number;
	sharedUsers?: number;
}

export interface HotspotSecurityConfig {
	addressList?: string[];
	transparentProxy?: boolean;
	bypassProxy?: boolean;
	advertise?: boolean;
	advertiseUrl?: string;
	advertiseInterval?: number;
}

export interface HotspotAdvancedConfig {
	sharedUsers?: number;
	addMacCookie?: boolean;
	macCookieTimeout?: number;
	keepaliveTimeout?: number;
	statusAutorefresh?: number;
	openStatusPage?: string;
	httpPap?: boolean;
	httpChap?: boolean;
	httpsRedirect?: boolean;
	split?: boolean;
}

// ============ VPN SPECIFIC TYPES ============

export interface VPNNetworkConfig {
	protocol?: "pptp" | "l2tp" | "sstp" | "ovpn" | "ipsec";
	localAddress?: string;
	remoteAddress?: string;
	dnsServers?: string[];
	routes?: Array<{
		destination: string;
		gateway?: string;
		distance?: number;
	}>;
}

export interface VPNBandwidthConfig extends BaseBandwidthConfig {
	// VPN specific bandwidth configs
}

export interface VPNTimeoutConfig extends BaseTimeoutConfig {
	connectTimeout?: number;
	keepaliveTimeout?: number;
}

export interface VPNLimitsConfig extends BaseLimitsConfig {
	maxConnections?: number;
	simultaneousConnections?: number;
}

export interface VPNSecurityConfig {
	encryption?: string[];
	authentication?: string[];
	certificate?: string;
	caCertificate?: string;
	requireClientCert?: boolean;
}

export interface VPNAdvancedConfig {
	mppe?: boolean;
	mppeRequired?: boolean;
	allowFastPath?: boolean;
	useIpsec?: boolean;
	ipsecSecret?: string;
	defaultRoute?: boolean;
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
	lastUsed?: string; // ISO date
	firstUsed?: string; // ISO date
	remainingTime?: number; // seconds
	remainingData?: number; // bytes
}

export interface VoucherGenerationConfig {
	length?: number; // code length
	prefix?: string;
	suffix?: string;
	charset?: "alphanumeric" | "numeric" | "alphabetic" | "custom";
	customCharset?: string;
	quantity?: number;
	avoidSimilar?: boolean; // avoid 0, O, 1, l, etc.
	format?: string; // pattern like "XXX-XXX-XXX"
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
	id: number;
	router_id: number;
	name: string;
	type: T;
	price: string;
	sell_price: string;
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
	comment?: string;
	mikrotik_id?: string;
	synced_to_mikrotik: boolean;
	status: "active" | "inactive" | "suspended";
	is_active: boolean;
	created_at: Date;
	updated_at: Date;
}

// ============ SPECIFIC PROFILE TYPES ============

export type PPPoEProfile = TypedSessionProfile<"pppoe">;
export type HotspotProfile = TypedSessionProfile<"hotspot">;
export type VPNProfile = TypedSessionProfile<"vpn">;
export type BandwidthProfile = TypedSessionProfile<"bandwidth">;
export type StaticIPProfile = TypedSessionProfile<"static_ip">;

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

// PPPoE schemas
export const PPPoENetworkConfigSchema = z.object({
	bridgeLearning: z.boolean().optional(),
	useIpv6: z.boolean().optional(),
	useMpls: z.boolean().optional(),
	changeTcpMss: z.boolean().optional(),
	useUpnp: z.boolean().optional(),
	addressList: z.array(z.string()).optional(),
	onUp: z.string().optional(),
	onDown: z.string().optional(),
});

export const PPPoEBandwidthConfigSchema = BaseBandwidthConfigSchema.extend({
	rateLimit: z.string().optional(),
});

export const PPPoELimitsConfigSchema = BaseLimitsConfigSchema.extend({
	useCompression: z.boolean().optional(),
	useEncryption: z.boolean().optional(),
	onlyOne: z.boolean().optional(),
});

export const PPPoESecurityConfigSchema = z.object({
	useCompression: z.boolean().optional(),
	useEncryption: z.boolean().optional(),
	allowedAddress: z.array(z.string()).optional(),
	callerIdFilter: z.array(z.string()).optional(),
});

export const PPPoEAdvancedConfigSchema = z.object({
	serviceName: z.string().optional(),
	acName: z.string().optional(),
	interfaceList: z.string().optional(),
	maxMru: z.number().positive().optional(),
	maxMtu: z.number().positive().optional(),
	mrru: z.number().positive().optional(),
});

// Hotspot schemas
export const HotspotNetworkConfigSchema = z.object({
	addressList: z.array(z.string()).optional(),
	transparentProxy: z.boolean().optional(),
	httpProxy: z.string().optional(),
	httpsProxy: z.string().optional(),
	ftp: z.boolean().optional(),
	bypass: z.boolean().optional(),
});

export const HotspotBandwidthConfigSchema = BaseBandwidthConfigSchema.extend({
	sharedUsers: z.number().positive().optional(),
	rateLimit: z.string().optional(),
});

export const HotspotTimeoutConfigSchema = BaseTimeoutConfigSchema.extend({
	keepaliveTimeout: z.number().positive().optional(),
	statusAutorefresh: z.number().positive().optional(),
	macCookieTimeout: z.number().positive().optional(),
});

export const HotspotLimitsConfigSchema = BaseLimitsConfigSchema.extend({
	macCookieTimeout: z.number().positive().optional(),
	sharedUsers: z.number().positive().optional(),
});

export const HotspotSecurityConfigSchema = z.object({
	addressList: z.array(z.string()).optional(),
	transparentProxy: z.boolean().optional(),
	bypassProxy: z.boolean().optional(),
	advertise: z.boolean().optional(),
	advertiseUrl: z.string().url().optional(),
	advertiseInterval: z.number().positive().optional(),
});

export const HotspotAdvancedConfigSchema = z.object({
	sharedUsers: z.number().positive().optional(),
	addMacCookie: z.boolean().optional(),
	macCookieTimeout: z.number().positive().optional(),
	keepaliveTimeout: z.number().positive().optional(),
	statusAutorefresh: z.number().positive().optional(),
	openStatusPage: z.string().optional(),
	httpPap: z.boolean().optional(),
	httpChap: z.boolean().optional(),
	httpsRedirect: z.boolean().optional(),
	split: z.boolean().optional(),
});

// VPN schemas
export const VPNNetworkConfigSchema = z.object({
	protocol: z.enum(["pptp", "l2tp", "sstp", "ovpn", "ipsec"]).optional(),
	localAddress: z.string().ip().optional(),
	remoteAddress: z.string().ip().optional(),
	dnsServers: z.array(z.string().ip()).optional(),
	routes: z
		.array(
			z.object({
				destination: z.string(),
				gateway: z.string().ip().optional(),
				distance: z.number().positive().optional(),
			})
		)
		.optional(),
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
		network_config: data.network_config || {},
		bandwidth_config: data.bandwidth_config || {},
		timeout_config: data.timeout_config || {},
		limits: data.limits || {},
		security_config: data.security_config,
		advanced_config: data.advanced_config,
		comment: data.comment,
		mikrotik_id: data.mikrotik_id,
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
		network_config: data.network_config || {},
		bandwidth_config: data.bandwidth_config || {},
		timeout_config: data.timeout_config || {},
		limits: data.limits || {},
		security_config: data.security_config,
		advanced_config: data.advanced_config,
		comment: data.comment,
		mikrotik_id: data.mikrotik_id,
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

	// Type-specific validations
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
				profile.advanced_config &&
				typeof profile.advanced_config === "object" &&
				"sharedUsers" in profile.advanced_config &&
				profile.advanced_config.sharedUsers &&
				profile.advanced_config.sharedUsers < 1
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
	bridgeLearning: true,
	useIpv6: false,
	useMpls: false,
	changeTcpMss: false,
	useUpnp: false,
	addressList: [],
};

export const defaultHotspotConfig: HotspotProfile["network_config"] = {
	transparentProxy: true,
	ftp: false,
	bypass: false,
	addressList: [],
};

export const defaultBandwidthConfig: BaseBandwidthConfig = {
	priority: 8,
	burstTime: "8",
};

export const defaultTimeoutConfig: BaseTimeoutConfig = {
	sessionTimeout: 0, // unlimited
	idleTimeout: 0, // unlimited
};
