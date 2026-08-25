// Maps Postgres SQLSTATE codes to the app's error-code registry
// (docs/reference/tessera-roadmap.md §3, Appendix A). Backend responses
// never leak SQLSTATE or constraint names to the client — those are for logs only.
//
// Two layers: a handful of named constraints get the specific module-level code
// the roadmap's Phase 1 names outright (CONSTRAINT_TO_APP_CODE); everything else
// falls back to a generic code by SQLSTATE alone. Constraints introduced by later
// phases get their own entry here when those modules are built — this file is the
// one place a Postgres error becomes an API error code, on purpose.

type PgError = { code?: string; constraint?: string };

const CONSTRAINT_TO_APP_CODE: Record<string, { code: string; status: number }> = {
  one_current_mark: { code: "MARK_ALREADY_CURRENT", status: 409 },
  reason_required_when_superseding: { code: "MARK_REASON_REQUIRED", status: 422 },
  user_email_key: { code: "USER_EMAIL_TAKEN", status: 409 },
};

const SQLSTATE_TO_APP_CODE: Record<string, { code: string; status: number }> = {
  "23505": { code: "CONFLICT", status: 409 }, // unique_violation
  "23514": { code: "VALIDATION_FAILED", status: 422 }, // check_violation
  "23502": { code: "VALIDATION_FAILED", status: 422 }, // not_null_violation
  "23503": { code: "NOT_FOUND", status: 404 }, // foreign_key_violation — a dangling client reference, not a 500
  "22P02": { code: "VALIDATION_FAILED", status: 422 }, // invalid_text_representation
};

export function isPgError(err: unknown): err is PgError {
  return typeof err === "object" && err !== null && "code" in err;
}

export function mapPgError(err: unknown): { code: string; status: number; constraint?: string } {
  if (!isPgError(err) || !err.code) {
    return { code: "INTERNAL", status: 500 };
  }
  if (err.constraint && err.constraint in CONSTRAINT_TO_APP_CODE) {
    return { ...CONSTRAINT_TO_APP_CODE[err.constraint], constraint: err.constraint };
  }
  if (err.code in SQLSTATE_TO_APP_CODE) {
    return { ...SQLSTATE_TO_APP_CODE[err.code], constraint: err.constraint };
  }
  return { code: "INTERNAL", status: 500 };
}
