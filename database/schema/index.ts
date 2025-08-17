// schema/index.ts
import * as users from "./users";
import * as mikrotik from "./mikrotik";
import * as service_plans from "./service_plans";

export const schema = {
	...users,
	...mikrotik,
	...service_plans,
};
