import type { Locale } from "./resolve-locale";
import { interpolate } from "./locale-provider";

// English and Armenian only ever produce "one"/"other" from Intl.PluralRules
// (Armenian's own CLDR rule treats both 0 and 1 as "one"); Russian produces
// all four. Every locale's dictionary still carries all four keys — not
// because en/hy need them, but so `PluralForms` has one shape shared by every
// locale's dictionary, rather than a type that only matches the one locale
// that actually needs "few"/"many".
export type PluralForms = { one: string; few: string; many: string; other: string };

const RULES: Record<Locale, Intl.PluralRules> = {
  hy: new Intl.PluralRules("hy"),
  en: new Intl.PluralRules("en"),
  ru: new Intl.PluralRules("ru"),
};

// `forms` values are templates with a `{count}` placeholder (matching this
// i18n system's own existing `interpolate()` convention — see
// locale-provider.tsx — rather than introducing a second templating
// mechanism just for plurals).
export function pluralize(locale: Locale, count: number, forms: PluralForms): string {
  // Intl.PluralRules' own return type includes "zero" (for locales like
  // Arabic that use it) even though none of hy/en/ru ever produce it —
  // narrowed here rather than widening PluralForms for a category no
  // locale we support actually needs.
  const category = RULES[locale].select(count) as keyof PluralForms;
  const template = forms[category] ?? forms.other;
  return interpolate(template, { count });
}
