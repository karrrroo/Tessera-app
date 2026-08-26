"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/state/auth-provider";
import { useLocale } from "@/i18n/locale-provider";
import { ApiRequestError } from "@/lib/api/client";
import { PasswordField } from "@/components/auth/password-field";
import { LanguagePill } from "@/components/auth/language-pill";
import { DemoRow } from "@/components/auth/demo-row";
import { WebMobileSwitch } from "@/components/shell/web-mobile-switch";
import { GradientMesh } from "@/components/design/gradient-mesh";
import { Glass } from "@/components/design/glass";
import { GlassLayered } from "@/components/design/glass-layered";
import { Mark } from "@/components/brand/mark";
import { landingRouteForRole } from "@/lib/landing-route";
import { OpeningOverlay, useOpeningSequence } from "@/components/auth/opening-sequence";

function errorMessage(err: unknown, t: ReturnType<typeof useLocale>["t"]): string {
  if (err instanceof ApiRequestError) {
    if (err.code === "AUTH_INVALID_CREDENTIALS") return t.auth.errCreds;
    if (err.code === "AUTH_ACCOUNT_LOCKED") {
      const seconds = err.details?.retryAfterSeconds;
      return t.auth.errLocked.replace("{seconds}", String(seconds ?? "60"));
    }
    if (err.code === "RATE_LIMITED") return t.auth.errRateLimited;
    if (err.code === "VALIDATION_FAILED") return t.auth.errField;
  }
  return t.auth.errGeneric;
}

export default function LoginPage() {
  const { t } = useLocale();
  const { login, status, user } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { phase, cardVisible, demoVisible } = useOpeningSequence();
  const desktopMarkRef = useRef<HTMLDivElement>(null);
  const mobileMarkRef = useRef<HTMLDivElement>(null);
  // Stable array identity: OpeningOverlay's measurement effect depends on
  // this array, and an inline literal here would get a new identity on
  // every render (every cardVisible/demoVisible tick), re-triggering that
  // effect and restarting its 700ms CSS transition each time instead of
  // running it once when the transition phase begins.
  const markTargetRefs = useMemo(() => [desktopMarkRef, mobileMarkRef], []);
  const markRevealed = phase === "revealed";

  useEffect(() => {
    if (status === "authed" && user) router.replace(landingRouteForRole(user.role));
  }, [status, user, router]);

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

  const form = (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm text-ink-2">{t.auth.idLabel}</span>
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
          className="w-full rounded-[18px] border border-hair bg-glass px-3 py-2 text-sm text-ink outline-none focus:border-hair-bright"
        />
      </label>
      <PasswordField label={t.auth.pw} value={password} onChange={setPassword} autoComplete="current-password" />
      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-ink-2">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          {t.auth.remember}
        </label>
        <Link href="/forgot" className="text-ink-3 underline hover:text-ink-2">
          {t.auth.forgot}
        </Link>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full px-4 py-2.5 text-sm font-medium disabled:opacity-50"
        style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
      >
        {t.auth.submit}
      </button>
    </form>
  );

  const cardStyle: React.CSSProperties = {
    opacity: cardVisible ? 1 : 0,
    transform: cardVisible ? "translateY(0)" : "translateY(16px)",
    transition: "opacity 400ms var(--ease-out), transform 400ms var(--ease-out)",
  };

  // Shared between the mobile card and the desktop card — only the wrapper
  // (a flat bg-raised Glass panel on mobile, the three-layer glass sitting
  // directly on the continuous mesh on desktop) differs.
  const cardBody = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl" style={{ color: "var(--ink)" }}>
            {t.auth.title}
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--ink-3)" }}>
            {t.auth.sub}
          </p>
        </div>
        <LanguagePill />
      </div>

      {form}

      <p className="text-center text-[12.5px]" style={{ color: "var(--ink-3)" }}>
        {t.auth.support}
      </p>

      <div
        className="space-y-2 border-t border-hair pt-4"
        style={{ opacity: demoVisible ? 1 : 0, transition: "opacity 300ms var(--ease-out)" }}
      >
        <DemoRow onError={setError} />
      </div>
    </>
  );

  return (
    <div className="relative h-screen overflow-hidden bg-base">
      <OpeningOverlay phase={phase} targetRefs={markTargetRefs} />

      <div className="absolute right-4 top-4 z-20" style={cardStyle}>
        <WebMobileSwitch />
      </div>

      {/* Desktop (≥900px): one continuous full-bleed mesh — not two columns
          joined at a seam. This overrides the base brief's §8bis ("right 48%
          — flat --bg-raised, no gradient, no glass") and corrections'
          own Fix 4 column split; see docs/decisions.md. Nothing sits on its
          own background here except the form's own glass card below — the
          mesh IS the page, edge to edge, with nothing to point at as an edge. */}
      <div className="absolute inset-0 hidden desktop:block" style={{ zIndex: 0 }}>
        <GradientMesh animateEntry={phase === "splash"} />
      </div>

      <div className="relative hidden h-full desktop:grid" style={{ gridTemplateColumns: "1fr 1fr", placeItems: "center", zIndex: 10 }}>
        <div className="flex flex-col items-center gap-4 px-10 text-center" style={cardStyle}>
          <div ref={desktopMarkRef} style={{ color: "var(--ink)", opacity: markRevealed ? 1 : 0 }}>
            <Mark size={64} />
          </div>
          <p className="max-w-sm text-sm" style={{ color: "var(--ink-2)" }}>
            {t.auth.tagline}
          </p>
        </div>

        <GlassLayered radius={34} className="login-card w-full max-w-[360px] space-y-6 p-8" style={cardStyle}>
          {cardBody}
        </GlassLayered>
      </div>

      {/* Mobile (<900px): unchanged — full-bleed mesh behind one centred
          glass card, its own separate mesh instance (a small viewport has no
          "second column" to bleed into in the first place). */}
      <div className="absolute inset-0 grid place-items-center overflow-y-auto p-8 desktop:hidden">
        <GradientMesh animateEntry={phase === "splash"} />
        <Glass radius={34} className="login-card relative z-10 w-full max-w-[380px] space-y-6 p-8" style={cardStyle}>
          <div className="space-y-1 text-center">
            <div ref={mobileMarkRef} className="mx-auto inline-block" style={{ opacity: markRevealed ? 1 : 0 }}>
              <Mark size={44} />
            </div>
          </div>
          {cardBody}
        </Glass>
      </div>
    </div>
  );
}
