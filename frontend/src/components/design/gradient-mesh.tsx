import type { CSSProperties } from "react";
import { Grain } from "./grain";

// Gradient mesh (brief §5.1): 4-5 feathered radial blobs over --bg-base,
// theme-scoped colors (--mesh-1..4, Palette Deep/Aura per --data-tt) and
// theme-scoped opacity (--mesh-opacity). "No gradient has a visible edge"
// (corrections-4 §2) — every stop fades to transparent well inside its own
// circle (70%), never at the boundary. Appears on login, splash, the ID
// card, widget surfaces, Iter panel, full-bleed empty states — never behind
// the gradebook, mosaic, tables or analytics (brief §5.1).
const BLOBS = [
  { top: "10%", left: "18%", size: "1100px", color: "var(--mesh-1)" },
  { top: "60%", left: "72%", size: "1300px", color: "var(--mesh-2)" },
  { top: "78%", left: "12%", size: "950px", color: "var(--mesh-3)" },
  { top: "20%", left: "80%", size: "1000px", color: "var(--mesh-4)" },
];

const ENTRY_TRANSFORM_MS = 1400;
const ENTRY_OPACITY_MS = 700;
const ENTRY_STAGGER_MS = 120;
const GRAIN_FADE_MS = 400;
const GRAIN_FADE_DELAY_MS = 900;

// The mesh entry bloom (corrections-3 §2.1, reused by the opening sequence,
// corrections-5 §3): "the mesh arrives rather than being already there."
// Each blob starts collapsed at the frame's centre and expands outward to
// its own resting position — position (top/left, container-relative) and
// scale (transform, self-relative) are animated separately because CSS
// percentages mean different things in each context. Runs once, on first
// load only — callers gate `animateEntry` themselves (opening-sequence.tsx),
// never on ordinary navigation.
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
      style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}
    >
      <div style={{ position: "absolute", inset: 0, opacity: "var(--mesh-opacity)" }}>
        {BLOBS.map((blob, i) => (
          <div
            key={i}
            className={animateEntry ? "tessera-mesh-entry-blob" : undefined}
            style={
              animateEntry
                ? ({
                    position: "absolute",
                    width: blob.size,
                    height: blob.size,
                    background: `radial-gradient(circle, ${blob.color} 0%, transparent 70%)`,
                    "--blob-top": blob.top,
                    "--blob-left": blob.left,
                    animationDelay: `${i * ENTRY_STAGGER_MS}ms, ${i * ENTRY_STAGGER_MS}ms`,
                  } as CSSProperties)
                : {
                    position: "absolute",
                    top: blob.top,
                    left: blob.left,
                    width: blob.size,
                    height: blob.size,
                    transform: "translate(-50%, -50%)",
                    background: `radial-gradient(circle, ${blob.color} 0%, transparent 70%)`,
                  }
            }
          />
        ))}
      </div>
      {grain && (
        <div className={animateEntry ? "tessera-mesh-entry-grain" : undefined}>
          <Grain />
        </div>
      )}
      {animateEntry && (
        <style>{`
          @keyframes tessera-mesh-entry-pos {
            from { top: 50%; left: 50%; }
            to { top: var(--blob-top); left: var(--blob-left); }
          }
          @keyframes tessera-mesh-entry-scale {
            from { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
            to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          }
          .tessera-mesh-entry-blob {
            top: var(--blob-top);
            left: var(--blob-left);
            transform: translate(-50%, -50%);
            animation:
              tessera-mesh-entry-pos ${ENTRY_TRANSFORM_MS}ms cubic-bezier(.16,1,.3,1) both,
              tessera-mesh-entry-scale ${ENTRY_OPACITY_MS}ms cubic-bezier(.16,1,.3,1) both;
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
            .tessera-mesh-entry-blob, .tessera-mesh-entry-grain { animation: none; opacity: 1; }
            .tessera-mesh-entry-blob { top: var(--blob-top); left: var(--blob-left); transform: translate(-50%, -50%) scale(1); }
          }
        `}</style>
      )}
    </div>
  );
}
