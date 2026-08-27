import { apiFetch, apiJson, ApiRequestError } from "./client";
import type { RecordSubject, Term as RecordTerm } from "./record";
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
  classLabel: string;
  status: "active" | "transferred" | "departed" | "graduated";
};

// GET /api/admin/students/:id. `subjects` is the same RecordSubject the
// student's own record uses — the endpoint calls record/service's
// buildSubjects rather than aggregating marks a second way, so the type is
// imported rather than restated.
export type AdminStudentDetail = {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    patronymic: string | null;
    birthDate: string | null;
    email: string;
    locale: "hy" | "en" | "ru";
    mustChangePassword: boolean;
    lastLoginAt: string | null;
  };
  enrollment: {
    id: string;
    status: RosterEntry["status"];
    classId: string;
    classLabel: string;
    academicYearId: string;
    yearLabel: string;
  };
  term: RecordTerm;
  availableTerms: RecordTerm[];
  subjects: RecordSubject[];
};

// GET /api/admin/students?q= and /api/admin/teachers?q= — the people search.
// A picker payload: no marks, no credentials. `total` is the full match count,
// `items` only the requested page.
export type StudentHit = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  externalId: string | null;
  className: string | null;
};
export type TeacherAssignment = { subjectId: string; nameHy: string; nameEn: string; nameRu: string; className: string };
export type TeacherHit = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  externalId: string | null;
  assignments: TeacherAssignment[];
};
export type SearchPage<T> = { items: T[]; total: number };

export type CreatedStudent = {
  student: { id: string; firstName: string; lastName: string };
  enrollment: { id: string; classId: string };
  login: string;
  temporaryPassword: string;
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

// Group B5 — admissions review. `transcriptToken` is a short-lived signed
// token, never the storage key: the backend mints it per response and it
// expires, so it is safe to put in a URL but pointless to persist. Nothing
// here is ever written to localStorage.
export type AdminApplication = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  email: string;
  phone: string | null;
  schoolChoice: string;
  streamChoice: string;
  motivation: string | null;
  status: "pending" | "approved" | "rejected";
  decidedAt: string | null;
  decidedBy: string | null;
  createdAt: string;
  transcriptToken: string | null;
};

export type ApplicationApproval = {
  application: AdminApplication;
  prefill: { firstName: string; lastName: string; birthDate: string; email: string };
  accountCreated: false;
};

export const adminApi = {
  listApplications: (status: "pending" | "approved" | "rejected" = "pending") =>
    apiJson<AdminApplication[]>(`/api/admin/applications?status=${status}`),
  getApplication: (id: string) => apiJson<AdminApplication>(`/api/admin/applications/${id}`),
  // B5 requires an Idempotency-Key on both decisions. Generated per click, so
  // a retry after a dropped response replays rather than double-deciding.
  approveApplication: (id: string) =>
    apiJson<ApplicationApproval>(`/api/admin/applications/${id}/approve`, {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
    }),
  rejectApplication: (id: string, reason?: string) =>
    apiJson<{ application: AdminApplication; notified: false }>(`/api/admin/applications/${id}/reject`, {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID(), "content-type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    }),
  deleteApplication: (id: string) =>
    apiJson<{ deletedRow: true; deletedObject: boolean }>(`/api/admin/applications/${id}`, { method: "DELETE" }),
  // Streams through the backend's authenticated endpoint (C10 — no presigned
  // URL ever reaches the browser), so this is a fetch-and-blob, not an href.
  downloadTranscript: async (token: string) => {
    const res = await apiFetch(`/api/admin/applications/transcript/${token}`);
    if (!res.ok) {
      let code = "UNKNOWN";
      try {
        const parsed = (await res.json()) as { error?: { code?: string } };
        code = parsed.error?.code ?? "UNKNOWN";
      } catch {
        code = "UNKNOWN";
      }
      throw new ApiRequestError(res.status, code);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    // The real filename is in Content-Disposition; a generic one is fine here
    // and deliberately carries no child's name into the downloads folder.
    anchor.download = "transcript";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },

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

  listRoster: (filters: { classId?: string; status?: string; q?: string }) => {
    const params = new URLSearchParams();
    if (filters.classId) params.set("classId", filters.classId);
    if (filters.status) params.set("status", filters.status);
    if (filters.q) params.set("q", filters.q);
    return apiJson<RosterEntry[]>(`/api/admin/roster?${params.toString()}`);
  },
  getStudent: (studentId: string, termId?: string) =>
    apiJson<AdminStudentDetail>(`/api/admin/students/${studentId}${termId ? `?termId=${termId}` : ""}`),
  createStudent: (data: {
    classId: string;
    firstName: string;
    lastName: string;
    patronymic?: string;
    birthDate?: string;
    email: string;
  }) => apiJson<CreatedStudent>("/api/admin/students", { method: "POST", body: JSON.stringify(data) }),
  transitionEnrollment: (
    id: string,
    patch: { status: "transferred"; toClassId: string } | { status: "departed" } | { status: "graduated" },
  ) => apiJson(`/api/admin/enrollments/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  // The assignment grid's unfiltered list lives on its own path, so no query
  // string on the search endpoint can ever be made to return a whole roster.
  listTeachers: () => apiJson<{ id: string; firstName: string; lastName: string }[]>("/api/admin/teachers/all"),

  searchStudents: (q: string, opts: { limit?: number; offset?: number } = {}) => {
    const p = new URLSearchParams({ q });
    if (opts.limit != null) p.set("limit", String(opts.limit));
    if (opts.offset != null) p.set("offset", String(opts.offset));
    return apiJson<SearchPage<StudentHit>>(`/api/admin/students?${p.toString()}`);
  },
  searchTeachers: (q: string, opts: { limit?: number; offset?: number } = {}) => {
    const p = new URLSearchParams({ q });
    if (opts.limit != null) p.set("limit", String(opts.limit));
    if (opts.offset != null) p.set("offset", String(opts.offset));
    return apiJson<SearchPage<TeacherHit>>(`/api/admin/teachers?${p.toString()}`);
  },
  listAssignments: (academicYearId: string) => apiJson<Assignment[]>(`/api/admin/assignments?academicYearId=${academicYearId}`),
  createAssignment: (data: { teacherId: string; classId: string; subjectId: string; academicYearId: string }) =>
    apiJson<Assignment>("/api/admin/assignments", { method: "POST", body: JSON.stringify(data) }),
  deleteAssignment: (id: string) => apiJson<void>(`/api/admin/assignments/${id}`, { method: "DELETE" }),

  // NOT an <a href>. requireAuth reads only the Authorization header, so a
  // plain link to this endpoint always returns 401 UNAUTHENTICATED — the
  // access token lives in memory, and the refresh cookie is path-scoped to
  // /api/auth/refresh. Same authenticated-blob shape as downloadExport.
  downloadImportTemplate: async (kind: "students" | "teachers"): Promise<void> => {
    const res = await apiFetch(`/api/admin/import/template?kind=${kind}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: { code: "INTERNAL" } }));
      throw new ApiRequestError(res.status, body.error.code, body.error.details);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${kind}-template.xlsx`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },

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
