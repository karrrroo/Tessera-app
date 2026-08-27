"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/locale-provider";
import { adminApi, type AcademicYear, type Term } from "@/lib/api/admin";

export default function YearsPage() {
  const t = useT();
  const [years, setYears] = useState<AcademicYear[] | null>(null);
  const [termsByYear, setTermsByYear] = useState<Record<string, Term[]>>({});
  const [newYear, setNewYear] = useState({ label: "", startsOn: "", endsOn: "" });
  const [newTerm, setNewTerm] = useState<Record<string, { index: string; label: string; startsOn: string; endsOn: string }>>({});

  async function reload() {
    const rows = await adminApi.listAcademicYears();
    setYears(rows);
    const terms: Record<string, Term[]> = {};
    for (const y of rows) terms[y.id] = await adminApi.listTerms(y.id);
    setTermsByYear(terms);
  }

  useEffect(() => {
    // Standard fetch-on-mount — reload() is also reused by the create
    // handlers below, so it can't be inlined without duplicating it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, []);

  async function createYear(e: React.FormEvent) {
    e.preventDefault();
    await adminApi.createAcademicYear(newYear);
    setNewYear({ label: "", startsOn: "", endsOn: "" });
    await reload();
  }

  async function createTerm(yearId: string, e: React.FormEvent) {
    e.preventDefault();
    const draft = newTerm[yearId];
    if (!draft) return;
    await adminApi.createTerm({ academicYearId: yearId, index: Number(draft.index), label: draft.label, startsOn: draft.startsOn, endsOn: draft.endsOn });
    setNewTerm((s) => ({ ...s, [yearId]: { index: "", label: "", startsOn: "", endsOn: "" } }));
    await reload();
  }

  if (!years) return null;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 p-8">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
        {t.admin.years}
      </h1>

      {years.map((year) => (
        <section key={year.id} className="space-y-3 border border-hair p-4">
          <h2 className="font-medium" style={{ color: "var(--ink)" }}>
            {year.label} ({year.startsOn} → {year.endsOn})
          </h2>
          <table className="w-full text-sm" style={{ background: "var(--bg-base)" }}>
            <thead>
              <tr style={{ color: "var(--ink-3)" }}>
                <th className="text-left">#</th>
                <th className="text-left">{t.admin.colLabel}</th>
                <th className="text-left">{t.admin.colStarts}</th>
                <th className="text-left">{t.admin.colEnds}</th>
              </tr>
            </thead>
            <tbody>
              {(termsByYear[year.id] ?? []).map((term) => (
                <tr key={term.id} style={{ color: "var(--ink)" }}>
                  <td>{term.index}</td>
                  <td>{term.label}</td>
                  <td>{term.startsOn}</td>
                  <td>{term.endsOn}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <form onSubmit={(e) => createTerm(year.id, e)} className="flex flex-wrap gap-2 text-sm">
            <input
              placeholder="#"
              value={newTerm[year.id]?.index ?? ""}
              onChange={(e) => setNewTerm((s) => ({ ...s, [year.id]: { ...(s[year.id] ?? { label: "", startsOn: "", endsOn: "" }), index: e.target.value } }))}
              className="w-12 rounded border border-hair bg-panel px-2 py-1"
            />
            <input
              placeholder={t.admin.colLabel}
              value={newTerm[year.id]?.label ?? ""}
              onChange={(e) => setNewTerm((s) => ({ ...s, [year.id]: { ...(s[year.id] ?? { index: "", startsOn: "", endsOn: "" }), label: e.target.value } }))}
              className="w-32 rounded border border-hair bg-panel px-2 py-1"
            />
            <input
              type="date"
              value={newTerm[year.id]?.startsOn ?? ""}
              onChange={(e) => setNewTerm((s) => ({ ...s, [year.id]: { ...(s[year.id] ?? { index: "", label: "", endsOn: "" }), startsOn: e.target.value } }))}
              className="rounded border border-hair bg-panel px-2 py-1"
            />
            <input
              type="date"
              value={newTerm[year.id]?.endsOn ?? ""}
              onChange={(e) => setNewTerm((s) => ({ ...s, [year.id]: { ...(s[year.id] ?? { index: "", label: "", startsOn: "" }), endsOn: e.target.value } }))}
              className="rounded border border-hair bg-panel px-2 py-1"
            />
            <button type="submit" className="rounded px-3 py-1" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
              {t.admin.addTerm}
            </button>
          </form>
        </section>
      ))}

      <form onSubmit={createYear} className="space-y-2 border border-hair p-4">
        <h2 className="font-medium" style={{ color: "var(--ink)" }}>
          {t.admin.newYear}
        </h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <input
            placeholder={t.admin.yearLabelHint}
            value={newYear.label}
            onChange={(e) => setNewYear((f) => ({ ...f, label: e.target.value }))}
            className="w-40 rounded border border-hair bg-panel px-2 py-1"
          />
          <input
            type="date"
            value={newYear.startsOn}
            onChange={(e) => setNewYear((f) => ({ ...f, startsOn: e.target.value }))}
            className="rounded border border-hair bg-panel px-2 py-1"
          />
          <input
            type="date"
            value={newYear.endsOn}
            onChange={(e) => setNewYear((f) => ({ ...f, endsOn: e.target.value }))}
            className="rounded border border-hair bg-panel px-2 py-1"
          />
          <button type="submit" className="rounded px-3 py-1" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
            {t.admin.createYear}
          </button>
        </div>
      </form>
    </main>
  );
}
