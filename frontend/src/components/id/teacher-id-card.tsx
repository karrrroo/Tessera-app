"use client";

import { Mark } from "@/components/brand/mark";
import { Grain } from "@/components/design/grain";
import { useT, useLocale } from "@/i18n/locale-provider";
import type { TeacherHolder } from "@/lib/api/identity";

function subjectLabel(subjects: TeacherHolder["subjects"], locale: "hy" | "en" | "ru"): string {
  const key = locale === "hy" ? "nameHy" : locale === "ru" ? "nameRu" : "nameEn";
  return subjects.map((s) => s[key]).join(" · ");
}

// No qr_credential row exists for teachers at all (schema is student-only,
// C2 forbids adding one) — this card displays but never opens a QR sheet.
export function TeacherIdCard({ holder }: { holder: TeacherHolder }) {
  const t = useT();
  const { locale } = useLocale();

  return (
    <div className="flex w-full max-w-[320px] flex-col items-center gap-4">
      <div
        className="relative flex aspect-[3/4] w-full flex-col justify-between overflow-hidden rounded-[28px] p-5"
        style={{ background: "var(--id-card-gradient)" }}
      >
        <Grain />
        <div className="relative flex flex-col gap-4.5">
          <span className="text-[10px] uppercase tracking-[.1em]" style={{ color: "var(--id-card-kind-fg)" }}>
            {t.common.roleTeacher}
          </span>
          <span style={{ color: "var(--id-card-fg)" }}>
            <Mark size={60} />
          </span>
        </div>
        <div className="relative flex flex-col gap-1.5">
          <span className="text-xl font-medium leading-tight" style={{ color: "var(--id-card-fg)" }}>
            {holder.firstName} {holder.lastName}
          </span>
          <span className="text-[13px]" style={{ color: "var(--id-card-fg-2)" }}>
            {subjectLabel(holder.subjects, locale)}
          </span>
          <span className="text-[13px]" style={{ color: "var(--id-card-fg-2)" }}>
            {holder.institutionName}
          </span>
          {holder.classLabels.length > 0 && (
            <span className="mt-2.5 flex flex-wrap gap-1.5">
              {holder.classLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full px-2.5 py-1 font-mono text-[11px]"
                  style={{ background: "var(--id-card-chip-bg)", color: "var(--id-card-fg)" }}
                >
                  {label}
                </span>
              ))}
            </span>
          )}
        </div>
      </div>
      <p className="text-center text-[11px]" style={{ color: "var(--ink-3)" }}>
        {t.scr.id.offlineOk}
      </p>
    </div>
  );
}
