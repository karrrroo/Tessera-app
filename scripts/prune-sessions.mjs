#!/usr/bin/env node
// Prunes long-revoked rows from `device_session`.
//
// WHY THIS IS NEEDED. Refresh-token rotation deliberately INSERTS a new row on
// every refresh and revokes the presented one, rather than updating in place —
// D-12's reuse detection needs the revoked row to still exist so that a
// replayed token can be told apart from an unknown one. Nothing, however, ever
// removed the old rows, so the table only grows: one row per refresh, per
// device, forever. Measured on this database: 412 rows in a single ordinary day
// before any load testing, and 2,000+ on a heavy one. At a 220-person school
// that is tens of thousands of rows a week, none of which anyone can see.
//
// WHY PRUNING IS SAFE. Reuse detection only needs a recent window. A token
// presented months after it was rotated is indistinguishable from a token that
// never existed, and both are refused — the difference is only which log line
// is written. Live sessions are never touched: this deletes rows that are
// already revoked and already invisible in Settings (listDeviceSessions
// filters on `revoked_at is null`).
//
// DRY RUN BY DEFAULT. It reports what it would delete and changes nothing
// unless `--apply` is passed, because this is a live database.
//
//   node scripts/prune-sessions.mjs                 # report only
//   node scripts/prune-sessions.mjs --apply         # actually delete
//   node scripts/prune-sessions.mjs --days=90       # a different window
//
// Suggested schedule: weekly. Nothing breaks if it never runs; the table just
// keeps growing.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const databaseUrl = readFileSync(join(root, "backend", ".env"), "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL not found in backend/.env");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const daysArg = process.argv.find((a) => a.startsWith("--days="));
const days = daysArg ? Number(daysArg.split("=")[1]) : 30;
if (!Number.isFinite(days) || days < 7) {
  console.error("--days must be a number and at least 7, to keep reuse detection meaningful for any realistic replay.");
  process.exit(1);
}

const isLocalHost = /localhost|127\.0\.0\.1/.test(databaseUrl);
const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: isLocalHost ? false : { rejectUnauthorized: true },
});
await client.connect();
try {
  const { rows: totals } = await client.query(
    `select count(*)::int as total,
            sum((revoked_at is null)::int)::int as live,
            sum((revoked_at is not null)::int)::int as revoked
       from device_session`,
  );
  const { rows: target } = await client.query(
    `select count(*)::int as n, min(revoked_at) as oldest, max(revoked_at) as newest
       from device_session
      where revoked_at is not null and revoked_at < now() - ($1 || ' days')::interval`,
    [String(days)],
  );

  console.log(`device_session: ${totals[0].total} rows — ${totals[0].live} live, ${totals[0].revoked} revoked`);
  console.log(`revoked more than ${days} days ago: ${target[0].n}`);
  if (target[0].n > 0) {
    console.log(`  oldest ${String(target[0].oldest).slice(0, 19)}, newest ${String(target[0].newest).slice(0, 19)}`);
  }

  if (!apply) {
    console.log("\nDry run — nothing deleted. Re-run with --apply to delete those rows.");
  } else if (target[0].n === 0) {
    console.log("\nNothing to delete.");
  } else {
    // A single statement, and never touching a live session: the predicate
    // repeats `revoked_at is not null` deliberately rather than relying on the
    // interval comparison alone to exclude nulls.
    const { rowCount } = await client.query(
      `delete from device_session
        where revoked_at is not null and revoked_at < now() - ($1 || ' days')::interval`,
      [String(days)],
    );
    const { rows: after } = await client.query(
      `select count(*)::int as total, sum((revoked_at is null)::int)::int as live from device_session`,
    );
    console.log(`\nDeleted ${rowCount} revoked session(s).`);
    console.log(`device_session now: ${after[0].total} rows — ${after[0].live} live (unchanged by this script).`);
    if (after[0].live !== totals[0].live) {
      console.error("FAILED: the number of LIVE sessions changed. That must never happen.");
      process.exit(1);
    }
  }
} finally {
  await client.end();
}
