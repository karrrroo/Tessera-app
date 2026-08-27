"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/state/auth-provider";
import { useLocale } from "@/i18n/locale-provider";
import { apiJson, ApiRequestError } from "@/lib/api/client";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import { GradientMesh } from "@/components/design/gradient-mesh";
import { Glass } from "@/components/design/glass";
import { landingRouteForRole } from "@/lib/landing-route";

export default function FirstLoginPage() {
  const { t } = useLocale();
  const router = useRouter();
  const { status, user, refreshUser, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Not a back link — a plain link to /login would leave the still-valid
  // session alive, so typing /overview by hand would enter the app without
  // ever changing the password. Signing out is the only way off this screen
  // that doesn't defeat the guard.
  async function signOut() {
    await logout();
    router.replace("/login");
  }

  useEffect(() => {
    if (status === "anon") router.replace("/login");
    else if (status === "authed" && user && !user.mustChangePassword) router.replace(landingRouteForRole(user.role));
  }, [status, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError(t.auth.mismatch);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiJson("/api/auth/password/change", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
      await refreshUser();
      // No `?? "student"` fallback here. `user` is this closure's value, i.e.
      // the profile from BEFORE the refresh above, so defaulting it silently
      // sent whoever it could not identify to the student landing route — a
      // teacher would land on /overview and be refused. When the role is
      // known, go straight there; when it is not, do nothing and let the
      // effect above redirect once refreshUser() has updated state, which it
      // already does the moment mustChangePassword turns false.
      if (user?.role) router.push(landingRouteForRole(user.role));
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "AUTH_CURRENT_PASSWORD_INVALID") {
        setError(t.auth.errCreds);
      } else if (err instanceof ApiRequestError && err.code === "AUTH_PASSWORD_WEAK") {
        setError(t.auth.errGeneric);
      } else {
        setError(t.auth.errGeneric);
      }
    } finally {
      setBusy(false);
    }
  }

  if (status !== "authed" || !user?.mustChangePassword) return null;

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-base p-8">
      <GradientMesh />
      <Glass radius={34} className="relative z-10 w-full max-w-sm space-y-4 p-8">
        <div>
          <h1 className="font-serif text-2xl" style={{ color: "var(--ink)" }}>
            {t.auth.firstTitle}
          </h1>
          {/* --ink-2, not --ink-3 — this card is real glass over the mesh,
              not an opaque panel; --ink-3's 48% opacity measured near-
              invisible against the mesh's lighter patches (same fix as
              login/page.tsx). */}
          <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
            {t.auth.firstBody}
          </p>
          {/* --ink-2, not --ink-3 — same glass-over-mesh contrast issue as
              the line above. */}
          <p className="mt-2 text-xs" style={{ color: "var(--ink-2)" }}>
            {t.auth.firstCredSource}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <PasswordField label={t.set.pwCur} value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
          <PasswordField label={t.auth.newPw} value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
          <PasswordField label={t.auth.repeat} value={confirm} onChange={setConfirm} autoComplete="new-password" />
          <PasswordChecklist password={newPassword} />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            {t.auth.saveGo}
          </button>
          <button
            type="button"
            onClick={signOut}
            className="block w-full text-center text-[13px]"
            style={{ color: "var(--ink-2)" }}
          >
            {t.auth.signOut}
          </button>
        </form>
      </Glass>
    </main>
  );
}
