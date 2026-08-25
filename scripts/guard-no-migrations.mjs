#!/usr/bin/env node
// Refuses to start the app if migration tooling has crept into the repo.
// C2 (docs/reference/tessera-roadmap.md): schema changes go back through
// tessera-schema.sql, applied once by hand — never generated, pushed, or migrated.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN = [/drizzle-kit generate/, /drizzle-kit push/, /\bmigrate\s*\(/];
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", "storage"]);
const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]);

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]):/, "$1:");

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(full);
      continue;
    }
    if (!SOURCE_EXT.has(entry.slice(entry.lastIndexOf(".")))) continue;
    const text = readFileSync(full, "utf8");
    for (const pattern of FORBIDDEN) {
      if (pattern.test(text)) {
        console.error(`\nMigration tooling found in ${full}: matches ${pattern}`);
        console.error("C2 forbids migrations. Apply schema changes to tessera-schema.sql and re-apply by hand.\n");
        process.exit(1);
      }
    }
  }
}

walk(join(root, "backend"));
walk(join(root, "frontend"));
