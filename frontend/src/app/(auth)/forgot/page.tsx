"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "@/i18n/locale-provider";
import { apiFetch } from "@/lib/api/client";

export default function ForgotPasswordPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/auth/password/forgot", { method: "POST", body: JSON.stringify({ email }) });
      if (res.status === 429) {
        setError(t.auth.errRateLimited);
        return;
      }
      router.push(`/forgot/sent?email=${encodeURIComponent(email)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">{t.auth.recTitle}</h1>
        <p className="text-sm text-gray-500">{t.auth.recSub}</p>
        <label className="block space-y-1">
          <span className="text-sm text-gray-600">{t.auth.identifierLabel}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-black px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {t.auth.recButton}
        </button>
        <Link href="/login" className="block text-center text-sm text-gray-500 underline">
          {t.auth.recBack}
        </Link>
      </form>
    </main>
  );
}
