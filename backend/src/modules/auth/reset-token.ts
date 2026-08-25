import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../lib/env.js";

// Stateless password-reset token, keyed to the user's current password_hash —
// no table, no schema change, no in-memory store (docs/decisions.md D-11).
//
//   payload = userId + "." + issuedAtEpochSeconds
//   mac     = HMAC-SHA256(RESET_SECRET, payload + "." + passwordHash), first 32 chars (base64url)
//   token   = base64url(payload + "." + mac)
//
// Verifying recomputes the MAC against the CURRENT password_hash. Once a reset
// succeeds, password_hash changes and every outstanding token for that user —
// this one and any other still-live one — stops verifying on its own. There is
// no separate "used" flag; a changed password is what makes a token single-use.
// Trade-off accepted: two tokens requested within the same 30 minutes are both
// live until either is used, not just the most recent one.

const MAX_AGE_SECONDS = 30 * 60;

function macFor(payload: string, passwordHash: string): string {
  return createHmac("sha256", env.RESET_SECRET)
    .update(`${payload}.${passwordHash}`)
    .digest("base64url")
    .slice(0, 32);
}

export function createResetToken(userId: string, passwordHash: string): string {
  const payload = `${userId}.${Math.floor(Date.now() / 1000)}`;
  const mac = macFor(payload, passwordHash);
  return Buffer.from(`${payload}.${mac}`, "utf8").toString("base64url");
}

export type ResetTokenResult = { ok: true; userId: string } | { ok: false; reason: "invalid" | "expired" };

export function verifyResetToken(token: string, passwordHash: string): ResetTokenResult {
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return { ok: false, reason: "invalid" };
  }

  const parts = decoded.split(".");
  if (parts.length !== 3) return { ok: false, reason: "invalid" };
  const [userId, issuedAtRaw, mac] = parts;
  const issuedAt = Number(issuedAtRaw);
  if (!userId || !Number.isFinite(issuedAt)) return { ok: false, reason: "invalid" };

  const expectedMac = macFor(`${userId}.${issuedAtRaw}`, passwordHash);
  const macBuf = Buffer.from(mac, "utf8");
  const expectedBuf = Buffer.from(expectedMac, "utf8");
  if (macBuf.length !== expectedBuf.length || !timingSafeEqual(macBuf, expectedBuf)) {
    return { ok: false, reason: "invalid" };
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - issuedAt;
  if (ageSeconds < 0 || ageSeconds > MAX_AGE_SECONDS) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, userId };
}
