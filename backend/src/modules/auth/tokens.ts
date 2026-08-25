import { randomBytes, createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../lib/env.js";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

// `sid` ties an access token to the device_session it was issued alongside —
// needed so GET /api/auth/sessions can mark which row is "this one" (the
// refresh cookie itself can't be read here: it's path-scoped to
// /api/auth/refresh only, per C12, so it's never sent on this request).
export type AccessTokenClaims = { sub: string; role: "student" | "teacher" | "admin"; sid: string };

export function signAccessToken(claims: AccessTokenClaims): { token: string; expiresIn: number } {
  const token = jwt.sign(claims, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
  return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

export type AccessTokenVerifyResult =
  | { valid: true; claims: AccessTokenClaims }
  | { valid: false; expired: boolean };

export function verifyAccessToken(token: string): AccessTokenVerifyResult {
  try {
    const claims = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload & AccessTokenClaims;
    return { valid: true, claims: { sub: claims.sub, role: claims.role, sid: claims.sid } };
  } catch (err) {
    return { valid: false, expired: err instanceof jwt.TokenExpiredError };
  }
}

// Refresh tokens are opaque random bytes, not JWTs (C12) — only their SHA-256
// hash is ever stored, in device_session.refresh_token_hash. High-entropy
// random input makes a fast hash appropriate here, unlike a user's password.
export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}
