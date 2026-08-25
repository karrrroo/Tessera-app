"use client";

import { useOnline } from "@/state/online-provider";
import { useT } from "@/i18n/locale-provider";

export function OfflineBanner() {
  const online = useOnline();
  const t = useT();

  if (online) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-30 py-1.5 text-center text-xs font-medium" style={{ background: "var(--danger)", color: "var(--danger-fg)" }}>
      {t.scr.off.bar}
    </div>
  );
}
