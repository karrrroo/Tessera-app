import { pool } from "../../db/client.js";
import { deriveHandle, handleKey } from "./crypto.js";

type MapEntry = { credentialId: string; studentId: string };

// Built at boot from `select id, student_id, seed from qr_credential`, never
// from a stored handle column (C2 forbids adding one — see roadmap: "the
// obvious reading of 'look up by handle' is 'add an indexed column', and
// that is exactly the change C2 forbids"). This map resolves the handle and
// nothing else; `revoked_at` is re-read from the row on every scan, so a
// stale map can only fail to *find* a newly issued credential — never miss
// a revocation performed on another instance.
let map = new Map<string, MapEntry>();

export async function rebuildHandleMap(): Promise<void> {
  const { rows } = await pool.query<{ id: string; student_id: string; seed: string }>(
    "select id, student_id, seed from qr_credential",
  );
  const next = new Map<string, MapEntry>();
  for (const row of rows) {
    next.set(handleKey(deriveHandle(row.seed)), { credentialId: row.id, studentId: row.student_id });
  }
  map = next;
}

export function lookupHandle(handle: Buffer): MapEntry | undefined {
  return map.get(handleKey(handle));
}

// Called right after a credential is first created (repo.ts) so a brand-new
// student's card scans immediately, without waiting for the next interval
// rebuild.
export function registerHandle(seed: string, entry: MapEntry): void {
  map.set(handleKey(deriveHandle(seed)), entry);
}

const REBUILD_INTERVAL_MS = 5 * 60 * 1000;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

export async function initHandleMap(): Promise<void> {
  await rebuildHandleMap();
  if (refreshTimer) return;
  refreshTimer = setInterval(() => {
    rebuildHandleMap().catch((err) => {
      console.error("[identity] handle map rebuild failed", err);
    });
  }, REBUILD_INTERVAL_MS);
}
