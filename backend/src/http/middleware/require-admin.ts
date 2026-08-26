import type { NextFunction, Request, Response } from "express";
import { ApiError, sendApiError } from "../errors.js";

// roadmap Phase 5: a non-admin curling an admin endpoint gets FORBIDDEN, not
// a 404 — the "not found" experience is a frontend-only choice (hiding that
// the route exists at all), not something the API itself needs to fake.
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    sendApiError(res, new ApiError(401, "UNAUTHENTICATED"));
    return;
  }
  if (req.auth.role !== "admin") {
    sendApiError(res, new ApiError(403, "FORBIDDEN"));
    return;
  }
  next();
}
