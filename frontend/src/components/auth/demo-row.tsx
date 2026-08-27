"use client";

import { useState } from "react";
import { useAuth } from "@/state/auth-provider";
import { useLocale } from "@/i18n/locale-provider";

// Every seed account (dev-only convention, never real credentials) shares one
// password — see docs/reference/tessera-seed.sql. Never rendered: it lives
// only in the closure below, used to call login() directly — never put into
// the DOM, an input value, or any attribute a screenshot could capture.
const SEED_PASSWORD = "Tessera2026!";

// Four literal entries, not derived, indexed, or spread from one another.
// This duplicated twice before by computing a label from a *fetched*
// account's role/must-change-password flag instead of naming its account
// directly — once two accounts shared a role, or a flag changed underneath
// it, the label collided. Naming each account by its own fixed identity
// can't collide, no matter what its live server-side state does.
const DEMO_ACCOUNTS: { email: string; labelKey: "demoS" | "demoT" | "demoA" | "demoF" }[] = [
  { email: "ani@demo.tessera.am", labelKey: "demoS" },
  { email: "sargsyan@demo.tessera.am", labelKey: "demoT" },
  { email: "direktor@demo.tessera.am", labelKey: "demoA" },
  { email: "nor@demo.tessera.am", labelKey: "demoF" },
];

export function DemoRow({ onError }: { onError: (message: string) => void }) {
  const { t } = useLocale();
  const { login } = useAuth();
  const [busy, setBusy] = useState(false);

  // One tap signs in — no intermediate "fill the form and wait" step; a demo
  // should land in the app on the first tap, not ask for a second.
  async function loginAs(email: string) {
    setBusy(true);
    try {
      await login({ identifier: email, password: SEED_PASSWORD, remember: false, deviceLabel: "demo-row" });
    } catch {
      onError(t.auth.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs tracking-wide" style={{ color: "var(--ink-3)" }}>
        {t.auth.demoLabel}
      </p>
      <div className="flex flex-wrap gap-2">
        {DEMO_ACCOUNTS.map((a) => (
          <button
            key={a.email}
            disabled={busy}
            onClick={() => loginAs(a.email)}
            className="rounded-full border border-hair px-3 py-1.5 text-xs disabled:opacity-50"
            style={{ color: "var(--ink-2)" }}
          >
            {t.auth[a.labelKey]}
          </button>
        ))}
      </div>
    </div>
  );
}
