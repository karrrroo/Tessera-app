"use client";

import { useRef, useState } from "react";
import { gradeColorVar } from "@/design/grade-colors";
import { useT } from "@/i18n/locale-provider";
import { useFocusTrap } from "@/lib/use-focus-trap";

// No dedicated design copy exists for this exact dialog (only `T.scr.gb
// .reason`, "Reason:", does) — kept minimal and structural rather than
// inventing a title. Submit stays disabled while the reason is empty,
// the first of GB's three enforcement layers (docs/decisions.md).
export function SupersedeDialog({
  currentValue,
  onSubmit,
  onCancel,
}: {
  currentValue: number;
  onSubmit: (value: number, reason: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [value, setValue] = useState(currentValue);
  const [reason, setReason] = useState("");
  const canSubmit = reason.trim().length > 0 && value !== currentValue;
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45" onClick={onCancel} aria-hidden />
      <div
        ref={panelRef}
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-[26px] p-6"
        style={{ background: "var(--panel)", border: "1px solid var(--hair)" }}
      >
        <div className="flex items-center justify-center gap-3">
          <span
            className="grid h-10 w-10 place-items-center rounded-xl font-mono text-base font-semibold"
            style={{ background: gradeColorVar(currentValue), color: "var(--mark-tile-fg)" }}
          >
            {currentValue}
          </span>
          <span style={{ color: "var(--ink-3)" }}>→</span>
          <div className="flex gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setValue(v)}
                className="grid h-7 w-7 place-items-center rounded-md font-mono text-[11px] font-semibold"
                style={{
                  background: v === value ? gradeColorVar(v) : "var(--surface2)",
                  color: v === value ? "var(--mark-tile-fg)" : "var(--ink-3)",
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs" style={{ color: "var(--ink-2)" }}>
            {t.scr.gb.reason}
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-2xl border p-3 text-sm outline-none"
            style={{ background: "var(--surface2)", borderColor: "var(--hair)", color: "var(--ink)" }}
          />
        </label>
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm" style={{ color: "var(--ink-2)" }}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit(value, reason.trim())}
            className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            {t.set.save}
          </button>
        </div>
      </div>
    </div>
  );
}
