"use client";

import { useLocale } from "@/i18n/locale-provider";
import { LOCALES, type Locale } from "@/i18n/dictionary";

const LABELS: Record<Locale, string> = { hy: "ՀԱՅ", en: "EN", ru: "РУС" };

// Belongs to Login and to Settings, and nowhere else (PRD §12 L-7) — never
// put this in a header.
export function LanguagePill() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="inline-flex rounded-full border border-gray-200 p-0.5 text-xs font-medium">
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`rounded-full px-3 py-1 transition-colors ${
            l === locale ? "bg-black text-white" : "text-gray-500"
          }`}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
