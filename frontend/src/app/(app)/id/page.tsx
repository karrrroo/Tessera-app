"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/state/auth-provider";
import { useT } from "@/i18n/locale-provider";
import { IdCard } from "@/components/id/id-card";
import { TeacherIdCard } from "@/components/id/teacher-id-card";
import { TodayPanel } from "@/components/id/today-panel";
import { QrSheet } from "@/components/id/qr-sheet";
import { useCredential } from "@/components/id/use-credential";
import { identityApi, type TodayEntry } from "@/lib/api/identity";

export default function IdPage() {
  const { user } = useAuth();
  const t = useT();
  const { credential, loading } = useCredential();
  const [qrOpen, setQrOpen] = useState(false);
  const [today, setToday] = useState<TodayEntry[]>([]);

  useEffect(() => {
    if (user?.role !== "teacher") return;
    let cancelled = false;
    // Fetch-on-mount for the teacher's own today panel — a plain network
    // read, not the offline-cached credential path above (teachers have no
    // qr_credential row at all, so there is nothing to cache-first here).
    identityApi
      .getToday()
      .then((rows) => {
        if (!cancelled) setToday(rows);
      })
      .catch(() => {
        if (!cancelled) setToday([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  if (loading) {
    return <main className="flex flex-1 items-center justify-center p-8" />;
  }

  if (!credential) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
          {t.scr.err.title}
        </p>
        <p className="text-xs" style={{ color: "var(--ink-3)" }}>
          {t.scr.err.body}
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-8">
      {credential.holder.role === "student" ? (
        <IdCard holder={credential.holder} onOpenQr={() => setQrOpen(true)} />
      ) : (
        <>
          <TeacherIdCard holder={credential.holder} />
          <TodayPanel entries={today} />
        </>
      )}
      {qrOpen && credential.payload && <QrSheet payload={credential.payload} onClose={() => setQrOpen(false)} />}
    </main>
  );
}
