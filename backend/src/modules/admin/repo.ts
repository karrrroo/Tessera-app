import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  institution,
  academicYear,
  term,
  subject,
  schoolClass,
  student,
  teacher,
  user,
  enrollment,
  teachingAssignment,
  importBatch,
  importRow,
  auditLog,
} from "../../db/schema.js";
import { ApiError } from "../../http/errors.js";

type EnrollmentStatusValue = "active" | "transferred" | "departed" | "graduated";

// There is no admin->institution link anywhere in the schema (no `admin`
// table, no `institution_id` on `user`) — see docs/decisions.md. The seed
// and the current schema are single-tenant (exactly one institution row),
// so this resolves "the actor's institution" as that sole row and fails
// loudly rather than guessing if that ever stops being true. C2 forbids
// adding the missing link via a schema change; a real multi-tenant
// deployment needs one.
export async function resolveActorInstitutionId(): Promise<string> {
  const rows = await db.select({ id: institution.id }).from(institution);
  if (rows.length !== 1) {
    throw new ApiError(500, "INTERNAL", {
      details: { reason: "expected exactly one institution row", found: rows.length },
    });
  }
  return rows[0].id;
}

export async function getInstitution(institutionId: string) {
  const [row] = await db.select().from(institution).where(eq(institution.id, institutionId)).limit(1);
  return row;
}

export async function updateInstitution(institutionId: string, patch: { name?: string; region?: string; type?: string }) {
  const [row] = await db
    .update(institution)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(institution.id, institutionId))
    .returning();
  return row;
}

export async function listAcademicYears(institutionId: string) {
  return db.select().from(academicYear).where(eq(academicYear.institutionId, institutionId)).orderBy(academicYear.startsOn);
}

export async function createAcademicYear(institutionId: string, data: { label: string; startsOn: string; endsOn: string }) {
  const [row] = await db
    .insert(academicYear)
    .values({ institutionId, ...data })
    .returning();
  return row;
}

export async function updateAcademicYear(id: string, patch: Partial<{ label: string; startsOn: string; endsOn: string }>) {
  const [row] = await db
    .update(academicYear)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(academicYear.id, id))
    .returning();
  return row;
}

export async function findAcademicYear(id: string, institutionId: string) {
  const [row] = await db
    .select()
    .from(academicYear)
    .where(and(eq(academicYear.id, id), eq(academicYear.institutionId, institutionId)))
    .limit(1);
  return row;
}

export async function listTerms(academicYearId: string) {
  return db.select().from(term).where(eq(term.academicYearId, academicYearId)).orderBy(term.index);
}

export async function createTerm(data: { academicYearId: string; index: number; label: string; startsOn: string; endsOn: string }) {
  const [row] = await db.insert(term).values(data).returning();
  return row;
}

export async function updateTerm(id: string, patch: Partial<{ index: number; label: string; startsOn: string; endsOn: string }>) {
  const [row] = await db
    .update(term)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(term.id, id))
    .returning();
  return row;
}

export async function deleteTerm(id: string) {
  await db.delete(term).where(eq(term.id, id));
}

export async function findTerm(id: string) {
  const [row] = await db.select().from(term).where(eq(term.id, id)).limit(1);
  return row;
}

export async function listSubjects(institutionId: string) {
  return db.select().from(subject).where(eq(subject.institutionId, institutionId)).orderBy(subject.nameHy);
}

export async function createSubject(data: { institutionId: string; nameHy: string; nameEn: string; nameRu: string; code?: string }) {
  const [row] = await db.insert(subject).values(data).returning();
  return row;
}

export async function updateSubject(id: string, patch: Partial<{ nameHy: string; nameEn: string; nameRu: string; code: string | null }>) {
  const [row] = await db
    .update(subject)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(subject.id, id))
    .returning();
  return row;
}

export async function deleteSubject(id: string) {
  await db.delete(subject).where(eq(subject.id, id));
}

export async function findSubject(id: string, institutionId: string) {
  const [row] = await db
    .select()
    .from(subject)
    .where(and(eq(subject.id, id), eq(subject.institutionId, institutionId)))
    .limit(1);
  return row;
}

export async function listClasses(institutionId: string, academicYearId?: string) {
  const conditions = academicYearId
    ? and(eq(schoolClass.institutionId, institutionId), eq(schoolClass.academicYearId, academicYearId))
    : eq(schoolClass.institutionId, institutionId);
  return db.select().from(schoolClass).where(conditions).orderBy(schoolClass.grade, schoolClass.letter);
}

export async function findClassesByCombo(academicYearId: string, combos: { grade: number; letter: string }[]) {
  if (combos.length === 0) return [];
  return db
    .select({ grade: schoolClass.grade, letter: schoolClass.letter })
    .from(schoolClass)
    .where(
      and(
        eq(schoolClass.academicYearId, academicYearId),
        inArray(schoolClass.grade, combos.map((c) => c.grade)),
      ),
    );
}

export async function insertClasses(rows: { institutionId: string; academicYearId: string; grade: number; letter: string }[]) {
  if (rows.length === 0) return [];
  return db.insert(schoolClass).values(rows).returning();
}

export async function findClassByLabel(institutionId: string, academicYearId: string, grade: number, letter: string) {
  const [row] = await db
    .select()
    .from(schoolClass)
    .where(
      and(
        eq(schoolClass.institutionId, institutionId),
        eq(schoolClass.academicYearId, academicYearId),
        eq(schoolClass.grade, grade),
        eq(schoolClass.letter, letter),
      ),
    )
    .limit(1);
  return row;
}

export async function findClass(id: string, institutionId: string) {
  const [row] = await db
    .select()
    .from(schoolClass)
    .where(and(eq(schoolClass.id, id), eq(schoolClass.institutionId, institutionId)))
    .limit(1);
  return row;
}

// Roster: student + user + current enrollment, scoped to institution.
export async function listRoster(institutionId: string, filters: { classId?: string; status?: string }) {
  const conditions = [eq(student.institutionId, institutionId)];
  if (filters.classId) conditions.push(eq(enrollment.classId, filters.classId));
  if (filters.status) conditions.push(eq(enrollment.status, filters.status as EnrollmentStatusValue));

  return db
    .select({
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      patronymic: student.patronymic,
      birthDate: student.birthDate,
      email: user.email,
      enrollmentId: enrollment.id,
      classId: enrollment.classId,
      status: enrollment.status,
    })
    .from(student)
    .innerJoin(user, eq(user.id, student.userId))
    .innerJoin(enrollment, eq(enrollment.studentId, student.id))
    .where(and(...conditions))
    .orderBy(student.lastName, student.firstName);
}

export async function findEnrollment(id: string) {
  const [row] = await db.select().from(enrollment).where(eq(enrollment.id, id)).limit(1);
  return row;
}

export async function findActiveEnrollmentForStudentYear(studentId: string, academicYearId: string) {
  const [row] = await db
    .select()
    .from(enrollment)
    .where(and(eq(enrollment.studentId, studentId), eq(enrollment.academicYearId, academicYearId), eq(enrollment.status, "active")))
    .limit(1);
  return row;
}

export async function transitionEnrollment(
  id: string,
  patch: { status: "transferred" | "departed" | "graduated" | "active" },
) {
  const [row] = await db
    .update(enrollment)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(enrollment.id, id))
    .returning();
  return row;
}

export async function createEnrollment(data: { studentId: string; classId: string; academicYearId: string }) {
  const [row] = await db.insert(enrollment).values(data).returning();
  return row;
}

export async function writeAuditLog(entry: {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}) {
  await db.insert(auditLog).values(entry);
}

export async function findStudentByEmail(email: string) {
  const [row] = await db
    .select({ student, userId: user.id })
    .from(student)
    .innerJoin(user, eq(user.id, student.userId))
    .where(eq(user.email, email))
    .limit(1);
  return row;
}

export async function listAssignments(institutionId: string, academicYearId: string) {
  return db
    .select({
      id: teachingAssignment.id,
      teacherId: teachingAssignment.teacherId,
      classId: teachingAssignment.classId,
      subjectId: teachingAssignment.subjectId,
      teacherFirstName: teacher.firstName,
      teacherLastName: teacher.lastName,
    })
    .from(teachingAssignment)
    .innerJoin(teacher, eq(teacher.id, teachingAssignment.teacherId))
    .where(and(eq(teachingAssignment.academicYearId, academicYearId), eq(teacher.institutionId, institutionId)));
}

export async function createAssignment(data: { teacherId: string; classId: string; subjectId: string; academicYearId: string }) {
  const [row] = await db.insert(teachingAssignment).values(data).returning();
  return row;
}

export async function deleteAssignment(id: string) {
  await db.delete(teachingAssignment).where(eq(teachingAssignment.id, id));
}

export async function listTeachers(institutionId: string) {
  return db.select().from(teacher).where(eq(teacher.institutionId, institutionId));
}

export async function findTeacherByEmail(email: string) {
  const [row] = await db
    .select({ teacher, userId: user.id })
    .from(teacher)
    .innerJoin(user, eq(user.id, teacher.userId))
    .where(eq(user.email, email))
    .limit(1);
  return row;
}

// --- Import batches ---

export async function createImportBatch(data: { institutionId: string; actorUserId: string; kind: "students" | "teachers" | "assignments"; filename: string; rowCount: number }) {
  const [row] = await db.insert(importBatch).values(data).returning();
  return row;
}

export async function findImportBatch(id: string, institutionId: string) {
  const [row] = await db
    .select()
    .from(importBatch)
    .where(and(eq(importBatch.id, id), eq(importBatch.institutionId, institutionId)))
    .limit(1);
  return row;
}

export async function insertImportRows(rows: { importBatchId: string; rowIndex: number; raw: unknown; status: "ok" | "warning" | "error"; message: string | null }[]) {
  if (rows.length === 0) return;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(importRow).values(rows.slice(i, i + CHUNK));
  }
}

export async function listImportRows(importBatchId: string) {
  return db.select().from(importRow).where(eq(importRow.importBatchId, importBatchId)).orderBy(importRow.rowIndex);
}

export async function findImportRow(importBatchId: string, rowIndex: number) {
  const [row] = await db
    .select()
    .from(importRow)
    .where(and(eq(importRow.importBatchId, importBatchId), eq(importRow.rowIndex, rowIndex)))
    .limit(1);
  return row;
}

export async function updateImportRow(id: string, patch: { raw?: unknown; status: "ok" | "warning" | "error"; message: string | null }) {
  const [row] = await db
    .update(importRow)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(importRow.id, id))
    .returning();
  return row;
}

export async function updateImportBatchStatus(id: string, patch: { status: "previewing" | "applied" | "discarded"; errorCount?: number; appliedAt?: string }) {
  const [row] = await db
    .update(importBatch)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(importBatch.id, id))
    .returning();
  return row;
}

export async function countErrorRows(importBatchId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(importRow)
    .where(and(eq(importRow.importBatchId, importBatchId), eq(importRow.status, "error")));
  return row?.count ?? 0;
}

// Preview must not be N+1 (roadmap Phase 5 performance section) — load
// every existing student name and every class once into in-memory Maps,
// then validate all rows against those Maps. classesByLabel keys on
// "<grade>-<letter>" (matching the import file's className column format).
export async function loadValidationContext(institutionId: string, academicYearId: string) {
  const classes = await db
    .select({ id: schoolClass.id, grade: schoolClass.grade, letter: schoolClass.letter })
    .from(schoolClass)
    .where(and(eq(schoolClass.institutionId, institutionId), eq(schoolClass.academicYearId, academicYearId)));
  const classesByLabel = new Map(classes.map((c) => [`${c.grade}-${c.letter}`, c.id]));

  const existingStudents = await db
    .select({ id: student.id, firstName: student.firstName, lastName: student.lastName, birthDate: student.birthDate, email: user.email })
    .from(student)
    .innerJoin(user, eq(user.id, student.userId))
    .where(eq(student.institutionId, institutionId));
  const studentsByEmail = new Map(existingStudents.map((s) => [s.email.toLowerCase(), s]));

  const existingEmails = new Set(existingStudents.map((s) => s.email.toLowerCase()));

  const subjects = await db.select({ id: subject.id, nameHy: subject.nameHy }).from(subject).where(eq(subject.institutionId, institutionId));
  const subjectsByName = new Map(subjects.map((s) => [s.nameHy.trim().toLowerCase(), s.id]));

  const teachers = await db
    .select({ id: teacher.id, email: user.email })
    .from(teacher)
    .innerJoin(user, eq(user.id, teacher.userId))
    .where(eq(teacher.institutionId, institutionId));
  const teachersByEmail = new Map(teachers.map((t) => [t.email.toLowerCase(), t.id]));

  return { classesByLabel, studentsByEmail, existingEmails, subjectsByName, teachersByEmail };
}
