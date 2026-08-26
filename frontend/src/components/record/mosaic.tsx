"use client";

import Link from "next/link";
import { gradeColorVar } from "@/design/grade-colors";
import { useLocale } from "@/i18n/locale-provider";
import type { RecordSubject } from "@/lib/api/record";
import { EmptyState } from "./empty-state";

function subjectName(s: RecordSubject, locale: "hy" | "en" | "ru"): string {
  return locale === "hy" ? s.nameHy : locale === "ru" ? s.nameRu : s.nameEn;
}

// REC-3: this surface must stay opaque — no GradientMesh, no glass, no
// translucency anywhere beneath a tile, or every tile's perceived hue
// shifts against whatever's behind it. `bg-panel`/`var(--panel)` is a flat
// fill by construction (tessera.css's own token, never rgba()/blur).
export function Mosaic({ subjects }: { subjects: RecordSubject[] }) {
  const { locale, t } = useLocale();
  const hasAnyMarks = subjects.some((s) => s.marks.length > 0);

  return (
    <div className="flex flex-col gap-3.5 rounded-[26px] p-4.5" style={{ background: "var(--panel)", border: "1px solid var(--hair)" }}>
      <div>
        <h2 className="font-serif text-base font-semibold" style={{ color: "var(--ink)" }}>
          {t.scr.ov.mosaicTitle}
        </h2>
        <p className="mt-0.5 text-[11px] leading-snug" style={{ color: "var(--ink-3)" }}>
          {t.scr.ov.mosaicSub}
        </p>
      </div>

      {!hasAnyMarks ? (
        <EmptyState title={t.scr.ov.emptyTitle} body={t.scr.ov.emptyBody} />
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px]" style={{ color: "var(--ink-3)" }}>
              1
            </span>
            <span className="flex flex-1 gap-0.5">
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className="h-2 flex-1 rounded-sm" style={{ background: gradeColorVar(i + 1) }} />
              ))}
            </span>
            <span className="font-mono text-[10px]" style={{ color: "var(--ink-3)" }}>
              10
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {subjects.map((s) => (
              <MosaicRow
                key={s.subjectId}
                subject={s}
                name={subjectName(s, locale)}
                avgLabel={t.scr.st.of10}
                legendOk={t.scr.ov.legendOk}
                legendDraft={t.scr.ov.legendDraft}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MosaicRow({
  subject,
  name,
  avgLabel,
  legendOk,
  legendDraft,
}: {
  subject: RecordSubject;
  name: string;
  avgLabel: string;
  legendOk: string;
  legendDraft: string;
}) {
  return (
    <Link
      href={`/subjects/${subject.subjectId}`}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl px-1 py-1 tablet:grid-cols-[140px_1fr_auto]"
    >
      <span className="flex min-w-0 items-center gap-1.5 truncate text-xs" style={{ color: "var(--ink-2)" }}>
        <span className="truncate">{name}</span>
        {subject.credentials.length > 0 && (
          <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: "var(--ok)" }} title={legendOk} />
        )}
        {subject.pendingCredentialCount > 0 && (
          <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: "var(--warning)" }} title={legendDraft} />
        )}
      </span>
      <span className="col-span-2 flex flex-wrap gap-[3px] tablet:col-span-1">
        {subject.marks.map((m) => (
          <span
            key={m.id}
            title={`${name} · ${m.value}`}
            className="h-3.5 w-3.5 rounded"
            style={{ background: gradeColorVar(m.value) }}
          />
        ))}
      </span>
      <span
        className="hidden text-right font-mono text-xs font-semibold tablet:block"
        style={{ color: subject.average === null ? "var(--ink-3)" : gradeColorVar(subject.average) }}
      >
        {subject.average === null ? "—" : subject.average}
        <span className="ml-0.5 font-sans text-[10px]" style={{ color: "var(--ink-3)" }}>
          {subject.average === null ? "" : avgLabel}
        </span>
      </span>
    </Link>
  );
}
