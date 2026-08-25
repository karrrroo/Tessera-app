"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/state/auth-provider";
import { useLocale } from "@/i18n/locale-provider";

type DemoAccount = { email: string; role: "student" | "teacher" | "admin"; mustChangePassword: boolean };

// Every seed account (dev-only convention, never real credentials) shares one
// password — see docs/reference/tessera-seed.sql.
const SEED_PASSWORD = "Tessera2026!";

export function DemoRow({ onError }: { onError: (message: string) => void }) {
  const { t } = useLocale();
  const { login } = useAuth();
  const [accounts, setAccounts] = useState<DemoAccount[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/dev/demo-accounts")
      .then((res) => (res.ok ? res.json() : []))
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  if (!accounts?.length) return null;

  const labelFor = (a: DemoAccount) => {
    if (a.mustChangePassword) return t.auth.demoF;
    if (a.role === "student") return t.auth.demoS;
    if (a.role === "teacher") return t.auth.demoT;
    return t.auth.demoA;
  };

  async function loginAs(a: DemoAccount) {
    setBusy(true);
    try {
      await login({ identifier: a.email, password: SEED_PASSWORD, remember: false, deviceLabel: "demo-row" });
    } catch {
      onError(t.auth.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-gray-400">{t.auth.demoLabel}</p>
      <div className="flex flex-wrap gap-2">
        {accounts.map((a) => (
          <button
            key={a.email}
            disabled={busy}
            onClick={() => loginAs(a)}
            className="rounded-full border border-gray-300 px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {labelFor(a)}
          </button>
        ))}
      </div>
    </div>
  );
}
