import * as crypto from 'crypto';

export const gen_random_uuid: () => string = (): string => {
	return crypto.randomBytes(16).toString("hex");
};