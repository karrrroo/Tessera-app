import type { CSSProperties, ReactNode } from "react";

// The three-layer glass technique ("tessera-v2-FINAL (3).md" §5.3), used
// wherever a surface sits directly on a gradient/mesh rather than a flat
// panel — the single-div `.glass-panel` utility (tessera.css) approximates
// glass with backdrop-filter alone, which the brief is explicit is not
// enough: "a single translucent rectangle is a grey box, not glass." Here,
// layer 1 (a fixed dark rect) gives the shape something real to *be*; layer
// 2 (the frosted panel) is offset slightly past layer 1's own edges so its
// blur has real content peeking through at the rim, not just layer 1's own
// flat color; layer 3 is the top-edge highlight, its own layer rather than
// folded into layer 2's box-shadow.
export function GlassLayered({
  children,
  radius = 26,
  className,
  style,
}: {
  children?: ReactNode;
  radius?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    // overflow:hidden here is load-bearing, not decoration: it's what makes
    // "nothing extends past the container's radius" true regardless of how
    // layer 1 is sized/positioned, rather than something each layer has to
    // separately get right.
    <div className={`relative overflow-hidden ${className ?? ""}`} style={{ borderRadius: radius, ...style }}>
      {/* Layer 1: the solid object — a small corner accent, not a large
          fraction of the card. Layer 2's 22px blur only softens what's
          within roughly a blur-radius of an edge; a block sized to a large
          share of the card would leave its own interior far from any edge,
          reading as flat opaque colour rather than "softened" no matter how
          translucent layer 2 above it is. Sized in px, comfortably within
          a couple of blur radii in both dimensions, so blur genuinely
          reaches all of it — and it never occupies enough of the card for
          the real mesh (behind everywhere else) to read as a minority. */}
      <div aria-hidden className="absolute left-0 top-0" style={{ width: 56, height: 56, background: "var(--glass-layer-base)" }} />
      {/* Layer 2: the frosted panel, covering the whole card. Over layer 1's
          corner this softens that fill; everywhere else, its blur is
          reading the real mesh behind the whole page — background stays
          the specified 10% white, never a darker/near-opaque fill, or the
          backdrop-filter has nothing left to visibly act on. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "rgba(255,255,255,.10)",
          backdropFilter: "blur(22px) saturate(160%)",
          WebkitBackdropFilter: "blur(22px) saturate(160%)",
          border: "1px solid var(--hair-bright)",
        }}
      />
      {/* Layer 3: the top-edge highlight, its own layer rather than folded
          into layer 2's own box-shadow. */}
      <div aria-hidden className="absolute inset-x-0 top-0" style={{ height: 1, background: "var(--hair-top)" }} />
      <div className="relative">{children}</div>
    </div>
  );
}
