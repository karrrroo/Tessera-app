"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";

const ERROR_MESSAGES: Record<string, string> = {
  IMPORT_FILE_UNREADABLE: "Could not read that file.",
  IMPORT_COLUMNS_MISSING: "The file is missing one or more required columns.",
  IMPORT_TOO_MANY_ROWS: "That file has too many rows (maximum 2000).",
  UNSUPPORTED_MEDIA_TYPE: "That file isn't a real .xlsx spreadsheet.",
  PAYLOAD_TOO_LARGE: "That file is too large (maximum 10 MB).",
};

// Template download above the drop zone — downloading it is the first
// thing that happens (roadmap ADM-4).
export function ImportDropzone({ kind, academicYearId }: { kind: "students" | "teachers"; academicYearId: string }) {
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
        setError(ERROR_MESSAGES[err.code] ?? err.code);
      } else {
        setError("Upload failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <a href={adminApi.importTemplateUrl(kind)} className="inline-block text-sm underline" style={{ color: "var(--ink-2)" }}>
        Download the {kind} template (.xlsx)
      </a>
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
        {busy ? "Uploading…" : "Drag a file here, or click to choose one"}
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
