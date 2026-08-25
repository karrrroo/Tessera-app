"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { T, type Dictionary, type Locale } from "./dictionary";

type LocaleContextValue = { locale: Locale; setLocale: (l: Locale) => void; t: Dictionary };

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

const STORAGE_KEY = "tessera.locale";

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "hy";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "hy" || stored === "en" || stored === "ru" ? stored : "hy";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  };

  const value = useMemo(() => ({ locale, setLocale, t: T[locale] }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

// Only ever fills placeholders in *our own* dictionary strings (never
// user-provided text), so a plain split/join is fine — no injection surface.
export function interpolate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.split(`{${key}}`).join(String(value)),
    template,
  );
}
