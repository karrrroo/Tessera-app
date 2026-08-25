"use client";

import { useLayoutMode } from "@/state/layout-mode-provider";
import { useT } from "@/i18n/locale-provider";

// Brief §8ter: a prototype preview control, not a real user setting — fixed
// top-right, visible everywhere including the login screen, hidden below
// 900px of real browser width (useLayoutMode already tracks that).
export function WebMobileSwitch() {
  const { mode, setMode, switchVisible } = useLayoutMode();
  const t = useT();

  if (!switchVisible) return null;

  return (
    <div className="glass-panel inline-flex h-8 items-center rounded-full p-0.5 text-xs font-medium">
      {(["web", "mobile"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className="rounded-full px-3 py-1 transition-colors"
          style={{
            background: mode === m ? "var(--accent)" : "transparent",
            color: mode === m ? "var(--accent-fg)" : "var(--ink-3)",
          }}
        >
          {m === "web" ? t.common.web : t.common.mobile}
        </button>
      ))}
    </div>
  );
}
