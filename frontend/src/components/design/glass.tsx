"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";

// Budget: at most 8 backdrop-filter elements per screen (brief §5.3) — warns
// in development past that. Never a real page limit in production; a real
// limit would need to be visible to the author, not silently enforced.
let liveGlassCount = 0;

export type GlassProps = {
  children?: ReactNode;
  radius?: number;
  className?: string;
  style?: CSSProperties;
};

export function Glass({ children, radius = 26, className, style }: GlassProps) {
  useEffect(() => {
    liveGlassCount += 1;
    if (process.env.NODE_ENV !== "production" && liveGlassCount > 8) {
      console.warn(`Glass: ${liveGlassCount} backdrop-filter elements mounted at once — brief §5.3 budgets 8 per screen.`);
    }
    return () => {
      liveGlassCount -= 1;
    };
  }, []);

  return (
    <div className={`glass-panel ${className ?? ""}`} style={{ borderRadius: radius, ...style }}>
      {children}
    </div>
  );
}
