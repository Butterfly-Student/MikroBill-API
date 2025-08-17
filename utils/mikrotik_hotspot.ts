// ============ MIKROTIK COMMAND GENERATORS ============

import { NewHotspotProfile, NewHotspotUser, NewPppUser } from "@/database/schema/mikrotik";

export class MikrotikCommandGenerator {
	/**
	 * Generate PPP profile add command
	 */
	/**
	 * Generate PPP profile add object for routeros-client
	 */
	static generatePPPProfileAddObject(profile: NewPppUser): Record<string, any> {

		const obj: Record<string, any> = {
			name: profile.name,
		};



		return obj;
	}

	/**
	 * Generate Hotspot user profile add object for routeros-client
	 */
	static generateHotspotProfileAddObject(
		profile: NewHotspotProfile
	): Record<string, any> {
		const obj: Record<string, any> = {
			name: profile.name,
		};

		return obj;
	}

	/**
	 * Generate PPP secret add object for routeros-client
	 */
	static generatePPPSecretAddObject(
		user: NewPppUser,
		profileName: string
	): Record<string, any> {
		const obj: Record<string, any> = {
			name: user.name,
			profile: profileName,
		};

		return obj;
	}

	/**
	 * Generate Hotspot user add object for routeros-client
	 */
	static generateHotspotUserAddObject(
		user: NewHotspotUser,
		profileName: string
	): Record<string, any> {
		const obj: Record<string, any> = {
			name: user.name,
			profile: profileName,
		};

		return obj;
	}
}

// ============ VALIDATION HELPERS ============

export function validateMikrotikRateLimit(rateLimit: string): {
	isValid: boolean;
	error?: string;
} {
	// Validate Mikrotik rate limit format: rx-rate[/tx-rate] [rx-burst-rate[/tx-burst-rate] ...]
	const rateLimitRegex =
		/^(\d+[kmgKMG]?)(\/\d+[kmgKMG]?)?(\s+\d+[kmgKMG]?)*(\/\d+[kmgKMG]?)*(\s+\d+)?(\s+\d+[kmgKMG]?)*(\/\d+[kmgKMG]?)*$/;

	if (!rateLimitRegex.test(rateLimit)) {
		return {
			isValid: false,
			error:
				"Invalid rate limit format. Use format: rx-rate[/tx-rate] [rx-burst-rate[/tx-burst-rate] [rx-burst-threshold[/tx-burst-threshold] [rx-burst-time[/tx-burst-time] [priority] [rx-rate-min[/tx-rate-min]]]]]",
		};
	}

	return { isValid: true };
}

export function validateMikrotikTime(timeValue: string): {
	isValid: boolean;
	error?: string;
} {
	// Validate Mikrotik time format: 1d2h3m4s or combinations
	const timeRegex =
		/^(\d+[wdhms])+$|^(\d+:\d{2}:\d{2})$|^none$|^immediately$|^never$/;

	if (!timeRegex.test(timeValue)) {
		return {
			isValid: false,
			error:
				"Invalid time format. Use format: 1d2h3m4s or 00:00:00 or 'none', 'immediately', 'never'",
		};
	}

	return { isValid: true };
}

export function validateMikrotikIP(ipAddress: string): {
	isValid: boolean;
	error?: string;
} {
	// Simple IP validation for Mikrotik
	const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;

	if (!ipRegex.test(ipAddress)) {
		return {
			isValid: false,
			error: "Invalid IP address format",
		};
	}

	return { isValid: true };
}
