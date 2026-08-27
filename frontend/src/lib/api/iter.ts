import { apiJson } from "./client";

export type IterTurn = { role: "user" | "model"; text: string };

export type SendIterMessageResponse = {
  id: string;
  storedAt: string;
  reply: string | null;
};

export const iterApi = {
  sendMessage: (input: { sessionId: string; text: string; screen?: string; locale: "hy" | "en" | "ru"; history: IterTurn[] }) =>
    apiJson<SendIterMessageResponse>("/api/iter/messages", { method: "POST", body: JSON.stringify(input) }),
};

// Group A5 — server-side per-user history. One row per EXCHANGE, newest first,
// keyset-paged on `createdAt`. Nothing in the request says whose history to
// return; the backend takes that from the token alone.
export type IterStoredExchange = {
  id: string;
  body: string;
  reply: string | null;
  createdAt: string;
  screen: string | null;
};

export type IterHistoryPage = { items: IterStoredExchange[]; nextCursor: string | null };

export const iterHistoryApi = {
  get: (opts: { cursor?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (opts.cursor) qs.set("cursor", opts.cursor);
    if (opts.limit) qs.set("limit", String(opts.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiJson<IterHistoryPage>(`/api/iter/messages${suffix}`);
  },
  clear: () => apiJson<{ deleted: number }>("/api/iter/messages", { method: "DELETE" }),
};
