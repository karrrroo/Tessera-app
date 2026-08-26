// No design precedent for this exact glyph (roadmap Phase 7 adds `trend`
// server-side; the design mockup predates it) — a plain, minimal arrow.
const GLYPH: Record<"up" | "down" | "flat", string> = { up: "↑", down: "↓", flat: "→" };
const COLOR: Record<"up" | "down" | "flat", string> = { up: "var(--ok)", down: "var(--danger)", flat: "var(--ink-3)" };

export function TrendIndicator({ trend }: { trend: "up" | "down" | "flat" | null }) {
  if (!trend) return null;
  return (
    <span className="font-mono text-xs" style={{ color: COLOR[trend] }} aria-hidden>
      {GLYPH[trend]}
    </span>
  );
}
