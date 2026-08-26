"use client";

import { useState } from "react";
import { gradeColorVar } from "@/design/grade-colors";
import { useLocale } from "@/i18n/locale-provider";
import type { SubjectDetailResponse } from "@/lib/api/record";
import { EmptyState } from "./empty-state";
import { MarkHistorySheet } from "./mark-history-sheet";
import { MarkSequence } from "./mark-sequence";
import { TopicBreakdown } from "./topic-breakdown";
import { TrendIndicator } from "./trend-indicator";

export function SubjectDetail({ subject }: { subject: SubjectDetailResponse }) {
  const { locale, t } = useLocale();
  const [historyMarkId, setHistoryMarkId] = useState<string | null>(null);
  const name = locale === "hy" ? subject.nameHy : locale === "ru" ? subject.nameRu : subject.nameEn;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-[26px] p-4.5" style={{ background: "var(--panel)", border: "1px solid var(--hair)" }}>
        <div className="flex flex-col gap-1">
          <span className="font-serif text-xl font-semibold" style={{ color: "var(--ink)" }}>
            {name}
          </span>
          <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
            {subject.teacherName}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <TrendIndicator trend={subject.trend} />
          <span
            className="font-mono text-3xl font-semibold"
            style={{ color: subject.average === null ? "var(--ink-3)" : gradeColorVar(subject.average) }}
          >
            {subject.average ?? "—"}
          </span>
          <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
            {t.scr.sj.semAvg}
          </span>
        </div>
      </div>

      <div className="rounded-[26px] p-4.5" style={{ background: "var(--panel)", border: "1px solid var(--hair)" }}>
        {subject.marks.length === 0 ? (
          <EmptyState title={t.scr.sj.emptyTitle} body={t.scr.sj.emptyBody} />
        ) : (
          <MarkSequence marks={subject.marks} onOpenHistory={setHistoryMarkId} />
        )}
      </div>

      {subject.topicBreakdown.length > 0 && (
        <div className="rounded-[26px] p-4.5" style={{ background: "var(--panel)", border: "1px solid var(--hair)" }}>
          <h3 className="mb-3.5 font-serif text-[15.5px] font-semibold" style={{ color: "var(--ink)" }}>
            {t.scr.sj.topicsTitle}
          </h3>
          <TopicBreakdown breakdown={subject.topicBreakdown} />
        </div>
      )}

      {subject.credentials.length > 0 && (
        <div className="rounded-[26px] p-4.5" style={{ background: "var(--panel)", border: "1px solid var(--hair)" }}>
          <h3 className="mb-3.5 font-serif text-[15.5px] font-semibold" style={{ color: "var(--ink)" }}>
            {t.scr.cr.title}
          </h3>
          <div className="flex flex-col gap-2.5">
            {subject.credentials.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-3">
                <span className="text-xs leading-snug" style={{ color: "var(--ink)" }}>
                  {c.title}
                </span>
                <span className="flex-none font-mono text-[10px]" style={{ color: "var(--ink-3)" }}>
                  {c.approvedAt?.slice(0, 10)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {historyMarkId && <MarkHistorySheet markId={historyMarkId} onClose={() => setHistoryMarkId(null)} />}
    </div>
  );
}
