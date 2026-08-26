import { apiJson, ApiRequestError } from "./client";
import { getAccessToken } from "./token-store";

export type Institution = { id: string; name: string; emisId: string | null; region: string; type: string };
export type AcademicYear = { id: string; institutionId: string; label: string; startsOn: string; endsOn: string };
export type Term = { id: string; academicYearId: string; index: number; label: string; startsOn: string; endsOn: string };
export type Subject = { id: string; institutionId: string; nameHy: string; nameEn: string; nameRu: string; code: string | null };
export type SchoolClass = { id: string; institutionId: string; academicYearId: string; grade: number; letter: string };
export type RosterEntry = {
  studentId: string;
  firstName: string;
  lastName: string;
  patronymic: string | null;
  birthDate: string | null;
  email: string;
  enrollmentId: string;
  classId: string;
  status: "active" | "transferred" | "departed" | "graduated";
};
export type Assignment = {
  id: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  teacherFirstName: string;
  teacherLastName: string;
};
export type RowIssue = { field: string; code: string; details?: Record<string, unknown> };
export type ImportRow = {
  rowIndex: number;
  status: "ok" | "warning" | "error";
  raw: Record<string, string>;
  issues?: RowIssue[];
  resolved?: Record<string, unknown>;
};
export type ImportBatch = {
  batchId: string;
  kind: "students" | "teachers";
  filename: string;
  rowCount: number;
  errorCount: number;
  warningCount: number;
  status: "previewing" | "applied" | "discarded";
  rows: ImportRow[];
};

export const adminApi = {
  getInstitution: () => apiJson<Institution>("/api/admin/institution"),
  updateInstitution: (patch: Partial<Pick<Institution, "name" | "region" | "type">>) =>
    apiJson<Institution>("/api/admin/institution", { method: "PATCH", body: JSON.stringify(patch) }),

  listAcademicYears: () => apiJson<AcademicYear[]>("/api/admin/academic-years"),
  createAcademicYear: (data: { label: string; startsOn: string; endsOn: string }) =>
    apiJson<AcademicYear>("/api/admin/academic-years", { method: "POST", body: JSON.stringify(data) }),

  listTerms: (academicYearId: string) => apiJson<Term[]>(`/api/admin/terms?academicYearId=${academicYearId}`),
  createTerm: (data: { academicYearId: string; index: number; label: string; startsOn: string; endsOn: string }) =>
    apiJson<Term>("/api/admin/terms", { method: "POST", body: JSON.stringify(data) }),
  deleteTerm: (id: string) => apiJson<void>(`/api/admin/terms/${id}`, { method: "DELETE" }),

  listSubjects: () => apiJson<Subject[]>("/api/admin/subjects"),
  createSubject: (data: { nameHy: string; nameEn: string; nameRu: string; code?: string }) =>
    apiJson<Subject>("/api/admin/subjects", { method: "POST", body: JSON.stringify(data) }),
  updateSubject: (id: string, patch: Partial<{ nameHy: string; nameEn: string; nameRu: string; code: string | null }>) =>
    apiJson<Subject>(`/api/admin/subjects/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteSubject: (id: string) => apiJson<void>(`/api/admin/subjects/${id}`, { method: "DELETE" }),

  listClasses: (academicYearId?: string) =>
    apiJson<SchoolClass[]>(`/api/admin/classes${academicYearId ? `?academicYearId=${academicYearId}` : ""}`),
  generateClasses: (data: { academicYearId: string; grades: number[]; letters: string[] }) =>
    apiJson<{ created: { id: string; grade: number; letter: string }[]; skipped: { grade: number; letter: string; code: string }[] }>(
      "/api/admin/classes/generate",
      { method: "POST", body: JSON.stringify(data) },
    ),
  reissueCredentials: (classId: string) =>
    apiJson<{
      credentials: { studentId: string; fullName: string; login: string; temporaryPassword: string }[];
      skipped: { studentId: string; code: string }[];
    }>(`/api/admin/classes/${classId}/credentials`, { method: "POST" }),

  listRoster: (filters: { classId?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters.classId) params.set("classId", filters.classId);
    if (filters.status) params.set("status", filters.status);
    return apiJson<RosterEntry[]>(`/api/admin/roster?${params.toString()}`);
  },
  transitionEnrollment: (
    id: string,
    patch: { status: "transferred"; toClassId: string } | { status: "departed" } | { status: "graduated" },
  ) => apiJson(`/api/admin/enrollments/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  listTeachers: () => apiJson<{ id: string; firstName: string; lastName: string }[]>("/api/admin/teachers"),
  listAssignments: (academicYearId: string) => apiJson<Assignment[]>(`/api/admin/assignments?academicYearId=${academicYearId}`),
  createAssignment: (data: { teacherId: string; classId: string; subjectId: string; academicYearId: string }) =>
    apiJson<Assignment>("/api/admin/assignments", { method: "POST", body: JSON.stringify(data) }),
  deleteAssignment: (id: string) => apiJson<void>(`/api/admin/assignments/${id}`, { method: "DELETE" }),

  importTemplateUrl: (kind: "students" | "teachers") => `/api/admin/import/template?kind=${kind}`,

  uploadImport: async (kind: "students" | "teachers", academicYearId: string, file: File): Promise<ImportBatch> => {
    const form = new FormData();
    form.append("file", file);
    form.append("academicYearId", academicYearId);
    const token = getAccessToken();
    const res = await fetch(`/api/admin/import?kind=${kind}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: { code: "INTERNAL" } }));
      throw new ApiRequestError(res.status, body.error.code, body.error.details);
    }
    return res.json();
  },

  getImportBatch: (batchId: string, academicYearId: string) =>
    apiJson<ImportBatch>(`/api/admin/import/${batchId}?academicYearId=${academicYearId}`),
  patchImportRow: (batchId: string, rowIndex: number, academicYearId: string, raw: Record<string, string>) =>
    apiJson<ImportRow>(`/api/admin/import/${batchId}/rows/${rowIndex}`, {
      method: "PATCH",
      body: JSON.stringify({ raw, academicYearId }),
    }),
  applyImport: (batchId: string, academicYearId: string) =>
    apiJson<{
      batchId: string;
      created: Record<string, number>;
      credentials: { fullName: string; login: string; temporaryPassword: string; classLabel?: string }[];
    }>(`/api/admin/import/${batchId}/apply`, { method: "POST", body: JSON.stringify({ academicYearId }) }),
  discardImport: (batchId: string) => apiJson<void>(`/api/admin/import/${batchId}/discard`, { method: "POST" }),
};
