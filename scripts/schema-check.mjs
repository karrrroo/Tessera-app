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

const EXPECTED_TABLE_COUNT = 22;
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
