"use client";

import { useEffect, useState } from "react";
import { identityApi, type AnomalyEntry } from "@/lib/api/identity";
import { useT } from "@/i18n/locale-provider";
import { ScreenError } from "@/components/record/screen-error";

// No design precedent (roadmap Phase 6 C13) — a dense table where a
// two-location pair is obvious at a glance: the flagged scan and the prior
// scan it conflicts with sit side by side in the same row, not two
// separate rows a reader has to correlate.
export default function ScanAnomaliesPage() {
  const t = useT();
  const [rows, setRows] = useState<AnomalyEntry[] | null>(null);
  const [error, setError] = useState(false);

  // A real bug, found live while smoke-testing this screen: no `.catch()`
  // at all, the same pattern fixed everywhere else in the app this session.
  function load() {
    setError(false);
    identityApi.getAnomalies().then(setRows, () => setError(true));
  }
  useEffect(load, []);

  const RESULT_LABEL: Record<AnomalyEntry["result"], string> = {
    valid: t.admin.resultValid,
    revoked: t.admin.resultRevoked,
    unknown: t.admin.resultUnknown,
    signature_invalid: t.admin.resultSigInvalid,
    not_enrolled: t.admin.resultNotEnrolled,
  };

  if (error) return <ScreenError onRetry={load} />;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
          {t.admin.scanAnomalies}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
          {t.admin.anomalyHint}
        </p>
      </div>

      {rows === null ? null : rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ink-3)" }}>
          {t.admin.noAnomalies}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--hair)" }}>
          <table className="w-full text-left text-sm" style={{ background: "var(--bg-base)" }}>
            <thead>
              <tr style={{ background: "var(--surface2)" }}>
                {[
                  t.admin.anomalyStudent,
                  t.admin.anomalyClass,
                  t.admin.anomalyResult,
                  t.admin.anomalyLocA,
                  t.admin.anomalyAtA,
                  t.admin.anomalyLocB,
                  t.admin.anomalyAtB,
                  t.admin.anomalyDelta,
                ].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium" style={{ color: "var(--ink-2)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.scanEventId} className="border-t" style={{ borderColor: "var(--hair)" }}>
                  <td className="px-3 py-2" style={{ color: "var(--ink)" }}>
                    {row.studentFirstName} {row.studentLastName}
                  </td>
                  <td className="px-3 py-2 font-mono" style={{ color: "var(--ink-2)" }}>
                    {row.classLabel || "—"}
                  </td>
                  <td className="px-3 py-2" style={{ color: row.result === "valid" ? "var(--ok)" : "var(--danger)" }}>
                    {RESULT_LABEL[row.result]}
                  </td>
                  <td className="px-3 py-2 font-mono" style={{ color: "var(--ink-2)" }}>
                    {row.previousScannerId}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--ink-3)" }}>
                    {new Date(row.previousScannedAt).toLocaleTimeString()}
                  </td>
                  <td className="px-3 py-2 font-mono" style={{ color: "var(--ink-2)" }}>
                    {row.scannerId}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--ink-3)" }}>
                    {new Date(row.scannedAt).toLocaleTimeString()}
                  </td>
                  <td className="px-3 py-2 font-mono" style={{ color: "var(--warning)" }}>
                    {row.secondsAgo}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
