"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useT } from "@/i18n/locale-provider";
import { adminApi } from "@/lib/api/admin";

type Credential = { studentId: string; fullName: string; login: string; temporaryPassword: string };

// Print stylesheet: one A4 page, black on white, no decoration bleeding into
// the margin (roadmap ADM-6). Credentials are never persisted anywhere —
// this screen always calls the reissue endpoint on demand, and warns before
// doing so, since the last-generated batch's own passwords are gone the
// moment that browser tab is closed (S-2).
export default function HandoutPage() {
  const t = useT();
  const { classId } = useParams<{ classId: string }>();
  const [credentials, setCredentials] = useState<Credential[] | null>(null);
  const [skipped, setSkipped] = useState<{ studentId: string; code: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function reissue() {
    if (!confirm("This regenerates temporary passwords for every student in this class who hasn't changed theirs yet. Continue?")) return;
    setBusy(true);
    try {
      const result = await adminApi.reissueCredentials(classId);
      setCredentials(result.credentials);
      setSkipped(result.skipped);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="p-8 print:hidden">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
          Credential handout
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
          Passwords are shown once. Print or write them down before leaving this page — they cannot be retrieved
          again, only reissued (which invalidates the old ones).
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={reissue}
            disabled={busy}
            className="rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            {busy ? "Generating…" : "Generate credentials"}
          </button>
          {credentials && (
            <button onClick={() => window.print()} className="rounded border border-hair px-4 py-2 text-sm" style={{ color: "var(--ink-2)" }}>
              Print
            </button>
          )}
        </div>
        {skipped.length > 0 && (
          <p className="mt-2 text-sm" style={{ color: "var(--ink-3)" }}>
            {skipped.length} student(s) already changed their password and were skipped.
          </p>
        )}
      </div>

      {credentials && (
        <div className="handout-sheet bg-white p-8 text-black">
          <table className="w-full border-collapse text-sm" style={{ background: "var(--bg-base)" }}>
            <thead>
              <tr>
                <th className="border border-black p-2 text-left">{t.admin.colName}</th>
                <th className="border border-black p-2 text-left">{t.admin.colLogin}</th>
                <th className="border border-black p-2 text-left">{t.admin.colTempPassword}</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((c) => (
                <tr key={c.studentId}>
                  <td className="border border-black p-2">{c.fullName}</td>
                  <td className="border border-black p-2">{c.login}</td>
                  <td className="border border-black p-2 font-mono">{c.temporaryPassword}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          .handout-sheet { break-after: page; }
        }
      `}</style>
    </>
  );
}
