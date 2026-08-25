#!/usr/bin/env node
// Starts the project's local, user-owned Postgres cluster (docs/decisions.md D-7).
// Not a Windows service — needs to be started once per machine session.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir = join(root, ".pgdata");
const logFile = join(root, ".pgdata-log.txt");
const binDir = process.env.PG_BIN ?? "C:\\Program Files\\PostgreSQL\\17\\bin";
const pgCtl = join(binDir, "pg_ctl.exe");
const pgIsReady = join(binDir, "pg_isready.exe");

if (!existsSync(dataDir)) {
  console.error(`No data directory at ${dataDir}. Run initdb first (see docs/phases/01-*.md).`);
  process.exit(1);
}

try {
  execFileSync(pgIsReady, ["-p", "5433"], { stdio: "ignore" });
  console.log("[db] already running on 5433");
  process.exit(0);
} catch {
  // not ready yet — fall through and start it
}

execFileSync(pgCtl, ["start", "-D", dataDir, "-o", "-p 5433", "-l", logFile, "-w"], {
  stdio: "inherit",
});
