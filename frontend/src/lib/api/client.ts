import { getAccessToken, notifyAuthFailure, setAccessToken } from "./token-store";

type ApiErrorBody = { error: { code: string; field?: string; details?: Record<string, unknown> } };

export class ApiRequestError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(status: number, code: string, details?: Record<string, unknown>) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Dedupes concurrent refreshes behind one shared promise (roadmap Phase 3,
// AuthProvider/apiClient spec) — otherwise two 401s arriving together, or
// AuthProvider's own boot-time refresh firing twice (React Strict Mode
// double-invokes effects in dev), would each present the same refresh
// cookie to the server; the second one to land loses the race and reads as
// genuine token reuse, which revokes the whole session family (D-12). Every
// refresh call in the app — boot-time or 401-triggered — must go through
// this single in-flight promise, never call the endpoint directly.
//
// Three-way result, not a boolean (Phase 6 fix, docs/decisions.md): `false`
// means the server was reached and said no (an expired/revoked refresh
// cookie — genuinely not authenticated). `null` means the server was never
// reached at all (offline) — that is not the same fact, and AuthProvider
// treats it differently so losing connectivity for a moment doesn't read
// as a logout everywhere in the app.
let refreshInFlight: Promise<boolean | null> | null = null;

export async function refreshOnce(): Promise<boolean | null> {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return false;
        const body = (await res.json()) as { accessToken: string };
        setAccessToken(body.accessToken);
        return true;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function apiFetch(path: string, init: RequestInit = {}, isRetry = false): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(path, { ...init, headers, credentials: "include" });

  if (res.status === 401 && !isRetry) {
    const body = (await res.clone().json().catch(() => null)) as ApiErrorBody | null;
    if (body?.error.code === "TOKEN_EXPIRED") {
      const refreshed = await refreshOnce();
      if (refreshed) return apiFetch(path, init, true);
      // refreshed === false: the server was reached and said no — really
      // logged out. refreshed === null: the network never answered at
      // all, which must not be treated as a logout (Phase 6, ID-8) — the
      // original 401 just propagates as this one request's own failure.
      if (refreshed === false) {
        setAccessToken(null);
        notifyAuthFailure();
      }
    }
  }
  return res;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: { code: "INTERNAL" } }))) as ApiErrorBody;
    throw new ApiRequestError(res.status, body.error.code, body.error.details);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
