#!/usr/bin/env node
// Stops the project's local, user-owned Postgres cluster (docs/decisions.md D-7).
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir = join(root, ".pgdata");
const binDir = process.env.PG_BIN ?? "C:\\Program Files\\PostgreSQL\\17\\bin";
const pgCtl = join(binDir, "pg_ctl.exe");

execFileSync(pgCtl, ["stop", "-D", dataDir, "-m", "fast"], { stdio: "inherit" });
