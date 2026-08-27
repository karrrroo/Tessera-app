"use client";

import { useAuth } from "@/state/auth-provider";
import { useT } from "@/i18n/locale-provider";
import { SessionList } from "@/components/auth/session-list";
import { AppearancePanel } from "@/components/settings/appearance-panel";
import { ExportPanel } from "@/components/export/export-panel";
import { ExportLogTable } from "@/components/export/export-log-table";

export default function SettingsPage() {
  const { logout, user } = useAuth();
  const t = useT();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
          {t.set.title}
        </h1>
        <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>
          {t.set.sub}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>
          {t.set.phase12Note}
        </p>
      </div>

      <AppearancePanel />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold tracking-wide" style={{ color: "var(--ink-3)" }}>
          {t.set.gAccount}
        </h3>
        <SessionList />
      </div>

      <ExportPanel />
      {user?.role === "admin" && <ExportLogTable />}

      <button
        onClick={() => logout()}
        className="self-start rounded-full px-4 py-2 text-sm"
        style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
      >
        {t.common.logout}
      </button>
    </main>
  );
}
