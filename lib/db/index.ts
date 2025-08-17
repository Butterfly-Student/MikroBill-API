import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { schema } from "@/database/schema/index"; // tetap bisa pakai schema yang sama


// Pastikan .env sudah di root folder dan DATABASE_URL diset
const connectionString = Bun.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL is not set in .env");
}

// postgres.js driver
const client = postgres(connectionString, {
	max: 10, // optional, max pool size
	ssl: false, // atau true kalau pakai SSL (cth di Railway, Supabase, dll)
});

// drizzle ORM client
export const db = drizzle(client, { schema });
