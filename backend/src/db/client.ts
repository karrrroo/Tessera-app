import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../lib/env.js";
import * as schema from "./schema.js";
import * as relations from "./relations.js";

const isLocalHost = /localhost|127\.0\.0\.1/.test(env.DATABASE_URL);

// Local Postgres has no TLS listener; Neon requires it (docs/decisions.md D-3/D-7).
//
// idleTimeoutMillis is 0 — NEVER reap an idle connection — and that is the
// whole point of this block, so it is not a stray tuning number. The database
// is Neon in eu-central-1: one round trip from here costs 66ms, but OPENING a
// connection (TCP + TLS + auth) costs 838ms. At the old 30s idle timeout the
// pool threw its connections away during any ordinary human pause, so the
// first request after one paid that handshake again: measured 901ms after 35s
// idle and 1146ms after 45s, against 212ms warm, dropping straight back to
// 209ms on the request after. That is the "it hangs" the brief describes —
// read a screen for a minute, click, wait a second, and then everything is
// fast again until the next pause.
//
// keepAlive puts TCP keepalives on the socket so an idle connection is not
// silently dropped by a NAT or firewall in between and discovered dead only
// when somebody tries to use it.
//
// max stays at 10: mapWithConcurrency (lib/concurrency.ts) caps the export
// fan-out below this number on purpose, so raising it here would quietly
// change that guarantee.
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: isLocalHost ? false : { rejectUnauthorized: true },
  max: 10,
  idleTimeoutMillis: 0,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

// Required by the line above, not optional hygiene. Connections now live
// indefinitely, so the far end closing one (Neon suspending the compute, a
// deploy, a network blip) is a normal event rather than a rare one. pg emits
// that on the POOL, and an unhandled 'error' event on an EventEmitter takes
// the whole process down — so without this, making connections long-lived
// would have traded a slow first request for a crashed backend. The pool has
// already discarded the client by the time this runs; the next request opens
// a fresh one.
pool.on("error", (err) => {
  console.error("[db] idle connection error (the pool has discarded it):", err.message);
});

export const db = drizzle(pool, { schema: { ...schema, ...relations } });
