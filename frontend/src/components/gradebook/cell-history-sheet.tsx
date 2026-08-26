"use client";

import { useEffect, useState } from "react";
import { gradeColorVar } from "@/design/grade-colors";
import { useT } from "@/i18n/locale-provider";
import { gradebookApi, type MarkHistoryResponse } from "@/lib/api/gradebook";

// GB-7: who, when, from what to what, why — the teacher's own view of the
// same chain Phase 7's MarkHistorySheet shows the student.
export function CellHistorySheet({ markId, onClose }: { markId: string; onClose: () => void }) {
  const t = useT();
  const [history, setHistory] = useState<MarkHistoryResponse | null>(null);

  useEffect(() => {
    gradebookApi.getMarkHistory(markId).then(setHistory);
  }, [markId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center tablet:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <div
        className="relative flex w-full max-w-[420px] flex-col gap-4 rounded-t-[34px] p-6 tablet:rounded-[34px]"
        style={{ background: "var(--panel)", border: "1px solid var(--hair)" }}
      >
        <div>
          <h2 className="font-serif text-base font-semibold" style={{ color: "var(--ink)" }}>
            {t.scr.gb.histTitle}
          </h2>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--ink-3)" }}>
            {t.scr.gb.histSub}
          </p>
        </div>

        {!history ? null : (
          <div className="flex flex-col gap-3.5">
            {history.steps.map((step, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-2xl p-3.5" style={{ background: "var(--surface2)" }}>
                <div className="flex items-center gap-2.5">
                  <span
                    className="grid h-8 w-8 flex-none place-items-center rounded-lg font-mono text-sm font-semibold"
                    style={{ background: gradeColorVar(step.fromValue), color: "var(--mark-tile-fg)" }}
                  >
                    {step.fromValue}
                  </span>
                  <span style={{ color: "var(--ink-3)" }}>→</span>
                  <span
                    className="grid h-8 w-8 flex-none place-items-center rounded-lg font-mono text-sm font-semibold"
                    style={{ background: gradeColorVar(step.toValue), color: "var(--mark-tile-fg)" }}
                  >
                    {step.toValue}
                  </span>
                  <span className="ml-auto font-mono text-[10.5px]" style={{ color: "var(--ink-3)" }}>
                    {step.at.slice(0, 10)}
                  </span>
                </div>
                {step.reason && (
                  <p className="text-[12px] leading-snug" style={{ color: "var(--ink-2)" }}>
                    {t.scr.gb.reason} {step.reason}
                  </p>
                )}
                {step.actorName && (
                  <p className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>
                    {step.actorName}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
