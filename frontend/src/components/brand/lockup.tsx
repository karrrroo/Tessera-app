import type { CSSProperties } from "react";
import { GLYPH_PATH, SPARK_PATH } from "./mark";

// The integrated wordmark ("Tessera.dc.html", the working prototype — the
// design source's own literal markup, not a description of it): the glyph,
// a tucked "e", the spark standing in for the first "s", then the typeset
// "sera" — seven marks read as one word. Bare `Mark` (the glyph+spark alone)
// is a distinct, separate component for every other context (header,
// sidebar, footer, ID card); this is only for the login screen's wide
// layout and the splash, per that file's own two `data-lockbox` instances
// and the merged brief's §2/§3.2 sizes (200px login, 280px splash).
//
// Every span/margin/gap value below is copied from the prototype's own
// inline styles, not estimated — most importantly `marginLeft: -16.65` on
// the "e" (the tuck under the glyph's crossbar that makes this read as one
// word rather than a logo next to a word) and `marginBottom: 12.65` on the
// spark (so its optical centre lands on the shared baseline at x-height,
// not cap height). The prototype authors these at a 250px reference width
// (200px ÷ its own scale(.8)) and reaches every other size via CSS `scale`
// on the whole row — reproduced here as `size / AUTHORED_WIDTH` so the
// baseline/tuck/gap relationships never have to be recomputed by hand.
const AUTHORED_WIDTH = 250;
const AUTHORED_HEIGHT = 52;

export type LockupProps = {
  size?: number;
  /** The entry animation (glyph slides in, spark springs in 120ms later,
   * then "e"/"sera" fade in) — login and splash only, per the prototype's
   * own scoping. Every other instance of this component (there should be
   * none outside those two) must leave this false: `data-anim="off"` mounts
   * the same DOM already in its settled end state, no animation at all. */
  animate?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function Lockup({ size = 200, animate = false, className, style }: LockupProps) {
  const scale = size / AUTHORED_WIDTH;
  const height = AUTHORED_HEIGHT * scale;

  return (
    <span
      className={className}
      style={{ display: "block", width: size, height, color: "inherit", lineHeight: 0, ...style }}
    >
      <span
        data-lock="1"
        data-anim={animate ? "on" : "off"}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-end",
          transform: `scale(${scale})`,
          transformOrigin: "left bottom",
          color: "inherit",
        }}
      >
        <span
          style={{
            position: "relative",
            flex: "none",
            width: 62.05,
            height: 71.58,
            marginBottom: 13.22,
            animation: animate ? "lockGlyph 900ms var(--ease-out) 260ms both" : undefined,
          }}
        >
          <svg width="100%" height="100%" viewBox="68 -8 872 1006" fill="currentColor" role="img" aria-label="Tessera">
            <path id="mark-glyph" d={GLYPH_PATH} />
          </svg>
        </span>
        <span
          style={{
            flex: "none",
            fontFamily: "var(--wordmark-font)",
            fontWeight: 400,
            fontSize: 66,
            lineHeight: 1,
            letterSpacing: "-.01em",
            marginLeft: -16.65,
            marginBottom: 0,
            animation: animate ? "lockLetter 500ms linear 620ms both" : undefined,
          }}
        >
          e
        </span>
        <span style={{ flex: "none", width: 6.66 }} />
        <span
          style={{
            position: "relative",
            flex: "none",
            width: 16.32,
            height: 38.85,
            marginBottom: 12.65,
            transformOrigin: "left bottom",
            animation: animate ? "lockSpark 900ms var(--ease-out) 380ms both" : undefined,
          }}
        >
          <svg width="100%" height="100%" viewBox="690.5 542 129 307" fill="currentColor">
            <path id="mark-spark" d={SPARK_PATH} />
          </svg>
        </span>
        <span style={{ flex: "none", width: 6.66 }} />
        <span
          style={{
            flex: "none",
            fontFamily: "var(--wordmark-font)",
            fontWeight: 400,
            fontSize: 66,
            lineHeight: 1,
            letterSpacing: "-.01em",
            marginBottom: 0,
            animation: animate ? "lockLetter 500ms linear 760ms both" : undefined,
          }}
        >
          sera
        </span>
      </span>
    </span>
  );
}
