"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ACCENTS, ACHROMATIC_ACCENT_IDS, NON_BLACK_ACCENT_FG, type AccentId } from "../design/accents";
import { deriveAccentTint, FALLBACK_TINT } from "../design/accent-tint";

type AccentContextValue = {
  accent: AccentId;
  setAccent: (a: AccentId) => void;
};

const AccentContext = createContext<AccentContextValue | undefined>(undefined);
const STORAGE_KEY = "tessera.accent";

function isAccentId(value: string | null): value is AccentId {
  return ACCENTS.some((a) => a.id === value);
}

function readStoredAccent(): AccentId {
  if (typeof window === "undefined") return "black";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isAccentId(stored) ? stored : "black";
}

// Writes --accent/--accent-fg/--accent-tint inline on the document root
// (brief §8). Black is special-cased to the CSS defaults already in
// tessera.css, which invert per theme ([data-tt] sets --accent/--accent-fg
// for black there) — black is the only accent the brief requires to invert;
// every other accent keeps its own fixed hex in both themes. --accent-tint
// is the fixed steel fallback for the two named achromatic accents (black,
// neutral) and a derived hue otherwise — never pure black/white regardless
// of which accent is active.
export function AccentProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<AccentId>(readStoredAccent);

  useEffect(() => {
    const root = document.documentElement;
    const def = ACCENTS.find((a) => a.id === accent);
    if (!def) return;

    if (accent === "black") {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-fg");
    } else {
      root.style.setProperty("--accent", def.hex);
      root.style.setProperty("--accent-fg", NON_BLACK_ACCENT_FG);
    }
    root.style.setProperty(
      "--accent-tint",
      ACHROMATIC_ACCENT_IDS.has(accent) ? FALLBACK_TINT : deriveAccentTint(def.hex),
    );
  }, [accent]);

  const setAccent = useCallback((a: AccentId) => {
    setAccentState(a);
    window.localStorage.setItem(STORAGE_KEY, a);
  }, []);

  const value = useMemo(() => ({ accent, setAccent }), [accent, setAccent]);

  return <AccentContext.Provider value={value}>{children}</AccentContext.Provider>;
}

export function useAccent() {
  const ctx = useContext(AccentContext);
  if (!ctx) throw new Error("useAccent must be used within AccentProvider");
  return ctx;
}
