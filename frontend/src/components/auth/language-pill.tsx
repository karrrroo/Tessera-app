"use client";

import { useLocale } from "@/i18n/locale-provider";
import { LOCALES } from "@/i18n/locale-provider";

// Brief §11ter (final per corrections-2 §3, superseding v2.2 §8): always the
// Latin codes HY/EN/RU, uppercase, never transliterated per active locale.
const CODES: Record<(typeof LOCALES)[number], string> = { hy: "HY", en: "EN", ru: "RU" };
const SEGMENT_WIDTH = 38;

// Belongs to Login and to Settings, and nowhere else (PRD §12 L-7) — never
// put this in a header (see docs/decisions.md for the design-brief conflict
// this resolved in the PRD's favor).
export function LanguagePill() {
  const { locale, setLocale } = useLocale();
  const activeIndex = LOCALES.indexOf(locale);

  return (
    <div
      className="relative inline-flex h-8 rounded-full border border-hair bg-transparent p-0.5 font-mono text-xs uppercase text-ink-3"
      style={{ letterSpacing: "0.6px" }}
    >
      <span
        aria-hidden
        className="absolute top-0.5 h-7 rounded-full transition-transform duration-200"
        style={{
          width: SEGMENT_WIDTH,
          background: "var(--lang-pill-fill)",
          transform: `translateX(${3 + activeIndex * SEGMENT_WIDTH}px)`,
          transitionTimingFunction: "var(--ease-out)",
        }}
      />
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          className={`relative z-10 flex items-center justify-center transition-colors ${l === locale ? "text-ink" : "text-ink-3 hover:text-ink-2"}`}
          style={{ width: SEGMENT_WIDTH }}
        >
          {CODES[l]}
        </button>
      ))}
    </div>
  );
}
