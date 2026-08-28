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
import { GradientMesh } from "@/components/design/gradient-mesh";
import { Glass } from "@/components/design/glass";
import { GlassLayered } from "@/components/design/glass-layered";
import { Mark } from "@/components/brand/mark";
import { Lockup } from "@/components/brand/lockup";
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

// `showDemo` is decided server-side, in page.tsx, from an env var this
// client component has no access to at runtime (only NEXT_PUBLIC_-prefixed
// vars reach the browser bundle) — passed down as a plain boolean so the
// decision of whether the row exists at all is made before this ever
// reaches the client, not hidden from it afterward.
export function LoginView({ showDemo, applicationsOpen }: { showDemo: boolean; applicationsOpen: boolean }) {
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
          className="w-full rounded-[18px] border border-hair px-3 py-2 text-sm text-ink focus:border-hair-bright"
          style={{ background: "rgba(255,255,255,.06)", backdropFilter: "blur(22px) saturate(160%)", WebkitBackdropFilter: "blur(22px) saturate(160%)" }}
        />
      </label>
      <PasswordField label={t.auth.pw} value={password} onChange={setPassword} autoComplete="current-password" />
      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-ink-2">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          {t.auth.remember}
        </label>
        <Link href="/forgot" className="text-ink-2 underline hover:text-ink">
          {t.auth.forgot}
        </Link>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full px-4 py-2.5 text-sm font-medium disabled:opacity-50"
        style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-fg)" }}
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
          {/* --ink-2, not the usual --ink-3: this card is real glass over a
              variable, blurred mesh (both the desktop and mobile instances,
              per Glass's own .glass-panel — not a flat panel), not the
              opaque surfaces --ink-3's 48%-opacity default assumes
              elsewhere in the app. Measured live: --ink-3 here computed to
              ~1.06:1 contrast against the mesh's lighter patches — --ink-2
              (72% opacity) is the same token every other line on this card
              already uses. */}
          <p className="mt-1 text-[13px]" style={{ color: "var(--ink-2)" }}>
            {t.auth.sub}
          </p>
        </div>
        <LanguagePill />
      </div>

      {form}

      <p className="text-center text-[12.5px]" style={{ color: "var(--ink-2)" }}>
        {t.auth.support}
      </p>

      {/* B3: below the support line, 13px, a LINK and not a button, because it
          must not compete with sign-in. The login screen states that accounts
          are created by the institution, so a prominent Register control would
          contradict the screen it sits on; admission is also seasonal, which
          is why this is gated at all. Rendered only when the backend says
          applications are open — when it does not, this is absent from the
          server-rendered HTML rather than hidden.

          --ink, NOT the --ink-3 B3 asked for. Reported as "the apply section
          is not on the login page", and it was not a missing feature: the link
          was in the server-rendered HTML the whole time and simply could not
          be read. --ink-3 is rgba(244,242,238,.48) on dark, and this card is
          barely-tinted glass over a saturated mesh, so composited over the
          surface the glyphs actually sit on it measured 3.04:1 on desktop dark
          and 2.54:1 on mobile dark, against the 4.5:1 that 13px text needs —
          worst of all on mobile, where the card's lower edge crosses the
          mesh's bright teal bloom and the link lands right on it.

          tessera.css already forbids this ("secondary text inside these panels
          must use --ink-2, never --ink-3"), so B3's value was against the
          design system's own rule. --ink-2 is not enough either, and that is
          measured rather than assumed: the support line one row above uses it
          and still only reaches 3.89:1 on mobile dark. Full-strength --ink is
          the first value that passes in all four conditions, measured after the
          change: 7.67:1 dark desktop, 5.72:1 dark mobile, 13.80:1 and 17.45:1
          light desktop/mobile — while staying a 13px underlined
          link below the support line, so it still does not compete with the
          filled sign-in button. */}
      {/* A hairline above it, so admission reads as its own section of the card
          rather than as a stray sentence trailing the support address. Same
          `border-t border-hair pt-4` the demo block below already uses, so the
          card's lower half is one consistent stack of divided rows instead of
          one bordered row and one floating one. */}
      {applicationsOpen && (
        <p className="border-t border-hair pt-4 text-center">
          <Link href="/apply" className="text-[13px] underline underline-offset-2" style={{ color: "var(--ink)" }}>
            {t.apply.loginLink}
          </Link>
        </p>
      )}

      {showDemo && (
        <div
          className="space-y-2 border-t border-hair pt-4"
          style={{ opacity: demoVisible ? 1 : 0, transition: "opacity 300ms var(--ease-out)" }}
        >
          <DemoRow onError={setError} />
        </div>
      )}
    </>
  );

  return (
    <div className="relative h-screen overflow-hidden bg-base">
      <OpeningOverlay phase={phase} targetRefs={markTargetRefs} />

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
        <div className="flex flex-col items-center gap-5 px-10 text-center" style={cardStyle}>
          {/* Lockup, not the bare Mark — the wide login column is one of
              the two contexts (with the splash) that shows the full
              wordmark, per Tessera.dc.html's own 200px lockbox and the
              merged brief §2/§3.2. `animate` stays false: the splash
              overlay already runs the entry animation once and hands off
              to this (already-settled) element the instant it's revealed —
              animating a second time here would replay it. */}
          <div ref={desktopMarkRef} style={{ color: "var(--ink)", opacity: markRevealed ? 1 : 0 }}>
            <Lockup size={200} />
          </div>
          <p className="max-w-sm text-sm" style={{ color: "var(--ink-2)" }}>
            {t.auth.tagline}
          </p>
        </div>

        {/* solid=false: the login card is the one surface this project's own
            follow-up dropped layer 1 from entirely — against the light mesh
            specifically, even the small blur-reachable corner accent still
            read as a residual dark smudge. Every other GlassLayered surface
            (the nav pill, sheets, modals) keeps layer 1 as specified. */}
        <GlassLayered
          radius={28}
          solid={false}
          className="login-card w-full max-w-[360px] p-8"
          contentClassName="space-y-6"
          style={cardStyle}
        >
          {cardBody}
        </GlassLayered>
      </div>

      {/* Mobile (<900px): unchanged — full-bleed mesh behind one centred
          glass card, its own separate mesh instance (a small viewport has no
          "second column" to bleed into in the first place). */}
      <div className="absolute inset-0 grid place-items-center overflow-y-auto p-8 desktop:hidden">
        <GradientMesh animateEntry={phase === "splash"} />
        <Glass radius={28} className="login-card relative z-10 w-full max-w-[380px] space-y-6 p-8" style={cardStyle}>
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
