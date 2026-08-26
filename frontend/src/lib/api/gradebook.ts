import { apiJson } from "./client";

export type TeacherClass = {
  classId: string;
  subjectId: string;
  termId: string | null;
  academicYearId: string;
  classLabel: string;
  subjectNameHy: string;
  subjectNameEn: string;
  subjectNameRu: string;
  studentCount: number;
  draftCount: number;
};

export type GradebookStudent = { id: string; firstName: string; lastName: string; enrollmentStatus: string };
export type GradebookAssessment = { id: string; heldOn: string; kind: string; title: string | null; topic: string | null; publishedMarkCount: number };
export type GradebookMark = {
  id: string;
  assessmentId: string;
  studentId: string;
  value: number;
  state: "draft" | "published";
  enteredAt: string;
  hasHistory: boolean;
};

export type GradebookResponse = {
  class: { id: string };
  subject: { id: string };
  term: { id: string; label: string };
  students: GradebookStudent[];
  assessments: GradebookAssessment[];
  marks: GradebookMark[];
};

export type PutMarksItem = { assessmentId: string; studentId: string; value: number | null };
export type PutMarksResponse = {
  marks: { id: string; assessmentId: string; studentId: string; value: number; state: string }[];
  deleted: string[];
  rejected: { assessmentId: string; studentId: string; code: string; currentMarkId?: string; currentValue?: number }[];
};

export type MarkHistoryStep = { fromValue: number; toValue: number; reason: string | null; at: string; actorName: string | null };
export type MarkHistoryResponse = { markId: string; currentValue: number; steps: MarkHistoryStep[] };

export const gradebookApi = {
  getClasses: () => apiJson<TeacherClass[]>("/api/teacher/classes"),
  getGradebook: (classId: string, subjectId: string, termId: string) =>
    apiJson<GradebookResponse>(`/api/gradebook?classId=${classId}&subjectId=${subjectId}&termId=${termId}`),
  createAssessment: (input: { classId: string; subjectId: string; termId: string; kind: string; heldOn?: string; title?: string; topic?: string }) =>
    apiJson<GradebookAssessment>("/api/assessments", { method: "POST", body: JSON.stringify(input) }),
  patchAssessment: (id: string, patch: { title?: string | null; topic?: string | null; heldOn?: string }) =>
    apiJson<GradebookAssessment>(`/api/assessments/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteAssessment: (id: string) => apiJson<void>(`/api/assessments/${id}`, { method: "DELETE" }),
  putMarks: (input: { classId: string; subjectId: string; termId: string; items: PutMarksItem[] }) =>
    apiJson<PutMarksResponse>("/api/marks", { method: "PUT", body: JSON.stringify(input) }),
  deleteMark: (id: string) => apiJson<void>(`/api/marks/${id}`, { method: "DELETE" }),
  publish: (input: { classId: string; subjectId: string; termId: string }, idempotencyKey: string) =>
    apiJson<{ publishedCount: number; publishedAt: string; batchId: string }>("/api/marks/publish", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    }),
  supersede: (markId: string, input: { value: number; reason: string }) =>
    apiJson<{ mark: { id: string }; supersededMarkId: string }>(`/api/marks/${markId}/supersede`, { method: "POST", body: JSON.stringify(input) }),
  getMarkHistory: (markId: string) => apiJson<MarkHistoryResponse>(`/api/marks/${markId}/history`),
};
