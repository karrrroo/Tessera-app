import { and, eq } from "drizzle-orm";
import { db, pool } from "../../db/client.js";
import {
  institution,
  schoolClass,
  subject,
  term,
  teacher,
  teachingAssignment,
  assessment,
  mark,
  exportLog,
} from "../../db/schema.js";

export async function resolveInstitutionId(): Promise<string> {
  const rows = await db.select({ id: institution.id }).from(institution);
  return rows[0]?.id ?? "";
}

export async function findInstitution(institutionId: string) {
  const [row] = await db.select().from(institution).where(eq(institution.id, institutionId)).limit(1);
  return row;
}

export async function findTeacherByUserId(userId: string) {
  const [row] = await db.select().from(teacher).where(eq(teacher.userId, userId)).limit(1);
  return row;
}

export async function findAssignment(teacherId: string, classId: string, subjectId: string) {
  const [row] = await db
    .select()
    .from(teachingAssignment)
    .where(
      and(
        eq(teachingAssignment.teacherId, teacherId),
        eq(teachingAssignment.classId, classId),
        eq(teachingAssignment.subjectId, subjectId),
      ),
    )
    .limit(1);
  return row;
}

export async function findClass(classId: string) {
  const [row] = await db.select().from(schoolClass).where(eq(schoolClass.id, classId)).limit(1);
  return row;
}

export async function findSubject(subjectId: string) {
  const [row] = await db.select().from(subject).where(eq(subject.id, subjectId)).limit(1);
  return row;
}

export async function findTerm(termId: string) {
  const [row] = await db.select().from(term).where(eq(term.id, termId)).limit(1);
  return row;
}

export async function findClassesForInstitution(institutionId: string, academicYearId: string) {
  return db
    .select()
    .from(schoolClass)
    .where(and(eq(schoolClass.institutionId, institutionId), eq(schoolClass.academicYearId, academicYearId)))
    .orderBy(schoolClass.grade, schoolClass.letter);
}

// Every subject actually taught in this class this year — a class-term
// export has no single "the subject" to key its columns on, so the sheet
// fan-out happens per subject instead (same principle institution-term
// already uses per class).
export async function findSubjectsTaughtInClass(classId: string, academicYearId: string) {
  return db
    .selectDistinct({ id: subject.id, nameHy: subject.nameHy, nameEn: subject.nameEn, nameRu: subject.nameRu })
    .from(teachingAssignment)
    .innerJoin(subject, eq(subject.id, teachingAssignment.subjectId))
    .where(and(eq(teachingAssignment.classId, classId), eq(teachingAssignment.academicYearId, academicYearId)));
}

// Same hy-AM-x-icu collation as the gradebook (docs/decisions.md D-55) —
// duplicated rather than imported across modules, matching this codebase's
// existing pattern of each module owning its own read queries.
export async function findStudentsForClass(classId: string) {
  const { rows } = await pool.query<{ id: string; first_name: string; last_name: string; status: string }>(
    `select s.id, s.first_name, s.last_name, e.status
       from enrollment e
       join student s on s.id = e.student_id
      where e.class_id = $1
      order by (e.status = 'active') desc, s.last_name collate "hy-AM-x-icu", s.first_name collate "hy-AM-x-icu"`,
    [classId],
  );
  return rows;
}

export type PublishedAssessment = { id: string; heldOn: string; title: string | null };
export type PublishedMark = { assessmentId: string; studentId: string; value: number };

// EXP-4, literally: `where state = 'published'`. Drafts and superseded rows
// are excluded by this condition alone — a superseded row's live successor
// is a separate row already in state='published'.
export async function findPublishedAssessments(classId: string, subjectId: string, termId: string): Promise<PublishedAssessment[]> {
  return db
    .select({ id: assessment.id, heldOn: assessment.heldOn, title: assessment.title })
    .from(assessment)
    .where(and(eq(assessment.classId, classId), eq(assessment.subjectId, subjectId), eq(assessment.termId, termId)))
    .orderBy(assessment.heldOn, assessment.createdAt);
}

export async function findPublishedMarks(classId: string, subjectId: string, termId: string): Promise<PublishedMark[]> {
  return db
    .select({ assessmentId: mark.assessmentId, studentId: mark.studentId, value: mark.value })
    .from(mark)
    .innerJoin(assessment, eq(assessment.id, mark.assessmentId))
    .where(
      and(
        eq(assessment.classId, classId),
        eq(assessment.subjectId, subjectId),
        eq(assessment.termId, termId),
        eq(mark.state, "published"),
      ),
    );
}

export async function countPublishedMarks(classId: string, subjectId: string, termId: string): Promise<number> {
  const rows = await findPublishedMarks(classId, subjectId, termId);
  return rows.length;
}

export async function insertExportLog(input: {
  institutionId: string;
  actorUserId: string;
  scope: Record<string, unknown>;
  format: "xlsx" | "csv";
  markCount: number;
}) {
  await db.insert(exportLog).values({
    institutionId: input.institutionId,
    actorUserId: input.actorUserId,
    scope: input.scope,
    format: input.format,
    markCount: input.markCount,
  });
}

export async function findExportLogs(institutionId: string, limit: number) {
  const { rows } = await pool.query(
    `select el.id, el.scope, el.format, el.mark_count, el.created_at,
            u.email as actor_email, t.first_name as teacher_first_name, t.last_name as teacher_last_name
       from export_log el
       left join "user" u on u.id = el.actor_user_id
       left join teacher t on t.user_id = el.actor_user_id
      where el.institution_id = $1
      order by el.created_at desc
      limit $2`,
    [institutionId, limit],
  );
  return rows;
}
