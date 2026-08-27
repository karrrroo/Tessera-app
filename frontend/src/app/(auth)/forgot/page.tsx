"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "@/i18n/locale-provider";
import { apiFetch } from "@/lib/api/client";
import { GradientMesh } from "@/components/design/gradient-mesh";
import { Glass } from "@/components/design/glass";

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
    <main className="relative flex min-h-screen items-center justify-center bg-base p-8">
      <GradientMesh />
      <Glass radius={34} className="relative z-10 w-full max-w-sm space-y-4 p-8">
        <h1 className="font-serif text-2xl" style={{ color: "var(--ink)" }}>
          {t.auth.recTitle}
        </h1>
        {/* --ink-2, not --ink-3 — real glass over the mesh, same fix as
            login/page.tsx. */}
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          {t.auth.recSub}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm" style={{ color: "var(--ink-2)" }}>
              {t.auth.email}
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-[18px] border border-hair bg-glass px-3 py-2 text-sm text-ink focus:border-hair-bright"
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            {t.auth.send}
          </button>
        </form>
        <Link href="/login" className="block text-center text-sm underline" style={{ color: "var(--ink-2)" }}>
          {t.auth.back}
        </Link>
      </Glass>
    </main>
  );
}
