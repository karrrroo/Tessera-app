import type { Dictionary } from "./locale-provider";

// A term's display name cannot come from its own row. `term` has a single
// `label` column, holding the Armenian name the seed wrote ("Առաջին
// կիսամյակ"), and C2 forbids adding `label_hy`/`label_en`/`label_ru` the way
// `subject` has them — so rendering `term.label` shows Armenian to a Russian
// or English reader no matter what the UI locale is. That was the one place
// DB-sourced copy leaked past the dictionary, and it showed on the two
// screens a student sees first (/overview and /subjects) plus the export
// panel's term picker.
//
// `term.index` is the way out: it is 1 or 2, the dictionary already carries
// both semester names in all three locales (`scr.sj.term1`/`term2`), and the
// backend already sends `index` alongside `label` on every term it returns.
// A third term would have no key of its own, so the stored label stays as the
// fallback — wrong language beats a blank pill.
export function termLabel(term: { index: number; label: string }, t: Dictionary): string {
  if (term.index === 1) return t.scr.sj.term1;
  if (term.index === 2) return t.scr.sj.term2;
  return term.label;
}
