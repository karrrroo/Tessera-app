"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/locale-provider";
import { exportApi, type ExportLogRow } from "@/lib/api/export";

// EXP-5: who, what scope, when, how many marks — "when someone asks
// whether a term was submitted, this answers it." A dense table (C13),
// admin-only.
export function ExportLogTable() {
  const t = useT();
  const [rows, setRows] = useState<ExportLogRow[] | null>(null);

  useEffect(() => {
    exportApi.getLogs(50).then(setRows);
  }, []);

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
                      {row.scope.scope}
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
