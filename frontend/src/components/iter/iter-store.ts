import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "tessera-iter";
const STORE_NAME = "messages";

export type IterMessage = { id: string; role: "user" | "model"; text: string; at: string };

// No server-side persistence by design (docs/decisions.md, Phase 11 built
// ahead of schedule): the roadmap's own original plan for an `iter_message`
// table is skipped because this build never alters the schema and the
// roadmap itself flags storing minors' conversations as an open legal
// question. History lives here instead — IndexedDB, per user — same
// pattern as the gradebook's draft store (draft-store.ts).
let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    },
  });
  return dbPromise;
}

function storeKey(userId: string): string {
  return `messages:${userId}`;
}

export async function loadMessages(userId: string): Promise<IterMessage[]> {
  try {
    const db = await getDb();
    const stored = (await db.get(STORE_NAME, storeKey(userId))) as IterMessage[] | undefined;
    return stored ?? [];
  } catch {
    return [];
  }
}

export async function saveMessages(userId: string, messages: IterMessage[]): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE_NAME, messages, storeKey(userId));
  } catch {
    // best-effort — the in-memory conversation for this session still has it
  }
}

export async function clearMessages(userId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE_NAME, storeKey(userId));
  } catch {
    // best-effort
  }
}
