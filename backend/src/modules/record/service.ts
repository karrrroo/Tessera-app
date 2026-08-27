import { ApiError, FORBIDDEN } from "../../http/errors.js";
import {
  findApprovedAndPendingCredentials,
  findAssignmentsForClass,
  findCurrentEnrollment,
  findMarkById,
  findMarksForStudentTerm,
  findOtherEnrollments,
  findPublishedMarksForYear,
  findStudentByUserId,
  findTeacherNames,
  findTermById,
  findTermsForYear,
  type MarkRow,
} from "./repo.js";

const RECORD_TERM_NOT_FOUND = () => new ApiError(404, "RECORD_TERM_NOT_FOUND");
const RECORD_NO_ENROLLMENT = () => new ApiError(409, "RECORD_NO_ENROLLMENT");

type AuthClaims = { sub: string; role: "student" | "teacher" | "admin" };

function requireStudent(auth: AuthClaims) {
  if (auth.role !== "student") throw FORBIDDEN();
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((a, b) => a + b, 0) / values.length);
}

// "compare the mean of the last three marks to the mean of the three
// before, up/down/flat at a ±0.4 threshold" — needs six marks to form both
// groups; fewer than that, there is no second group to compare against, so
// trend is null rather than a guess from a smaller, non-comparable sample.
function computeTrend(chronologicalValues: number[]): "up" | "down" | "flat" | null {
  if (chronologicalValues.length < 6) return null;
  const last3 = chronologicalValues.slice(-3);
  const prev3 = chronologicalValues.slice(-6, -3);
  const delta = average(last3)! - average(prev3)!;
  if (delta > 0.4) return "up";
  if (delta < -0.4) return "down";
  return "flat";
}

async function resolveEnrollmentOrThrow(userId: string) {
  const student = await findStudentByUserId(userId);
  if (!student) throw RECORD_NO_ENROLLMENT();
  const enr = await findCurrentEnrollment(student.id);
  if (!enr) throw RECORD_NO_ENROLLMENT();
  return { student, enrollment: enr };
}

export async function resolveTermOrThrow(academicYearId: string, requestedTermId?: string) {
  const terms = await findTermsForYear(academicYearId);
  if (terms.length === 0) throw RECORD_TERM_NOT_FOUND();
  if (!requestedTermId) {
    // Defaults to the year's first term by index — simpler and more
    // predictable than picking "whichever term has already started",
    // which this seed data's own dates show can legitimately be none of
    // them (the academic year itself starts a few days in the future).
    return terms[0];
  }
  const found = terms.find((t) => t.id === requestedTermId);
  if (!found) throw RECORD_TERM_NOT_FOUND();
  return found;
}

type SubjectMark = {
  id: string;
  value: number;
  heldOn: string;
  kind: string;
  title: string | null;
  topic: string | null;
  state: "published";
  publishedAt: string | null;
  supersededFrom: { markId: string; value: number; reason: string | null; at: string } | null;
};

// Per assessment, the response carries only the live (published) mark plus
// one level of "what it replaced" — the full chain lives behind
// GET /api/me/marks/:id/history. A superseded row with no live successor
// in this set can't happen: supersede always inserts the replacement in
// the same transaction (PRD §10.3).
function buildSubjectMarks(rows: MarkRow[]): SubjectMark[] {
  const byAssessment = new Map<string, MarkRow[]>();
  for (const row of rows) {
    const group = byAssessment.get(row.assessmentId);
    if (group) group.push(row);
    else byAssessment.set(row.assessmentId, [row]);
  }

  const result: SubjectMark[] = [];
  for (const group of byAssessment.values()) {
    const current = group.find((r) => r.state === "published");
    if (!current) continue;
    const byId = new Map(group.map((r) => [r.markId, r]));
    const prior = current.supersedesMarkId ? byId.get(current.supersedesMarkId) : undefined;
    result.push({
      id: current.markId,
      value: current.value,
      heldOn: current.heldOn,
      kind: current.kind,
      title: current.title,
      topic: current.topic,
      state: "published",
      publishedAt: current.publishedAt,
      supersededFrom: prior
        ? { markId: prior.markId, value: prior.value, reason: current.reason, at: current.enteredAt }
        : null,
    });
  }
  return result.sort((a, b) => a.heldOn.localeCompare(b.heldOn));
}

// Exported for the admin student view (GET /api/admin/students/:id): an admin
// looking at one student needs the same per-subject marks, averages and trends
// a student sees on their own record. Duplicating that aggregation is how the
// two drift apart, so the admin route calls straight into this.
export async function buildSubjects(studentId: string, classId: string, academicYearId: string, termId: string) {
  const [assignments, markRows] = await Promise.all([
    findAssignmentsForClass(classId, academicYearId),
    findMarksForStudentTerm(studentId, termId),
  ]);

  const marksBySubject = new Map<string, MarkRow[]>();
  for (const row of markRows) {
    const list = marksBySubject.get(row.subjectId);
    if (list) list.push(row);
    else marksBySubject.set(row.subjectId, [row]);
  }

  const credentials = await findApprovedAndPendingCredentials(studentId, assignments.map((a) => a.subjectId));
  const credentialsBySubject = new Map<string, typeof credentials>();
  for (const c of credentials) {
    const list = credentialsBySubject.get(c.subjectId ?? "");
    if (list) list.push(c);
    else credentialsBySubject.set(c.subjectId ?? "", [c]);
  }

  return assignments.map((a) => {
    const rows = marksBySubject.get(a.subjectId) ?? [];
    const marks = buildSubjectMarks(rows);
    const values = marks.map((m) => m.value);
    const subjectCredentials = credentialsBySubject.get(a.subjectId) ?? [];
    return {
      subjectId: a.subjectId,
      nameHy: a.nameHy,
      nameEn: a.nameEn,
      nameRu: a.nameRu,
      teacherName: `${a.teacherFirstName} ${a.teacherLastName}`,
      average: average(values),
      trend: computeTrend(values),
      marks,
      credentials: subjectCredentials
        .filter((c) => c.status === "approved")
        .map((c) => ({ id: c.id, title: c.title, category: c.category, approvedAt: c.decidedAt })),
      pendingCredentialCount: subjectCredentials.filter((c) => c.status === "pending").length,
    };
  });
}

export async function getRecord(auth: AuthClaims, requestedTermId?: string) {
  requireStudent(auth);
  const { student, enrollment } = await resolveEnrollmentOrThrow(auth.sub);
  const [terms, term] = await Promise.all([
    findTermsForYear(enrollment.academicYearId),
    resolveTermOrThrow(enrollment.academicYearId, requestedTermId),
  ]);
  const subjects = await buildSubjects(student.id, enrollment.classId, enrollment.academicYearId, term.id);

  return {
    term: { id: term.id, label: term.label, index: term.index, startsOn: term.startsOn, endsOn: term.endsOn },
    availableTerms: terms.map((t) => ({ id: t.id, label: t.label, index: t.index })),
    class: { id: enrollment.classId, label: `${enrollment.grade}-${enrollment.letter}` },
    subjects,
  };
}

export async function getSubjectDetail(auth: AuthClaims, subjectId: string, requestedTermId?: string) {
  requireStudent(auth);
  const { student, enrollment } = await resolveEnrollmentOrThrow(auth.sub);
  const term = await resolveTermOrThrow(enrollment.academicYearId, requestedTermId);
  const subjects = await buildSubjects(student.id, enrollment.classId, enrollment.academicYearId, term.id);
  const subject = subjects.find((s) => s.subjectId === subjectId);
  if (!subject) throw new ApiError(404, "NOT_FOUND");

  // REC-10: [] / 0 when nothing carries a topic — the UI degrades to the
  // subject-level view rather than showing a broken or misleading section.
  const withTopic = subject.marks.filter((m) => m.topic);
  const byTopic = new Map<string, number[]>();
  for (const m of withTopic) {
    const list = byTopic.get(m.topic!);
    if (list) list.push(m.value);
    else byTopic.set(m.topic!, [m.value]);
  }
  const topicBreakdown = [...byTopic.entries()].map(([topic, values]) => ({
    topic,
    average: average(values),
    markCount: values.length,
  }));
  const topicCoverage = subject.marks.length === 0 ? 0 : round1(withTopic.length / subject.marks.length);

  return { ...subject, topicBreakdown, topicCoverage };
}

export async function getArchive(auth: AuthClaims) {
  requireStudent(auth);
  const { student, enrollment } = await resolveEnrollmentOrThrow(auth.sub);
  const others = await findOtherEnrollments(student.id, enrollment.academicYearId);

  const years = await Promise.all(
    others.map(async (o) => {
      const rows = await findPublishedMarksForYear(student.id, o.classId);
      const bySubject = new Map<string, { nameHy: string; nameEn: string; nameRu: string; values: number[] }>();
      for (const r of rows) {
        const entry = bySubject.get(r.subjectId);
        if (entry) entry.values.push(r.value);
        else bySubject.set(r.subjectId, { nameHy: r.nameHy, nameEn: r.nameEn, nameRu: r.nameRu, values: [r.value] });
      }
      return {
        academicYearId: o.academicYearId,
        yearLabel: o.yearLabel,
        classLabel: `${o.grade}-${o.letter}`,
        enrollmentStatus: o.status,
        finalMarks: [...bySubject.entries()].map(([subjectId, s]) => ({
          subjectId,
          nameHy: s.nameHy,
          nameEn: s.nameEn,
          nameRu: s.nameRu,
          finalAverage: average(s.values),
        })),
        // No attestation/document table exists anywhere in the schema
        // (D-24-style gap) — always empty, not fabricated, kept in the
        // shape so the frontend's "renders nothing when absent" rule
        // already covers the day one gets added.
        attestations: [] as { id: string; title: string; url: string }[],
      };
    }),
  );

  return { years };
}

export async function getMarkHistory(auth: AuthClaims, markId: string) {
  requireStudent(auth);
  const { student } = await resolveEnrollmentOrThrow(auth.sub);

  const chain: NonNullable<Awaited<ReturnType<typeof findMarkById>>>[] = [];
  let current = await findMarkById(markId);
  if (!current || current.studentId !== student.id) throw new ApiError(404, "NOT_FOUND");
  chain.unshift(current);
  while (current.supersedesMarkId) {
    const prior = await findMarkById(current.supersedesMarkId);
    if (!prior) break;
    chain.unshift(prior);
    current = prior;
  }

  const teacherIds = [...new Set(chain.map((m) => m.enteredByTeacherId))];
  const teachers = await findTeacherNames(teacherIds);
  const teacherName = new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`]));

  const steps = [];
  for (let i = 1; i < chain.length; i++) {
    const from = chain[i - 1];
    const to = chain[i];
    steps.push({
      fromValue: from.value,
      toValue: to.value,
      reason: to.reason,
      at: to.enteredAt,
      actorName: teacherName.get(to.enteredByTeacherId) ?? null,
    });
  }
  return { markId: chain[chain.length - 1].id, currentValue: chain[chain.length - 1].value, steps };
}
