"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type LayoutMode = "web" | "mobile";
const WEB_MODE_MIN_WIDTH = 900;

type LayoutModeContextValue = {
  mode: LayoutMode;
  setMode: (m: LayoutMode) => void;
  /** The switch itself is a prototype/demo control (brief §8ter) — hidden
      below 900px of real browser width, where the choice is meaningless. */
  switchVisible: boolean;
};

const LayoutModeContext = createContext<LayoutModeContextValue | undefined>(undefined);

// Not persisted — brief §8ter: "a prototype preview control, not a question
// asked of real users; in production the device decides." Defaults to
// whatever the real viewport implies.
export function LayoutModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<LayoutMode>("web");
  const [switchVisible, setSwitchVisible] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${WEB_MODE_MIN_WIDTH}px)`);
    // Below 900px the switch is hidden and the choice is meaningless, so mode
    // is forced to mobile; above it, resizing never overrides whichever mode
    // the user (or the default) already had — the switch itself is the only
    // way to change it once it's visible (PL-3 governs the switch's own
    // visibility reacting to width, not the chosen mode being reset).
    const apply = () => {
      setSwitchVisible(media.matches);
      if (!media.matches) setMode("mobile");
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return (
    <LayoutModeContext.Provider value={{ mode, setMode, switchVisible }}>{children}</LayoutModeContext.Provider>
  );
}

export function useLayoutMode() {
  const ctx = useContext(LayoutModeContext);
  if (!ctx) throw new Error("useLayoutMode must be used within LayoutModeProvider");
  return ctx;
}
