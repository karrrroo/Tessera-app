"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "@/i18n/locale-provider";
import { apiJson, ApiRequestError } from "@/lib/api/client";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordChecklist } from "@/components/auth/password-checklist";

export default function ResetPasswordPage() {
  const { t } = useLocale();
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError(t.auth.mismatch);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiJson("/api/auth/password/reset", { method: "POST", body: JSON.stringify({ token, newPassword }) });
      router.push("/login");
    } catch (err) {
      if (err instanceof ApiRequestError && (err.code === "AUTH_RESET_TOKEN_INVALID" || err.code === "AUTH_RESET_TOKEN_EXPIRED")) {
        setError(t.auth.resetInvalid);
      } else {
        setError(t.auth.errGeneric);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">{t.auth.newTitle}</h1>
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
