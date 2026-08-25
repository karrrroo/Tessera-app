import type { NextFunction, Request, Response } from "express";
import { ApiError, sendApiError } from "../errors.js";
import { verifyAccessToken, type AccessTokenClaims } from "../../modules/auth/tokens.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AccessTokenClaims;
    }
  }
}

// Distinguishes TOKEN_EXPIRED from UNAUTHENTICATED (roadmap Phase 3) because
// the client's silent-refresh-and-retry only fires on the former.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) {
    sendApiError(res, new ApiError(401, "UNAUTHENTICATED"));
    return;
  }

  const result = verifyAccessToken(token);
  if (!result.valid) {
    sendApiError(res, result.expired ? new ApiError(401, "TOKEN_EXPIRED") : new ApiError(401, "UNAUTHENTICATED"));
    return;
  }

  req.auth = result.claims;
  next();
}
