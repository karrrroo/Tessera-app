"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import hy from "./hy";
import en from "./en";
import ru from "./ru";
import { getAccessToken } from "../lib/api/token-store";
import { apiJson } from "../lib/api/client";

export const LOCALES = ["hy", "en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

// hy/en/ru each infer as their own literal string types (`as const`), which
// don't structurally match each other — widen to plain `string` so all three
// satisfy one shared Dictionary type.
type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : T extends object
      ? { readonly [K in keyof T]: Widen<T[K]> }
      : T;

export type Dictionary = Widen<typeof hy>;

const DICTIONARIES: Record<Locale, Dictionary> = { hy, en, ru };

// Each language's own name for itself — locale-invariant (Armenian is
// always "Հայերեն" regardless of which UI language is active), matching
// Tessera.dc.html's own `langFullName: {hy:'Հայերեն', en:'English',
// ru:'Русский'}[st.lang]` lookup. Not real per-locale copy, so it lives here
// rather than in the T dictionary or a component (i18n:check's "no Armenian
// outside i18n" rule is about hardcoded product copy, not this).
export const LANGUAGE_AUTONYMS: Record<Locale, string> = { hy: "Հայերեն", en: "English", ru: "Русский" };

type LocaleContextValue = {
  locale: Locale;
  /** User-driven change — persists to localStorage, and to the account's
      user.locale via PATCH /api/me/preferences when signed in (roadmap
      Phase 4: locale is the one preference that follows the person, not
      the device). */
  setLocale: (l: Locale) => void;
  /** Server-driven sync only (AuthProvider, once user.locale loads) — never
      fires a PATCH back, so it can't loop with the read it came from. */
  syncLocaleFromServer: (l: Locale) => void;
  t: Dictionary;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

const STORAGE_KEY = "tessera.locale";

function isLocale(value: string | null): value is Locale {
  return value === "hy" || value === "en" || value === "ru";
}

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "hy";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isLocale(stored) ? stored : "hy";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  // roadmap Phase 4 Done-when #12: document.documentElement.lang tracks the
  // active locale.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const syncLocaleFromServer = useCallback((l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
    if (getAccessToken()) {
      apiJson("/api/me/preferences", { method: "PATCH", body: JSON.stringify({ locale: l }) }).catch(() => {
        // Best-effort — the UI has already switched language; a failed sync
        // just means the choice doesn't follow the account to another device.
      });
    }
  }, []);

  const value = useMemo(
    () => ({ locale, setLocale, syncLocaleFromServer, t: DICTIONARIES[locale] }),
    [locale, setLocale, syncLocaleFromServer],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

// roadmap Phase 4: "useT() returns the active dictionary" — plain function
// calls into it (t.nav.overview) keep types checkable, instead of a <T k="..."/>
// lookup component.
export function useT(): Dictionary {
  return useLocale().t;
}

// Only ever fills placeholders in *our own* dictionary strings (never
// user-provided text), so a plain split/join is fine — no injection surface.
// Note: the real T dictionary (unlike Phase 3's placeholder one) has no
// `{key}`-style tokens at all — every screen composes dynamic values by
// concatenating translated fragments directly, in each language's own word
// order (see e.g. scr.dlg.sendTo). Kept for any future string that does use
// one; do not force a template pattern onto strings that don't have one.
export function interpolate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.split(`{${key}}`).join(String(value)),
    template,
  );
}
