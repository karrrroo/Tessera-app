import type { NextFunction, Request, Response } from "express";
import { NOT_FOUND, sendApiError } from "../errors.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A real bug, found live: POST /api/credentials/:id/decision with a
// non-UUID id (a stale link, a typo, a bad back-button state — not an
// exotic input) returned a raw 500 {error:{code:"INTERNAL"}}. The route's
// own service code already does the right thing for a well-formed but
// nonexistent id (`if (!credential) throw NOT_FOUND()`) — the problem is
// upstream of that: `eq(table.id, req.params.id)` reaches Postgres before
// that check ever runs, and a `uuid` column rejects a non-UUID string at
// the driver level with its own error, which the generic handler can only
// present as an opaque 500. No route in the backend validates an `:id`
// param's shape today, so this middleware is deliberately generic —
// mount it on any router whose `:id` params feed a uuid column, not just
// this one route.
export function requireUuidParam(paramName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.params[paramName];
    if (!value || !UUID_RE.test(value)) {
      sendApiError(res, NOT_FOUND());
      return;
    }
    next();
  };
}
