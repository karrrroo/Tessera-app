import type { NextFunction, Request, Response } from "express";
import { ApiError, sendApiError } from "../errors.js";
import { findUserById } from "../../modules/auth/repo.js";

// AUTH-7, enforced at the API so browser-back can't defeat it. Checked live
// against the database rather than a JWT claim: a successful
// POST /api/auth/password/change returns 204 with no fresh token (by design),
// so the still-live 15-minute access token must not go on claiming
// mustChangePassword after it's no longer true.
const EXEMPT_PATHS = new Set(["/api/me", "/api/auth/password/change", "/api/auth/logout"]);

export async function requirePasswordChanged(req: Request, res: Response, next: NextFunction) {
  // req.path is relative to whichever router it's read from — when this runs
  // inside a mounted sub-router, req.path is only the tail end (e.g.
  // "/password/change", not "/api/auth/password/change"), so the exemption
  // list above would never match. req.originalUrl (query string stripped) is
  // stable regardless of nesting.
  const fullPath = req.originalUrl.split("?")[0];
  if (EXEMPT_PATHS.has(fullPath) || !req.auth) {
    next();
    return;
  }

  const u = await findUserById(req.auth.sub);
  if (u?.mustChangePassword) {
    sendApiError(res, new ApiError(403, "AUTH_PASSWORD_CHANGE_REQUIRED"));
    return;
  }
  next();
}
