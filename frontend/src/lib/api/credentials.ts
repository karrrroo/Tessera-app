import { apiFetch, apiJson, ApiRequestError } from "./client";
import { getAccessToken } from "./token-store";

export type CredentialCategory = "olympiad" | "course" | "sport" | "volunteering" | "art";
export type CredentialStatus = "pending" | "approved" | "declined";

export type CredentialItem = {
  id: string;
  status: CredentialStatus;
  category: CredentialCategory;
  title: string;
  description: string | null;
  subject: { id: string; nameHy: string; nameEn: string; nameRu: string } | null;
  student?: { id: string; firstName: string; lastName: string; classLabel: string | null };
  attachment: { mime: string; key: string } | null;
  createdAt: string;
  decision: { status: CredentialStatus; reason: string | null; decidedAt: string; decidedBy: { name: string | null } | null } | null;
};

export type CredentialListParams = { status?: CredentialStatus; subjectId?: string; cursor?: string };
export type CredentialListResponse = { items: CredentialItem[]; nextCursor: string | null };

// CR-2: multipart, so this bypasses apiFetch/apiJson entirely and builds the
// request directly — mirrors admin.ts's uploadImport, the app's one other
// multipart upload. apiFetch would set Content-Type: application/json on any
// body it doesn't recognize, which corrupts a FormData boundary.
export async function submitCredential(input: {
  category: CredentialCategory;
  title: string;
  description?: string;
  subjectId?: string;
  file: File;
}): Promise<CredentialItem> {
  const form = new FormData();
  form.append("category", input.category);
  form.append("title", input.title);
  if (input.description) form.append("description", input.description);
  if (input.subjectId) form.append("subjectId", input.subjectId);
  form.append("file", input.file);

  const token = getAccessToken();
  const res = await fetch("/api/credentials", {
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
}

function buildListQuery(params: CredentialListParams): string {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.subjectId) query.set("subjectId", params.subjectId);
  if (params.cursor) query.set("cursor", params.cursor);
  return query.toString();
}

// C10: the attachment is never a signed URL — this fetches through the
// backend's own authenticated endpoint with the bearer, into a blob URL the
// caller (AttachmentViewer) revokes on unmount, the same pattern export.ts's
// downloadExport already uses for its own authenticated file fetch.
export async function fetchAttachment(credentialId: string): Promise<{ url: string; contentType: string }> {
  const res = await apiFetch(`/api/credentials/${credentialId}/attachment`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { code: "INTERNAL" } }));
    throw new ApiRequestError(res.status, body.error.code, body.error.details);
  }
  const contentType = res.headers.get("Content-Type") ?? "application/octet-stream";
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), contentType };
}

export const credentialsApi = {
  submit: submitCredential,
  list: (params: CredentialListParams = {}) => apiJson<CredentialListResponse>(`/api/credentials?${buildListQuery(params)}`),
  decide: (id: string, decision: "approved" | "declined", reason: string | undefined, idempotencyKey: string) =>
    apiJson<CredentialItem>(`/api/credentials/${id}/decision`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ decision, reason }),
    }),
  fetchAttachment,
};
