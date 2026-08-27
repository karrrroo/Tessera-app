"use client";

import { useT } from "@/i18n/locale-provider";

// CR-4: the reason is shown in full, never truncated — a decline without
// an explanation is worse than no system at all, and clipping it to a
// couple of lines with an ellipsis is the same failure in a smaller font.
export function DeclineReasonBlock({ reason }: { reason: string }) {
  const t = useT();
  return (
    <div className="rounded-[14px] p-3" style={{ background: "var(--surface2)", border: "1px solid var(--hair)" }}>
      <p className="text-xs font-medium" style={{ color: "var(--ink-3)" }}>
        {t.scr.gb.reason}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed" style={{ color: "var(--ink)" }}>
        {reason}
      </p>
    </div>
  );
}
