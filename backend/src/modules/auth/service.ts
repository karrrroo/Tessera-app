import { ApiError, RATE_LIMITED } from "../../http/errors.js";
import {
  hashPassword,
  isPasswordStrongEnough,
  verifyDummyPassword,
  verifyPassword,
} from "./password.js";
import { generateRefreshToken, hashRefreshToken, signAccessToken } from "./tokens.js";
import { createResetToken, verifyResetToken } from "./reset-token.js";
import { checkForgotCooldown, clearFailedLogins, recordFailedLogin } from "./rate-limit.js";
import { recordRotatedAway, wasRotatedAway } from "./rotation-tracker.js";
import * as repo from "./repo.js";

const REFRESH_COOKIE_MAX_AGE_SECONDS = { normal: 30 * 24 * 60 * 60, remember: 90 * 24 * 60 * 60 };
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export type RefreshCookie = { token: string; maxAgeSeconds: number };

export async function login(input: { identifier: string; password: string; remember: boolean; deviceLabel: string }) {
  const found = await repo.findUserByIdentifier(input.identifier);

  if (!found) {
    await verifyDummyPassword(input.password);
    recordFailedLogin(input.identifier);
    throw new ApiError(401, "AUTH_INVALID_CREDENTIALS");
  }

  if (found.lockedUntil && new Date(found.lockedUntil).getTime() > Date.now()) {
    throw new ApiError(423, "AUTH_ACCOUNT_LOCKED", {
      details: { retryAfterSeconds: Math.ceil((new Date(found.lockedUntil).getTime() - Date.now()) / 1000) },
    });
  }

  const { valid, needsUpgrade } = await verifyPassword(found.passwordHash, input.password);
  if (!valid) {
    const { shouldLock } = recordFailedLogin(input.identifier);
    if (shouldLock) {
      await repo.setLockedUntil(found.id, new Date(Date.now() + LOCKOUT_DURATION_MS));
      throw new ApiError(423, "AUTH_ACCOUNT_LOCKED", { details: { retryAfterSeconds: LOCKOUT_DURATION_MS / 1000 } });
    }
    throw new ApiError(401, "AUTH_INVALID_CREDENTIALS");
  }

  if (needsUpgrade) {
    await repo.setPasswordHash(found.id, await hashPassword(input.password), false);
  }
  clearFailedLogins(input.identifier);
  await repo.setLastLoginAt(found.id);

  const { token: refreshToken, hash } = generateRefreshToken();
  const session = await repo.createDeviceSession({ userId: found.id, deviceLabel: input.deviceLabel, refreshTokenHash: hash });
  const { token: accessToken, expiresIn } = signAccessToken({ sub: found.id, role: found.role, sid: session.id });
  const user = await repo.getUserProfile(found.id);

  return {
    accessToken,
    expiresIn,
    user,
    refreshCookie: {
      token: refreshToken,
      maxAgeSeconds: input.remember ? REFRESH_COOKIE_MAX_AGE_SECONDS.remember : REFRESH_COOKIE_MAX_AGE_SECONDS.normal,
    } satisfies RefreshCookie,
  };
}

export async function refresh(presentedToken: string | undefined) {
  if (!presentedToken) throw new ApiError(401, "AUTH_REFRESH_MISSING");

  const presentedHash = hashRefreshToken(presentedToken);
  const active = await repo.findActiveDeviceSessionByHash(presentedHash);

  if (!active) {
    // Only a token this service itself rotated away is a reuse/theft signal
    // — a session the user explicitly revoked (Settings, "sign out this
    // device") is expected to fail here too, but harmlessly, with no
    // collateral effect on their other sessions. See rotation-tracker.ts.
    const rotatedAway = wasRotatedAway(presentedHash);
    if (rotatedAway) {
      await repo.revokeAllDeviceSessionsForUser(rotatedAway.userId);
      throw new ApiError(401, "AUTH_REFRESH_REUSED");
    }
    const anyMatch = await repo.findAnyDeviceSessionByHash(presentedHash);
    throw new ApiError(401, anyMatch ? "AUTH_SESSION_REVOKED" : "AUTH_REFRESH_INVALID");
  }

  const u = await repo.findUserById(active.userId);
  if (!u) throw new ApiError(401, "AUTH_SESSION_REVOKED");

  const { token: newRefreshToken, hash: newHash } = generateRefreshToken();
  const newSession = await repo.rotateDeviceSession(active.id, {
    userId: active.userId,
    deviceLabel: active.deviceLabel,
    newHash,
  });
  recordRotatedAway(presentedHash, active.userId);
  const { token: accessToken, expiresIn } = signAccessToken({ sub: u.id, role: u.role, sid: newSession.id });

  return {
    accessToken,
    expiresIn,
    refreshCookie: { token: newRefreshToken, maxAgeSeconds: REFRESH_COOKIE_MAX_AGE_SECONDS.normal } satisfies RefreshCookie,
  };
}

export async function logout(sessionId: string) {
  await repo.revokeDeviceSession(sessionId);
}

export async function changePassword(userId: string, currentSessionId: string, input: { currentPassword: string; newPassword: string }) {
  const u = await repo.findUserById(userId);
  if (!u) throw new ApiError(401, "UNAUTHENTICATED");

  const { valid } = await verifyPassword(u.passwordHash, input.currentPassword);
  if (!valid) throw new ApiError(400, "AUTH_CURRENT_PASSWORD_INVALID");

  const failed = isPasswordStrongEnough(input.newPassword);
  if (failed.length) throw new ApiError(422, "AUTH_PASSWORD_WEAK", { details: { failed } });

  const { valid: sameAsCurrent } = await verifyPassword(u.passwordHash, input.newPassword);
  if (sameAsCurrent) throw new ApiError(422, "AUTH_PASSWORD_REUSED");

  await repo.setPasswordHash(userId, await hashPassword(input.newPassword), true);
  await repo.revokeAllDeviceSessionsExcept(userId, currentSessionId);
}

// Dev-only fallback until a mail provider is chosen (Phase 14) — the actual
// reset link. Held in memory only, most-recent-per-email, for
// GET /api/dev/last-reset-token (never mounted when NODE_ENV === "production").
const devLastResetLink = new Map<string, string>();
export function getDevLastResetLink(email: string) {
  return devLastResetLink.get(email);
}

export async function forgotPassword(email: string) {
  const cooldown = checkForgotCooldown(email);
  if (!cooldown.allowed) throw RATE_LIMITED(cooldown.retryAfterSeconds);

  // Always 202/empty either way (AUTH-9) — enumeration would undo the point
  // of the generic login error.
  const found = await repo.findUserByIdentifier(email);
  if (found) {
    const token = createResetToken(found.id, found.passwordHash);
    devLastResetLink.set(email, `/reset/${token}`);
    console.log(`[dev] password reset link for ${email}: /reset/${token}`);
  }
}

export async function resetPassword(input: { token: string; newPassword: string }) {
  const failed = isPasswordStrongEnough(input.newPassword);
  if (failed.length) throw new ApiError(422, "AUTH_PASSWORD_WEAK", { details: { failed } });

  // The token's userId is unauthenticated input — it only becomes trustworthy
  // once the MAC (keyed by that same user's current password_hash) checks out.
  let claimedUserId: string | undefined;
  try {
    [claimedUserId] = Buffer.from(input.token, "base64url").toString("utf8").split(".");
  } catch {
    // falls through to the same generic error as any other malformed token
  }
  const u = claimedUserId ? await repo.findUserById(claimedUserId) : undefined;
  if (!u) throw new ApiError(400, "AUTH_RESET_TOKEN_INVALID");

  const result = verifyResetToken(input.token, u.passwordHash);
  if (!result.ok) {
    throw result.reason === "expired"
      ? new ApiError(410, "AUTH_RESET_TOKEN_EXPIRED")
      : new ApiError(400, "AUTH_RESET_TOKEN_INVALID");
  }

  await repo.setPasswordHash(u.id, await hashPassword(input.newPassword), true);
  await repo.revokeAllDeviceSessionsForUser(u.id);
}

export async function listSessions(userId: string, currentSessionId: string) {
  const rows = await repo.listDeviceSessions(userId);
  return rows.map((r) => ({
    id: r.id,
    deviceLabel: r.deviceLabel,
    lastSeenAt: r.lastSeenAt,
    createdAt: r.createdAt,
    current: r.id === currentSessionId,
  }));
}

export async function revokeSession(userId: string, sessionId: string) {
  const rows = await repo.listDeviceSessions(userId);
  const target = rows.find((r) => r.id === sessionId);
  if (!target) throw new ApiError(404, "SESSION_NOT_FOUND");
  await repo.revokeDeviceSession(sessionId);
}

export async function revokeAllOtherSessions(userId: string, currentSessionId: string) {
  await repo.revokeAllDeviceSessionsExcept(userId, currentSessionId);
}

export async function listDemoAccounts() {
  return repo.listDemoAccounts();
}
