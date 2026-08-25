#!/usr/bin/env node
// Read-only audit of the seeded database. Prints a counts report, asserts the
// specific fixtures later phases' manual tests depend on, and writes
// fixtures.json (committed) — or data-gaps.md and exits 1 if something's
// missing. Never writes to the database. See
// docs/reference/tessera-roadmap.md Phase 2 and docs/decisions.md D-9.
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
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

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const gaps = [];
function gap(fixture, detail, suggestedInsert) {
  gaps.push({ fixture, detail, suggestedInsert });
  console.error(`GAP:  ${fixture} — ${detail}`);
}
function ok(message) {
  console.log(`OK:   ${message}`);
}

const fixtures = { generatedAt: null };

await client.connect();
try {
  // ---------- counts report ----------
  console.log("--- counts ---");
  const scalarCounts = {
    institutions: `select count(*) from institution`,
    "academic years": `select count(*) from academic_year`,
    terms: `select count(*) from term`,
    classes: `select count(*) from class`,
    subjects: `select count(*) from subject`,
    teachers: `select count(*) from teacher`,
  };
  for (const [label, sql] of Object.entries(scalarCounts)) {
    const { rows } = await client.query(sql);
    console.log(`${label}: ${rows[0].count}`);
  }

  const { rows: byEnrollment } = await client.query(
    `select status, count(*) from enrollment group by status order by status`,
  );
  console.log(`students by enrollment status: ${byEnrollment.map((r) => `${r.status}=${r.count}`).join(", ")}`);

  const { rows: taCounts } = await client.query(
    `select count(*)::int as n from teaching_assignment group by teacher_id`,
  );
  const taNums = taCounts.map((r) => r.n);
  console.log(
    `teaching assignments per teacher: min=${Math.min(...taNums)} median=${median(taNums)} max=${Math.max(...taNums)}`,
  );

  const { rows: assCounts } = await client.query(
    `select count(*)::int as n from assessment group by class_id, subject_id`,
  );
  const assNums = assCounts.map((r) => r.n);
  console.log(
    `assessments per class-subject: min=${Math.min(...assNums)} median=${median(assNums)} max=${Math.max(...assNums)}`,
  );

  const { rows: byMarkState } = await client.query(`select state, count(*) from mark group by state order by state`);
  console.log(`marks by state: ${byMarkState.map((r) => `${r.state}=${r.count}`).join(", ")}`);

  const { rows: byCredStatus } = await client.query(
    `select status, count(*) from credential_request group by status order by status`,
  );
  console.log(`credential requests by status: ${byCredStatus.map((r) => `${r.status}=${r.count}`).join(", ")}`);

  // ---------- fixtures ----------
  console.log("\n--- fixtures ---");

  // 1. Four is_demo accounts: student, teacher (>=4 assignments), admin, one must_change_password.
  const { rows: demoUsers } = await client.query(
    `select u.id as user_id, u.email, u.role, u.must_change_password, u.password_hash,
            s.id as student_id, t.id as teacher_id
     from "user" u
     left join student s on s.user_id = u.id
     left join teacher t on t.user_id = u.id
     where u.is_demo = true`,
  );
  const validHash = (h) => /^\$2[aby]\$/.test(h) || /^\$argon2id\$/.test(h);
  const admin = demoUsers.find((u) => u.role === "admin");
  const teacherDemo = demoUsers.find((u) => u.role === "teacher");
  const firstLogin = demoUsers.find((u) => u.role === "student" && u.must_change_password);
  const studentDemo = demoUsers.find((u) => u.role === "student" && !u.must_change_password);
  if (admin && teacherDemo && firstLogin && studentDemo && [admin, teacherDemo, firstLogin, studentDemo].every((u) => validHash(u.password_hash))) {
    const { rows: taCount } = await client.query(
      `select count(*)::int as n from teaching_assignment where teacher_id = $1`,
      [teacherDemo.teacher_id],
    );
    if (taCount[0].n >= 4) {
      ok(`4 demo accounts found (student=${studentDemo.email}, teacher=${teacherDemo.email} with ${taCount[0].n} assignments, admin=${admin.email}, firstLogin=${firstLogin.email}), all with a parseable password hash`);
      fixtures.demo = {
        student: { email: studentDemo.email, userId: studentDemo.user_id, studentId: studentDemo.student_id },
        teacher: { email: teacherDemo.email, userId: teacherDemo.user_id, teacherId: teacherDemo.teacher_id },
        admin: { email: admin.email, userId: admin.user_id },
        firstLogin: { email: firstLogin.email, userId: firstLogin.user_id },
      };
    } else {
      gap("demo teacher assignments", `demo teacher has ${taCount[0].n} assignments, need >=4`, null);
    }
  } else {
    gap("4 demo accounts", `found ${demoUsers.length} is_demo accounts, missing one of student/teacher/admin/firstLogin, or an unparseable hash`, null);
  }

  // 2. >=1 teacher with >=12 draft marks in one class-subject.
  const { rows: draftGroups } = await client.query(
    `select m.entered_by_teacher_id as teacher_id, a.class_id, a.subject_id, count(*)::int as n
     from mark m join assessment a on a.id = m.assessment_id
     where m.state = 'draft'
     group by m.entered_by_teacher_id, a.class_id, a.subject_id
     order by n desc limit 1`,
  );
  if (draftGroups[0]?.n >= 12) {
    const g = draftGroups[0];
    ok(`draft owner found: teacher ${g.teacher_id}, class ${g.class_id}, subject ${g.subject_id}, ${g.n} drafts`);
    fixtures.draftOwner = { teacherId: g.teacher_id, classId: g.class_id, subjectId: g.subject_id, count: g.n };
  } else {
    gap("draft owner", `best candidate has ${draftGroups[0]?.n ?? 0} draft marks, need >=12`, null);
  }

  // 3. >=3 corrections (mark with supersedes_mark_id set and a non-null reason).
  const { rows: corrections } = await client.query(
    `select id, value, reason from mark where supersedes_mark_id is not null and reason is not null limit 5`,
  );
  if (corrections.length >= 3) {
    ok(`${corrections.length >= 5 ? "5+" : corrections.length} correction marks found with non-null reason (sample: ${corrections.slice(0, 3).map((c) => c.id).join(", ")})`);
    fixtures.supersededMarks = corrections.slice(0, 3).map((c) => c.id);
  } else {
    gap("superseded marks with reason", `found only ${corrections.length}, need >=3`, null);
  }

  // 4. Sparse student: minimum published-mark count, clearly an outlier vs. the rest.
  const { rows: byStudent } = await client.query(
    `select student_id, count(*)::int as n from mark where state = 'published' group by student_id order by n asc limit 2`,
  );
  if (byStudent.length >= 2 && byStudent[0].n < byStudent[1].n / 4) {
    ok(`sparse student found: ${byStudent[0].student_id} with ${byStudent[0].n} published marks (next-lowest has ${byStudent[1].n})`);
    fixtures.sparseStudent = { studentId: byStudent[0].student_id, publishedMarks: byStudent[0].n };
  } else {
    gap("sparse student", `no student stands out as a sparse outlier (lowest=${byStudent[0]?.n}, next=${byStudent[1]?.n})`, null);
  }

  // 5. Departed enrollment whose student still has published marks.
  const { rows: departed } = await client.query(
    `select e.id as enrollment_id, e.student_id from enrollment e
     where e.status = 'departed' and exists (select 1 from mark m where m.student_id = e.student_id and m.state = 'published')
     limit 1`,
  );
  if (departed.length) {
    ok(`departed enrollment with published marks: enrollment ${departed[0].enrollment_id}, student ${departed[0].student_id}`);
    fixtures.departedStudent = { studentId: departed[0].student_id, enrollmentId: departed[0].enrollment_id };
  } else {
    gap(
      "departed student",
      "no departed enrollment with published marks exists",
      `update enrollment set status = 'departed' where id = (select id from enrollment where status = 'active' limit 1);`,
    );
  }

  // 6. Heavy class-subject-term: the roadmap's ">=20 assessments" is unreachable
  // with this seed (real max is 8 per class-subject-term, 15 across both terms
  // combined — see docs/decisions.md D-9). Using a threshold that actually
  // separates a real "heavy" combo from the rest instead: >=5 assessments in
  // one term, in a class with >=25 active students.
  const { rows: heavy } = await client.query(
    `select a.class_id, a.subject_id, a.term_id, count(*)::int as assessments,
            (select count(*)::int from enrollment e where e.class_id = a.class_id and e.status = 'active') as students
     from assessment a
     group by a.class_id, a.subject_id, a.term_id
     having count(*) >= 5
        and (select count(*) from enrollment e where e.class_id = a.class_id and e.status = 'active') >= 25
     order by count(*) desc limit 1`,
  );
  if (heavy.length) {
    const h = heavy[0];
    ok(`heavy class-subject-term found: class ${h.class_id}, subject ${h.subject_id}, term ${h.term_id}, ${h.assessments} assessments, ${h.students} students`);
    fixtures.heavyClassSubjectTerm = {
      classId: h.class_id,
      subjectId: h.subject_id,
      termId: h.term_id,
      students: h.students,
      assessments: h.assessments,
    };
  } else {
    gap("heavy class-subject-term", "no combo with >=5 assessments and >=25 students", null);
  }

  // 7. Tagged / untagged assessment (Phase 7 REC-10 degradation).
  const { rows: untagged } = await client.query(`select id from assessment where topic is null limit 1`);
  const { rows: tagged } = await client.query(`select id from assessment where topic is not null limit 1`);
  if (untagged.length) {
    ok(`untagged assessment found: ${untagged[0].id}`);
    fixtures.untaggedAssessment = untagged[0].id;
  } else {
    gap("untagged assessment", "no assessment with topic is null", null);
  }
  if (tagged.length) {
    ok(`tagged assessment found: ${tagged[0].id}`);
    fixtures.taggedAssessment = tagged[0].id;
  } else {
    gap(
      "tagged assessment",
      "no assessment has a non-null topic — tessera-seed.sql never sets this column at all (PRD Q8/REC-10 is exactly this open question)",
      `update assessment set topic = 'Sample topic' where id = (select id from assessment order by random() limit 1);`,
    );
  }

  // 8. Credential requests in all three statuses, >=1 declined with a reason.
  const statuses = new Set(byCredStatus.map((r) => r.status));
  const { rows: credByStatus } = await client.query(
    `select status, id, decision_reason from credential_request where status in ('pending','approved','declined')`,
  );
  const pending = credByStatus.find((r) => r.status === "pending");
  const approved = credByStatus.find((r) => r.status === "approved");
  const declined = credByStatus.find((r) => r.status === "declined" && r.decision_reason);
  if (statuses.has("pending") && statuses.has("approved") && statuses.has("declined") && declined) {
    ok(`credential requests in all 3 statuses, declined has a reason (${declined.id})`);
    fixtures.credentials = { pending: pending.id, approved: approved.id, declined: declined.id };
  } else {
    gap("credential requests", `statuses present: ${[...statuses].join(", ")}; declined-with-reason: ${!!declined}`, null);
  }

  // 9. qr_credential count matches student count.
  const { rows: qrCheck } = await client.query(
    `select (select count(*) from student) as students, (select count(*) from qr_credential) as qr_credentials`,
  );
  if (qrCheck[0].students === qrCheck[0].qr_credentials && Number(qrCheck[0].students) > 0) {
    ok(`qr_credential count (${qrCheck[0].qr_credentials}) matches student count (${qrCheck[0].students})`);
  } else {
    gap("qr_credential coverage", `students=${qrCheck[0].students}, qr_credentials=${qrCheck[0].qr_credentials}`, null);
  }
} finally {
  await client.end();
}

// ---------- output ----------
const fixturesPath = join(root, "fixtures.json");
const gapsPath = join(root, "data-gaps.md");

fixtures.generatedAt = new Date().toISOString();

if (gaps.length === 0) {
  writeFileSync(fixturesPath, JSON.stringify(fixtures, null, 2) + "\n");
  if (existsSync(gapsPath)) unlinkSync(gapsPath);
  console.log(`\nWrote ${fixturesPath}. data:audit passed — no gaps.`);
} else {
  writeFileSync(fixturesPath, JSON.stringify(fixtures, null, 2) + "\n");
  const lines = [
    "# Data gaps found by `npm run data:audit`",
    "",
    "Read-only audit. Nothing below was inserted — this file lists what's missing",
    "and, where there's an obvious fix, the INSERT/UPDATE that would create it.",
    "`npm run data:topup` runs exactly these, but only when explicitly instructed.",
    "",
  ];
  for (const g of gaps) {
    lines.push(`## ${g.fixture}`, "", g.detail, "");
    if (g.suggestedInsert) {
      lines.push("```sql", g.suggestedInsert, "```", "");
    } else {
      lines.push("_No mechanical fix — this needs an author decision, not a script._", "");
    }
  }
  writeFileSync(gapsPath, lines.join("\n"));
  console.error(`\n${gaps.length} gap(s) found. Wrote ${gapsPath}. data:audit FAILED.`);
  process.exit(1);
}
