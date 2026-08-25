"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/state/auth-provider";
import { useLocale } from "@/i18n/locale-provider";
import { ApiRequestError } from "@/lib/api/client";
import { PasswordField } from "@/components/auth/password-field";
import { LanguagePill } from "@/components/auth/language-pill";
import { DemoRow } from "@/components/auth/demo-row";

function errorMessage(err: unknown, t: ReturnType<typeof useLocale>["t"]): string {
  if (err instanceof ApiRequestError) {
    if (err.code === "AUTH_INVALID_CREDENTIALS") return t.auth.errCreds;
    if (err.code === "AUTH_ACCOUNT_LOCKED") return t.auth.errLocked;
    if (err.code === "RATE_LIMITED") return t.auth.errRateLimited;
    if (err.code === "VALIDATION_FAILED") return t.auth.errField;
  }
  return t.auth.errGeneric;
}

export default function LoginPage() {
  const { t } = useLocale();
  const { login, status } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "authed") router.replace("/overview");
  }, [status, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier || !password) {
      setError(t.auth.errField);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login({ identifier, password, remember, deviceLabel: navigator.userAgent.slice(0, 100) });
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="hidden flex-1 items-center justify-center bg-black text-white md:flex">
        <h1 className="font-serif text-4xl">{t.auth.title}</h1>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold md:hidden">{t.auth.title}</h1>
              <p className="text-sm text-gray-500">{t.auth.subtitle}</p>
            </div>
            <LanguagePill />
          </div>

          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-1">
              <span className="text-sm text-gray-600">{t.auth.identifierLabel}</span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
              />
            </label>
            <PasswordField
              label={t.auth.passwordLabel}
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              {t.auth.rememberLabel}
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-black px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {t.auth.loginButton}
            </button>
          </form>

          <Link href="/forgot" className="block text-center text-sm text-gray-500 underline">
            {t.auth.forgotLink}
          </Link>

          <DemoRow onError={setError} />
        </div>
      </div>
    </div>
  );
}
