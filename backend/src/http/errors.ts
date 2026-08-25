import type { Response } from "express";

// The one shape every error response takes (docs/reference/tessera-roadmap.md §3):
// { error: { code, field?, details? } } — never a "message" key, since that would
// mean a translation leaked into the backend (C8). The client maps `code` to a
// hy/en/ru string itself.
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field?: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, opts?: { field?: string; details?: Record<string, unknown> }) {
    super(code);
    this.status = status;
    this.code = code;
    this.field = opts?.field;
    this.details = opts?.details;
  }
}

export function sendApiError(res: Response, err: ApiError) {
  res.status(err.status).json({
    error: {
      code: err.code,
      ...(err.field ? { field: err.field } : {}),
      ...(err.details ? { details: err.details } : {}),
    },
  });
}

// Shared codes (§3.1) — module-specific codes (AUTH_*, MARK_*, ...) are thrown as
// ApiError directly from each module's service layer.
export const VALIDATION_FAILED = (details?: Record<string, unknown>) =>
  new ApiError(422, "VALIDATION_FAILED", { details });
export const UNAUTHENTICATED = () => new ApiError(401, "UNAUTHENTICATED");
export const TOKEN_EXPIRED = () => new ApiError(401, "TOKEN_EXPIRED");
export const FORBIDDEN = () => new ApiError(403, "FORBIDDEN");
export const NOT_FOUND = () => new ApiError(404, "NOT_FOUND");
export const CONFLICT = () => new ApiError(409, "CONFLICT");
export const RATE_LIMITED = (retryAfterSeconds?: number) =>
  new ApiError(429, "RATE_LIMITED", retryAfterSeconds ? { details: { retryAfterSeconds } } : undefined);
export const INTERNAL = () => new ApiError(500, "INTERNAL");
