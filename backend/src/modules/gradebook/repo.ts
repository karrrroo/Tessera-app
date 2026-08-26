import { and, eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "../../db/client.js";
import { teacher, teachingAssignment, schoolClass, subject, term, student, enrollment, assessment, mark, auditLog } from "../../db/schema.js";

export async function findTeacherByUserId(userId: string) {
  const [row] = await db.select().from(teacher).where(eq(teacher.userId, userId)).limit(1);
  return row;
}

export async function findAssignment(teacherId: string, classId: string, subjectId: string, academicYearId?: string) {
  const conditions = [
    eq(teachingAssignment.teacherId, teacherId),
    eq(teachingAssignment.classId, classId),
    eq(teachingAssignment.subjectId, subjectId),
  ];
  if (academicYearId) conditions.push(eq(teachingAssignment.academicYearId, academicYearId));
  const [row] = await db
    .select()
    .from(teachingAssignment)
    .where(and(...conditions))
    .limit(1);
  return row;
}

export async function findTeacherAssignments(teacherId: string) {
  return db
    .select({
      classId: teachingAssignment.classId,
      subjectId: teachingAssignment.subjectId,
      academicYearId: teachingAssignment.academicYearId,
      grade: schoolClass.grade,
      letter: schoolClass.letter,
      subjectNameHy: subject.nameHy,
      subjectNameEn: subject.nameEn,
      subjectNameRu: subject.nameRu,
    })
    .from(teachingAssignment)
    .innerJoin(schoolClass, eq(schoolClass.id, teachingAssignment.classId))
    .innerJoin(subject, eq(subject.id, teachingAssignment.subjectId))
    .where(eq(teachingAssignment.teacherId, teacherId));
}

export async function findTermsForYear(academicYearId: string) {
  return db.select().from(term).where(eq(term.academicYearId, academicYearId)).orderBy(term.index);
}

export async function findTermById(termId: string) {
  const [row] = await db.select().from(term).where(eq(term.id, termId)).limit(1);
  return row;
}

export async function countActiveStudents(classId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(enrollment)
    .where(and(eq(enrollment.classId, classId), eq(enrollment.status, "active")));
  return row?.n ?? 0;
}

export async function countDrafts(classId: string, subjectId: string, termId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(mark)
    .innerJoin(assessment, eq(assessment.id, mark.assessmentId))
    .where(and(eq(assessment.classId, classId), eq(assessment.subjectId, subjectId), eq(assessment.termId, termId), eq(mark.state, "draft")));
  return row?.n ?? 0;
}

// Armenian collation (hy-AM, ICU — ships with this Postgres, verified
// directly) on both name parts — a plain byte-order sort does not match an
// Armenian alphabetical list, and a teacher reading down a register that
// doesn't match their paper one will not trust the screen.
export async function findStudentsForClass(classId: string) {
  const { rows } = await pool.query<{ id: string; first_name: string; last_name: string; status: string }>(
    `select s.id, s.first_name, s.last_name, e.status
       from enrollment e
       join student s on s.id = e.student_id
      where e.class_id = $1
      order by (e.status = 'active') desc, s.last_name collate "hy-AM", s.first_name collate "hy-AM"`,
    [classId],
  );
  return rows;
}

export async function findAssessmentsForGradebook(classId: string, subjectId: string, termId: string) {
  return db
    .select({
      id: assessment.id,
      heldOn: assessment.heldOn,
      kind: assessment.kind,
      title: assessment.title,
      topic: assessment.topic,
      publishedMarkCount: sql<number>`(select count(*)::int from mark m where m.assessment_id = ${assessment.id} and m.state = 'published')`,
    })
    .from(assessment)
    .where(and(eq(assessment.classId, classId), eq(assessment.subjectId, subjectId), eq(assessment.termId, termId)))
    // heldOn alone ties for same-day assessments — Postgres gives no order
    // guarantee across ties, so two lessons entered the same day could
    // visibly swap columns between loads without a secondary key.
    .orderBy(assessment.heldOn, assessment.createdAt);
}

export async function findMarksForGradebook(classId: string, subjectId: string, termId: string) {
  return db
    .select({
      id: mark.id,
      assessmentId: mark.assessmentId,
      studentId: mark.studentId,
      value: mark.value,
      state: mark.state,
      enteredAt: mark.enteredAt,
      hasHistory: sql<boolean>`(${mark.supersedesMarkId} is not null)`,
    })
    .from(mark)
    .innerJoin(assessment, eq(assessment.id, mark.assessmentId))
    .where(and(eq(assessment.classId, classId), eq(assessment.subjectId, subjectId), eq(assessment.termId, termId), inArray(mark.state, ["draft", "published"])));
}

export async function findAssessmentById(assessmentId: string) {
  const [row] = await db.select().from(assessment).where(eq(assessment.id, assessmentId)).limit(1);
  return row;
}

export async function insertAssessment(input: { classId: string; subjectId: string; termId: string; heldOn: string; kind: string; title?: string; topic?: string; teacherId: string }) {
  const [row] = await db
    .insert(assessment)
    .values({
      classId: input.classId,
      subjectId: input.subjectId,
      termId: input.termId,
      heldOn: input.heldOn,
      kind: input.kind as "lesson" | "test" | "exam" | "project",
      title: input.title ?? null,
      topic: input.topic ?? null,
      createdByTeacherId: input.teacherId,
    })
    .returning();
  return row;
}

export async function patchAssessment(assessmentId: string, patch: { title?: string | null; topic?: string | null; heldOn?: string }) {
  const [row] = await db
    .update(assessment)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(assessment.id, assessmentId))
    .returning();
  return row;
}

export async function countMarksForAssessment(assessmentId: string) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(mark).where(eq(mark.assessmentId, assessmentId));
  return row?.n ?? 0;
}

export async function deleteAssessment(assessmentId: string) {
  await db.delete(assessment).where(eq(assessment.id, assessmentId));
}

export async function findEnrolledStudentIds(classId: string) {
  const rows = await db.select({ studentId: enrollment.studentId }).from(enrollment).where(eq(enrollment.classId, classId));
  return new Set(rows.map((r) => r.studentId));
}

// The batch upsert (roadmap PUT /api/marks): `insert ... on conflict
// (assessment_id, student_id) where state in ('draft','published') do
// update set value = excluded.value where mark.state = 'draft'`, run for
// every item in one round trip. Items whose conflict target matched but
// the guard excluded (i.e. the row is currently published) simply don't
// come back in the RETURNING set — the caller compares against the input
// to find those, then looks up their live value to report.
export async function upsertDraftMarks(
  items: { assessmentId: string; studentId: string; value: number }[],
  teacherId: string,
) {
  if (items.length === 0) return [];
  const assessmentIds = items.map((i) => i.assessmentId);
  const studentIds = items.map((i) => i.studentId);
  const values = items.map((i) => i.value);
  const { rows } = await pool.query<{ id: string; assessment_id: string; student_id: string; value: number; state: string }>(
    `insert into mark (assessment_id, student_id, value, state, entered_by_teacher_id, entered_at)
     select t.assessment_id, t.student_id, t.value, 'draft', $4::uuid, current_timestamp
       from unnest($1::uuid[], $2::uuid[], $3::smallint[]) as t(assessment_id, student_id, value)
     on conflict (assessment_id, student_id) where state in ('draft', 'published')
     do update set value = excluded.value, entered_at = excluded.entered_at
     where mark.state = 'draft'
     returning id, assessment_id, student_id, value, state`,
    [assessmentIds, studentIds, values, teacherId],
  );
  return rows;
}

export async function findCurrentMarks(pairs: { assessmentId: string; studentId: string }[]) {
  if (pairs.length === 0) return [];
  const { rows } = await pool.query<{ id: string; assessment_id: string; student_id: string; value: number; state: string }>(
    `select m.id, m.assessment_id, m.student_id, m.value, m.state
       from mark m
       join unnest($1::uuid[], $2::uuid[]) as t(assessment_id, student_id)
         on t.assessment_id = m.assessment_id and t.student_id = m.student_id
      where m.state in ('draft', 'published')`,
    [pairs.map((p) => p.assessmentId), pairs.map((p) => p.studentId)],
  );
  return rows;
}

export async function deleteDraftMarksBatch(pairs: { assessmentId: string; studentId: string }[]) {
  if (pairs.length === 0) return [];
  const { rows } = await pool.query<{ id: string; assessment_id: string; student_id: string }>(
    `delete from mark
      where state = 'draft'
        and (assessment_id, student_id) in (select * from unnest($1::uuid[], $2::uuid[]))
      returning id, assessment_id, student_id`,
    [pairs.map((p) => p.assessmentId), pairs.map((p) => p.studentId)],
  );
  return rows;
}

export async function findDraftMarkById(markId: string) {
  const [row] = await db.select().from(mark).where(and(eq(mark.id, markId), eq(mark.state, "draft"))).limit(1);
  return row;
}

export async function deleteMarkById(markId: string) {
  await db.delete(mark).where(eq(mark.id, markId));
}

export async function publishDrafts(classId: string, subjectId: string, termId: string) {
  const assessmentIds = db
    .select({ id: assessment.id })
    .from(assessment)
    .where(and(eq(assessment.classId, classId), eq(assessment.subjectId, subjectId), eq(assessment.termId, termId)));
  return db
    .update(mark)
    .set({ state: "published", publishedAt: new Date().toISOString() })
    .where(and(eq(mark.state, "draft"), inArray(mark.assessmentId, assessmentIds)))
    .returning({ id: mark.id });
}

export async function findMarkById(markId: string) {
  const [row] = await db.select().from(mark).where(eq(mark.id, markId)).limit(1);
  return row;
}

// Two statements in one transaction, demote *then* insert — not the
// reverse. `one_current_mark` is a plain (non-deferred) unique index, so
// Postgres checks it at the end of each statement, not at commit; a
// concurrently-published-again old row aside, inserting the new
// `published` row before the old one is demoted would leave both rows
// matching the partial index at once and the insert itself would be
// rejected. Demoting first means the insert's own check only ever sees
// the old row as already 'superseded'.
export async function supersedeMark(input: {
  oldMarkId: string;
  assessmentId: string;
  studentId: string;
  value: number;
  reason: string;
  teacherId: string;
}) {
  return db.transaction(async (tx) => {
    await tx.update(mark).set({ state: "superseded", updatedAt: new Date().toISOString() }).where(eq(mark.id, input.oldMarkId));
    const now = new Date().toISOString();
    const [inserted] = await tx
      .insert(mark)
      .values({
        assessmentId: input.assessmentId,
        studentId: input.studentId,
        value: input.value,
        state: "published",
        supersedesMarkId: input.oldMarkId,
        reason: input.reason,
        enteredByTeacherId: input.teacherId,
        enteredAt: now,
        publishedAt: now,
      })
      .returning();
    return inserted;
  });
}

export async function findMarkChain(markId: string) {
  const chain = [];
  let current = await findMarkById(markId);
  if (!current) return [];
  chain.unshift(current);
  while (current.supersedesMarkId) {
    const prior = await findMarkById(current.supersedesMarkId);
    if (!prior) break;
    chain.unshift(prior);
    current = prior;
  }
  return chain;
}

export async function findTeacherNames(teacherIds: string[]) {
  if (teacherIds.length === 0) return [];
  return db.select({ id: teacher.id, firstName: teacher.firstName, lastName: teacher.lastName }).from(teacher).where(inArray(teacher.id, teacherIds));
}

// Idempotency-Key (roadmap PRD §11.2), stored in audit_log.after rather than
// a dedicated column — there is no idempotency-key table or column
// anywhere in the schema, and audit_log's jsonb columns are exactly the
// existing, schema-change-free place for this kind of extra metadata.
export async function findPublishByIdempotencyKey(idempotencyKey: string) {
  const [row] = await db
    .select({ after: auditLog.after })
    .from(auditLog)
    .where(and(eq(auditLog.action, "marks_publish"), sql`${auditLog.after}->>'idempotencyKey' = ${idempotencyKey}`))
    .limit(1);
  return row?.after as { batchId: string; publishedCount: number; publishedAt: string } | undefined;
}

export async function writePublishAuditLog(input: {
  actorUserId: string;
  classId: string;
  subjectId: string;
  termId: string;
  publishedCount: number;
  publishedAt: string;
  batchId: string;
  idempotencyKey?: string;
}) {
  await db.insert(auditLog).values({
    actorUserId: input.actorUserId,
    action: "marks_publish",
    entityType: "class_subject_term",
    entityId: null,
    after: {
      classId: input.classId,
      subjectId: input.subjectId,
      termId: input.termId,
      publishedCount: input.publishedCount,
      publishedAt: input.publishedAt,
      batchId: input.batchId,
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });
}
