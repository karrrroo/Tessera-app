"use client";

import { gradeColorVar } from "@/design/grade-colors";
import { useLocale } from "@/i18n/locale-provider";
import type { ArchiveYear as ArchiveYearData } from "@/lib/api/record";

// No attestation/document table exists anywhere in the schema, so
// `attestations` is always empty for real data (docs/decisions.md) — this
// renders only the final-marks list, and simply has nothing to show for
// attestations rather than a fabricated "0 documents" line.
export function ArchiveYear({ year }: { year: ArchiveYearData }) {
  const { locale } = useLocale();

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
          {year.yearLabel}
        </span>
        <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>
          {year.classLabel}
        </span>
      </div>
      <div className="rounded-[26px] p-1" style={{ background: "var(--panel)", border: "1px solid var(--hair)" }}>
        {year.finalMarks.map((m) => {
          const name = locale === "hy" ? m.nameHy : locale === "ru" ? m.nameRu : m.nameEn;
          return (
            <div key={m.subjectId} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <span className="text-[12.5px]" style={{ color: "var(--ink)" }}>
                {name}
              </span>
              <span
                className="font-mono text-[13px] font-semibold"
                style={{ color: m.finalAverage === null ? "var(--ink-3)" : gradeColorVar(m.finalAverage) }}
              >
                {m.finalAverage ?? "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
