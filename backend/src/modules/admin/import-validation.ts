import type { ParsedRow } from "./xlsx.js";

export type RowIssue = { field: string; code: string; details?: Record<string, unknown> };
export type RowValidation = {
  status: "ok" | "warning" | "error";
  issues: RowIssue[];
  resolved: Record<string, unknown>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AGE_YEARS = 25;

function parseClassLabel(label: string): { grade: number; letter: string } | null {
  const match = /^(\d{1,2})-(.+)$/.exec(label.trim());
  if (!match) return null;
  const grade = Number(match[1]);
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) return null;
  return { grade, letter: match[2].trim() };
}

export type StudentValidationContext = {
  classesByLabel: Map<string, string>;
  studentsByEmail: Map<string, { id: string; firstName: string; lastName: string; birthDate: string | null; email: string }>;
  academicYearStartsOn: string;
};

export function validateStudentRow(
  row: ParsedRow,
  rowIndex: number,
  ctx: StudentValidationContext,
  emailsSeenInFile: Map<string, number>,
): RowValidation {
  const issues: RowIssue[] = [];
  const resolved: Record<string, unknown> = {};

  const allBlank = Object.values(row).every((v) => v.trim() === "");
  if (allBlank) {
    return { status: "error", issues: [{ field: "*", code: "ROW_EMPTY" }], resolved };
  }

  if (!row.lastName?.trim()) issues.push({ field: "lastName", code: "ROW_MISSING_LAST_NAME" });
  if (!row.firstName?.trim()) issues.push({ field: "firstName", code: "ROW_MISSING_FIRST_NAME" });

  if (row.birthDate?.trim()) {
    if (!DATE_PATTERN.test(row.birthDate.trim())) {
      issues.push({ field: "birthDate", code: "ROW_INVALID_DATE" });
    } else {
      const birth = new Date(row.birthDate.trim());
      const yearStart = new Date(ctx.academicYearStartsOn);
      const ageAtYearStart = (yearStart.getTime() - birth.getTime()) / (365.25 * 24 * 3600 * 1000);
      if (birth.getTime() > yearStart.getTime() || ageAtYearStart > MAX_AGE_YEARS) {
        issues.push({ field: "birthDate", code: "ROW_DATE_IMPLAUSIBLE" });
      }
    }
  }

  const classLabel = row.className?.trim();
  if (classLabel) {
    const parsed = parseClassLabel(classLabel);
    const classId = parsed ? ctx.classesByLabel.get(`${parsed.grade}-${parsed.letter}`) : undefined;
    if (!classId) {
      issues.push({ field: "className", code: "ROW_UNKNOWN_CLASS", details: { value: classLabel } });
    } else {
      resolved.classId = classId;
    }
  } else {
    issues.push({ field: "className", code: "ROW_UNKNOWN_CLASS", details: { value: "" } });
  }

  const email = row.email?.trim().toLowerCase();
  if (!email || !EMAIL_PATTERN.test(email)) {
    issues.push({ field: "email", code: "ROW_INVALID_EMAIL" });
  } else {
    const firstSeenAt = emailsSeenInFile.get(email);
    if (firstSeenAt !== undefined && firstSeenAt !== rowIndex) {
      issues.push({ field: "email", code: "ROW_DUPLICATE_IN_FILE", details: { otherRowIndex: firstSeenAt } });
    }
    const existing = ctx.studentsByEmail.get(email);
    if (existing) {
      issues.push({ field: "email", code: "ROW_DUPLICATE_IN_DB", details: { existingStudentId: existing.id } });
    }
  }

  const hasError = issues.length > 0;
  return { status: hasError ? "error" : "ok", issues, resolved };
}

export type TeacherValidationContext = {
  classesByLabel: Map<string, string>;
  subjectsByName: Map<string, string>;
  teachersByEmail: Map<string, string>;
};

export function validateTeacherRow(
  row: ParsedRow,
  rowIndex: number,
  ctx: TeacherValidationContext,
  emailsSeenInFile: Map<string, number>,
): RowValidation {
  const issues: RowIssue[] = [];
  const resolved: Record<string, unknown> = {};

  const allBlank = Object.values(row).every((v) => v.trim() === "");
  if (allBlank) {
    return { status: "error", issues: [{ field: "*", code: "ROW_EMPTY" }], resolved };
  }

  if (!row.lastName?.trim()) issues.push({ field: "lastName", code: "ROW_MISSING_LAST_NAME" });
  if (!row.firstName?.trim()) issues.push({ field: "firstName", code: "ROW_MISSING_FIRST_NAME" });

  const email = row.email?.trim().toLowerCase();
  if (!email || !EMAIL_PATTERN.test(email)) {
    issues.push({ field: "email", code: "ROW_INVALID_EMAIL" });
  } else {
    const firstSeenAt = emailsSeenInFile.get(email);
    if (firstSeenAt !== undefined && firstSeenAt !== rowIndex) {
      issues.push({ field: "email", code: "ROW_DUPLICATE_IN_FILE", details: { otherRowIndex: firstSeenAt } });
    }
    if (ctx.teachersByEmail.has(email)) {
      issues.push({ field: "email", code: "ROW_DUPLICATE_IN_DB", details: { existingStudentId: ctx.teachersByEmail.get(email) } });
    }
  }

  const subjectName = row.subject?.trim().toLowerCase();
  const subjectId = subjectName ? ctx.subjectsByName.get(subjectName) : undefined;
  if (!subjectId) {
    issues.push({ field: "subject", code: "ROW_UNKNOWN_SUBJECT", details: { value: row.subject ?? "" } });
  } else {
    resolved.subjectId = subjectId;
  }

  const classLabels = (row.classNames ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const classIds: string[] = [];
  for (const label of classLabels) {
    const parsed = parseClassLabel(label);
    const classId = parsed ? ctx.classesByLabel.get(`${parsed.grade}-${parsed.letter}`) : undefined;
    if (!classId) {
      issues.push({ field: "classNames", code: "ROW_UNKNOWN_CLASS", details: { value: label } });
    } else {
      classIds.push(classId);
    }
  }
  if (classLabels.length === 0) {
    issues.push({ field: "classNames", code: "ROW_UNKNOWN_CLASS", details: { value: "" } });
  } else {
    resolved.classIds = classIds;
  }

  const hasError = issues.length > 0;
  return { status: hasError ? "error" : "ok", issues, resolved };
}
