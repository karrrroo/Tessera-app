import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to introspect the database (see .env.example)");
}

// Introspection ("pull") only. No other drizzle-kit command is ever run against
// this config — see docs/reference/tessera-roadmap.md §1.2 and
// scripts/guard-no-migrations.mjs, which enforces that at startup.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  // Journal/snapshot bookkeeping from `pull` goes here, not into src/db — it's
  // drizzle-kit's own introspection scratch space, never consumed by app code
  // and never applied against the database (see docs/reference/tessera-roadmap.md §1.2).
  out: "./.drizzle-introspect",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
