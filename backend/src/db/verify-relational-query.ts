// One-off (but repeatable) check that a nested relational query is a single
// round trip, not N+1 — Phase 1's "Done when" for docs/reference/tessera-roadmap.md.
// Run with: npx tsx src/db/verify-relational-query.ts (from backend/)
import "dotenv/config";
import { pool, db } from "./client.js";

let queryCount = 0;
const originalQuery = pool.query.bind(pool);
// @ts-expect-error — intentionally widening pg's overloaded query signature for a one-off counter
pool.query = (...args: unknown[]) => {
  queryCount += 1;
  // @ts-expect-error — see above
  return originalQuery(...args);
};

const result = await db.query.assessment.findMany({
  with: { class: true, subject: true, term: true, teacher: true, marks: true },
  limit: 5,
});

console.log(`rows returned: ${result.length}`);
console.log(`round trips: ${queryCount}`);
if (queryCount === 1) {
  console.log("OK: single round trip");
} else {
  console.error(`FAIL: expected 1 round trip, saw ${queryCount}`);
  process.exitCode = 1;
}

await pool.end();
