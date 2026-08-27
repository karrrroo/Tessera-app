"use client";

import { useEffect } from "react";
import { gradeColorVar } from "@/design/grade-colors";
import { useT } from "@/i18n/locale-provider";
import { recordApi } from "@/lib/api/record";
import { useAsyncData } from "@/lib/use-async-data";

// REC-8: old value, new value, date and the reason in full — a correction
// is never hidden from the student it concerns. No design copy exists for
// this exact student-facing sheet (the roadmap's own "T.dlg.*" pointer
// doesn't actually contain it — see docs/decisions.md); the heading reuses
// `T.scr.gb.histTitle`/`histSub`/`reason`, the same real copy Phase 8's
// teacher-facing cell history will use for the identical concept.
export function MarkHistorySheet({ markId, onClose }: { markId: string; onClose: () => void }) {
  const t = useT();
  const { data: history, error, retry } = useAsyncData(() => recordApi.getMarkHistory(markId), [markId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center tablet:items-center" role="dialog" aria-modal="true">
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

        {error ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <p className="text-sm" style={{ color: "var(--ink-3)" }}>
              {t.scr.err.body}
            </p>
            <button type="button" onClick={retry} className="text-sm underline" style={{ color: "var(--ink-2)" }}>
              {t.scr.err.retry}
            </button>
          </div>
        ) : !history ? null : (
          <div className="flex flex-col gap-3.5">
            {history.steps.map((step, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-2xl p-3.5" style={{ background: "var(--surface2)" }}>
                <div className="flex items-center gap-2.5">
                  <ValueChip value={step.fromValue} />
                  <span style={{ color: "var(--ink-3)" }}>→</span>
                  <ValueChip value={step.toValue} />
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

function ValueChip({ value }: { value: number }) {
  return (
    <span
      className="grid h-8 w-8 flex-none place-items-center rounded-lg font-mono text-sm font-semibold"
      style={{ background: gradeColorVar(value), color: "var(--mark-tile-fg)" }}
    >
      {value}
    </span>
  );
}
