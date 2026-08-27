import type { CSSProperties } from "react";
import { Grain } from "./grain";

// Gradient mesh (brief §5.1): 4-5 feathered radial blobs over --bg-base,
// theme-scoped colors (--mesh-1..4, Palette Deep/Aura per --data-tt) and
// theme-scoped opacity (--mesh-opacity). "No gradient has a visible edge"
// (corrections-4 §2) — every stop fades to transparent well inside its own
// circle (70%), never at the boundary. Appears on login, splash, the ID
// card, widget surfaces, Iter panel, full-bleed empty states — never behind
// the gradebook, mosaic, tables or analytics (brief §5.1).
//
// Positions are plain numbers, not "18%" strings, because the entry
// animation needs to do arithmetic on them (see ENTRY, below).
const BLOBS = [
  { top: 10, left: 18, size: "1100px", color: "var(--mesh-1)" },
  { top: 60, left: 72, size: "1300px", color: "var(--mesh-2)" },
  { top: 78, left: 12, size: "950px", color: "var(--mesh-3)" },
  { top: 20, left: 80, size: "1000px", color: "var(--mesh-4)" },
];

const ENTRY_TRANSFORM_MS = 1400;
const ENTRY_OPACITY_MS = 700;
const ENTRY_STAGGER_MS = 120;
const GRAIN_FADE_MS = 400;
const GRAIN_FADE_DELAY_MS = 900;

// The mesh entry bloom (corrections-3 §2.1, reused by the opening sequence,
// corrections-5 §3): "the mesh arrives rather than being already there."
// Each blob starts collapsed at the frame's centre and expands outward to
// its own resting position.
//
// COMPOSITOR-ONLY. This animation used to move the blobs by animating
// `top`/`left`, which brief §13 forbids where transform will do, so this is
// first of all a compliance fix.
//
// Be honest about what it bought on its own, though: almost nothing. The
// entry animation's cost, isolated by running the same build with and
// without prefers-reduced-motion (which this animation already switches
// itself off for), was +727ms of painting BEFORE this change and +727ms
// after. The layout thrash was real but it was not the bottleneck — the
// blobs were forcing grain.tsx's full-viewport feTurbulence filter to be
// re-evaluated every frame, and that dominated everything. Once the grain
// was tiled and cached, the same isolated measurement fell to +258ms.
//
// The lesson worth keeping: `top`/`left` was the §13 violation, and fixing
// it was correct, but it was not the answer to "why does this hang."
//
// The reason it was written with top/left in the first place is real: a
// percentage means different things to `left` (the containing block's
// width) and to `translate` (the element's own width), so the delta from
// the frame's centre to a blob's resting position cannot be written as a
// self-relative percentage. Container query units resolve that — `1cqw` is
// 1% of the nearest size-container's width, which is exactly the unit
// `left`'s percentage was in. So the root below is declared
// `container-type: size` and each blob carries its own
// `--blob-dx/--blob-dy` offset in cqw/cqh.
//
// Position and scale still need different durations (1400ms vs 700ms) and
// one element cannot run two animations on `transform`, so the blob is a
// pair: the outer element carries the position offset, the inner one the
// scale and fade.
function entryVars(blob: (typeof BLOBS)[number]): CSSProperties {
  return {
    // Distance from this blob's resting position back to the frame centre,
    // in units of the container's own width/height.
    "--blob-dx": `calc(${50 - blob.left} * 1cqw)`,
    "--blob-dy": `calc(${50 - blob.top} * 1cqh)`,
  } as CSSProperties;
}

export function GradientMesh({
  className,
  grain = true,
  animateEntry = false,
}: {
  className?: string;
  grain?: boolean;
  animateEntry?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        // The size container the blobs' cqw/cqh offsets resolve against.
        // Safe on an inset-0 absolute box: its size comes from the insets,
        // never from its contents, which is what `size` containment asserts.
        ...(animateEntry ? { containerType: "size" } : null),
      }}
    >
      <div style={{ position: "absolute", inset: 0, opacity: "var(--mesh-opacity)" }}>
        {BLOBS.map((blob, i) =>
          animateEntry ? (
            <div
              key={i}
              className="tessera-mesh-entry-blob"
              style={{
                position: "absolute",
                top: `${blob.top}%`,
                left: `${blob.left}%`,
                width: blob.size,
                height: blob.size,
                animationDelay: `${i * ENTRY_STAGGER_MS}ms`,
                ...entryVars(blob),
              }}
            >
              <div
                className="tessera-mesh-entry-bloom"
                style={{
                  background: `radial-gradient(circle, ${blob.color} 0%, transparent 70%)`,
                  animationDelay: `${i * ENTRY_STAGGER_MS}ms`,
                }}
              />
            </div>
          ) : (
            <div
              key={i}
              style={{
                position: "absolute",
                top: `${blob.top}%`,
                left: `${blob.left}%`,
                width: blob.size,
                height: blob.size,
                transform: "translate(-50%, -50%)",
                background: `radial-gradient(circle, ${blob.color} 0%, transparent 70%)`,
              }}
            />
          ),
        )}
      </div>
      {grain && (
        <div className={animateEntry ? "tessera-mesh-entry-grain" : undefined}>
          <Grain />
        </div>
      )}
      {animateEntry && (
        <style>{`
          @keyframes tessera-mesh-entry-pos {
            from { transform: translate(-50%, -50%) translate(var(--blob-dx), var(--blob-dy)); }
            to   { transform: translate(-50%, -50%) translate(0, 0); }
          }
          @keyframes tessera-mesh-entry-scale {
            from { transform: scale(0.2); opacity: 0; }
            to   { transform: scale(1); opacity: 1; }
          }
          .tessera-mesh-entry-blob {
            transform: translate(-50%, -50%);
            animation: tessera-mesh-entry-pos ${ENTRY_TRANSFORM_MS}ms cubic-bezier(.16,1,.3,1) both;
          }
          .tessera-mesh-entry-bloom {
            position: absolute;
            inset: 0;
            animation: tessera-mesh-entry-scale ${ENTRY_OPACITY_MS}ms cubic-bezier(.16,1,.3,1) both;
          }
          .tessera-mesh-entry-grain {
            opacity: 0;
            animation: tessera-mesh-entry-grain-in ${GRAIN_FADE_MS}ms ease-out ${GRAIN_FADE_DELAY_MS}ms both;
          }
          @keyframes tessera-mesh-entry-grain-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .tessera-mesh-entry-blob,
            .tessera-mesh-entry-bloom,
            .tessera-mesh-entry-grain { animation: none; opacity: 1; }
            .tessera-mesh-entry-blob { transform: translate(-50%, -50%); }
            .tessera-mesh-entry-bloom { transform: none; }
          }
        `}</style>
      )}
    </div>
  );
}
