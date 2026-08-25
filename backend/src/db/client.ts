import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../lib/env.js";
import * as schema from "./schema.js";
import * as relations from "./relations.js";

const isLocalHost = /localhost|127\.0\.0\.1/.test(env.DATABASE_URL);

// Local Postgres has no TLS listener; Neon requires it (docs/decisions.md D-3/D-7).
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: isLocalHost ? false : { rejectUnauthorized: true },
  max: 10,
  idleTimeoutMillis: 30_000,
});

export const db = drizzle(pool, { schema: { ...schema, ...relations } });
