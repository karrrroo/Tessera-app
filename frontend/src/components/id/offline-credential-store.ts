import { openDB, type IDBPDatabase } from "idb";
import type { CredentialResponse } from "@/lib/api/identity";

const DB_NAME = "tessera-credential";
const STORE_NAME = "credential";
const RECORD_KEY = "current";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    },
  });
  return dbPromise;
}

// Written on every successful GET /api/me/credential, read first on mount
// (roadmap Phase 6, useCredential) — a private window, cleared site data, or
// a browser that blocks IndexedDB outright all just mean there is nothing
// cached yet, not a crash.
export async function readStoredCredential(): Promise<CredentialResponse | null> {
  try {
    const db = await getDb();
    return (await db.get(STORE_NAME, RECORD_KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function writeStoredCredential(value: CredentialResponse): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE_NAME, value, RECORD_KEY);
  } catch {
    // best-effort — the screen already has the value in memory either way
  }
}
