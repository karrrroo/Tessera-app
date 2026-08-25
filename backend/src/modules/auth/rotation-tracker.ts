// Distinguishes "this refresh token was rotated away" (a real reuse/theft
// signal) from "this session was explicitly revoked" (expected, no signal at
// all) — device_session's revoked_at can't tell those apart on its own, since
// both end with the same row in the same state. Recording rotations here,
// in memory, is what lets service.ts tell the difference without a schema
// change. Losing this on restart just means a replayed rotated token gets
// treated as a plain dead session instead of triggering a full revoke — the
// safe direction to fail in, unlike the reset-token case.
//
// Pruned lazily (on each record) rather than on a timer — reuse only matters
// shortly after rotation, so a generous 24h window is plenty and this never
// needs to be exact.

const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;

const rotatedAway = new Map<string, { userId: string; rotatedAt: number }>();

export function recordRotatedAway(oldHash: string, userId: string): void {
  const now = Date.now();
  for (const [hash, entry] of rotatedAway) {
    if (now - entry.rotatedAt > PRUNE_AFTER_MS) rotatedAway.delete(hash);
  }
  rotatedAway.set(oldHash, { userId, rotatedAt: now });
}

export function wasRotatedAway(hash: string): { userId: string } | undefined {
  return rotatedAway.get(hash);
}
