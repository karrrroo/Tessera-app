// The access token lives here — a plain module-scoped variable, never React
// state (which could get serialized into devtools/persisted state) and never
// localStorage/sessionStorage (C12). AuthProvider is the only writer that
// matters for app logic; apiClient also writes here after a silent refresh.
let currentAccessToken: string | null = null;

export function getAccessToken(): string | null {
  return currentAccessToken;
}

export function setAccessToken(token: string | null): void {
  currentAccessToken = token;
}

let onAuthFailure: (() => void) | null = null;

export function registerAuthFailureHandler(fn: () => void): void {
  onAuthFailure = fn;
}

export function notifyAuthFailure(): void {
  onAuthFailure?.();
}
