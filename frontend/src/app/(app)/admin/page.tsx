"use client";

import Link from "next/link";
import { SetupChecklist } from "@/components/admin/setup-checklist";
import { useT } from "@/i18n/locale-provider";

export default function AdminOverviewPage() {
  const t = useT();
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
          {t.admin.title}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
          {t.admin.sub}
        </p>
      </div>
      <SetupChecklist />
      <Link href="/admin/scan-anomalies" className="text-sm underline" style={{ color: "var(--ink-2)" }}>
        {t.admin.scanAnomalies} →
      </Link>
    </main>
  );
}
