"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import hy from "./hy";
import en from "./en";
import ru from "./ru";
import { getAccessToken } from "../lib/api/token-store";
import { apiJson } from "../lib/api/client";
import { isLocale, LOCALES, type Locale } from "./resolve-locale";

export { LOCALES };
export type { Locale };

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
// Same key, doubling as the cookie name — one conceptual "the user's chosen
// locale" value, just persisted in two places so both the server (which can
// only ever read a cookie, never localStorage) and the client have access
// to it.
const COOKIE_KEY = STORAGE_KEY;

function persistLocale(l: Locale) {
  window.localStorage.setItem(STORAGE_KEY, l);
  document.cookie = `${COOKIE_KEY}=${l}; path=/; max-age=31536000; SameSite=Lax`;
}

// initialLocale comes from the server (layout.tsx resolves it from the
// `tessera.locale` cookie, falling back to Accept-Language, per
// resolve-locale.ts) — using it directly as the very first client state,
// rather than independently recomputing a locale client-side from
// localStorage/navigator.languages, is what fixes the hydration mismatch:
// the server-rendered HTML and the client's first render now start from the
// exact same value instead of two computations that could disagree.
export function LocaleProvider({ children, initialLocale }: { children: ReactNode; initialLocale: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const migratedRef = useRef(false);

  // roadmap Phase 4 Done-when #12: document.documentElement.lang tracks the
  // active locale.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // One-time, post-hydration only: a visitor who chose a locale before this
  // cookie mechanism existed (or whose cookies are blocked but whose
  // localStorage isn't) has a real preference sitting in localStorage that
  // the server-side cookie read couldn't see. Reconciling it here — after
  // mount, not during the initial render — is a plain follow-up state
  // update like the rest of the app's post-mount reveals; it cannot cause a
  // hydration mismatch because hydration has already completed by the time
  // this effect runs.
  useEffect(() => {
    if (migratedRef.current) return;
    migratedRef.current = true;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored) && stored !== initialLocale) {
      setLocaleState(stored);
      persistLocale(stored);
    }
  }, [initialLocale]);

  const syncLocaleFromServer = useCallback((l: Locale) => {
    setLocaleState(l);
    persistLocale(l);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    persistLocale(l);
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
