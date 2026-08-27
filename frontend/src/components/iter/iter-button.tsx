"use client";

import { IterMark } from "./iter-mark";
import { useIter } from "./iter-provider";

// IT-2: 44px on mobile, 48px on web, both bottom-right, 16px from the edge.
// IT-3: must never be confused with the QR/docked button — size and hue
// carry the distinction (violet inverse-bloom here vs. the blue-teal QR
// bloom), never the same size class as that button.
//
// Size and position are both media-query-driven rather than passed in from
// AppShell as a `variant` prop plus inline `position`/`right`/`bottom`. There
// is only one of these in the tree, and it needs no JS to know which viewport
// it is in. On mobile it clears the pill nav (58px of pill plus its dock
// offset); at >=900px there is no pill, so it drops to the normal 28px inset.
export function IterButton() {
  const { open, openPanel } = useIter();

  // Hidden while the panel itself is open — on desktop the panel is a
  // right-anchored sheet, so a still-visible bottom-right launcher would
  // sit inside (and intercept clicks on) the panel's own composer.
  if (open) return null;

  return (
    <button
      type="button"
      onClick={openPanel}
      title="Iter"
      aria-label="Iter"
      className="fixed bottom-[116px] right-4 z-[70] grid size-11 place-items-center overflow-hidden rounded-full desktop:bottom-7 desktop:right-7 desktop:size-12"
      style={{
        background: "radial-gradient(circle at 26% 22%, var(--iter-bloom-1) 0%, var(--iter-bloom-2) 46%, var(--iter-bloom-3) 100%)",
        boxShadow: "0 5px 18px rgba(107,69,224,.4)",
        color: "var(--iter-fg)",
      }}
    >
      <IterMark size={20} />
    </button>
  );
}
