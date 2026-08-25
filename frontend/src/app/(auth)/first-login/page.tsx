"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/state/auth-provider";
import { useLocale } from "@/i18n/locale-provider";
import { apiJson, ApiRequestError } from "@/lib/api/client";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordChecklist } from "@/components/auth/password-checklist";

export default function FirstLoginPage() {
  const { t } = useLocale();
  const router = useRouter();
  const { status, user, refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "anon") router.replace("/login");
    else if (status === "authed" && user && !user.mustChangePassword) router.replace("/overview");
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
      router.push("/overview");
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "AUTH_CURRENT_PASSWORD_INVALID") {
        setError(t.auth.errCreds);
      } else if (err instanceof ApiRequestError && err.code === "AUTH_PASSWORD_WEAK") {
        setError(t.auth.mismatch);
      } else {
        setError(t.auth.errGeneric);
      }
    } finally {
      setBusy(false);
    }
  }

  if (status !== "authed" || !user?.mustChangePassword) return null;

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">{t.auth.firstTitle}</h1>
        <p className="text-sm text-gray-500">{t.auth.firstBody}</p>
        <PasswordField label={t.auth.currentPasswordLabel} value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
        <PasswordField label={t.auth.newPasswordLabel} value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
        <PasswordField label={t.auth.confirmPasswordLabel} value={confirm} onChange={setConfirm} autoComplete="new-password" />
        <PasswordChecklist password={newPassword} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-black px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {t.auth.saveGo}
        </button>
      </form>
    </main>
  );
}
