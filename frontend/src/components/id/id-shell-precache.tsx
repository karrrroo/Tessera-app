"use client";

import { useEffect } from "react";

// Registers public/sw.js app-wide (cheap no-op on repeat visits, and the SW
// itself only ever acts on /id + its static chunks — see that file's own
// comment). Mounted once in the root layout so precaching can start on any
// page, not only after a user first opens /id.
export function IdShellPrecache() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Best-effort — a browser that refuses this just means ID-8's offline
      // guarantee doesn't hold on that browser, not a broken app.
    });
  }, []);

  return null;
}
