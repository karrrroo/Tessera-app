"use client";

import { useRef } from "react";
import { useT } from "@/i18n/locale-provider";
import { useFocusTrap } from "@/lib/use-focus-trap";

// GB-5's exact copy, composed the same way the design source does:
// `{draftCount} {sendB} {classLabel}{sendTo}` then sendB2 as its own
// sentence — the second sentence is the point (a correction after
// publish requires a new record with a reason).
export function PublishDialog({
  draftCount,
  classLabel,
  onConfirm,
  onCancel,
}: {
  draftCount: number;
  classLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
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
        <h2 className="font-serif text-lg font-semibold" style={{ color: "var(--ink)" }}>
          {t.scr.dlg.sendT}
        </h2>
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {draftCount} {t.scr.dlg.sendB} {classLabel}
          {t.scr.dlg.sendTo}
        </p>
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
          {t.scr.dlg.sendB2}
        </p>
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm" style={{ color: "var(--ink-2)" }}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            {t.scr.dlg.sendOk}
          </button>
        </div>
      </div>
    </div>
  );
}
