"use client";

import { useT, useLocale } from "@/i18n/locale-provider";
import type { TodayEntry } from "@/lib/api/identity";

function subjectName(entry: TodayEntry, locale: "hy" | "en" | "ru"): string {
  return locale === "hy" ? entry.subjectNameHy : locale === "ru" ? entry.subjectNameRu : entry.subjectNameEn;
}

// No time-of-day or room here, and no "current lesson" highlight either —
// the schema has neither a period nor a start time (assessment only has a
// date, `held_on`), and PRD §3.2 rules out inventing a timetable to get
// one, so there is no real basis for picking which entry is "now". Derived
// from today's assessments, not a lesson table (roadmap Phase 6: "do not
// invent a lesson table — that is scope creep wearing a small disguise").
export function TodayPanel({ entries }: { entries: TodayEntry[] }) {
  const t = useT();
  const { locale } = useLocale();

  return (
    <div className="flex w-full max-w-[320px] flex-col gap-3.5">
      <span className="font-serif text-[19px] font-semibold" style={{ color: "var(--ink)" }}>
        {t.scr.today.title}
      </span>
      <div
        className="flex flex-col gap-2 rounded-[26px] border p-4"
        style={{ background: "var(--glass)", borderColor: "var(--hair-bright)" }}
      >
        {entries.length === 0 ? (
          <span className="text-[13px]" style={{ color: "var(--ink-3)" }}>
            {t.scr.today.empty}
          </span>
        ) : (
          entries.map((entry) => (
            <span key={entry.assessmentId} className="flex items-center gap-3.5 rounded-2xl px-3.5 py-2.5">
              <span className="truncate text-[13.5px]" style={{ color: "var(--ink)" }}>
                {entry.classLabel} · {subjectName(entry, locale)}
              </span>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
