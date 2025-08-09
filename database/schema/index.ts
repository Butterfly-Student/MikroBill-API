// schema/index.ts
import * as users from "./users";
import * as mikrotik from "./mikrotik";

export const schema = {
	...users,
	...mikrotik,
};
