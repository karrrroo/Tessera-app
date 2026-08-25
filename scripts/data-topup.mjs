#!/usr/bin/env node
// Fixes exactly the gaps scripts/data-audit.mjs found in data-gaps.md, and
// nothing else. Idempotent: each statement is a no-op if the fixture it
// creates already exists (see the NOT EXISTS guard in each query below), so
// running this twice is safe. Run ONLY on explicit instruction — never
// wired into npm start/dev, and never invoked automatically by data-audit.
// See docs/reference/tessera-roadmap.md Phase 2 and docs/decisions.md D-9.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const backendEnv = readFileSync(join(root, "backend", ".env"), "utf8");
const databaseUrl = backendEnv.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const isLocalHost = /localhost|127\.0\.0\.1/.test(databaseUrl);
const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: isLocalHost ? false : { rejectUnauthorized: true },
});

await client.connect();
try {
  const departed = await client.query(`
    update enrollment set status = 'departed'
    where id = (
      select e.id from enrollment e
      where e.status = 'active'
        and exists (select 1 from mark m where m.student_id = e.student_id and m.state = 'published')
        and not exists (select 1 from enrollment e2 where e2.status = 'departed')
      order by e.id limit 1
    )
    returning id, student_id;
  `);
  console.log(
    departed.rowCount
      ? `Marked enrollment ${departed.rows[0].id} (student ${departed.rows[0].student_id}) as departed.`
      : "No-op: a departed enrollment already exists.",
  );

  const tagged = await client.query(`
    update assessment set topic = 'Բազմանդամների գումարում և տարբերություն'
    where id = (
      select id from assessment
      where not exists (select 1 from assessment where topic is not null)
      order by id limit 1
    )
    returning id;
  `);
  console.log(
    tagged.rowCount
      ? `Set topic on assessment ${tagged.rows[0].id}.`
      : "No-op: a tagged assessment already exists.",
  );
} finally {
  await client.end();
}
