import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../lib/env.js";

// B5: "The transcript downloads through a time-limited signed key generated
// by the backend — never publicly addressable, and the key is never stored in
// the client."
//
// So the download URL carries a token, not the storage key. The token is
// `applicationId.expiryEpochSeconds.MAC`, the MAC covers both other parts, and
// the endpoint that accepts it still requires an admin session — the signature
// bounds the link's lifetime, it does not replace authentication. C10 is
// unchanged: no presigned URL ever reaches a browser, and every byte still
// streams through the backend's own authenticated endpoint.
//
// The signing key is DERIVED from RESET_SECRET rather than being a new
// environment variable, so deploying this needs no new secret from anyone. The
// derivation is a labelled HMAC, which is standard key separation: a token
// minted here can never be replayed as a password-reset token and vice versa,
// because the two keys are computationally unrelated.
const SIGNING_KEY = createHmac("sha256", env.RESET_SECRET).update("application-transcript-v1").digest();

const TTL_SECONDS = 5 * 60;

function mac(applicationId: string, expiresAt: number): string {
  return createHmac("sha256", SIGNING_KEY).update(`${applicationId}.${expiresAt}`).digest("base64url");
}

export function signTranscriptKey(applicationId: string, now = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + TTL_SECONDS;
  return `${applicationId}.${expiresAt}.${mac(applicationId, expiresAt)}`;
}

export type VerifyResult =
  | { ok: true; applicationId: string }
  | { ok: false; reason: "malformed" | "expired" | "bad-signature" };

export function verifyTranscriptKey(token: string, now = Date.now()): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [applicationId, expiryRaw, given] = parts;
  const expiresAt = Number(expiryRaw);
  if (!Number.isSafeInteger(expiresAt)) return { ok: false, reason: "malformed" };

  // Signature before expiry, and both before anything is done with the id:
  // checking expiry first would let an unsigned token with a far-future
  // expiry reach the comparison, and telling the two failures apart is not
  // information a caller needs.
  const expected = mac(applicationId, expiresAt);
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "bad-signature" };
  if (Math.floor(now / 1000) > expiresAt) return { ok: false, reason: "expired" };
  return { ok: true, applicationId };
}

export const TRANSCRIPT_KEY_TTL_SECONDS = TTL_SECONDS;
