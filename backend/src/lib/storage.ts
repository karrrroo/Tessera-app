import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Readable } from "node:stream";

// File storage (D-4): a local-disk adapter, not the roadmap's S3/R2/MinIO —
// this build skips Cloudflare and MinIO entirely, so attachments live under
// backend/storage/ (gitignored) behind this interface. Swapping in a real S3
// implementation later means writing a second StorageProvider and switching
// which one is constructed; no call site here should need to change.
//
// D-4's own sketch named the interface `save`/`getSignedUrl`/`delete`, but
// `getSignedUrl` doesn't fit Phase 10's concrete requirement (C10: "no
// presigned URL is ever returned to a browser" — every attachment streams
// through the backend's own authenticated endpoint). `read()` returning a
// stream is what that endpoint actually needs, so the interface is
// `save`/`read`/`delete` instead — see docs/decisions.md.
//
// The schema's `credential_request` has no column for the original filename
// or byte size, and this app never runs migrations against the frozen
// schema. Both travel as a JSON sidecar next to the blob (`{key}.meta.json`)
// rather than being invented as new database columns.

const STORAGE_ROOT = join(process.cwd(), "storage");

export type StoredObjectMeta = {
  originalName: string;
  contentType: string;
  sizeBytes: number;
};

export type StorageProvider = {
  save(key: string, buffer: Buffer, meta: Omit<StoredObjectMeta, "sizeBytes">): Promise<void>;
  read(key: string): Promise<{ stream: Readable; meta: StoredObjectMeta } | null>;
  delete(key: string): Promise<void>;
};

function objectPath(key: string): string {
  return join(STORAGE_ROOT, key);
}

function metaPath(key: string): string {
  return join(STORAGE_ROOT, `${key}.meta.json`);
}

class LocalDiskStorageProvider implements StorageProvider {
  async save(key: string, buffer: Buffer, meta: Omit<StoredObjectMeta, "sizeBytes">): Promise<void> {
    const dest = objectPath(key);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buffer);
    const fullMeta: StoredObjectMeta = { ...meta, sizeBytes: buffer.length };
    await writeFile(metaPath(key), JSON.stringify(fullMeta), "utf8");
  }

  async read(key: string): Promise<{ stream: Readable; meta: StoredObjectMeta } | null> {
    try {
      await stat(objectPath(key));
      const meta = JSON.parse(await readFile(metaPath(key), "utf8")) as StoredObjectMeta;
      return { stream: createReadStream(objectPath(key)), meta };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(objectPath(key), { force: true });
    await rm(metaPath(key), { force: true });
  }
}

export const storage: StorageProvider = new LocalDiskStorageProvider();
