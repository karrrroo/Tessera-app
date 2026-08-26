"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Lockup } from "@/components/brand/lockup";

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
    // Width-to-width, not height-to-height: the old bare-Mark overlay was
    // near-square, so height and width scaled almost identically and either
    // worked. Lockup is a wide rectangle (~4.8:1) — its width is the stable
    // reference (both the overlay and every target render the same
    // component, just at a different `size`), so this is the one ratio
    // that's correct regardless of which target/breakpoint it lands on.
    const scale = targetRect.width / SPLASH_LOCKUP_SIZE;
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
      <div ref={innerRef} style={{ color: "var(--ink)", transform: "scale(1)" }}>
        {/* Brief §13.2, "the identity moment" — Tessera.dc.html's own
            keyframes (lockGlyph/lockSpark/lockLetter, see tessera.css):
            the glyph slides in, the spark follows 120ms later, then the
            typeset letters fade in. `animate` is unconditional (not tied to
            `phase`) deliberately: this component only ever mounts at all
            during "splash"/"transition" (the guard above returns null
            otherwise), and the animations (up to 1260ms) outlast the
            1100ms splash phase — tying `animate` to `phase === "splash"`
            would flip it false the instant "transition" begins and cut
            every animation off mid-flight, snapping each span to its base
            state instead of letting it finish. */}
        <Lockup size={SPLASH_LOCKUP_SIZE} animate />
      </div>
    </div>
  );
}
