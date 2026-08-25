"use client";

import { useAuth } from "@/state/auth-provider";
import { useT } from "@/i18n/locale-provider";

export default function OverviewPage() {
  const { user } = useAuth();
  const t = useT();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
        {t.nav.overview}
      </h1>
      <p className="text-sm" style={{ color: "var(--ink-2)" }}>
        Signed in as {user?.firstName} {user?.lastName} ({user?.role})
      </p>
      <p className="text-xs" style={{ color: "var(--ink-3)" }}>
        The mosaic and real content arrive in Phase 7 — this is a gating placeholder.
      </p>
    </main>
  );
}
