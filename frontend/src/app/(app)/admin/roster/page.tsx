"use client";

import { useEffect, useState } from "react";
import { adminApi, type RosterEntry, type SchoolClass } from "@/lib/api/admin";
import { useCurrentAcademicYear } from "@/components/admin/use-current-academic-year";

const STATUS_LABEL: Record<RosterEntry["status"], string> = {
  active: "Active",
  transferred: "Transferred",
  departed: "Departed",
  graduated: "Graduated",
};

export default function RosterPage() {
  const year = useCurrentAcademicYear();
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [classFilter, setClassFilter] = useState("");
  const [transferTarget, setTransferTarget] = useState<RosterEntry | null>(null);
  const [transferToClassId, setTransferToClassId] = useState("");

  async function reload(yearId: string) {
    const [c, r] = await Promise.all([adminApi.listClasses(yearId), adminApi.listRoster({ classId: classFilter || undefined })]);
    setClasses(c);
    // The roster endpoint has no academicYearId filter (matching the
    // roadmap's own spec — classId/status only), so an unfiltered fetch
    // returns every student the institution has ever had, across every
    // year. When "All classes" is selected (no explicit classId), narrow
    // to this year's roster client-side by checking each entry's classId
    // against this year's own class list — otherwise a student from a
    // different year shows up with no resolvable class label, and
    // "Transfer" would offer only this year's classes as targets anyway.
    const yearClassIds = new Set(c.map((cls) => cls.id));
    setRoster(classFilter ? r : r.filter((entry) => yearClassIds.has(entry.classId)));
  }

  useEffect(() => {
    // Standard fetch-on-filter-change — reload() is also reused by the
    // transfer/depart handlers, so it can't be inlined without duplicating
    // it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (year) reload(year.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, classFilter]);

  async function depart(entry: RosterEntry) {
    if (!confirm(`Mark ${entry.firstName} ${entry.lastName} as departed? This never deletes their record.`)) return;
    await adminApi.transitionEnrollment(entry.enrollmentId, { status: "departed" });
    if (year) reload(year.id);
  }

  async function confirmTransfer() {
    if (!transferTarget || !transferToClassId) return;
    await adminApi.transitionEnrollment(transferTarget.enrollmentId, { status: "transferred", toClassId: transferToClassId });
    setTransferTarget(null);
    setTransferToClassId("");
    if (year) reload(year.id);
  }

  if (year === undefined) return null;
  if (year === null || !classes || !roster) return null;

  const classLabel = (id: string) => {
    const c = classes.find((x) => x.id === id);
    return c ? `${c.grade}-${c.letter}` : "?";
  };

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
        Roster — {year.label}
      </h1>

      <select
        value={classFilter}
        onChange={(e) => setClassFilter(e.target.value)}
        className="rounded border border-hair bg-panel px-2 py-1 text-sm"
        style={{ color: "var(--ink)" }}
      >
        <option value="">All classes</option>
        {[...classes]
          .sort((a, b) => a.grade - b.grade || a.letter.localeCompare(b.letter))
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.grade}-{c.letter}
            </option>
          ))}
      </select>

      <table className="w-full border border-hair text-sm">
        <thead>
          <tr className="border-b border-hair" style={{ color: "var(--ink-3)" }}>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Class</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Email</th>
            <th className="w-40" />
          </tr>
        </thead>
        <tbody>
          {roster.map((entry) => (
            <tr key={entry.enrollmentId} className="border-b border-hair" style={{ color: "var(--ink)" }}>
              <td className="p-2">
                {entry.lastName} {entry.firstName}
              </td>
              <td className="p-2">{classLabel(entry.classId)}</td>
              <td className="p-2">{STATUS_LABEL[entry.status]}</td>
              <td className="p-2" style={{ color: "var(--ink-3)" }}>
                {entry.email}
              </td>
              <td className="p-2 text-right">
                {entry.status === "active" && (
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setTransferTarget(entry)} className="text-xs underline" style={{ color: "var(--ink-2)" }}>
                      Transfer
                    </button>
                    <button onClick={() => depart(entry)} className="text-xs text-danger">
                      Depart
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {transferTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,.45)" }}>
          <div className="w-80 space-y-3 rounded-md border border-hair p-4" style={{ background: "var(--panel)" }}>
            <h2 className="font-medium" style={{ color: "var(--ink)" }}>
              Transfer {transferTarget.firstName} {transferTarget.lastName}
            </h2>
            <select
              value={transferToClassId}
              onChange={(e) => setTransferToClassId(e.target.value)}
              className="w-full rounded border border-hair bg-transparent px-2 py-1 text-sm"
              style={{ color: "var(--ink)" }}
            >
              <option value="">Choose a class…</option>
              {classes
                .filter((c) => c.id !== transferTarget.classId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.grade}-{c.letter}
                  </option>
                ))}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setTransferTarget(null)} className="rounded px-3 py-1.5 text-sm" style={{ color: "var(--ink-2)" }}>
                Cancel
              </button>
              <button
                onClick={confirmTransfer}
                disabled={!transferToClassId}
                className="rounded px-3 py-1.5 text-sm disabled:opacity-50"
                style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
