import { apiFetch, apiJson, ApiRequestError } from "./client";

export type ExportScope = "class-subject-term" | "class-term" | "institution-term";
export type ExportFormat = "xlsx" | "csv";

export type ExportLogRow = {
  id: string;
  scope: { scope: ExportScope; classId?: string; subjectId?: string; termId: string };
  format: ExportFormat;
  mark_count: number;
  created_at: string;
  actor_email: string;
  teacher_first_name: string | null;
  teacher_last_name: string | null;
};

export type ExportParams = {
  scope: ExportScope;
  classId?: string;
  subjectId?: string;
  termId: string;
  format: ExportFormat;
  locale: "hy" | "en" | "ru";
};

// EXP-6: since the app and API share an origin, a plain `<a href>` carries
// no Authorization header — the access token lives only in memory
// (token-store.ts, C12) — so this fetches with the bearer, reads the blob,
// and triggers the save itself, reusing `apiFetch`'s existing
// refresh-on-expiry retry rather than reimplementing it here.
export async function downloadExport(params: ExportParams): Promise<void> {
  const query = new URLSearchParams();
  query.set("scope", params.scope);
  if (params.classId) query.set("classId", params.classId);
  if (params.subjectId) query.set("subjectId", params.subjectId);
  query.set("termId", params.termId);
  query.set("format", params.format);
  query.set("locale", params.locale);

  const res = await apiFetch(`/api/export?${query.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { code: "INTERNAL" } }));
    throw new ApiRequestError(res.status, body.error.code, body.error.details);
  }

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const filename = parseFilename(disposition) ?? "export";

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// `filename*` (RFC 5987, UTF-8) is parsed first — it's the real name; the
// plain `filename=` is only the ASCII fallback for clients that don't
// understand the extended form.
function parseFilename(disposition: string): string | null {
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (star) return decodeURIComponent(star[1]);
  const plain = /filename="([^"]+)"/i.exec(disposition);
  return plain ? plain[1] : null;
}

export const exportApi = {
  download: downloadExport,
  getLogs: (limit = 50) => apiJson<ExportLogRow[]>(`/api/export/logs?limit=${limit}`),
};
