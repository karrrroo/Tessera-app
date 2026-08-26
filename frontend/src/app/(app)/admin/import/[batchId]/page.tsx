"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { adminApi, type ImportBatch } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";
import { ImportPreviewTable } from "@/components/admin/import-preview-table";

const APPLY_ERROR_MESSAGES: Record<string, string> = {
  IMPORT_BATCH_NOT_PREVIEWING: "This batch was already applied or discarded.",
  IMPORT_HAS_ERRORS: "Some rows still have errors.",
  IMPORT_BATCH_EXPIRED: "This preview has expired (previews live 24 hours). Upload the file again.",
};

export default function ImportBatchPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const academicYearId = searchParams.get("academicYearId") ?? "";
  const kind = (searchParams.get("kind") as "students" | "teachers") ?? "students";

  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ created: Record<string, number>; credentials: unknown[] } | null>(null);

  async function reload() {
    setBatch(await adminApi.getImportBatch(batchId, academicYearId));
  }

  useEffect(() => {
    // Standard fetch-on-mount — reload() is also reused by commitCell, so
    // it can't be inlined without duplicating it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  async function commitCell(rowIndex: number, field: string, value: string) {
    const updated = await adminApi.patchImportRow(batchId, rowIndex, academicYearId, { [field]: value });
    setBatch((b) => (b ? { ...b, rows: b.rows.map((r) => (r.rowIndex === rowIndex ? updated : r)), errorCount: b.rows.filter((r) => (r.rowIndex === rowIndex ? updated.status : r.status) === "error").length } : b));
    await reload();
  }

  async function apply() {
    setApplying(true);
    setApplyError(null);
    try {
      const result = await adminApi.applyImport(batchId, academicYearId);
      setApplied(result);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setApplyError(APPLY_ERROR_MESSAGES[err.code] ?? err.code);
      } else {
        setApplyError("Could not apply this batch.");
      }
    } finally {
      setApplying(false);
    }
  }

  async function discard() {
    await adminApi.discardImport(batchId);
    router.push(kind === "students" ? "/admin/import/students" : "/admin/import/teachers");
  }

  if (!batch) return null;

  if (applied) {
    return (
      <main className="mx-auto w-full max-w-2xl space-y-4 p-8">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--ok)" }}>
          Applied
        </h1>
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          {Object.entries(applied.created)
            .map(([k, v]) => `${v} ${k}`)
            .join(", ")}{" "}
          created.
        </p>
        <p className="text-sm font-medium" style={{ color: "var(--danger)" }}>
          {applied.credentials.length} temporary passwords were generated. They are shown once, right now, and never
          again — write them down or print the handout before leaving this page.
        </p>
        <pre className="max-h-96 overflow-auto border border-hair p-3 text-xs" style={{ color: "var(--ink)" }}>
          {JSON.stringify(applied.credentials, null, 2)}
        </pre>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
            {batch.filename}
          </h1>
          <p className="text-sm" style={{ color: "var(--ink-3)" }}>
            {batch.rowCount} rows · {batch.errorCount} errors · {batch.warningCount} warnings
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={discard} className="rounded border border-hair px-4 py-2 text-sm" style={{ color: "var(--ink-2)" }}>
            Discard
          </button>
          <button
            onClick={apply}
            disabled={batch.errorCount > 0 || applying}
            className="rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            {applying ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>

      {applyError && <p className="text-sm text-danger">{applyError}</p>}

      <ImportPreviewTable rows={batch.rows} kind={kind} onCellCommit={commitCell} />
    </main>
  );
}
