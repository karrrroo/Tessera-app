"use client";

import Link from "next/link";
import { gradeColorVar } from "@/design/grade-colors";
import { useLocale } from "@/i18n/locale-provider";
import type { RecordSubject } from "@/lib/api/record";

export function SubjectCard({ subject, active }: { subject: RecordSubject; active: boolean }) {
  const { locale } = useLocale();
  const name = locale === "hy" ? subject.nameHy : locale === "ru" ? subject.nameRu : subject.nameEn;

  return (
    <Link
      href={`/subjects/${subject.subjectId}`}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors"
      style={{ background: active ? "var(--surface2)" : "transparent" }}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-serif text-sm font-medium" style={{ color: "var(--ink)" }}>
          {name}
        </span>
        <span className="truncate text-[11px]" style={{ color: "var(--ink-3)" }}>
          {subject.teacherName}
        </span>
        <span className="mt-0.5 flex gap-0.5">
          {subject.marks.map((m) => (
            <span key={m.id} className="h-2.5 w-2.5 rounded-sm" style={{ background: gradeColorVar(m.value) }} />
          ))}
        </span>
      </span>
      <span
        className="flex-none font-mono text-base font-semibold"
        style={{ color: subject.average === null ? "var(--ink-3)" : gradeColorVar(subject.average) }}
      >
        {subject.average ?? "—"}
      </span>
    </Link>
  );
}
