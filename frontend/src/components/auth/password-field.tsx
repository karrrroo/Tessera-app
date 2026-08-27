"use client";

import { useState } from "react";
import { useT } from "@/i18n/locale-provider";

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const t = useT();
  return (
    <label className="block space-y-1">
      <span className="text-sm text-ink-2">{label}</span>
      {/* rgba(255,255,255,.06) + its own blur, not `bg-glass` — on the auth
          screens this sits directly on the mesh/glass card (D-87), where
          `--glass`'s theme-conditional opacity (up to .72 in light theme) is
          opaque enough to read as a flat fill with no backdrop-filter of its
          own; a fixed, low, always-translucent value is what actually shows
          the card's own texture through the input rather than covering it. */}
      <div
        className="flex items-center rounded-[18px] border border-hair px-1 focus-within:border-hair-bright"
        style={{ background: "rgba(255,255,255,.06)", backdropFilter: "blur(22px) saturate(160%)", WebkitBackdropFilter: "blur(22px) saturate(160%)" }}
      >
        <input
          type={revealed ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="flex-1 rounded-[18px] bg-transparent px-3 py-2 text-sm text-ink"
        />
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="px-3 text-ink-3 hover:text-ink-2"
          aria-label={revealed ? t.auth.hidePw : t.auth.showPw}
        >
          {revealed ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.4 5.5A10.9 10.9 0 0 1 12 5c5 0 9 4 10 7-.4 1.2-1.3 2.7-2.6 4M6.6 6.6C4.6 8 3.2 10 2 12c1 3 5 7 10 7 1 0 2-.1 2.9-.4" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
}
