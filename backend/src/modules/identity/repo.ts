import { and, desc, eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, pool } from "../../db/client.js";
import {
  student,
  teacher,
  user,
  institution,
  enrollment,
  schoolClass,
  teachingAssignment,
  subject,
  assessment,
  qrCredential,
  scanEvent,
  academicYear,
} from "../../db/schema.js";
import { registerHandle } from "./handle-map.js";

// Its own helper (rather than inlining the fragment at the call site) so
// today's date comes from Postgres, not from any JS-side clock read — Done-
// when #7 greps this whole directory for JS clock access, not just the
// credential-derivation file.
function currentDateSql() {
  return sql`current_date`;
}

export async function findStudentIdentity(userId: string) {
  const [row] = await db
    .select({
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      institutionId: institution.id,
      institutionName: institution.name,
    })
    .from(student)
    .innerJoin(institution, eq(institution.id, student.institutionId))
    .where(eq(student.userId, userId))
    .limit(1);
  if (!row) return null;

  // Most-recent-by-year enrollment, same tie-breaking limitation as
  // useCurrentAcademicYear on the frontend (docs/decisions.md D-27) — there
  // is no institution-wide "current year" flag anywhere in the schema.
  const [enr] = await db
    .select({ status: enrollment.status, grade: schoolClass.grade, letter: schoolClass.letter })
    .from(enrollment)
    .innerJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .innerJoin(academicYear, eq(academicYear.id, enrollment.academicYearId))
    .where(eq(enrollment.studentId, row.studentId))
    .orderBy(desc(academicYear.startsOn))
    .limit(1);

  return {
    ...row,
    enrollmentStatus: enr?.status ?? null,
    classLabel: enr ? `${enr.grade}-${enr.letter}` : null,
  };
}

export async function findTeacherIdentity(userId: string) {
  const [row] = await db
    .select({
      teacherId: teacher.id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      institutionId: institution.id,
      institutionName: institution.name,
    })
    .from(teacher)
    .innerJoin(institution, eq(institution.id, teacher.institutionId))
    .where(eq(teacher.userId, userId))
    .limit(1);
  if (!row) return null;

  // Scope to the teacher's own most-recent academic year (max startsOn
  // among the years they have assignments in), not an institution-wide
  // "current year" — same D-27 limitation, applied per teacher.
  const [latest] = await db
    .select({ academicYearId: teachingAssignment.academicYearId, startsOn: academicYear.startsOn })
    .from(teachingAssignment)
    .innerJoin(academicYear, eq(academicYear.id, teachingAssignment.academicYearId))
    .where(eq(teachingAssignment.teacherId, row.teacherId))
    .orderBy(desc(academicYear.startsOn))
    .limit(1);

  if (!latest) return { ...row, subjects: [], classLabels: [] as string[] };

  const rows = await db
    .select({
      subjectNameHy: subject.nameHy,
      subjectNameEn: subject.nameEn,
      subjectNameRu: subject.nameRu,
      grade: schoolClass.grade,
      letter: schoolClass.letter,
    })
    .from(teachingAssignment)
    .innerJoin(subject, eq(subject.id, teachingAssignment.subjectId))
    .innerJoin(schoolClass, eq(schoolClass.id, teachingAssignment.classId))
    .where(and(eq(teachingAssignment.teacherId, row.teacherId), eq(teachingAssignment.academicYearId, latest.academicYearId)));

  const subjectsByName = new Map<string, { nameHy: string; nameEn: string; nameRu: string }>();
  const classLabels = new Set<string>();
  for (const r of rows) {
    subjectsByName.set(r.subjectNameHy, { nameHy: r.subjectNameHy, nameEn: r.subjectNameEn, nameRu: r.subjectNameRu });
    classLabels.add(`${r.grade}-${r.letter}`);
  }

  return {
    ...row,
    subjects: [...subjectsByName.values()],
    classLabels: [...classLabels].sort(),
  };
}

// PRD §16 / C2: qr_credential is fully seeded per student (200/200 rows at
// last count), but a student created later — mid-year add, bulk import —
// has no row yet, since Phase 5's admin module predates this one and never
// wrote to this table. Lazily creating one here (rather than reaching back
// into Phase 5's service code) keeps every student's ID working regardless
// of which path created them, without coupling the two modules.
export async function getOrCreateQrCredential(studentId: string) {
  const [existing] = await db.select().from(qrCredential).where(eq(qrCredential.studentId, studentId)).limit(1);
  if (existing) return existing;

  const seed = randomBytes(16).toString("hex");
  const [created] = await db.insert(qrCredential).values({ studentId, seed }).returning();
  registerHandle(seed, { credentialId: created.id, studentId });
  return created;
}

export async function findQrCredentialById(id: string) {
  const [row] = await db.select().from(qrCredential).where(eq(qrCredential.id, id)).limit(1);
  return row;
}

export async function findScanTargetByStudentId(studentId: string) {
  const [row] = await db
    .select({
      firstName: student.firstName,
      lastName: student.lastName,
      institutionName: institution.name,
      status: enrollment.status,
      grade: schoolClass.grade,
      letter: schoolClass.letter,
    })
    .from(student)
    .innerJoin(institution, eq(institution.id, student.institutionId))
    .leftJoin(enrollment, eq(enrollment.studentId, student.id))
    .leftJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .leftJoin(academicYear, eq(academicYear.id, enrollment.academicYearId))
    .where(eq(student.id, studentId))
    .orderBy(desc(academicYear.startsOn))
    .limit(1);
  return row;
}

export async function insertScanEvent(input: { qrCredentialId: string; scannerId: string; result: string; location?: string }) {
  const [row] = await db
    .insert(scanEvent)
    .values({
      qrCredentialId: input.qrCredentialId,
      scannerId: input.scannerId,
      result: input.result,
      location: input.location ?? null,
    })
    .returning();
  return row;
}

// Anomaly rule (roadmap): the same qr_credential_id scanned at two different
// scanner_ids within 120 seconds. Checked against the row just inserted, so
// this always compares against *prior* scans only.
export async function findAnomalyPeer(qrCredentialId: string, scannerId: string, excludeScanEventId: string) {
  const { rows } = await pool.query<{ scanner_id: string; seconds_ago: number }>(
    `select scanner_id, extract(epoch from (current_timestamp - scanned_at))::int as seconds_ago
       from scan_event
      where qr_credential_id = $1
        and scanner_id <> $2
        and id <> $3
        and scanned_at >= current_timestamp - interval '120 seconds'
      order by scanned_at desc
      limit 1`,
    [qrCredentialId, scannerId, excludeScanEventId],
  );
  return rows[0];
}

export type AnomalyRow = {
  scan_event_id: string;
  scanned_at: string;
  scanner_id: string;
  location: string | null;
  result: string;
  previous_scanner_id: string;
  previous_scanned_at: string;
  seconds_ago: number;
  student_first_name: string;
  student_last_name: string;
  class_label: string;
};

export async function findAnomalies(since?: string): Promise<AnomalyRow[]> {
  const { rows } = await pool.query<AnomalyRow>(
    `select distinct on (e1.id)
            e1.id as scan_event_id, e1.scanned_at, e1.scanner_id, e1.location, e1.result,
            e2.scanner_id as previous_scanner_id, e2.scanned_at as previous_scanned_at,
            extract(epoch from (e1.scanned_at - e2.scanned_at))::int as seconds_ago,
            s.first_name as student_first_name, s.last_name as student_last_name,
            coalesce(c.grade::text || '-' || c.letter, '') as class_label
       from scan_event e1
       join scan_event e2
         on e2.qr_credential_id = e1.qr_credential_id
        and e2.scanner_id <> e1.scanner_id
        and e2.scanned_at < e1.scanned_at
        and e1.scanned_at - e2.scanned_at <= interval '120 seconds'
       join qr_credential qc on qc.id = e1.qr_credential_id
       join student s on s.id = qc.student_id
       left join enrollment en on en.student_id = s.id
       left join class c on c.id = en.class_id
       left join academic_year ay on ay.id = en.academic_year_id
      where ($1::timestamptz is null or e1.scanned_at >= $1::timestamptz)
      order by e1.id, ay.starts_on desc nulls last, e2.scanned_at desc`,
    [since ?? null],
  );
  return rows.sort((a, b) => (a.scanned_at < b.scanned_at ? 1 : -1));
}

export async function findTodayAssessmentsForTeacher(teacherId: string) {
  return db
    .select({
      assessmentId: assessment.id,
      kind: assessment.kind,
      grade: schoolClass.grade,
      letter: schoolClass.letter,
      subjectNameHy: subject.nameHy,
      subjectNameEn: subject.nameEn,
      subjectNameRu: subject.nameRu,
    })
    .from(assessment)
    .innerJoin(schoolClass, eq(schoolClass.id, assessment.classId))
    .innerJoin(subject, eq(subject.id, assessment.subjectId))
    .where(and(eq(assessment.createdByTeacherId, teacherId), eq(assessment.heldOn, currentDateSql())))
    .orderBy(schoolClass.grade, schoolClass.letter);
}

export async function findUserLocale(userId: string) {
  const [row] = await db.select({ locale: user.locale }).from(user).where(eq(user.id, userId)).limit(1);
  return row?.locale ?? "hy";
}
