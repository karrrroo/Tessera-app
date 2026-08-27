import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { student, teacher, user, enrollment, importBatch, schoolClass, teachingAssignment } from "../../db/schema.js";
import { ApiError, NOT_FOUND, VALIDATION_FAILED } from "../../http/errors.js";
import { hashPassword } from "../auth/password.js";
import { generateTemporaryPassword } from "./temp-password.js";
import { buildSubjects, resolveTermOrThrow } from "../record/service.js";
import { findTermsForYear } from "../record/repo.js";
import * as repo from "./repo.js";
import * as search from "./search.js";
import * as xlsx from "./xlsx.js";
import { validateStudentRow, validateTeacherRow, type RowValidation } from "./import-validation.js";
import { GENERATE_RANGE_MAX, IMPORT_MAX_ROWS, IMPORT_PREVIEW_TTL_HOURS } from "./validation.js";
import type { ImportKind } from "./xlsx.js";

// --- Institution ---

export async function getInstitution(institutionId: string) {
  const row = await repo.getInstitution(institutionId);
  if (!row) throw NOT_FOUND();
  return row;
}

export async function updateInstitution(institutionId: string, patch: { name?: string; region?: string; type?: string }) {
  return repo.updateInstitution(institutionId, patch);
}

// --- Academic years ---

export async function listAcademicYears(institutionId: string) {
  return repo.listAcademicYears(institutionId);
}

export async function createAcademicYear(institutionId: string, data: { label: string; startsOn: string; endsOn: string }) {
  if (new Date(data.endsOn) <= new Date(data.startsOn)) {
    throw VALIDATION_FAILED({ field: "endsOn" });
  }
  return repo.createAcademicYear(institutionId, data);
}

export async function updateAcademicYear(id: string, institutionId: string, patch: Partial<{ label: string; startsOn: string; endsOn: string }>) {
  const existing = await repo.findAcademicYear(id, institutionId);
  if (!existing) throw NOT_FOUND();
  return repo.updateAcademicYear(id, patch);
}

// --- Terms ---

export async function listTerms(academicYearId: string, institutionId: string) {
  const year = await repo.findAcademicYear(academicYearId, institutionId);
  if (!year) throw NOT_FOUND();
  return repo.listTerms(academicYearId);
}

export async function createTerm(institutionId: string, data: { academicYearId: string; index: number; label: string; startsOn: string; endsOn: string }) {
  const year = await repo.findAcademicYear(data.academicYearId, institutionId);
  if (!year) throw NOT_FOUND();
  if (new Date(data.endsOn) <= new Date(data.startsOn)) throw VALIDATION_FAILED({ field: "endsOn" });
  return repo.createTerm(data);
}

export async function updateTerm(id: string, institutionId: string, patch: Partial<{ index: number; label: string; startsOn: string; endsOn: string }>) {
  const existingTerm = await repo.findTerm(id);
  if (!existingTerm) throw NOT_FOUND();
  const year = await repo.findAcademicYear(existingTerm.academicYearId, institutionId);
  if (!year) throw NOT_FOUND();
  return repo.updateTerm(id, patch);
}

export async function deleteTerm(id: string, institutionId: string) {
  const existingTerm = await repo.findTerm(id);
  if (!existingTerm) throw NOT_FOUND();
  const year = await repo.findAcademicYear(existingTerm.academicYearId, institutionId);
  if (!year) throw NOT_FOUND();
  await repo.deleteTerm(id);
}

// --- Subjects ---

export async function listSubjects(institutionId: string) {
  return repo.listSubjects(institutionId);
}

export async function createSubject(institutionId: string, data: { nameHy: string; nameEn: string; nameRu: string; code?: string }) {
  return repo.createSubject({ institutionId, ...data });
}

export async function updateSubject(id: string, institutionId: string, patch: Partial<{ nameHy: string; nameEn: string; nameRu: string; code: string | null }>) {
  const existing = await repo.findSubject(id, institutionId);
  if (!existing) throw NOT_FOUND();
  return repo.updateSubject(id, patch);
}

export async function deleteSubject(id: string, institutionId: string) {
  const existing = await repo.findSubject(id, institutionId);
  if (!existing) throw NOT_FOUND();
  await repo.deleteSubject(id);
}

// --- Classes + generator ---

export async function listClasses(institutionId: string, academicYearId?: string) {
  return repo.listClasses(institutionId, academicYearId);
}

export async function createClass(institutionId: string, data: { academicYearId: string; grade: number; letter: string }) {
  const year = await repo.findAcademicYear(data.academicYearId, institutionId);
  if (!year) throw NOT_FOUND();
  const [row] = await repo.insertClasses([{ institutionId, ...data }]);
  return row;
}

export async function generateClasses(institutionId: string, data: { academicYearId: string; grades: number[]; letters: string[] }) {
  const year = await repo.findAcademicYear(data.academicYearId, institutionId);
  if (!year) throw NOT_FOUND();

  const combos = data.grades.flatMap((grade) => data.letters.map((letter) => ({ grade, letter })));
  if (combos.length > GENERATE_RANGE_MAX) {
    throw new ApiError(422, "GENERATE_RANGE_TOO_LARGE", { details: { max: GENERATE_RANGE_MAX } });
  }

  const existing = await repo.findClassesByCombo(data.academicYearId, combos);
  const existingKeys = new Set(existing.map((e) => `${e.grade}-${e.letter}`));

  const toCreate = combos.filter((c) => !existingKeys.has(`${c.grade}-${c.letter}`));
  const skipped = combos.filter((c) => existingKeys.has(`${c.grade}-${c.letter}`));

  const created = await repo.insertClasses(
    toCreate.map((c) => ({ institutionId, academicYearId: data.academicYearId, grade: c.grade, letter: c.letter })),
  );

  return {
    created: created.map((c) => ({ id: c.id, grade: c.grade, letter: c.letter })),
    skipped: skipped.map((c) => ({ grade: c.grade, letter: c.letter, code: "CLASS_ALREADY_EXISTS" })),
  };
}

// --- Roster ---

export async function listRoster(
  institutionId: string,
  filters: { classId?: string; status?: string; q?: string },
) {
  return repo.listRoster(institutionId, filters);
}

// The admin-side counterpart of GET /api/me/record: one student's marks for
// one term, plus enough identity to be sure it is the right student. The
// per-subject aggregation is record/service's `buildSubjects`, called rather
// than reimplemented, so what an admin reads and what the student reads can
// never disagree.
export async function getStudentDetail(institutionId: string, studentId: string, requestedTermId?: string) {
  const detail = await repo.findStudentDetail(studentId, institutionId);
  if (!detail) throw NOT_FOUND();

  const [terms, term] = await Promise.all([
    findTermsForYear(detail.academicYearId),
    resolveTermOrThrow(detail.academicYearId, requestedTermId),
  ]);
  const subjects = await buildSubjects(detail.studentId, detail.classId, detail.academicYearId, term.id);

  return {
    student: {
      id: detail.studentId,
      firstName: detail.firstName,
      lastName: detail.lastName,
      patronymic: detail.patronymic,
      birthDate: detail.birthDate,
      email: detail.email,
      locale: detail.locale,
      mustChangePassword: detail.mustChangePassword,
      lastLoginAt: detail.lastLoginAt,
    },
    enrollment: {
      id: detail.enrollmentId,
      status: detail.status,
      classId: detail.classId,
      classLabel: detail.classLabel,
      academicYearId: detail.academicYearId,
      yearLabel: detail.yearLabel,
    },
    term: { id: term.id, label: term.label, index: term.index },
    availableTerms: terms.map((t) => ({ id: t.id, label: t.label, index: t.index })),
    subjects,
  };
}

// --- People search (admin) ---

export async function searchStudents(institutionId: string, opts: { q: string; limit: number; offset: number }) {
  return search.searchStudents(institutionId, opts);
}

// Teacher hits carry what they teach. The assignment rows come from
// `repo.listAssignments` — the exact query the assignment grid already uses —
// and the subject/class lookups are the same two lists the grid already
// fetches, so there is one assignments query in the codebase, not two.
//
// Subject names are returned in all three languages rather than pre-resolved
// to one string: every other subject-bearing response in this app does the
// same and the client picks by active locale. Returning a single Armenian
// string here would reintroduce exactly the untranslated-copy bug that the
// term labels had.
export async function searchTeachers(institutionId: string, opts: { q: string; limit: number; offset: number }) {
  const page = await search.searchTeachers(institutionId, opts);
  if (page.items.length === 0) return { items: [], total: page.total };

  const years = await repo.listAcademicYears(institutionId);
  const currentYear = years.at(-1); // listAcademicYears orders by startsOn ascending
  if (!currentYear) return { items: page.items.map((t) => ({ ...t, assignments: [] })), total: page.total };

  const [assignments, subjects, classes] = await Promise.all([
    repo.listAssignments(institutionId, currentYear.id),
    repo.listSubjects(institutionId),
    repo.listClasses(institutionId, currentYear.id),
  ]);
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const classById = new Map(classes.map((c) => [c.id, c]));

  const byTeacher = new Map<string, { subjectId: string; nameHy: string; nameEn: string; nameRu: string; className: string }[]>();
  for (const a of assignments) {
    const s = subjectById.get(a.subjectId);
    const c = classById.get(a.classId);
    if (!s || !c) continue; // an assignment pointing at another year's class
    const list = byTeacher.get(a.teacherId) ?? [];
    list.push({ subjectId: s.id, nameHy: s.nameHy, nameEn: s.nameEn, nameRu: s.nameRu, className: `${c.grade}-${c.letter}` });
    byTeacher.set(a.teacherId, list);
  }

  return {
    items: page.items.map((t) => ({ ...t, assignments: byTeacher.get(t.id) ?? [] })),
    total: page.total,
  };
}

export async function addMidYearStudent(
  institutionId: string,
  data: { classId: string; firstName: string; lastName: string; patronymic?: string; birthDate?: string; email: string },
) {
  const cls = await repo.findClass(data.classId, institutionId);
  if (!cls) throw NOT_FOUND();

  // The plaintext is returned to the caller exactly once, the same contract
  // the class-handout path already uses (`reissueClassCredentials`): it is
  // never stored, and never recoverable afterwards. Previously it was
  // generated, hashed and dropped on the floor, so a newly created student
  // had a password no one alive knew.
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  return db.transaction(async (tx) => {
    const [u] = await tx
      .insert(user)
      .values({ email: data.email, passwordHash, role: "student", mustChangePassword: true })
      .returning();
    const [s] = await tx
      .insert(student)
      .values({
        userId: u.id,
        institutionId,
        firstName: data.firstName,
        lastName: data.lastName,
        patronymic: data.patronymic,
        birthDate: data.birthDate,
      })
      .returning();
    const [e] = await tx
      .insert(enrollment)
      .values({ studentId: s.id, classId: data.classId, academicYearId: cls.academicYearId })
      .returning();
    return { student: s, enrollment: e, login: u.email, temporaryPassword };
  });
}

/**
 * Creates one teacher account: a `user` row and a `teacher` row, in one
 * transaction, with a temporary password returned exactly once.
 *
 * The same contract as `addMidYearStudent` and `reissueClassCredentials`: the
 * plaintext is generated here, shown to the admin once, and never stored or
 * recoverable afterwards; the account starts with `mustChangePassword` so the
 * first thing the teacher does is replace it.
 *
 * No class and no teaching assignment. A teacher's classes are assignments
 * made on /admin/assignments against a specific academic year, subject and
 * term, and a teacher with none is a valid record — someone hired before the
 * timetable exists. Bundling an assignment into account creation would mean
 * either inventing a default or refusing to create a teacher until the
 * timetable is ready.
 *
 * A duplicate email needs no handling here: `user.email` is citext UNIQUE and
 * db/pg-errors.ts already maps that constraint to 409 USER_EMAIL_TAKEN, which
 * is how the student path reports it too.
 */
export async function addTeacher(
  institutionId: string,
  data: { firstName: string; lastName: string; patronymic?: string; email: string; emisTeacherId?: string },
) {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  return db.transaction(async (tx) => {
    const [u] = await tx
      .insert(user)
      .values({ email: data.email, passwordHash, role: "teacher", mustChangePassword: true })
      .returning();
    const [t] = await tx
      .insert(teacher)
      .values({
        userId: u.id,
        institutionId,
        firstName: data.firstName,
        lastName: data.lastName,
        patronymic: data.patronymic,
        emisTeacherId: data.emisTeacherId,
      })
      .returning();
    return { teacher: t, login: u.email, temporaryPassword };
  });
}

// `enrollment` has an unconditional `unique(student_id, academic_year_id)`
// constraint (tessera-schema.sql) — a student can have exactly one row per
// year, full stop. The roadmap's own acceptance test for this endpoint
// ("the old enrollment reads transferred, a new active one exists") assumes
// two rows can coexist for one student-year, which this schema makes
// impossible; C2 forbids changing it to allow that. Resolved as: a transfer
// is an in-place update of the same row's classId (status stays "active" —
// the student IS actively enrolled, just in a different class), with the
// change recorded to audit_log so the transfer event itself has a durable
// record. "Prior marks stay attached to the old class" — the other half of
// that Done-when item — holds regardless of how enrollment is modeled,
// because assessment/mark reference class_id directly, never through
// enrollment. See docs/decisions.md.
export async function transitionEnrollment(
  id: string,
  actorUserId: string,
  patch: { status: "transferred"; toClassId: string } | { status: "departed" } | { status: "graduated" },
) {
  const current = await repo.findEnrollment(id);
  if (!current) throw NOT_FOUND();

  const ALLOWED: Record<string, string[]> = {
    active: ["transferred", "departed", "graduated"],
    transferred: [],
    departed: [],
    graduated: [],
  };
  if (!ALLOWED[current.status]?.includes(patch.status)) {
    throw new ApiError(409, "ENROLLMENT_TRANSITION_INVALID", {
      details: { from: current.status, allowed: ALLOWED[current.status] ?? [] },
    });
  }

  if (patch.status === "transferred") {
    const [targetClass] = await db.select().from(schoolClass).where(eq(schoolClass.id, patch.toClassId)).limit(1);
    if (!targetClass || targetClass.academicYearId !== current.academicYearId) {
      throw new ApiError(422, "ENROLLMENT_TARGET_CLASS_INVALID");
    }
    const [updated] = await db
      .update(enrollment)
      .set({ classId: patch.toClassId, updatedAt: new Date().toISOString() })
      .where(eq(enrollment.id, id))
      .returning();
    await repo.writeAuditLog({
      actorUserId,
      action: "enrollment.transfer",
      entityType: "enrollment",
      entityId: id,
      before: { classId: current.classId, status: current.status },
      after: { classId: patch.toClassId, status: "active" },
    });
    return updated;
  }

  const updated = await repo.transitionEnrollment(id, { status: patch.status });
  await repo.writeAuditLog({
    actorUserId,
    action: `enrollment.${patch.status}`,
    entityType: "enrollment",
    entityId: id,
    before: { status: current.status },
    after: { status: patch.status },
  });
  return updated;
}

// --- Assignments ---

export async function listTeachers(institutionId: string) {
  return repo.listTeachers(institutionId);
}

export async function listAssignments(institutionId: string, academicYearId: string) {
  return repo.listAssignments(institutionId, academicYearId);
}

export async function createAssignment(data: { teacherId: string; classId: string; subjectId: string; academicYearId: string }) {
  return repo.createAssignment(data);
}

export async function deleteAssignment(id: string) {
  await repo.deleteAssignment(id);
}

// --- Import: template ---

export async function getImportTemplate(kind: ImportKind) {
  return xlsx.buildTemplate(kind);
}

// --- Import: preview ---

export async function previewImport(
  institutionId: string,
  actorUserId: string,
  academicYearId: string,
  kind: ImportKind,
  filename: string,
  buffer: Buffer,
) {
  const rows = await xlsx.parseUpload(buffer, kind);
  if (rows.length > IMPORT_MAX_ROWS) {
    throw new ApiError(422, "IMPORT_TOO_MANY_ROWS", { details: { max: IMPORT_MAX_ROWS, found: rows.length } });
  }

  const context = await repo.loadValidationContext(institutionId, academicYearId);
  const year = await repo.findAcademicYear(academicYearId, institutionId);
  if (!year) throw NOT_FOUND();

  const emailsSeenInFile = new Map<string, number>();
  rows.forEach((row, i) => {
    const email = row.email?.trim().toLowerCase();
    if (email && !emailsSeenInFile.has(email)) emailsSeenInFile.set(email, i + 1);
  });

  const validations: RowValidation[] = rows.map((row, i) =>
    kind === "students"
      ? validateStudentRow(row, i + 1, { ...context, academicYearStartsOn: year.startsOn }, emailsSeenInFile)
      : validateTeacherRow(row, i + 1, context, emailsSeenInFile),
  );

  const batch = await repo.createImportBatch({
    institutionId,
    actorUserId,
    kind,
    filename,
    rowCount: rows.length,
  });

  await repo.insertImportRows(
    rows.map((row, i) => ({
      importBatchId: batch.id,
      rowIndex: i + 1,
      raw: row,
      status: validations[i].status,
      message: validations[i].issues.length > 0 ? JSON.stringify(validations[i].issues) : null,
    })),
  );

  const errorCount = validations.filter((v) => v.status === "error").length;
  await repo.updateImportBatchStatus(batch.id, { status: "previewing", errorCount });

  return shapeBatchResponse(batch.id, institutionId, kind, filename, rows.length, errorCount, rows, validations);
}

function shapeBatchResponse(
  batchId: string,
  _institutionId: string,
  kind: ImportKind,
  filename: string,
  rowCount: number,
  errorCount: number,
  rows: xlsx.ParsedRow[],
  validations: RowValidation[],
) {
  const warningCount = validations.filter((v) => v.status === "warning").length;
  return {
    batchId,
    kind,
    filename,
    rowCount,
    errorCount,
    warningCount,
    status: "previewing" as const,
    rows: rows.map((raw, i) => ({
      rowIndex: i + 1,
      status: validations[i].status,
      raw,
      ...(validations[i].issues.length > 0 ? { issues: validations[i].issues } : {}),
      ...(Object.keys(validations[i].resolved).length > 0 ? { resolved: validations[i].resolved } : {}),
    })),
  };
}

// --- Import: re-read a preview ---

export async function getImportBatch(batchId: string, institutionId: string, academicYearId: string) {
  const batch = await repo.findImportBatch(batchId, institutionId);
  if (!batch) throw NOT_FOUND();
  const rows = await repo.listImportRows(batchId);
  const context = await repo.loadValidationContext(institutionId, academicYearId);
  const year = await repo.findAcademicYear(academicYearId, institutionId);

  const emailsSeenInFile = new Map<string, number>();
  rows.forEach((row) => {
    const raw = row.raw as xlsx.ParsedRow;
    const email = raw.email?.trim().toLowerCase();
    if (email && !emailsSeenInFile.has(email)) emailsSeenInFile.set(email, row.rowIndex);
  });

  const rawRows = rows.map((r) => r.raw as xlsx.ParsedRow);
  const validations = rows.map((r) =>
    batch.kind === "students"
      ? validateStudentRow(r.raw as xlsx.ParsedRow, r.rowIndex, { ...context, academicYearStartsOn: year?.startsOn ?? "1900-01-01" }, emailsSeenInFile)
      : validateTeacherRow(r.raw as xlsx.ParsedRow, r.rowIndex, context, emailsSeenInFile),
  );
  const errorCount = validations.filter((v) => v.status === "error").length;

  // importKind's DB enum also has "assignments" (unused — this pipeline
  // never creates a batch with that kind; assignments are entered through
  // AssignmentGrid, not a spreadsheet upload), so this narrows safely.
  const kind = batch.kind as ImportKind;
  return shapeBatchResponse(batch.id, institutionId, kind, batch.filename, batch.rowCount, errorCount, rawRows, validations);
}

// --- Import: patch one row ---

export async function patchImportRow(
  batchId: string,
  rowIndex: number,
  institutionId: string,
  academicYearId: string,
  newRaw: Record<string, unknown>,
) {
  const batch = await repo.findImportBatch(batchId, institutionId);
  if (!batch) throw NOT_FOUND();
  if (batch.status !== "previewing") throw new ApiError(409, "IMPORT_BATCH_NOT_PREVIEWING");

  const existingRow = await repo.findImportRow(batchId, rowIndex);
  if (!existingRow) throw NOT_FOUND();

  const merged = { ...(existingRow.raw as Record<string, unknown>), ...newRaw } as xlsx.ParsedRow;
  const context = await repo.loadValidationContext(institutionId, academicYearId);
  const year = await repo.findAcademicYear(academicYearId, institutionId);

  const allRows = await repo.listImportRows(batchId);
  const emailsSeenInFile = new Map<string, number>();
  allRows.forEach((r) => {
    const raw = r.rowIndex === rowIndex ? merged : (r.raw as xlsx.ParsedRow);
    const email = raw.email?.trim().toLowerCase();
    if (email && !emailsSeenInFile.has(email)) emailsSeenInFile.set(email, r.rowIndex);
  });

  const validation =
    batch.kind === "students"
      ? validateStudentRow(merged, rowIndex, { ...context, academicYearStartsOn: year?.startsOn ?? "1900-01-01" }, emailsSeenInFile)
      : validateTeacherRow(merged, rowIndex, context, emailsSeenInFile);

  const updated = await repo.updateImportRow(existingRow.id, {
    raw: merged,
    status: validation.status,
    message: validation.issues.length > 0 ? JSON.stringify(validation.issues) : null,
  });

  const errorCount = await repo.countErrorRows(batchId);
  await repo.updateImportBatchStatus(batchId, { status: "previewing", errorCount });

  return {
    rowIndex: updated.rowIndex,
    status: updated.status,
    raw: merged,
    ...(validation.issues.length > 0 ? { issues: validation.issues } : {}),
    ...(Object.keys(validation.resolved).length > 0 ? { resolved: validation.resolved } : {}),
  };
}

// --- Import: discard ---

export async function discardImport(batchId: string, institutionId: string) {
  const batch = await repo.findImportBatch(batchId, institutionId);
  if (!batch) throw NOT_FOUND();
  if (batch.status !== "previewing") throw new ApiError(409, "IMPORT_BATCH_NOT_PREVIEWING");
  await repo.updateImportBatchStatus(batchId, { status: "discarded" });
}

// --- Import: apply ---

const HOURS_TO_MS = 3600_000;

export async function applyImport(batchId: string, institutionId: string, academicYearId: string) {
  const batch = await repo.findImportBatch(batchId, institutionId);
  if (!batch) throw NOT_FOUND();
  if (batch.status !== "previewing") throw new ApiError(409, "IMPORT_BATCH_NOT_PREVIEWING");

  const ageMs = Date.now() - new Date(batch.createdAt).getTime();
  if (ageMs > IMPORT_PREVIEW_TTL_HOURS * HOURS_TO_MS) {
    throw new ApiError(410, "IMPORT_BATCH_EXPIRED");
  }

  const errorCount = await repo.countErrorRows(batchId);
  if (errorCount > 0) {
    const rows = await repo.listImportRows(batchId);
    const errorRowIndexes = rows.filter((r) => r.status === "error").map((r) => r.rowIndex);
    throw new ApiError(409, "IMPORT_HAS_ERRORS", { details: { errorRowIndexes } });
  }

  const rows = await repo.listImportRows(batchId);

  // Re-resolve every row through the same validators the preview used
  // (rather than re-deriving classId/subjectId ad hoc here) so apply can
  // never disagree with what the admin already reviewed on screen.
  const context = await repo.loadValidationContext(institutionId, academicYearId);
  const year = await repo.findAcademicYear(academicYearId, institutionId);
  const emailsSeenInFile = new Map<string, number>();
  rows.forEach((r) => {
    const raw = r.raw as xlsx.ParsedRow;
    const email = raw.email?.trim().toLowerCase();
    if (email && !emailsSeenInFile.has(email)) emailsSeenInFile.set(email, r.rowIndex);
  });
  const resolutions = rows.map((r) =>
    batch.kind === "students"
      ? validateStudentRow(r.raw as xlsx.ParsedRow, r.rowIndex, { ...context, academicYearStartsOn: year?.startsOn ?? "1900-01-01" }, emailsSeenInFile)
      : validateTeacherRow(r.raw as xlsx.ParsedRow, r.rowIndex, context, emailsSeenInFile),
  );

  // Argon2 is the real bottleneck, not Postgres (roadmap performance note) —
  // generate every temporary password first, then hash all of them
  // concurrently (argon2's native async hash queues onto libuv's threadpool,
  // sized in src/index.ts to os.cpus().length - 1), then do one bulk insert.
  const plainPasswords = rows.map(() => generateTemporaryPassword());
  const hashes = await Promise.all(plainPasswords.map(hashPassword));

  if (batch.kind === "students") {
    return applyStudentImport(batch.id, institutionId, academicYearId, rows, resolutions, plainPasswords, hashes);
  }
  return applyTeacherImport(batch.id, institutionId, academicYearId, rows, resolutions, plainPasswords, hashes);
}

async function applyStudentImport(
  batchId: string,
  institutionId: string,
  academicYearId: string,
  rows: Awaited<ReturnType<typeof repo.listImportRows>>,
  resolutions: RowValidation[],
  plainPasswords: string[],
  hashes: string[],
) {
  const credentials: { studentId: string; fullName: string; login: string; temporaryPassword: string; classLabel: string }[] = [];

  const result = await db.transaction(async (tx) => {
    const CHUNK = 500;
    let createdUsers = 0;
    let createdStudents = 0;
    let createdEnrollments = 0;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const usersToInsert = slice.map((r, j) => {
        const raw = r.raw as xlsx.ParsedRow;
        return { email: raw.email.trim(), passwordHash: hashes[i + j], role: "student" as const, mustChangePassword: true };
      });
      const insertedUsers = await tx.insert(user).values(usersToInsert).returning();

      const studentsToInsert = slice.map((r, j) => {
        const raw = r.raw as xlsx.ParsedRow;
        return {
          userId: insertedUsers[j].id,
          institutionId,
          firstName: raw.firstName.trim(),
          lastName: raw.lastName.trim(),
          patronymic: raw.patronymic?.trim() || undefined,
          birthDate: raw.birthDate?.trim() || undefined,
        };
      });
      const insertedStudents = await tx.insert(student).values(studentsToInsert).returning();

      const enrollmentsToInsert = slice.map((r, j) => {
        const classId = resolutions[i + j].resolved.classId as string;
        return { studentId: insertedStudents[j].id, classId, academicYearId };
      });
      await tx.insert(enrollment).values(enrollmentsToInsert);

      for (let j = 0; j < slice.length; j++) {
        const raw = slice[j].raw as xlsx.ParsedRow;
        credentials.push({
          studentId: insertedStudents[j].id,
          fullName: `${raw.firstName.trim()} ${raw.lastName.trim()}`,
          login: raw.email.trim(),
          temporaryPassword: plainPasswords[i + j],
          classLabel: raw.className.trim(),
        });
      }

      createdUsers += insertedUsers.length;
      createdStudents += insertedStudents.length;
      createdEnrollments += enrollmentsToInsert.length;
    }

    await tx
      .update(importBatch)
      .set({ status: "applied", appliedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(importBatch.id, batchId));

    return { students: createdStudents, users: createdUsers, enrollments: createdEnrollments };
  });

  return { batchId, created: result, credentials };
}

async function applyTeacherImport(
  batchId: string,
  institutionId: string,
  academicYearId: string,
  rows: Awaited<ReturnType<typeof repo.listImportRows>>,
  resolutions: RowValidation[],
  plainPasswords: string[],
  hashes: string[],
) {
  const credentials: { teacherId: string; fullName: string; login: string; temporaryPassword: string }[] = [];

  const result = await db.transaction(async (tx) => {
    const insertedUsers = await tx
      .insert(user)
      .values(
        rows.map((r, i) => {
          const raw = r.raw as xlsx.ParsedRow;
          return { email: raw.email.trim(), passwordHash: hashes[i], role: "teacher" as const, mustChangePassword: true };
        }),
      )
      .returning();

    const insertedTeachers = await tx
      .insert(teacher)
      .values(
        rows.map((r, i) => {
          const raw = r.raw as xlsx.ParsedRow;
          return {
            userId: insertedUsers[i].id,
            institutionId,
            firstName: raw.firstName.trim(),
            lastName: raw.lastName.trim(),
            patronymic: raw.patronymic?.trim() || undefined,
          };
        }),
      )
      .returning();

    // Every (class, subject) pair from the row's "Դասարաններ" column becomes
    // its own teaching_assignment row (roadmap: "for teachers their
    // teaching_assignment rows" — tested directly, Done-when #12).
    const assignmentsToInsert: { teacherId: string; classId: string; subjectId: string; academicYearId: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const subjectId = resolutions[i].resolved.subjectId as string;
      const classIds = (resolutions[i].resolved.classIds as string[]) ?? [];
      for (const classId of classIds) {
        assignmentsToInsert.push({ teacherId: insertedTeachers[i].id, classId, subjectId, academicYearId });
      }
    }
    if (assignmentsToInsert.length > 0) {
      await tx.insert(teachingAssignment).values(assignmentsToInsert);
    }

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i].raw as xlsx.ParsedRow;
      credentials.push({
        teacherId: insertedTeachers[i].id,
        fullName: `${raw.firstName.trim()} ${raw.lastName.trim()}`,
        login: raw.email.trim(),
        temporaryPassword: plainPasswords[i],
      });
    }

    await tx
      .update(importBatch)
      .set({ status: "applied", appliedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(importBatch.id, batchId));

    return { teachers: insertedTeachers.length, users: insertedUsers.length, assignments: assignmentsToInsert.length };
  });

  return { batchId, created: result, credentials };
}

// --- Credential reissue ---

export async function reissueClassCredentials(classId: string, institutionId: string) {
  const cls = await repo.findClass(classId, institutionId);
  if (!cls) throw NOT_FOUND();

  const roster = await repo.listRoster(institutionId, { classId });
  const eligible = roster.filter((r) => r.status === "active");

  const credentials: { studentId: string; fullName: string; login: string; temporaryPassword: string }[] = [];
  const skipped: { studentId: string; code: string }[] = [];

  for (const entry of eligible) {
    const [row] = await db
      .select({ userId: user.id, mustChange: user.mustChangePassword })
      .from(student)
      .innerJoin(user, eq(user.id, student.userId))
      .where(eq(student.id, entry.studentId))
      .limit(1);
    if (row && !row.mustChange) {
      skipped.push({ studentId: entry.studentId, code: "CREDENTIALS_ALREADY_CHANGED" });
      continue;
    }
    const plain = generateTemporaryPassword();
    const hash = await hashPassword(plain);
    await db
      .update(user)
      .set({ passwordHash: hash, mustChangePassword: true, updatedAt: new Date().toISOString() })
      .where(eq(user.id, row.userId));
    credentials.push({
      studentId: entry.studentId,
      fullName: `${entry.firstName} ${entry.lastName}`,
      login: entry.email,
      temporaryPassword: plain,
    });
  }

  return { credentials, skipped };
}
