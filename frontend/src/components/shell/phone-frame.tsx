import type { ReactNode } from "react";

const FRAME_WIDTH = 390;
const FRAME_HEIGHT = 844;
const STAGE_WIDTH = 480;
const STAGE_HEIGHT = 920;

// The web-preview phone frame (brief §8ter) — only rendered when previewing
// mobile from a wide (>=900px) real browser via the Web/Mobile switch; a
// genuinely narrow browser renders the mobile layout directly, full-bleed,
// with no fake chrome (the real device already provides that).
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, margin: "0 auto", background: "var(--bg-base)" }}
    >
      <div
        className="relative overflow-hidden border border-hair bg-base"
        style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT, borderRadius: 44 }}
      >
        <div className="flex h-6 items-center justify-between px-5 text-[11px]" style={{ color: "var(--ink)" }}>
          <span>9:41</span>
          <span>100%</span>
        </div>
        <div className="relative" style={{ height: FRAME_HEIGHT - 24, overflow: "hidden" }}>
          {children}
        </div>
        <div
          className="absolute bottom-1.5 left-1/2 h-1 w-32 -translate-x-1/2 rounded-full"
          style={{ background: "var(--hair-bright)" }}
        />
      </div>
    </div>
  );
}
