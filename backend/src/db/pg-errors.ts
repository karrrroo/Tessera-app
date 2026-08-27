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
  // Phase 5 (admin) — class_academic_year_id_grade_letter_key is the same
  // collision the generator itself pre-checks (roadmap: existing combos are
  // "skipped", not an error), but the single-class POST route has no
  // pre-check to fall back on, so it needs its own named code too.
  class_academic_year_id_grade_letter_key: { code: "CLASS_ALREADY_EXISTS", status: 409 },
};

const SQLSTATE_TO_APP_CODE: Record<string, { code: string; status: number }> = {
  "23505": { code: "CONFLICT", status: 409 }, // unique_violation
  "23514": { code: "VALIDATION_FAILED", status: 422 }, // check_violation
  "23502": { code: "VALIDATION_FAILED", status: 422 }, // not_null_violation
  "23503": { code: "NOT_FOUND", status: 404 }, // foreign_key_violation — a dangling client reference, not a 500
  "22P02": { code: "VALIDATION_FAILED", status: 422 }, // invalid_text_representation
};

function hasPgCode(err: unknown): err is PgError {
  return typeof err === "object" && err !== null && "code" in err;
}

// Drizzle (0.45+) wraps every driver-level failure in its own
// DrizzleQueryError, with the real `pg` DatabaseError — the one actually
// carrying `.code`/`.constraint` — moved to `.cause` instead of staying on
// the thrown error itself. A real bug, found while diagnosing why a
// duplicate teaching-assignment insert (a genuine 23505 unique_violation)
// came back as a raw 500 "INTERNAL" instead of 409 CONFLICT: this function
// only ever checked the top-level object, so every wrapped error missed
// both mapping layers below and fell through to the generic branch.
export function isPgError(err: unknown): err is PgError {
  return hasPgCode(err) || (err instanceof Error && hasPgCode(err.cause));
}

export function mapPgError(err: unknown): { code: string; status: number; constraint?: string } {
  const pg = hasPgCode(err) ? err : err instanceof Error && hasPgCode(err.cause) ? err.cause : undefined;
  if (!pg || !pg.code) {
    return { code: "INTERNAL", status: 500 };
  }
  if (pg.constraint && pg.constraint in CONSTRAINT_TO_APP_CODE) {
    return { ...CONSTRAINT_TO_APP_CODE[pg.constraint], constraint: pg.constraint };
  }
  if (pg.code in SQLSTATE_TO_APP_CODE) {
    return { ...SQLSTATE_TO_APP_CODE[pg.code], constraint: pg.constraint };
  }
  return { code: "INTERNAL", status: 500 };
}
