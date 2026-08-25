"use client";

import { useTheme, type ThemePreference } from "@/state/theme-provider";
import { useBackground, BACKGROUNDS } from "@/state/background-provider";
import { useAccent } from "@/state/accent-provider";
import { ACCENTS } from "@/design/accents";
import { useLocale, useT, LANGUAGE_AUTONYMS } from "@/i18n/locale-provider";
import { LanguagePill } from "@/components/auth/language-pill";

const THEME_OPTIONS: ThemePreference[] = ["light", "dark", "system"];

function SwatchButton({
  active,
  onClick,
  swatch,
  label,
}: {
  active: boolean;
  onClick: () => void;
  swatch: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform"
      style={{ borderColor: active ? "var(--ink)" : "transparent" }}
    >
      <span className="h-6 w-6 rounded-full" style={{ background: swatch }} />
    </button>
  );
}

// Brief §11ter groups 2 ("Appearance") and 3 ("Language") — the minimal slice of Settings
// Phase 4 owns (enough to drive ThemeProvider/BackgroundProvider/
// AccentProvider/LocaleProvider). Account/notifications/support/widgets are
// Phase 12's job.
export function AppearancePanel() {
  const { preference, setPreference } = useTheme();
  const { background, setBackground } = useBackground();
  const { accent, setAccent } = useAccent();
  const { locale } = useLocale();
  const t = useT();

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
          {t.set.themeTitle}
        </h3>
        <p className="text-xs" style={{ color: "var(--ink-3)" }}>
          {t.set.themeSub}
        </p>
        <div className="flex gap-2">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setPreference(opt)}
              className="rounded-full px-3 py-1.5 text-sm"
              style={{
                background: preference === opt ? "var(--accent)" : "transparent",
                color: preference === opt ? "var(--accent-fg)" : "var(--ink-2)",
                border: preference === opt ? "none" : "1px solid var(--hair)",
              }}
            >
              {opt === "light" ? t.set.light : opt === "dark" ? t.set.dark : t.set.system}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
          {t.set.accentTitle}
        </h3>
        <p className="text-xs" style={{ color: "var(--ink-3)" }}>
          {t.set.accentSub}
        </p>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((a) => (
            <SwatchButton
              key={a.id}
              active={accent === a.id}
              onClick={() => setAccent(a.id)}
              swatch={a.swatch}
              label={a.label[locale]}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
          {t.bg.title}
        </h3>
        <div className="flex flex-wrap gap-3">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBackground(b.id)}
              className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
              style={{ borderColor: background === b.id ? "var(--accent)" : "var(--hair)", color: "var(--ink-2)" }}
            >
              <span className="h-4 w-4 rounded-full border border-hair" style={{ background: b.hex }} />
              {t.bg[b.id]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
          {t.set.langTitle}
        </h3>
        <LanguagePill />
        <p className="text-xs" style={{ color: "var(--ink-3)" }}>
          {LANGUAGE_AUTONYMS[locale]}
        </p>
      </div>
    </section>
  );
}
