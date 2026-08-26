"use client";

import { useState } from "react";
import { useLocale, useT } from "@/i18n/locale-provider";
import { downloadExport } from "@/lib/api/export";

// GB-14: a secondary action in the class header, deliberately not beside
// Publish (different kinds of action). Scope is pre-filled from whichever
// class/subject/term is currently open — no picker of its own.
export function ExportButton({ classId, subjectId, termId }: { classId: string; subjectId: string; termId: string }) {
  const t = useT();
  const { locale } = useLocale();
  const [exporting, setExporting] = useState(false);

  async function run() {
    if (exporting) return;
    setExporting(true);
    try {
      await downloadExport({ scope: "class-subject-term", classId, subjectId, termId, format: "xlsx", locale });
    } catch {
      // A failed export is a no-op the teacher can just retry — nothing in
      // the gradebook's own state depends on it succeeding.
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={exporting}
      title={t.scr.gb.exportBtn}
      className="flex-none rounded-full border px-3.5 py-2 text-xs disabled:opacity-50"
      style={{ borderColor: "var(--hair)", color: "var(--ink-2)" }}
    >
      {exporting ? "…" : t.scr.gb.exportBtn}
    </button>
  );
}
