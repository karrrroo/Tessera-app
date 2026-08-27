"use client";

import { useT } from "@/i18n/locale-provider";
import { exportApi } from "@/lib/api/export";
import { useAsyncData } from "@/lib/use-async-data";

// EXP-5: who, what scope, when, how many marks — "when someone asks
// whether a term was submitted, this answers it." A dense table (C13),
// admin-only.
const SCOPE_LABEL_KEY = {
  "class-subject-term": "s1",
  "class-term": "s2",
  "institution-term": "s3",
} as const;

export function ExportLogTable() {
  const t = useT();
  const { data: rows, error, retry } = useAsyncData(() => exportApi.getLogs(50), []);
  // A real bug, found live: this rendered the raw enum value
  // ("institution-term") instead of the same localized label the export
  // form above it already uses for the identical set of scopes.
  const scopeLabel = (scope: string) => {
    const key = SCOPE_LABEL_KEY[scope as keyof typeof SCOPE_LABEL_KEY];
    return key ? t.exp[key] : scope;
  };

  if (error) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold tracking-wide" style={{ color: "var(--ink-3)" }}>
          {t.exp.logTitle}
        </h3>
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <p className="text-xs" style={{ color: "var(--ink-3)" }}>
            {t.scr.err.body}
          </p>
          <button type="button" onClick={retry} className="text-xs underline" style={{ color: "var(--ink-2)" }}>
            {t.scr.err.retry}
          </button>
        </div>
      </div>
    );
  }

  if (!rows) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold tracking-wide" style={{ color: "var(--ink-3)" }}>
        {t.exp.logTitle}
      </h3>
      <p className="text-xs" style={{ color: "var(--ink-3)" }}>
        {t.exp.logSub}
      </p>
      {rows.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--ink-3)" }}>
          {t.exp.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--hair)" }}>
          <table className="w-full text-left text-xs">
            <tbody>
              {rows.map((row) => {
                const who = row.teacher_first_name ? `${row.teacher_first_name} ${row.teacher_last_name}` : row.actor_email;
                return (
                  <tr key={row.id} className="border-t" style={{ borderColor: "var(--hair)" }}>
                    <td className="whitespace-nowrap px-3 py-2" style={{ color: "var(--ink)" }}>
                      {who}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2" style={{ color: "var(--ink-2)" }}>
                      {scopeLabel(row.scope.scope)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono" style={{ color: "var(--ink-3)" }}>
                      {row.format}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono" style={{ color: "var(--ink)" }}>
                      {row.mark_count} {t.exp.marks}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono" style={{ color: "var(--ink-3)" }}>
                      {new Date(row.created_at).toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
