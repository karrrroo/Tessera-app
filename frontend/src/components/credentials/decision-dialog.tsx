"use client";

import { useState } from "react";
import { useT } from "@/i18n/locale-provider";

// CR-4: submit disabled while the reason is empty — the same rule the
// server enforces (CREDENTIAL_REASON_REQUIRED), so this is a UX
// convenience, not the actual guard.
export function DecisionDialog({
  onApprove,
  onDecline,
  onCancel,
  busy,
  error,
}: {
  onApprove: () => void;
  onDecline: (reason: string) => void;
  onCancel: () => void;
  busy: boolean;
  /** A real bug, found live: a failed decide reverted the optimistic list
   * update but left this dialog open with no indication anything had
   * failed — the reviewer just saw their click do nothing. */
  error?: boolean;
}) {
  const t = useT();
  const [mode, setMode] = useState<"choose" | "decline">("choose");
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45" onClick={onCancel} aria-hidden />
      <div className="relative flex w-full max-w-sm flex-col gap-4 rounded-[26px] p-6" style={{ background: "var(--panel)", border: "1px solid var(--hair)" }}>
        {error && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {t.scr.err.body}
          </p>
        )}
        {mode === "choose" ? (
          <>
            <h2 className="font-serif text-lg font-semibold" style={{ color: "var(--ink)" }}>
              {t.scr.q.approve} / {t.scr.q.decline}
            </h2>
            <div className="flex justify-end gap-2.5">
              <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm" style={{ color: "var(--ink-2)" }}>
                {t.scr.cr.cancel}
              </button>
              <button
                type="button"
                onClick={() => setMode("decline")}
                disabled={busy}
                className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
                style={{ color: "var(--danger)", border: "1px solid var(--danger)" }}
              >
                {t.scr.q.decline}
              </button>
              <button
                type="button"
                onClick={onApprove}
                disabled={busy}
                className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
                style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
              >
                {t.scr.q.approve}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-serif text-lg font-semibold" style={{ color: "var(--ink)" }}>
              {t.scr.dlg.declT}
            </h2>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
              {t.scr.dlg.declB}
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-[14px] border border-hair bg-transparent px-3 py-2 text-sm"
              style={{ color: "var(--ink)" }}
            />
            <div className="flex justify-end gap-2.5">
              <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm" style={{ color: "var(--ink-2)" }}>
                {t.scr.cr.cancel}
              </button>
              <button
                type="button"
                onClick={() => onDecline(reason)}
                disabled={busy || !reason.trim()}
                className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
                style={{ background: "var(--danger)", color: "var(--danger-fg)" }}
              >
                {t.scr.dlg.declOk}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
