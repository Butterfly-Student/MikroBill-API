import "dotenv/config"
import { defineConfig } from "drizzle-kit"

export default defineConfig({
	schema: ["./database/schema/mikrotik.ts", "./database/schema/users.ts"],
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
	verbose: true,
	strict: true,
});
