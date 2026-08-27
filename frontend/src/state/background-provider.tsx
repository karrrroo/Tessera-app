"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTheme } from "./theme-provider";
import { BACKGROUNDS, type BackgroundId } from "../design/backgrounds";

export type { BackgroundId };
export { BACKGROUNDS };

type BackgroundContextValue = {
  background: BackgroundId;
  setBackground: (b: BackgroundId) => void;
};

const BackgroundContext = createContext<BackgroundContextValue | undefined>(undefined);
const STORAGE_KEY = "tessera.background";

function isBackgroundId(value: string | null): value is BackgroundId {
  return value === "deep" || value === "coal" || value === "cream" || value === "grey";
}

function readStoredBackground(): BackgroundId | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isBackgroundId(stored) ? stored : null;
}

// Writes data-bg on the document root (brief §11ter: Խորը/Ածխային/Սերուցք/
// Մոխրագույն). Must sit inside ThemeProvider.
//
// Two directions of the theme<->background coupling: explicitly picking a
// background always forces the matching theme (deep/coal are dark,
// cream/grey are light) — the brief's rule that a light background must
// never pair with dark ink. The reverse direction matters too, and is easy
// to miss: Settings exposes Theme and Background as separately clickable
// controls, so a person can pick a background (forcing a matching theme via
// setBackground below), then later flip Theme on its own, bypassing
// setBackground entirely. A real bug here (found live: explicit "cream"
// background + a direct switch to dark theme) left `--ink` and `--bg-base`
// nearly identical — text unreadable on every screen, not just the one
// where the mismatch was created. Before any background has ever been
// picked there's nothing sticky yet either, so the same effect also covers
// that case (deep while dark, cream while light) rather than defaulting to
// a hardcoded "deep" that can disagree with a light system theme on first
// load.
//
// The fix is a lightness *reconciliation*, not a re-run of the original
// pre-explicit auto-follow: it only overrides the background when its own
// light/dark nature actually disagrees with the resolved theme (a same-
// lightness change, e.g. deep -> coal, is left alone — that's still a
// deliberate choice, not a mismatch), and it persists the corrected
// background so a reload doesn't reintroduce the same mismatch.
export function BackgroundProvider({ children }: { children: ReactNode }) {
  const { resolved, setPreference } = useTheme();
  const explicitRef = useRef(readStoredBackground() !== null);
  const [background, setBackgroundState] = useState<BackgroundId>(
    () => readStoredBackground() ?? (resolved === "dark" ? "deep" : "cream"),
  );

  useEffect(() => {
    const currentIsLight = BACKGROUNDS.find((entry) => entry.id === background)?.light ?? resolved !== "dark";
    const themeIsLight = resolved !== "dark";
    if (!explicitRef.current || currentIsLight !== themeIsLight) {
      const corrected = resolved === "dark" ? "deep" : "cream";
      setBackgroundState(corrected);
      if (explicitRef.current) window.localStorage.setItem(STORAGE_KEY, corrected);
    }
    // Only `resolved` should re-run this — `background` is read here to
    // check the CURRENT value at the moment theme changes, not to make this
    // effect re-fire every time the background itself changes (setBackground
    // already keeps the two in sync synchronously on that path).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved]);

  useEffect(() => {
    document.documentElement.setAttribute("data-bg", background);
  }, [background]);

  const setBackground = useCallback(
    (b: BackgroundId) => {
      explicitRef.current = true;
      setBackgroundState(b);
      window.localStorage.setItem(STORAGE_KEY, b);
      const def = BACKGROUNDS.find((entry) => entry.id === b);
      if (def) setPreference(def.light ? "light" : "dark");
    },
    [setPreference],
  );

  const value = useMemo(() => ({ background, setBackground }), [background, setBackground]);

  return <BackgroundContext.Provider value={value}>{children}</BackgroundContext.Provider>;
}

export function useBackground() {
  const ctx = useContext(BackgroundContext);
  if (!ctx) throw new Error("useBackground must be used within BackgroundProvider");
  return ctx;
}
