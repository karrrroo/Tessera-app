"use client";

import { Mark } from "@/components/brand/mark";
import { Grain } from "@/components/design/grain";
import { useT } from "@/i18n/locale-provider";
import type { StudentHolder } from "@/lib/api/identity";

// 3:4, vertical --accent-tint gradient (ID-2, brief §10) — dark in both
// themes on purpose, so text/icon colors here are the fixed --id-card-fg-*
// tokens, never --ink. Grain only (not GradientMesh's radial blobs): the
// design source's own ID card block (Tessera.dc.html) layers a single noise
// overlay on the gradient, nothing else — see docs/decisions.md.
export function IdCard({ holder, onOpenQr }: { holder: StudentHolder; onOpenQr: () => void }) {
  const t = useT();

  return (
    <div className="flex w-full max-w-[320px] flex-col items-center gap-4">
      <div
        className="relative flex aspect-[3/4] w-full flex-col justify-between overflow-hidden rounded-[28px] p-5"
        style={{ background: "var(--id-card-gradient)" }}
      >
        <Grain />
        <div className="relative flex flex-col gap-4.5">
          <span className="text-[10px] tracking-[.1em]" style={{ color: "var(--id-card-kind-fg)" }}>
            {t.scr.id.kind}
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
            {t.common.roleStudent}
          </span>
          <span className="text-[13px]" style={{ color: "var(--id-card-fg-2)" }}>
            {holder.institutionName}
          </span>
          <span className="mt-2.5 flex gap-5">
            <span className="flex flex-col gap-0.5">
              <span className="text-[9.5px] tracking-[.08em]" style={{ color: "var(--id-card-fg-3)" }}>
                {t.set.kCls}
              </span>
              <span className="font-mono text-[13px]" style={{ color: "var(--id-card-fg)" }}>
                {holder.classLabel ?? "—"}
              </span>
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[9.5px] tracking-[.08em]" style={{ color: "var(--id-card-fg-3)" }}>
                {t.scr.id.code}
              </span>
              <span className="font-mono text-[13px]" style={{ color: "var(--id-card-fg)" }}>
                {holder.tesseraId}
              </span>
            </span>
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenQr}
        className="grid min-h-[52px] w-full place-items-center rounded-full text-[14.5px] font-semibold"
        style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
      >
        {t.scr.qs.show}
      </button>
      <p className="max-w-[320px] text-center text-[11.5px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
        {t.scr.id.note}
      </p>
      <p className="text-center text-[11px]" style={{ color: "var(--ink-3)" }}>
        {t.scr.id.offlineOk}
      </p>
    </div>
  );
}
