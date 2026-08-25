"use client";

import { useLocale } from "@/i18n/locale-provider";

// Live, three rules (roadmap Phase 3 frontend components: PasswordChecklist).
export function PasswordChecklist({ password }: { password: string }) {
  const { t } = useLocale();
  const rules = [
    { key: "req8", pass: password.length >= 8 },
    { key: "reqNum", pass: /\d/.test(password) },
    { key: "reqUp", pass: /[A-Z]/.test(password) },
  ] as const;

  return (
    <ul className="space-y-1 text-xs">
      {rules.map((r) => (
        <li key={r.key} style={{ color: r.pass ? "var(--ok)" : "var(--ink-3)" }}>
          {r.pass ? "✓" : "○"} {t.auth[r.key]}
        </li>
      ))}
    </ul>
  );
}
