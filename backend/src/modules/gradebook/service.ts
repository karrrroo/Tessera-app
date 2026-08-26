import { randomUUID } from "node:crypto";
import { ApiError, FORBIDDEN, NOT_FOUND } from "../../http/errors.js";
import * as repo from "./repo.js";

type AuthClaims = { sub: string; role: "student" | "teacher" | "admin" };

const ASSESSMENT_HAS_MARKS = () => new ApiError(409, "ASSESSMENT_HAS_MARKS");
const PUBLISH_NOTHING_TO_PUBLISH = () => new ApiError(409, "PUBLISH_NOTHING_TO_PUBLISH");
const MARK_NOT_PUBLISHED = () => new ApiError(409, "MARK_NOT_PUBLISHED");
const MARK_ALREADY_SUPERSEDED = () => new ApiError(409, "MARK_ALREADY_SUPERSEDED");
const MARK_VALUE_UNCHANGED = () => new ApiError(422, "MARK_VALUE_UNCHANGED");
const MARK_REASON_REQUIRED = () => new ApiError(422, "MARK_REASON_REQUIRED");

async function requireTeacher(auth: AuthClaims) {
  if (auth.role !== "teacher") throw FORBIDDEN();
  const teacher = await repo.findTeacherByUserId(auth.sub);
  if (!teacher) throw NOT_FOUND();
  return teacher;
}

// Every route verifies a teaching_assignment row exists for (teacher,
// class, subject, year) — absent means NOT_FOUND, not FORBIDDEN (roadmap
// brief §13 S-4 / PRD §3.1): a teacher probing a class that isn't theirs
// should not learn the class exists at all.
async function requireAssignment(teacherId: string, classId: string, subjectId: string, academicYearId?: string) {
  const assignment = await repo.findAssignment(teacherId, classId, subjectId, academicYearId);
  if (!assignment) throw NOT_FOUND();
  return assignment;
}

export async function getTeacherClasses(auth: AuthClaims) {
  const teacher = await requireTeacher(auth);
  const assignments = await repo.findTeacherAssignments(teacher.id);

  return Promise.all(
    assignments.map(async (a) => {
      const terms = await repo.findTermsForYear(a.academicYearId);
      const term = terms[0]; // same default-term convention as Phase 7 (D-37)
      const [studentCount, draftCount] = await Promise.all([
        repo.countActiveStudents(a.classId),
        term ? repo.countDrafts(a.classId, a.subjectId, term.id) : Promise.resolve(0),
      ]);
      return {
        classId: a.classId,
        subjectId: a.subjectId,
        termId: term?.id ?? null,
        academicYearId: a.academicYearId,
        classLabel: `${a.grade}-${a.letter}`,
        subjectNameHy: a.subjectNameHy,
        subjectNameEn: a.subjectNameEn,
        subjectNameRu: a.subjectNameRu,
        studentCount,
        draftCount,
      };
    }),
  );
}

export async function getGradebook(auth: AuthClaims, classId: string, subjectId: string, termId: string) {
  const teacher = await requireTeacher(auth);
  const termRow = await repo.findTermById(termId);
  if (!termRow) throw NOT_FOUND();
  await requireAssignment(teacher.id, classId, subjectId, termRow.academicYearId);

  const [students, assessments, marks] = await Promise.all([
    repo.findStudentsForClass(classId),
    repo.findAssessmentsForGradebook(classId, subjectId, termId),
    repo.findMarksForGradebook(classId, subjectId, termId),
  ]);

  return {
    class: { id: classId },
    subject: { id: subjectId },
    term: { id: termRow.id, label: termRow.label },
    students: students.map((s) => ({ id: s.id, firstName: s.first_name, lastName: s.last_name, enrollmentStatus: s.status })),
    assessments,
    marks: marks.map((m) => ({
      id: m.id,
      assessmentId: m.assessmentId,
      studentId: m.studentId,
      value: m.value,
      state: m.state,
      enteredAt: m.enteredAt,
      hasHistory: m.hasHistory,
    })),
  };
}

export async function createAssessment(
  auth: AuthClaims,
  input: { classId: string; subjectId: string; termId: string; heldOn?: string; kind: string; title?: string; topic?: string },
) {
  const teacher = await requireTeacher(auth);
  const termRow = await repo.findTermById(input.termId);
  if (!termRow) throw NOT_FOUND();
  await requireAssignment(teacher.id, input.classId, input.subjectId, termRow.academicYearId);

  // GB-10: heldOn defaults to today — the one place in this codebase a
  // gradebook write is allowed to read the clock, since a new column has
  // to start somewhere and "today" is exactly what pressing `+` means.
  const heldOn = input.heldOn ?? new Date().toISOString().slice(0, 10);

  return repo.insertAssessment({
    classId: input.classId,
    subjectId: input.subjectId,
    termId: input.termId,
    heldOn,
    kind: input.kind,
    title: input.title,
    topic: input.topic,
    teacherId: teacher.id,
  });
}

export async function patchAssessment(auth: AuthClaims, assessmentId: string, patch: { title?: string | null; topic?: string | null; heldOn?: string }) {
  const teacher = await requireTeacher(auth);
  const found = await repo.findAssessmentById(assessmentId);
  if (!found) throw NOT_FOUND();
  await requireAssignment(teacher.id, found.classId, found.subjectId);
  return repo.patchAssessment(assessmentId, patch);
}

export async function deleteAssessment(auth: AuthClaims, assessmentId: string) {
  const teacher = await requireTeacher(auth);
  const found = await repo.findAssessmentById(assessmentId);
  if (!found) throw NOT_FOUND();
  await requireAssignment(teacher.id, found.classId, found.subjectId);

  const markCount = await repo.countMarksForAssessment(assessmentId);
  if (markCount > 0) throw ASSESSMENT_HAS_MARKS();
  await repo.deleteAssessment(assessmentId);
}

const pairKey = (assessmentId: string, studentId: string) => `${assessmentId}:${studentId}`;

export async function putMarks(
  auth: AuthClaims,
  input: { classId: string; subjectId: string; termId: string; items: { assessmentId: string; studentId: string; value: number | null }[] },
) {
  const teacher = await requireTeacher(auth);
  const termRow = await repo.findTermById(input.termId);
  if (!termRow) throw NOT_FOUND();
  await requireAssignment(teacher.id, input.classId, input.subjectId, termRow.academicYearId);

  const enrolledIds = await repo.findEnrolledStudentIds(input.classId);
  const assessments = await repo.findAssessmentsForGradebook(input.classId, input.subjectId, input.termId);
  const assessmentIds = new Set(assessments.map((a) => a.id));

  const rejected: { assessmentId: string; studentId: string; code: string; currentMarkId?: string; currentValue?: number }[] = [];
  const toUpsert: { assessmentId: string; studentId: string; value: number }[] = [];
  const toDelete: { assessmentId: string; studentId: string }[] = [];

  for (const item of input.items) {
    if (!enrolledIds.has(item.studentId)) {
      rejected.push({ assessmentId: item.assessmentId, studentId: item.studentId, code: "MARK_STUDENT_NOT_IN_CLASS" });
    } else if (!assessmentIds.has(item.assessmentId)) {
      rejected.push({ assessmentId: item.assessmentId, studentId: item.studentId, code: "MARK_TERM_MISMATCH" });
    } else if (item.value === null) {
      toDelete.push({ assessmentId: item.assessmentId, studentId: item.studentId });
    } else {
      toUpsert.push({ assessmentId: item.assessmentId, studentId: item.studentId, value: item.value });
    }
  }

  const upserted = toUpsert.length > 0 ? await repo.upsertDraftMarks(toUpsert, teacher.id) : [];
  const upsertedPairs = new Set(upserted.map((r) => pairKey(r.assessment_id, r.student_id)));
  const missedUpserts = toUpsert.filter((i) => !upsertedPairs.has(pairKey(i.assessmentId, i.studentId)));

  const deleted = toDelete.length > 0 ? await repo.deleteDraftMarksBatch(toDelete) : [];
  const deletedPairs = new Set(deleted.map((r) => pairKey(r.assessment_id, r.student_id)));
  const missedDeletes = toDelete.filter((i) => !deletedPairs.has(pairKey(i.assessmentId, i.studentId)));

  // Either kind of "miss" has exactly one possible cause: the delete/update
  // statement's own `where state = 'draft'` guard excluded it because the
  // row is currently published — there is no other way for a conflict
  // target to match without the guard passing.
  const missed = [...missedUpserts, ...missedDeletes];
  if (missed.length > 0) {
    const current = await repo.findCurrentMarks(missed);
    const currentByPair = new Map(current.map((c) => [pairKey(c.assessment_id, c.student_id), c]));
    for (const item of missed) {
      const row = currentByPair.get(pairKey(item.assessmentId, item.studentId));
      rejected.push({
        assessmentId: item.assessmentId,
        studentId: item.studentId,
        code: "MARK_ALREADY_PUBLISHED",
        currentMarkId: row?.id,
        currentValue: row?.value,
      });
    }
  }

  return {
    marks: upserted.map((r) => ({ id: r.id, assessmentId: r.assessment_id, studentId: r.student_id, value: r.value, state: r.state })),
    deleted: deleted.map((d) => d.id),
    rejected,
  };
}

export async function deleteMark(auth: AuthClaims, markId: string) {
  const teacher = await requireTeacher(auth);
  const found = await repo.findDraftMarkById(markId);
  if (!found) throw NOT_FOUND();
  const assessmentRow = await repo.findAssessmentById(found.assessmentId);
  if (!assessmentRow) throw NOT_FOUND();
  await requireAssignment(teacher.id, assessmentRow.classId, assessmentRow.subjectId);
  await repo.deleteMarkById(markId);
}

export async function publishMarks(auth: AuthClaims, input: { classId: string; subjectId: string; termId: string }, idempotencyKey?: string) {
  const teacher = await requireTeacher(auth);
  const termRow = await repo.findTermById(input.termId);
  if (!termRow) throw NOT_FOUND();
  await requireAssignment(teacher.id, input.classId, input.subjectId, termRow.academicYearId);

  if (idempotencyKey) {
    const existing = await repo.findPublishByIdempotencyKey(idempotencyKey);
    // Shaped identically to a fresh publish's response — the stored
    // record carries more (class/subject/term, the key itself) purely for
    // this lookup, none of which belongs in the response twice.
    if (existing) return { publishedCount: existing.publishedCount, publishedAt: existing.publishedAt, batchId: existing.batchId };
  }

  const published = await repo.publishDrafts(input.classId, input.subjectId, input.termId);
  if (published.length === 0) throw PUBLISH_NOTHING_TO_PUBLISH();

  const publishedAt = new Date().toISOString();
  const batchId = randomUUID();
  await repo.writePublishAuditLog({
    actorUserId: auth.sub,
    classId: input.classId,
    subjectId: input.subjectId,
    termId: input.termId,
    publishedCount: published.length,
    publishedAt,
    batchId,
    idempotencyKey,
  });

  return { publishedCount: published.length, publishedAt, batchId };
}

export async function supersedeMark(auth: AuthClaims, markId: string, input: { value: number; reason: string }) {
  const teacher = await requireTeacher(auth);
  const found = await repo.findMarkById(markId);
  if (!found) throw NOT_FOUND();
  const assessmentRow = await repo.findAssessmentById(found.assessmentId);
  if (!assessmentRow) throw NOT_FOUND();
  await requireAssignment(teacher.id, assessmentRow.classId, assessmentRow.subjectId);

  if (found.state === "draft") throw MARK_NOT_PUBLISHED();
  if (found.state === "superseded") throw MARK_ALREADY_SUPERSEDED();
  if (found.value === input.value) throw MARK_VALUE_UNCHANGED();

  // Three layers, deliberately (roadmap): client-side (submit disabled),
  // this one, and the database's own `reason_required_when_superseding`
  // check constraint — which only catches NULL, not whitespace, so this
  // layer is the one that actually enforces "empty or whitespace".
  const reason = input.reason.trim();
  if (!reason) throw MARK_REASON_REQUIRED();

  const result = await repo.supersedeMark({
    oldMarkId: markId,
    assessmentId: found.assessmentId,
    studentId: found.studentId,
    value: input.value,
    reason,
    teacherId: teacher.id,
  });
  return { mark: result, supersededMarkId: markId };
}

export async function getMarkHistory(auth: AuthClaims, markId: string) {
  const teacher = await requireTeacher(auth);
  const chain = await repo.findMarkChain(markId);
  if (chain.length === 0) throw NOT_FOUND();

  const assessmentRow = await repo.findAssessmentById(chain[chain.length - 1].assessmentId);
  if (!assessmentRow) throw NOT_FOUND();
  await requireAssignment(teacher.id, assessmentRow.classId, assessmentRow.subjectId);

  const teacherIds = [...new Set(chain.map((m) => m.enteredByTeacherId))];
  const teachers = await repo.findTeacherNames(teacherIds);
  const nameById = new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`]));

  const steps = [];
  for (let i = 1; i < chain.length; i++) {
    const from = chain[i - 1];
    const to = chain[i];
    steps.push({ fromValue: from.value, toValue: to.value, reason: to.reason, at: to.enteredAt, actorName: nameById.get(to.enteredByTeacherId) ?? null });
  }
  return { markId: chain[chain.length - 1].id, currentValue: chain[chain.length - 1].value, steps };
}
