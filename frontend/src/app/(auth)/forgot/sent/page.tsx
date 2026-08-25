"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLocale, interpolate } from "@/i18n/locale-provider";
import { apiFetch } from "@/lib/api/client";

const COOLDOWN_SECONDS = 60;

export default function ForgotSentPage() {
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
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-xl font-semibold">{t.auth.sentTitle}</h1>
        <p className="text-sm text-gray-500">{t.auth.sentBody}</p>

        <button
          onClick={resend}
          disabled={secondsLeft > 0}
          className="w-full rounded-full border border-gray-300 px-4 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {secondsLeft > 0 ? interpolate(t.auth.resendWait, { seconds: secondsLeft }) : t.auth.resendButton}
        </button>

        {devLink && (
          <p className="text-xs text-gray-400">
            {t.auth.devLinkLabel}:{" "}
            <Link href={devLink} className="underline">
              {devLink}
            </Link>
          </p>
        )}

        <Link href="/login" className="block text-sm text-gray-500 underline">
          {t.auth.recBack}
        </Link>
      </div>
    </main>
  );
}
