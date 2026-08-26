import { apiJson } from "./client";

export type Term = { id: string; label: string; index: number; startsOn?: string; endsOn?: string };

export type SubjectMark = {
  id: string;
  value: number;
  heldOn: string;
  kind: "lesson" | "test" | "exam" | "project";
  title: string | null;
  topic: string | null;
  state: "published";
  publishedAt: string | null;
  supersededFrom: { markId: string; value: number; reason: string | null; at: string } | null;
};

export type SubjectCredential = { id: string; title: string; category: string; approvedAt: string | null };

export type RecordSubject = {
  subjectId: string;
  nameHy: string;
  nameEn: string;
  nameRu: string;
  teacherName: string;
  average: number | null;
  trend: "up" | "down" | "flat" | null;
  marks: SubjectMark[];
  credentials: SubjectCredential[];
  pendingCredentialCount: number;
};

export type RecordResponse = {
  term: Term;
  availableTerms: Term[];
  class: { id: string; label: string };
  subjects: RecordSubject[];
};

export type SubjectDetailResponse = RecordSubject & {
  topicBreakdown: { topic: string; average: number | null; markCount: number }[];
  topicCoverage: number;
};

export type ArchiveYear = {
  academicYearId: string;
  yearLabel: string;
  classLabel: string;
  enrollmentStatus: "active" | "transferred" | "departed" | "graduated";
  finalMarks: { subjectId: string; nameHy: string; nameEn: string; nameRu: string; finalAverage: number | null }[];
  attestations: { id: string; title: string; url: string }[];
};

export type MarkHistoryStep = { fromValue: number; toValue: number; reason: string | null; at: string; actorName: string | null };
export type MarkHistoryResponse = { markId: string; currentValue: number; steps: MarkHistoryStep[] };

export const recordApi = {
  getRecord: (termId?: string) => apiJson<RecordResponse>(`/api/me/record${termId ? `?termId=${termId}` : ""}`),
  getSubject: (subjectId: string, termId?: string) =>
    apiJson<SubjectDetailResponse>(`/api/me/subjects/${subjectId}${termId ? `?termId=${termId}` : ""}`),
  getArchive: () => apiJson<{ years: ArchiveYear[] }>("/api/me/archive"),
  getMarkHistory: (markId: string) => apiJson<MarkHistoryResponse>(`/api/me/marks/${markId}/history`),
};
