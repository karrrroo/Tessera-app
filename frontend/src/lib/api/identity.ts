import { apiJson } from "./client";

export type StudentHolder = {
  role: "student";
  firstName: string;
  lastName: string;
  institutionName: string;
  classLabel: string | null;
  tesseraId: string;
};

export type TeacherHolder = {
  role: "teacher";
  firstName: string;
  lastName: string;
  institutionName: string;
  classLabels: string[];
  subjects: { nameHy: string; nameEn: string; nameRu: string }[];
};

export type CredentialResponse = {
  credentialId: string | null;
  payload: string | null;
  issuedAt: string | null;
  holder: StudentHolder | TeacherHolder;
};

export type TodayEntry = {
  assessmentId: string;
  kind: "lesson" | "test" | "exam" | "project";
  classLabel: string;
  subjectNameHy: string;
  subjectNameEn: string;
  subjectNameRu: string;
};

export type AnomalyEntry = {
  scanEventId: string;
  scannedAt: string;
  scannerId: string;
  location: string | null;
  result: "valid" | "revoked" | "unknown" | "signature_invalid" | "not_enrolled";
  previousScannerId: string;
  previousScannedAt: string;
  secondsAgo: number;
  studentFirstName: string;
  studentLastName: string;
  classLabel: string;
};

export const identityApi = {
  getCredential: () => apiJson<CredentialResponse>("/api/me/credential"),
  getToday: () => apiJson<TodayEntry[]>("/api/me/today"),
  getAnomalies: (since?: string) =>
    apiJson<AnomalyEntry[]>(`/api/verify/anomalies${since ? `?since=${encodeURIComponent(since)}` : ""}`),
};
