"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Mark } from "@/components/brand/mark";

// The opening sequence (corrections-5 §3, "Splash, then the login opens"):
// a full-screen splash (0-1100ms), then a transition (1100-1900ms) in which
// the SAME lockup travels from the splash's centre to wherever it rests on
// the real login screen — not a fade-cross. Once per session; skipped
// entirely under prefers-reduced-motion; never replays after logout (the
// session-storage flag persists until the tab/browser closes).
const SESSION_KEY = "tessera-splash-shown";
const SPLASH_MS = 1100;
const REVEAL_MS = 1900;
const CARD_AT_MS = 1400;
const DEMO_AT_MS = 1700;
export const SPLASH_LOCKUP_SIZE = 280;

export type OpeningPhase = "pending" | "splash" | "transition" | "revealed";

function readShouldSkip(): boolean {
  try {
    const seen = window.sessionStorage.getItem(SESSION_KEY) === "1";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return seen || reduced;
  } catch {
    // sessionStorage can throw under storage-blocked private modes — treat
    // as already seen rather than ever blocking the login screen on it.
    return true;
  }
}

export function useOpeningSequence() {
  // Both "window"-touching decisions — has this session already seen the
  // splash, and does the OS ask for reduced motion — can only be answered
  // client-side, so the pre-effect render (server AND the client's own
  // first render, before hydration effects run) always starts from this
  // same neutral "pending" state. Deciding earlier, during render, would
  // make the client's first render disagree with the server's and produce
  // a hydration mismatch.
  const [phase, setPhase] = useState<OpeningPhase>("pending");
  const [cardVisible, setCardVisible] = useState(false);
  const [demoVisible, setDemoVisible] = useState(false);
  // Caches the skip decision across React Strict Mode's dev-only
  // mount→cleanup→mount double-invoke of effects. Without this, the first
  // (discarded) invocation would write the "seen" flag to sessionStorage
  // before the second (surviving) invocation reads it back — making the
  // splash skip itself on every single load.
  const shouldSkipRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (shouldSkipRef.current === null) shouldSkipRef.current = readShouldSkip();
    const shouldSkip = shouldSkipRef.current;

    if (shouldSkip) {
      setPhase("revealed");
      setCardVisible(true);
      setDemoVisible(true);
      return;
    }

    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* best-effort only */
    }

    setPhase("splash");
    const timers = [
      setTimeout(() => setPhase("transition"), SPLASH_MS),
      setTimeout(() => setCardVisible(true), CARD_AT_MS),
      setTimeout(() => setDemoVisible(true), DEMO_AT_MS),
      setTimeout(() => setPhase("revealed"), REVEAL_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return { phase, cardVisible, demoVisible };
}

// The travelling lockup itself. `targetRefs` are the real, already-in-place
// (but opacity-0-until-`revealed`) Mark elements on the login screen — one
// per responsive layout; whichever one actually has layout at the moment
// the transition starts is the real destination. Measuring it, rather than
// hand-computing a position, is what keeps this correct across breakpoints
// without hardcoding either layout's geometry here.
export function OpeningOverlay({
  phase,
  targetRefs,
}: {
  phase: OpeningPhase;
  targetRefs: RefObject<HTMLElement | null>[];
}) {
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase !== "transition") return;
    const inner = innerRef.current;
    const target = targetRefs.map((r) => r.current).find((el) => el && el.getBoundingClientRect().width > 0);
    if (!inner || !target) return;
    const targetRect = target.getBoundingClientRect();
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const scale = targetRect.height / SPLASH_LOCKUP_SIZE;
    inner.style.transition = "transform 700ms cubic-bezier(.2,.8,.2,1)";
    inner.style.transform = `translate(${targetCenterX - viewportCenterX}px, ${targetCenterY - viewportCenterY}px) scale(${scale})`;
  }, [phase, targetRefs]);

  if (phase === "pending" || phase === "revealed") return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        ref={innerRef}
        className={phase === "splash" ? "tessera-mark-entry" : undefined}
        style={{ color: "var(--ink)", transform: "scale(1)" }}
      >
        <Mark size={SPLASH_LOCKUP_SIZE} />
      </div>
      {/* Brief §13.2, "the identity moment": the two paths animate
          separately, not the mark as one fading/scaling unit — the glyph
          settles first, then the spark springs in 180ms later. This is the
          splash's entire entry effect (there is no additional wrapper-level
          fade); runs once per mount, which OpeningOverlay already guarantees
          by only ever mounting this className during the splash phase. */}
      <style>{`
        @keyframes tessera-mark-glyph-in {
          from { opacity: 0; transform: scale(.88); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes tessera-mark-spark-in {
          from { opacity: 0; transform: scale(.4) rotate(-14deg); }
          to { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        .tessera-mark-entry #mark-glyph {
          transform-box: fill-box;
          transform-origin: center;
          opacity: 0;
          animation: tessera-mark-glyph-in var(--t-entry) var(--ease-out) both;
        }
        .tessera-mark-entry #mark-spark {
          transform-box: fill-box;
          transform-origin: center;
          opacity: 0;
          animation: tessera-mark-spark-in 340ms var(--ease-spring) 180ms both;
        }
        @media (prefers-reduced-motion: reduce) {
          .tessera-mark-entry #mark-glyph, .tessera-mark-entry #mark-spark {
            animation: none;
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}
