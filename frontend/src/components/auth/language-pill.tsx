"use client";

import { useLocale } from "@/i18n/locale-provider";
import { LOCALES } from "@/i18n/locale-provider";

// Brief §11ter (final per corrections-2 §3, superseding v2.2 §8): always the
// Latin codes HY/EN/RU, uppercase, never transliterated per active locale.
const CODES: Record<(typeof LOCALES)[number], string> = { hy: "HY", en: "EN", ru: "RU" };

// Belongs to Login and to Settings, and nowhere else (PRD §12 L-7) — never
// put this in a header (see docs/decisions.md for the design-brief conflict
// this resolved in the PRD's favor).
//
// Grid (not flex, not fixed pixel widths on each button) is what actually
// guarantees three equal segments regardless of label content — `1fr` tracks
// are measured equal by construction, where flex/auto-width items only
// happen to end up equal when their content widths already are. `min-width:0`
// matters here too: without it a grid item won't shrink below its own
// content's intrinsic width, which defeats the equal-width grid track the
// moment any label is wider than 1/3 of the pill.
// The sliding fill is positioned with `left` as a percentage of the *track*
// (this element's own containing block), not `transform: translateX(%)` —
// a translateX percentage resolves against the translated element's *own*
// width, which for a single one-third-wide segment is a different quantity
// than one full segment-step of the track, and would drift across positions.
export function LanguagePill() {
  const { locale, setLocale } = useLocale();
  const activeIndex = LOCALES.indexOf(locale);

  return (
    <div
      // shrink-0: this sits in a `flex justify-between` row next to the
      // title/subtitle block (login/page.tsx's cardBody) — without it, a
      // flex item's default flex-shrink:1 would let a wide sibling (a
      // longer locale's title+subtitle, e.g. ru's) squeeze this below its
      // own 114px width, which is exactly the "the pill isn't a fixed size"
      // failure mode a width alone doesn't prevent in a flex container.
      className="relative grid h-8 shrink-0 rounded-full border border-hair bg-transparent p-0.5 font-mono text-xs uppercase text-ink-3"
      style={{ letterSpacing: "0.6px", gridTemplateColumns: `repeat(${LOCALES.length}, 1fr)`, width: 114 }}
    >
      <span
        aria-hidden
        className="absolute top-0.5 h-7 rounded-full transition-[left] duration-200"
        style={{
          left: `calc(2px + ${activeIndex} * (100% - 4px) / ${LOCALES.length})`,
          width: `calc((100% - 4px) / ${LOCALES.length})`,
          background: "var(--lang-pill-fill)",
          transitionTimingFunction: "var(--ease-out)",
        }}
      />
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={l === locale}
          className={`relative z-10 flex min-w-0 items-center justify-center transition-colors ${l === locale ? "text-ink" : "text-ink-3 hover:text-ink-2"}`}
        >
          {CODES[l]}
        </button>
      ))}
    </div>
  );
}
