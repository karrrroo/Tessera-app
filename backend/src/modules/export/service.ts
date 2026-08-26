import { ApiError, FORBIDDEN, NOT_FOUND } from "../../http/errors.js";
import { filenameSegment } from "../../lib/transliterate.js";
import { mapWithConcurrency } from "../../lib/concurrency.js";
import * as repo from "./repo.js";

const EXPORT_CONCURRENCY = 8;

const EXPORT_SCOPE_INVALID = (required: string[]) => new ApiError(422, "EXPORT_SCOPE_INVALID", { details: { required } });
const EXPORT_SCOPE_FORBIDDEN = () => new ApiError(403, "EXPORT_SCOPE_FORBIDDEN");
const EXPORT_NO_PUBLISHED_MARKS = () => new ApiError(409, "EXPORT_NO_PUBLISHED_MARKS");

type AuthClaims = { sub: string; role: "student" | "teacher" | "admin" };
type Scope = "class-subject-term" | "class-term" | "institution-term";
type Locale = "hy" | "en" | "ru";

export type ExportUnit = { classId: string; classLabel: string; subjectId: string; subjectName: string };

export type ExportPlan = {
  scope: Scope;
  format: "xlsx" | "csv";
  locale: Locale;
  institutionId: string;
  institutionName: string;
  termId: string;
  termLabel: string;
  units: ExportUnit[];
  filenameAscii: string;
  filenameUtf8: string;
};

function localizedSubjectName(s: { nameHy: string; nameEn: string; nameRu: string }, locale: Locale): string {
  return locale === "hy" ? s.nameHy : locale === "ru" ? s.nameRu : s.nameEn;
}

function classLabel(c: { grade: number; letter: string }): string {
  return `${c.grade}-${c.letter}`;
}

// Naming follows which dimensions the scope pins: class-subject-term pins
// all three; class-term pins class+term and fans out over every subject
// that class is taught; institution-term pins only institution+term and
// fans out over every (class, subject) pair in the institution. "One
// worksheet per class" in the roadmap's own prose is read as shorthand for
// "one worksheet per class-subject pair" — the alternative (one worksheet
// per class covering every subject at once) has no single set of
// assessment-date columns to use, which is the layout's whole premise
// (EXP-3).
async function resolveUnits(
  scope: Scope,
  params: { classId?: string; subjectId?: string },
  termRow: { academicYearId: string },
  institutionId: string,
  locale: Locale,
): Promise<ExportUnit[]> {
  if (scope === "class-subject-term") {
    if (!params.classId || !params.subjectId) throw EXPORT_SCOPE_INVALID(["classId", "subjectId"]);
    const [classRow, subjectRow] = await Promise.all([repo.findClass(params.classId), repo.findSubject(params.subjectId)]);
    if (!classRow || !subjectRow) throw NOT_FOUND();
    return [{ classId: classRow.id, classLabel: classLabel(classRow), subjectId: subjectRow.id, subjectName: localizedSubjectName(subjectRow, locale) }];
  }

  if (scope === "class-term") {
    if (!params.classId) throw EXPORT_SCOPE_INVALID(["classId"]);
    const classRow = await repo.findClass(params.classId);
    if (!classRow) throw NOT_FOUND();
    const subjects = await repo.findSubjectsTaughtInClass(classRow.id, classRow.academicYearId);
    return subjects.map((s) => ({ classId: classRow.id, classLabel: classLabel(classRow), subjectId: s.id, subjectName: localizedSubjectName(s, locale) }));
  }

  // institution-term
  const classes = await repo.findClassesForInstitution(institutionId, termRow.academicYearId);
  const subjectsByClass = await mapWithConcurrency(classes, EXPORT_CONCURRENCY, (c) => repo.findSubjectsTaughtInClass(c.id, c.academicYearId));
  const units: ExportUnit[] = [];
  for (const [i, c] of classes.entries()) {
    for (const s of subjectsByClass[i]) units.push({ classId: c.id, classLabel: classLabel(c), subjectId: s.id, subjectName: localizedSubjectName(s, locale) });
  }
  return units;
}

export async function prepareExport(
  auth: AuthClaims,
  params: { scope: Scope; classId?: string; subjectId?: string; termId: string; format: "xlsx" | "csv"; locale: Locale },
): Promise<ExportPlan> {
  if (auth.role === "student") throw FORBIDDEN();
  if (auth.role === "teacher" && params.scope !== "class-subject-term") throw EXPORT_SCOPE_FORBIDDEN();

  const institutionId = await repo.resolveInstitutionId();
  const institutionRow = await repo.findInstitution(institutionId);
  if (!institutionRow) throw NOT_FOUND();

  if (auth.role === "teacher") {
    if (!params.classId || !params.subjectId) throw EXPORT_SCOPE_INVALID(["classId", "subjectId"]);
    const teacherRow = await repo.findTeacherByUserId(auth.sub);
    if (!teacherRow) throw NOT_FOUND();
    const assignment = await repo.findAssignment(teacherRow.id, params.classId, params.subjectId);
    if (!assignment) throw NOT_FOUND();
  }

  const termRow = await repo.findTerm(params.termId);
  if (!termRow) throw NOT_FOUND();
  const units = await resolveUnits(params.scope, params, termRow, institutionId, params.locale);

  const counts = await mapWithConcurrency(units, EXPORT_CONCURRENCY, (unit) => repo.countPublishedMarks(unit.classId, unit.subjectId, params.termId));
  const totalMarks = counts.reduce((a, b) => a + b, 0);
  if (totalMarks === 0) throw EXPORT_NO_PUBLISHED_MARKS();

  const dateStamp = new Date().toISOString().slice(0, 10);
  const nameParts =
    params.scope === "class-subject-term"
      ? [units[0].classLabel, units[0].subjectName]
      : params.scope === "class-term"
        ? [units[0].classLabel]
        : [institutionRow.name];

  return {
    scope: params.scope,
    format: params.format,
    locale: params.locale,
    institutionId,
    institutionName: institutionRow.name,
    termId: termRow.id,
    termLabel: termRow.label,
    units,
    filenameAscii: ["Tessera", ...nameParts.map(filenameSegment), filenameSegment(termRow.label), dateStamp].join("_"),
    filenameUtf8: ["Tessera", ...nameParts, termRow.label, dateStamp].join("_"),
  };
}

export async function getExportLogs(auth: AuthClaims, limit: number) {
  if (auth.role !== "admin") throw FORBIDDEN();
  const institutionId = await repo.resolveInstitutionId();
  return repo.findExportLogs(institutionId, limit);
}
