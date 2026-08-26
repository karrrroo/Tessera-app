import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "tessera-gradebook-drafts";
const STORE_NAME = "drafts";

export type DraftEntry = { value: number; enteredAt: string };

// GB-3: keyed `${classId}:${subjectId}:${termId}`, module-level (not
// component state) so switching class doesn't unmount it and doesn't
// clear the key — losing a draft once destroys trust permanently.
const memoryStore = new Map<string, Map<string, DraftEntry>>();
let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    },
  });
  return dbPromise;
}

export function draftGroupKey(classId: string, subjectId: string, termId: string): string {
  return `${classId}:${subjectId}:${termId}`;
}

export function cellKey(assessmentId: string, studentId: string): string {
  return `${assessmentId}:${studentId}`;
}

function getMap(groupKey: string): Map<string, DraftEntry> {
  let map = memoryStore.get(groupKey);
  if (!map) {
    map = new Map();
    memoryStore.set(groupKey, map);
  }
  return map;
}

// In IndexedDB before Postgres, always — an unflushed entry has to
// survive a crashed tab, and the 600ms network debounce is exactly the
// window a crash can land in.
async function persist(groupKey: string): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE_NAME, Object.fromEntries(getMap(groupKey)), groupKey);
  } catch {
    // best-effort — the in-memory map (and this session) still has it
  }
}

export function setDraft(groupKey: string, cell: string, value: number, enteredAt: string): void {
  getMap(groupKey).set(cell, { value, enteredAt });
  void persist(groupKey);
}

export function clearDraft(groupKey: string, cell: string): void {
  getMap(groupKey).delete(cell);
  void persist(groupKey);
}

export function getDraftValue(groupKey: string, cell: string): number | undefined {
  return getMap(groupKey).get(cell)?.value;
}

export function getGroupEntries(groupKey: string): [string, DraftEntry][] {
  return [...getMap(groupKey).entries()];
}

// Restores this key's map from IndexedDB into memory exactly once per
// session (a key already in memory this session is authoritative — it
// may hold edits IndexedDB's last persist hasn't caught up to yet).
export async function restoreDraftGroup(groupKey: string): Promise<{ restoredCount: number }> {
  if (memoryStore.has(groupKey)) return { restoredCount: 0 };
  try {
    const db = await getDb();
    const stored = (await db.get(STORE_NAME, groupKey)) as Record<string, DraftEntry> | undefined;
    const map = new Map(Object.entries(stored ?? {}));
    memoryStore.set(groupKey, map);
    return { restoredCount: map.size };
  } catch {
    memoryStore.set(groupKey, new Map());
    return { restoredCount: 0 };
  }
}

// Reconciliation on every gradebook load (roadmap GB-3): a server-published
// mark always wins outright (it's no longer this store's concern once
// published); a local entry newer than the server's own draft `enteredAt`
// wins over that server draft (it hasn't been flushed yet); otherwise the
// server's draft wins and the stale local entry is dropped.
export function reconcileDraftGroup(
  groupKey: string,
  serverMarks: { assessmentId: string; studentId: string; state: "draft" | "published"; enteredAt?: string }[],
): void {
  const map = getMap(groupKey);
  for (const mark of serverMarks) {
    const key = cellKey(mark.assessmentId, mark.studentId);
    const local = map.get(key);
    if (!local) continue;
    if (mark.state === "published") {
      map.delete(key);
    } else if (mark.enteredAt && local.enteredAt <= mark.enteredAt) {
      map.delete(key);
    }
  }
  void persist(groupKey);
}
