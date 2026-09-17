/**
 * Applies the SQL in ./drizzle to whatever DATABASE_URL points at.
 *
 * Run by hand (`npm run db:migrate`) rather than on every deploy: this is a
 * take-home, and a migration that runs automatically during a build is a good
 * way to have a half-applied schema with no obvious owner.
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

config({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

await migrate(drizzle(neon(url)), { migrationsFolder: "./drizzle" });
console.log("Migrations applied.");
