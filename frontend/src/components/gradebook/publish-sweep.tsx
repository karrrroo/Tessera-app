"use client";

const SWEEP_DURATION_MS = 900;

// GB-13: one gradient sweep across the top of the content area. That is
// the confirmation — deliberately no toast alongside it. Remounted by
// `playKey` (a fresh key retriggers the CSS animation) rather than driven
// by a timer + setState — the bar ends translated off-screen and simply
// stays there, so there's nothing to clean up afterwards.
export function PublishSweep({ playKey }: { playKey: number }) {
  if (playKey === 0) return null;

  return (
    <div key={playKey} className="pointer-events-none absolute left-0 right-0 top-0 z-30 h-1 overflow-hidden" aria-hidden>
      <div
        className="h-full w-1/3"
        style={{
          background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
          animation: `tessera-publish-sweep ${SWEEP_DURATION_MS}ms ease-out forwards`,
        }}
      />
      <style>{`
        @keyframes tessera-publish-sweep {
          from { transform: translateX(-100%); }
          to { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
