import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  auditLog,
  credentialRequest,
  schoolClass,
  student,
  subject,
  teacher,
  teachingAssignment,
  enrollment,
  academicYear,
  user,
} from "../../db/schema.js";

export async function findStudentByUserId(userId: string) {
  const [row] = await db.select().from(student).where(eq(student.userId, userId)).limit(1);
  return row;
}

export async function findTeacherByUserId(userId: string) {
  const [row] = await db.select().from(teacher).where(eq(teacher.userId, userId)).limit(1);
  return row;
}

// Same most-recent-by-year limitation as record/repo.ts's findCurrentEnrollment (D-27) —
// there is no institution-wide "current year" flag anywhere in the schema.
export async function findCurrentEnrollment(studentId: string) {
  const [row] = await db
    .select({ grade: schoolClass.grade, letter: schoolClass.letter })
    .from(enrollment)
    .innerJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .innerJoin(academicYear, eq(academicYear.id, enrollment.academicYearId))
    .where(eq(enrollment.studentId, studentId))
    .orderBy(desc(academicYear.startsOn))
    .limit(1);
  return row;
}

export async function findSubjectById(subjectId: string) {
  const [row] = await db.select().from(subject).where(eq(subject.id, subjectId)).limit(1);
  return row;
}

// CR-7: "spans all the teacher's subjects; it is not class-scoped" — unlike
// gradebook's findAssignment, this ignores class/year entirely and asks only
// "does this teacher teach this subject, in any class, ever."
export async function teacherTeachesSubject(teacherId: string, subjectId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: teachingAssignment.id })
    .from(teachingAssignment)
    .where(and(eq(teachingAssignment.teacherId, teacherId), eq(teachingAssignment.subjectId, subjectId)))
    .limit(1);
  return !!row;
}

export async function findSubjectIdsTaughtByTeacher(teacherId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ subjectId: teachingAssignment.subjectId })
    .from(teachingAssignment)
    .where(eq(teachingAssignment.teacherId, teacherId));
  return rows.map((r) => r.subjectId);
}

export async function insertCredentialRequest(input: {
  id: string;
  studentId: string;
  subjectId?: string;
  category: string;
  title: string;
  description?: string;
  attachmentUrl?: string;
  attachmentMime?: string;
}) {
  const [row] = await db
    .insert(credentialRequest)
    .values({
      id: input.id,
      studentId: input.studentId,
      subjectId: input.subjectId,
      category: input.category,
      title: input.title,
      description: input.description,
      attachmentUrl: input.attachmentUrl,
      attachmentMime: input.attachmentMime,
    })
    .returning();
  return row;
}

export async function findCredentialById(id: string) {
  const [row] = await db.select().from(credentialRequest).where(eq(credentialRequest.id, id)).limit(1);
  return row;
}

type ListScope =
  | { role: "student"; studentId: string }
  | { role: "teacher"; subjectIds: string[] }
  | { role: "admin" };

export async function findCredentialsList(
  scope: ListScope,
  filters: { status?: "pending" | "approved" | "declined"; subjectId?: string; cursor?: string },
  limit: number,
) {
  const conditions = [];
  if (scope.role === "student") conditions.push(eq(credentialRequest.studentId, scope.studentId));
  if (scope.role === "teacher") {
    if (scope.subjectIds.length === 0) return [];
    conditions.push(inArray(credentialRequest.subjectId, scope.subjectIds));
  }
  if (filters.status) conditions.push(eq(credentialRequest.status, filters.status));
  if (filters.subjectId) conditions.push(eq(credentialRequest.subjectId, filters.subjectId));
  if (filters.cursor) conditions.push(lt(credentialRequest.createdAt, filters.cursor));

  const rows = await db
    .select({
      id: credentialRequest.id,
      status: credentialRequest.status,
      category: credentialRequest.category,
      title: credentialRequest.title,
      description: credentialRequest.description,
      attachmentUrl: credentialRequest.attachmentUrl,
      attachmentMime: credentialRequest.attachmentMime,
      createdAt: credentialRequest.createdAt,
      decidedAt: credentialRequest.decidedAt,
      decisionReason: credentialRequest.decisionReason,
      decidedByUserId: credentialRequest.decidedByUserId,
      subjectId: credentialRequest.subjectId,
      subjectNameHy: subject.nameHy,
      subjectNameEn: subject.nameEn,
      subjectNameRu: subject.nameRu,
      studentId: credentialRequest.studentId,
      studentFirstName: student.firstName,
      studentLastName: student.lastName,
    })
    .from(credentialRequest)
    .leftJoin(subject, eq(subject.id, credentialRequest.subjectId))
    .innerJoin(student, eq(student.id, credentialRequest.studentId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(credentialRequest.createdAt))
    .limit(limit);
  return rows;
}

export async function findClassLabelsForStudents(studentIds: string[]): Promise<Map<string, string>> {
  if (studentIds.length === 0) return new Map();
  const rows = await db
    .select({
      studentId: enrollment.studentId,
      grade: schoolClass.grade,
      letter: schoolClass.letter,
      startsOn: academicYear.startsOn,
    })
    .from(enrollment)
    .innerJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .innerJoin(academicYear, eq(academicYear.id, enrollment.academicYearId))
    .where(inArray(enrollment.studentId, studentIds))
    .orderBy(desc(academicYear.startsOn));
  const map = new Map<string, string>();
  for (const row of rows) {
    if (!map.has(row.studentId)) map.set(row.studentId, `${row.grade}-${row.letter}`);
  }
  return map;
}

// Decider's display name — a teacher's real name, or the account's email
// when there is no teacher row (an admin has no profile table at all,
// same fallback export-log-table.tsx's frontend already uses for actors).
export async function findDeciderDisplay(userId: string): Promise<{ name: string | null; email: string }> {
  const [row] = await db
    .select({ email: user.email, firstName: teacher.firstName, lastName: teacher.lastName })
    .from(user)
    .leftJoin(teacher, eq(teacher.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1);
  if (!row) return { name: null, email: "" };
  return { name: row.firstName ? `${row.firstName} ${row.lastName}` : null, email: row.email };
}

export async function decideCredential(input: {
  id: string;
  status: "approved" | "declined";
  decidedByUserId: string;
  decidedAt: string;
  decisionReason?: string;
}) {
  const [row] = await db
    .update(credentialRequest)
    .set({
      status: input.status,
      decidedByUserId: input.decidedByUserId,
      decidedAt: input.decidedAt,
      decisionReason: input.decisionReason,
      updatedAt: input.decidedAt,
    })
    .where(eq(credentialRequest.id, input.id))
    .returning();
  return row;
}

// Idempotency-Key (roadmap PRD §11.2), stored in audit_log.after exactly
// like gradebook's publish flow (repo.ts there) — no dedicated column
// anywhere in the frozen schema. Scoped additionally to entityId so a
// replayed key can't collide across two different credential requests.
export async function findDecisionByIdempotencyKey(credentialId: string, idempotencyKey: string) {
  const [row] = await db
    .select({ after: auditLog.after })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, "credential_decision"),
        eq(auditLog.entityId, credentialId),
        sql`${auditLog.after}->>'idempotencyKey' = ${idempotencyKey}`,
      ),
    )
    .limit(1);
  return row?.after as { status: string; decidedAt: string; decisionReason?: string } | undefined;
}

export async function writeCredentialAuditLog(input: {
  actorUserId: string;
  credentialId: string;
  before: { status: string };
  after: { status: string; decidedAt: string; decisionReason?: string; idempotencyKey?: string };
}) {
  await db.insert(auditLog).values({
    actorUserId: input.actorUserId,
    action: "credential_decision",
    entityType: "credential_request",
    entityId: input.credentialId,
    before: input.before,
    after: input.after,
  });
}

