// Locale resolution rules shared between the server (layout.tsx, from the
// Accept-Language request header) and the client (locale-provider.tsx, from
// navigator.languages / localStorage) — kept in one place so the two can
// never resolve a first-visit locale differently, which is what caused the
// hydration mismatch: the server rendered its own hy default while the
// client-only computation independently landed on a different locale.
export const LOCALES = ["hy", "en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "hy" || value === "en" || value === "ru";
}

// Armenian first: an explicit stored choice always wins wherever this is
// called from; absent that, the caller's language-preference list picks
// between the three only when an entry actually matches en or ru — anything
// else (Armenian, a third language, nothing at all) defaults to hy rather
// than falling through to whatever the environment's own default happens
// to be.
export function resolveLocaleFromLanguages(preferred: readonly string[]): Locale {
  for (const lang of preferred) {
    const base = lang.slice(0, 2).toLowerCase();
    if (base === "en" || base === "ru") return base;
  }
  return "hy";
}

// Accept-Language is a comma-separated list of tags, each optionally
// carrying a ";q=" weight ("en-US,en;q=0.9,ru;q=0.8") — strip the weight and
// keep the browser's own preference order, mirroring navigator.languages'
// shape closely enough for resolveLocaleFromLanguages to treat them
// identically.
export function parseAcceptLanguage(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part) => part.split(";")[0].trim())
    .filter(Boolean);
}
