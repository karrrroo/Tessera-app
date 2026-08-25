import argon2 from "argon2";
import bcrypt from "bcryptjs";

// OWASP baseline (roadmap Phase 3).
const ARGON2_OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

// Seed data is bcrypt ($2a$12$…) per tessera-PRD.md §11.5.2 and docs/decisions.md D-9;
// every password this app itself sets uses Argon2id. verifyPassword accepts either and
// tells the caller whether to transparently upgrade the stored hash to Argon2id.
const BCRYPT_PREFIX = /^\$2[aby]\$/;
const ARGON2ID_PREFIX = /^\$argon2id\$/;

// Fixed dummy hash checked when no user is found, so a real vs. fictional
// identifier takes the same time (AUTH-9). Not a real account's hash.
const DUMMY_HASH = await argon2.hash("tessera-timing-safety-dummy", ARGON2_OPTS);

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTS);
}

export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  if (ARGON2ID_PREFIX.test(hash)) {
    return { valid: await argon2.verify(hash, plain), needsUpgrade: false };
  }
  if (BCRYPT_PREFIX.test(hash)) {
    const valid = await bcrypt.compare(plain, hash);
    return { valid, needsUpgrade: valid };
  }
  return { valid: false, needsUpgrade: false };
}

// Always takes the same code path as a real verify, regardless of which branch
// of verifyPassword would have run, so "user not found" and "wrong password"
// cost the same wall-clock time.
export async function verifyDummyPassword(plain: string): Promise<void> {
  await argon2.verify(DUMMY_HASH, plain);
}

export function isPasswordStrongEnough(plain: string): string[] {
  const failed: string[] = [];
  if (plain.length < 8) failed.push("length");
  if (!/\d/.test(plain)) failed.push("digit");
  if (!/[A-Z]/.test(plain)) failed.push("uppercase");
  return failed;
}
