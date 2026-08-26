"use client";

import { useEffect, useState } from "react";
import { identityApi, type CredentialResponse } from "@/lib/api/identity";
import { readStoredCredential, writeStoredCredential } from "./offline-credential-store";

// Cache-first, not network-first (roadmap Phase 6): read IndexedDB, render
// immediately, then revalidate from the network in the background. A
// network-first read would cost the sub-500ms open PRD §11.1 wants at a
// door with one bar of signal — precisely the situation this exists for.
export function useCredential() {
  const [credential, setCredential] = useState<CredentialResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const cached = await readStoredCredential();
      if (cancelled) return;
      if (cached) {
        setCredential(cached);
        setLoading(false);
      }

      try {
        const fresh = await identityApi.getCredential();
        if (cancelled) return;
        setCredential(fresh);
        setLoading(false);
        if (fresh.payload) void writeStoredCredential(fresh);
      } catch {
        // Offline, or the credential was revoked server-side — either way,
        // whatever IndexedDB already rendered (if anything) stands. A stale
        // cached QR after a revocation isn't a security hole: the door's
        // POST /api/verify re-reads revoked_at on every scan regardless of
        // what the phone displays (ID-9's real control, not the code).
        if (!cancelled) setLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return { credential, loading };
}
