import type { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { env } from "../../lib/env.js";
import { ApiError, sendApiError } from "../errors.js";

// A door reader is not a person and there is no `scanner` role — `user.role`
// is `enum('student','teacher','admin')` and C2 forbids extending it. This
// shares nothing with requireAuth: no JWT, just one shared device key.
export function requireScannerKey(req: Request, res: Response, next: NextFunction) {
  const key = req.header("x-scanner-key");
  if (!key || !timingSafeEqualStrings(key, env.SCANNER_API_KEY)) {
    sendApiError(res, new ApiError(401, "SCANNER_UNAUTHORISED"));
    return;
  }
  next();
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
