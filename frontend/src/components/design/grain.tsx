// Grain overlay for gradient surfaces (brief §5.2 — "not optional. The
// highest-value detail in this brief"). An SVG feTurbulence layer;
// baseFrequency 0.8, 3 octaves, opacity .055, overlay blend, no pointer events.
export function Grain({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.055, mixBlendMode: "overlay" }}
      width="100%"
      height="100%"
    >
      <filter id="tesseraGrain">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={3} stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#tesseraGrain)" />
    </svg>
  );
}
