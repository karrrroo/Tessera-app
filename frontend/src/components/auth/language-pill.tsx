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
// The sliding fill moves with `transform`, not `left` (brief §13). An
// earlier revision of this file used `left` and argued that translateX's
// percentage — which resolves against the translated element's own width —
// is a different quantity from one segment-step of the track. That is true
// in general and false for this geometry, which is why the swap is safe
// here: the fill is exactly one segment wide, and three segments tile the
// track with no gaps, so the two quantities are the same 36px. Concretely,
// the container is 114px border-box with a 1px border and 2px padding, so
// the fill's containing block is 112px; a segment is (112 - 4) / 3 = 36px;
// and the fill's own width is that same expression. Verified by measuring
// the fill's rect in all three states before and after the change --
// identical to the pixel (see docs/decisions.md).
//
// If the fill is ever made narrower than a segment (an inset, a gap), this
// stops being true and the offset needs a `calc()` against the track, not
// a bare percentage.
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
      {/* Slides on transform, not on `left` (brief §13). The swap is exact,
          not an approximation: one segment-step of the track is
          (100% - 4px) / 3 of the container, and the indicator's own width
          is that same expression — so translateX(n * 100%), where 100% is
          the indicator's own width, lands on precisely the position the
          old `left: calc(2px + n * (100% - 4px) / 3)` computed. */}
      <span
        aria-hidden
        className="absolute left-0.5 top-0.5 h-7 rounded-full transition-transform duration-200"
        style={{
          width: `calc((100% - 4px) / ${LOCALES.length})`,
          transform: `translateX(calc(${activeIndex} * 100%))`,
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
