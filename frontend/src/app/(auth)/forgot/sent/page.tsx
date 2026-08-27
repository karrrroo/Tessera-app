"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLocale, interpolate } from "@/i18n/locale-provider";
import { apiFetch } from "@/lib/api/client";
import { GradientMesh } from "@/components/design/gradient-mesh";
import { Glass } from "@/components/design/glass";

const COOLDOWN_SECONDS = 60;

// useSearchParams() forces a client-only bail-out during static prerendering
// and Next.js requires a Suspense boundary around it (build-only error,
// invisible under `next dev` — found while building Phase 6, unrelated to
// it, and fixed here rather than left for whoever hits the next `next build`).
export default function ForgotSentPage() {
  return (
    <Suspense fallback={null}>
      <ForgotSentContent />
    </Suspense>
  );
}

function ForgotSentContent() {
  const { t } = useLocale();
  const email = useSearchParams().get("email") ?? "";
  const [secondsLeft, setSecondsLeft] = useState(COOLDOWN_SECONDS);
  const [devLink, setDevLink] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!email) return;
    fetch(`/api/auth/dev/last-reset-token?email=${encodeURIComponent(email)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setDevLink(body?.link ?? null))
      .catch(() => setDevLink(null));
  }, [email]);

  async function resend() {
    if (secondsLeft > 0 || !email) return;
    await apiFetch("/api/auth/password/forgot", { method: "POST", body: JSON.stringify({ email }) });
    setSecondsLeft(COOLDOWN_SECONDS);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-base p-8">
      <GradientMesh />
      <Glass radius={34} className="relative z-10 w-full max-w-sm space-y-4 p-8 text-center">
        <h1 className="font-serif text-2xl" style={{ color: "var(--ink)" }}>
          {t.auth.sentTitle}
        </h1>
        {/* --ink-2, not --ink-3 — real glass over the mesh, same fix as
            login/page.tsx. */}
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          {t.auth.sentBody}
        </p>

        <button
          onClick={resend}
          disabled={secondsLeft > 0}
          className="w-full rounded-full border border-hair px-4 py-2.5 text-sm font-medium disabled:opacity-50"
          style={{ color: "var(--ink-2)" }}
        >
          {secondsLeft > 0 ? interpolate(t.auth.resendWait, { seconds: secondsLeft }) : t.auth.resendButton}
        </button>

        {devLink && (
          <p className="text-xs" style={{ color: "var(--ink-2)" }}>
            {/* Dev-only convenience (NODE_ENV !== "production"), never shown to
                real users — deliberately not localized. */}
            Dev: reset link{" "}
            <Link href={devLink} className="underline">
              {devLink}
            </Link>
          </p>
        )}

        <Link href="/login" className="block text-sm underline" style={{ color: "var(--ink-2)" }}>
          {t.auth.back}
        </Link>
      </Glass>
    </main>
  );
}
