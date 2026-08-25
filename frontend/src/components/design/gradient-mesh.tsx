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

export function GradientMesh({ className, grain = true }: { className?: string; grain?: boolean }) {
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
            style={{
              position: "absolute",
              top: blob.top,
              left: blob.left,
              width: blob.size,
              height: blob.size,
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, ${blob.color} 0%, transparent 70%)`,
            }}
          />
        ))}
      </div>
      {grain && <Grain />}
    </div>
  );
}
