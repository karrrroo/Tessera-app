#!/usr/bin/env node
// Verifies the live database still matches what tessera-schema.sql promises.
// Read-only. Fails loudly (non-zero exit) on any drift. See
// docs/reference/tessera-roadmap.md Phase 1 and docs/decisions.md D-3/D-7.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const backendEnv = readFileSync(join(root, "backend", ".env"), "utf8");
const databaseUrl = backendEnv.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();

if (!databaseUrl) {
  console.error("DATABASE_URL not found in backend/.env");
  process.exit(1);
}

const isLocalHost = /localhost|127\.0\.0\.1/.test(databaseUrl);
const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: isLocalHost ? false : { rejectUnauthorized: true },
});

// 23, not 22: group B adds `application`. Per B1 this check EXPECTS the new
// table rather than being relaxed to tolerate its absence — so until
// docs/reference/tessera-schema-application.sql has been applied by hand,
// schema:check fails here, on purpose, and that failure is the reminder.
const EXPECTED_TABLE_COUNT = 23;
const EXPECTED_ENUMS = {
  user_role: ["student", "teacher", "admin"],
  locale_code: ["hy", "en", "ru"],
  enrollment_status: ["active", "transferred", "departed", "graduated"],
  assessment_kind: ["lesson", "test", "exam", "project"],
  mark_state: ["draft", "published", "superseded"],
  import_kind: ["students", "teachers", "assignments"],
  import_status: ["previewing", "applied", "discarded"],
  import_row_status: ["ok", "warning", "error"],
  export_format: ["xlsx", "csv"],
  credential_status: ["pending", "approved", "declined"],
  support_kind: ["contact", "problem", "feedback"],
};
const EXPECTED_NULLABLE_EMIS_COLUMNS = [
  ["institution", "emis_id"],
  ["student", "emis_student_id"],
  ["teacher", "emis_teacher_id"],
];

let failed = false;
function fail(message) {
  console.error(`FAIL: ${message}`);
  failed = true;
}
function ok(message) {
  console.log(`OK:   ${message}`);
}

await client.connect();
try {
  const { rows: tableRows } = await client.query(
    `select count(*)::int as n from information_schema.tables where table_schema = 'public'`,
  );
  const tableCount = tableRows[0].n;
  if (tableCount === EXPECTED_TABLE_COUNT) {
    ok(`${tableCount} tables in public schema`);
  } else {
    fail(`expected ${EXPECTED_TABLE_COUNT} tables, found ${tableCount}`);
  }

  // The `application` table (group B), checked by name and by shape rather
  // than only by the count above — a count alone would go green again if some
  // unrelated table were added while this one was still missing.
  const { rows: appRows } = await client.query(
    `select column_name, data_type, is_nullable
       from information_schema.columns
      where table_schema = 'public' and table_name = 'application'
      order by ordinal_position`,
  );
  if (appRows.length === 0) {
    fail(
      "table `application` is missing — apply docs/reference/tessera-schema-application.sql " +
        "by hand in the Neon SQL editor (additive, no DROP). Group B's admissions queue " +
        "cannot read or write until it exists.",
    );
  } else {
    const byName = new Map(appRows.map((r) => [r.column_name, r]));
    const EXPECTED_APPLICATION_COLUMNS = [
      ["id", "uuid", "NO"],
      ["first_name", "text", "NO"],
      ["last_name", "text", "NO"],
      ["birth_date", "date", "NO"],
      ["email", "text", "NO"],
      ["phone", "text", "YES"],
      ["school_choice", "text", "NO"],
      ["stream_choice", "text", "NO"],
      ["motivation", "text", "YES"],
      ["transcript_key", "text", "YES"],
      ["status", "text", "NO"],
      ["decided_at", "timestamp with time zone", "YES"],
      ["decided_by", "uuid", "YES"],
      ["created_at", "timestamp with time zone", "NO"],
    ];
    let shapeOk = true;
    for (const [name, type, nullable] of EXPECTED_APPLICATION_COLUMNS) {
      const col = byName.get(name);
      if (!col) {
        fail(`application.${name} is missing`);
        shapeOk = false;
      } else if (col.data_type !== type || col.is_nullable !== nullable) {
        fail(`application.${name} should be ${type} null=${nullable}, found ${col.data_type} null=${col.is_nullable}`);
        shapeOk = false;
      }
    }
    if (shapeOk) ok(`application has all ${EXPECTED_APPLICATION_COLUMNS.length} expected columns`);

    // The partial unique index is a product rule, not a nicety: it is what
    // stops one email address filing two pending applications at once.
    const { rows: idx } = await client.query(
      `select indexname from pg_indexes where schemaname = 'public' and tablename = 'application'`,
    );
    const names = idx.map((r) => r.indexname);
    for (const required of ["application_status_created_idx", "application_pending_email_idx"]) {
      if (names.includes(required)) ok(`index ${required} exists`);
      else fail(`index ${required} is missing on application`);
    }

    // Optional in the handed-over DDL, so this reports rather than fails.
    const { rows: chk } = await client.query(
      `select conname from pg_constraint where conname = 'application_status_check'`,
    );
    if (chk.length > 0) ok("constraint application_status_check exists");
    else console.log("NOTE: application_status_check was not applied (it was optional) — status is unconstrained text");
  }

  for (const [enumName, expectedValues] of Object.entries(EXPECTED_ENUMS)) {
    const { rows } = await client.query(
      `select e.enumlabel from pg_type t join pg_enum e on e.enumtypid = t.oid
       where t.typname = $1 order by e.enumsortorder`,
      [enumName],
    );
    const actual = rows.map((r) => r.enumlabel);
    if (JSON.stringify(actual) === JSON.stringify(expectedValues)) {
      ok(`enum ${enumName} = [${actual.join(", ")}]`);
    } else {
      fail(`enum ${enumName}: expected [${expectedValues.join(", ")}], found [${actual.join(", ")}]`);
    }
  }

  const { rows: checkRows } = await client.query(
    `select conname, pg_get_constraintdef(oid) as def from pg_constraint
     where conname in ('mark_value_check', 'reason_required_when_superseding')`,
  );
  for (const name of ["mark_value_check", "reason_required_when_superseding"]) {
    const found = checkRows.find((r) => r.conname === name);
    if (found) {
      ok(`check constraint ${name}: ${found.def}`);
    } else {
      fail(`missing check constraint ${name}`);
    }
  }

  const { rows: indexRows } = await client.query(
    `select indexdef from pg_indexes where indexname = 'one_current_mark'`,
  );
  if (indexRows.length === 1) {
    ok(`one_current_mark predicate: ${indexRows[0].indexdef}`);
  } else {
    fail("missing unique partial index one_current_mark");
  }

  for (const [table, column] of EXPECTED_NULLABLE_EMIS_COLUMNS) {
    const { rows } = await client.query(
      `select is_nullable from information_schema.columns where table_name = $1 and column_name = $2`,
      [table, column],
    );
    if (rows[0]?.is_nullable === "YES") {
      ok(`${table}.${column} is nullable`);
    } else {
      fail(`${table}.${column} should be nullable, found: ${JSON.stringify(rows[0])}`);
    }
  }

  const { rows: emailRows } = await client.query(
    `select udt_name from information_schema.columns where table_name = 'user' and column_name = 'email'`,
  );
  if (emailRows[0]?.udt_name === "citext") {
    ok(`"user".email is citext`);
  } else {
    fail(`"user".email should be citext, found: ${JSON.stringify(emailRows[0])}`);
  }
} finally {
  await client.end();
}

if (failed) {
  console.error("\nschema:check FAILED — see above.");
  process.exit(1);
}
console.log("\nschema:check passed.");
