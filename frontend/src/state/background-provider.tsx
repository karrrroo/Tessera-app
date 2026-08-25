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
// Two directions of the theme<->background coupling, deliberately different:
// explicitly picking a background always forces the matching theme (deep/coal
// are dark, cream/grey are light) — the brief's rule that a light background
// must never pair with dark ink. But *before* the person has ever picked a
// background, there's nothing to keep sticky yet, so it auto-follows
// whichever theme is resolved (including live OS changes under "system") —
// deep while dark, cream while light — rather than defaulting to a hardcoded
// "deep" that can disagree with a light system theme on first load (that
// exact mismatch, both tokens resolving near-black text-on-background, was
// caught rendering the login screen unreadable). Once setBackground is ever
// called, that auto-follow stops for good.
export function BackgroundProvider({ children }: { children: ReactNode }) {
  const { resolved, setPreference } = useTheme();
  const explicitRef = useRef(readStoredBackground() !== null);
  const [background, setBackgroundState] = useState<BackgroundId>(
    () => readStoredBackground() ?? (resolved === "dark" ? "deep" : "cream"),
  );

  useEffect(() => {
    if (!explicitRef.current) {
      setBackgroundState(resolved === "dark" ? "deep" : "cream");
    }
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
