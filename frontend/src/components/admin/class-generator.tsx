"use client";

import { useState } from "react";
import { adminApi } from "@/lib/api/admin";
import { useT } from "@/i18n/locale-provider";
import { ARMENIAN_CLASS_LETTERS } from "@/design/armenian-letters";

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
const LETTERS: readonly string[] = ARMENIAN_CLASS_LETTERS;

// Live preview of the exact class names before the request — "seeing '16
// classes' before pressing is what makes a bulk action safe to press"
// (roadmap ADM-3).
export function ClassGenerator({ academicYearId, onGenerated }: { academicYearId: string; onGenerated: () => void }) {
  const t = useT();
  const [grades, setGrades] = useState<Set<number>>(new Set());
  const [letters, setLetters] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  const combos = [...grades].sort((a, b) => a - b).flatMap((g) => [...letters].sort().map((l) => `${g}-${l}`));

  function toggle<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  async function generate() {
    setBusy(true);
    setResult(null);
    try {
      const res = await adminApi.generateClasses({ academicYearId, grades: [...grades], letters: [...letters] });
      setResult({ created: res.created.length, skipped: res.skipped.length });
      onGenerated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 border border-hair p-4">
      <h2 className="font-medium" style={{ color: "var(--ink)" }}>
        {t.admin.classGenerator}
      </h2>
      <div>
        <p className="text-xs" style={{ color: "var(--ink-3)" }}>
          {t.admin.grades}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {GRADES.map((g) => (
            <button
              key={g}
              onClick={() => toggle(grades, g, setGrades)}
              className="h-8 w-8 rounded border text-sm"
              style={{
                borderColor: grades.has(g) ? "var(--accent)" : "var(--hair)",
                background: grades.has(g) ? "var(--accent)" : "transparent",
                color: grades.has(g) ? "var(--accent-fg)" : "var(--ink-2)",
              }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs" style={{ color: "var(--ink-3)" }}>
          {t.admin.letters}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {LETTERS.map((l) => (
            <button
              key={l}
              onClick={() => toggle(letters, l, setLetters)}
              className="h-8 w-8 rounded border text-sm"
              style={{
                borderColor: letters.has(l) ? "var(--accent)" : "var(--hair)",
                background: letters.has(l) ? "var(--accent)" : "transparent",
                color: letters.has(l) ? "var(--accent-fg)" : "var(--ink-2)",
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {combos.length > 0 && (
        <div>
          <p className="text-xs" style={{ color: "var(--ink-3)" }}>
            Will create {combos.length} {combos.length === 1 ? "class" : "classes"} (existing ones are skipped):
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--ink)" }}>
            {combos.join(", ")}
          </p>
        </div>
      )}

      <button
        onClick={generate}
        disabled={combos.length === 0 || busy}
        className="rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
      >
        {t.admin.generate} {combos.length > 0 ? combos.length : ""} {t.admin.classes.toLowerCase()}
      </button>

      {result && (
        <p className="text-sm" style={{ color: "var(--ok)" }}>
          Created {result.created}, skipped {result.skipped} (already existed).
        </p>
      )}
    </div>
  );
}
