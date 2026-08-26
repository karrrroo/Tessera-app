"use client";

import type { TeacherClass } from "@/lib/api/gradebook";
import { useLocale } from "@/i18n/locale-provider";

function subjectName(c: TeacherClass, locale: "hy" | "en" | "ru"): string {
  return locale === "hy" ? c.subjectNameHy : locale === "ru" ? c.subjectNameRu : c.subjectNameEn;
}

// GB-2: pills on desktop, the same row scrolls horizontally on mobile —
// one element, not two implementations.
export function ClassPills({
  classes,
  active,
  onSelect,
}: {
  classes: TeacherClass[];
  active: TeacherClass | null;
  onSelect: (c: TeacherClass) => void;
}) {
  const { locale } = useLocale();

  return (
    <div className="flex flex-1 gap-1.5 overflow-x-auto pb-0.5">
      {classes.map((c) => {
        const isActive = active?.classId === c.classId && active.subjectId === c.subjectId;
        return (
          <button
            key={`${c.classId}:${c.subjectId}`}
            type="button"
            onClick={() => onSelect(c)}
            className="flex min-h-[44px] flex-none flex-col gap-0.5 rounded-2xl px-3.5 py-2 text-left"
            style={{
              background: isActive ? "var(--accent)" : "transparent",
              color: isActive ? "var(--accent-fg)" : "var(--ink-2)",
              border: isActive ? "none" : "1px solid var(--hair)",
            }}
          >
            <span className="font-mono text-[13px] font-semibold">{c.classLabel}</span>
            <span className="text-[10px] opacity-70">
              {subjectName(c, locale)} · {c.studentCount}
              {c.draftCount > 0 && ` · ${c.draftCount}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
