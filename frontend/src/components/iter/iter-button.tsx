"use client";

import { IterMark } from "./iter-mark";
import { useIter } from "./iter-provider";

// IT-2: 44px on mobile, 48px on web, both bottom-right, 16px from the edge.
// IT-3: must never be confused with the QR/docked button — size and hue
// carry the distinction (violet inverse-bloom here vs. the blue-teal QR
// bloom), never the same size class as that button.
export function IterButton({ variant, style }: { variant: "mobile" | "desktop"; style?: React.CSSProperties }) {
  const { open, openPanel } = useIter();
  const size = variant === "mobile" ? 44 : 48;

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
      className="grid place-items-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 26% 22%, var(--iter-bloom-1) 0%, var(--iter-bloom-2) 46%, var(--iter-bloom-3) 100%)",
        boxShadow: "0 5px 18px rgba(107,69,224,.4)",
        color: "var(--iter-fg)",
        ...style,
      }}
    >
      <IterMark size={20} />
    </button>
  );
}
