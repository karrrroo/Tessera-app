"use client";

import Link from "next/link";
import { SetupChecklist } from "@/components/admin/setup-checklist";
import { PeopleSearch } from "@/components/admin/people-search";
import { useT } from "@/i18n/locale-provider";

export default function AdminOverviewPage() {
  const t = useT();
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
          {t.admin.title}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          {t.admin.sub}
        </p>
      </div>
      <PeopleSearch />

      <SetupChecklist />

      <div className="flex flex-col gap-2">
        <Link href="/admin/students/new" className="text-sm underline" style={{ color: "var(--ink-2)" }}>
          {t.admin.stu.newLink}
        </Link>
        {/* Its counterpart. Both account-creation paths sit together here so
            an admin does not have to know that one exists to find the other. */}
        <Link href="/admin/teachers/new" className="text-sm underline" style={{ color: "var(--ink-2)" }}>
          {t.admin.teach.newLink}
        </Link>
        <Link href="/admin/scan-anomalies" className="text-sm underline" style={{ color: "var(--ink-2)" }}>
          {t.admin.scanAnomalies} →
        </Link>
        {/* B5. Reached from here rather than from the sidebar: the admin
            sidebar has exactly three slots (dashboard, queue, settings) and
            adding a fourth would need a nav id, a label and an icon the
            design package never specified — the same gap that once made all
            three admin icons render identically. Every other admin
            sub-screen is reached this way too. */}
        <Link href="/admin/applications" className="text-sm underline" style={{ color: "var(--ink-2)" }}>
          {t.admin.apps.title} →
        </Link>
      </div>
    </main>
  );
}
