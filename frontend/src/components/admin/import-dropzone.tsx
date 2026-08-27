"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";
import { useT } from "@/i18n/locale-provider";

type Dict = ReturnType<typeof useT>;
const ERROR_KEY: Record<string, keyof Dict["admin"]> = {
  IMPORT_FILE_UNREADABLE: "errUnreadable",
  IMPORT_COLUMNS_MISSING: "errColumns",
  IMPORT_TOO_MANY_ROWS: "errTooManyRows",
  UNSUPPORTED_MEDIA_TYPE: "errNotXlsx",
  PAYLOAD_TOO_LARGE: "errTooLarge",
};

// Template download above the drop zone — downloading it is the first
// thing that happens (roadmap ADM-4).
export function ImportDropzone({ kind, academicYearId }: { kind: "students" | "teachers"; academicYearId: string }) {
  const t = useT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const batch = await adminApi.uploadImport(kind, academicYearId, file);
      router.push(`/admin/import/${batch.batchId}?kind=${kind}&academicYearId=${academicYearId}`);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        const key = ERROR_KEY[err.code];
        setError(key ? (t.admin[key] as string) : err.code);
      } else {
        setError(t.admin.uploadFailed);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          void adminApi.downloadImportTemplate(kind).catch(() => setError(t.admin.uploadFailed));
        }}
        className="inline-block text-sm underline"
        style={{ color: "var(--ink-2)" }}
      >
        {kind === "students" ? t.admin.tmplStudents : t.admin.tmplTeachers}
      </button>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded border-2 border-dashed text-sm"
        style={{ borderColor: dragOver ? "var(--accent)" : "var(--hair)", color: "var(--ink-3)" }}
      >
        {busy ? t.admin.uploading : t.admin.dropHint}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
