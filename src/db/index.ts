import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
}

/**
 * Neon's HTTP driver rather than node-postgres: every query is a stateless
 * HTTPS round-trip, so a burst of serverless functions can't exhaust a
 * connection pool that nothing is around to keep.
 */
export const db = drizzle(neon(url), { schema });

export { schema };
