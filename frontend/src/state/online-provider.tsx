"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const OnlineContext = createContext<boolean | undefined>(undefined);

export function OnlineProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return <OnlineContext.Provider value={online}>{children}</OnlineContext.Provider>;
}

export function useOnline(): boolean {
  const ctx = useContext(OnlineContext);
  if (ctx === undefined) throw new Error("useOnline must be used within OnlineProvider");
  return ctx;
}
