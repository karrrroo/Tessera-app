"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "@/i18n/locale-provider";
import { apiJson, ApiRequestError } from "@/lib/api/client";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import { GradientMesh } from "@/components/design/gradient-mesh";
import { Glass } from "@/components/design/glass";

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
    <main className="relative flex min-h-screen items-center justify-center bg-base p-8">
      <GradientMesh />
      <Glass radius={34} className="relative z-10 w-full max-w-sm space-y-4 p-8">
        <div>
          <h1 className="font-serif text-2xl" style={{ color: "var(--ink)" }}>
            {t.auth.newTitle}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
            {t.auth.newSub}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
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
        </form>
      </Glass>
    </main>
  );
}
