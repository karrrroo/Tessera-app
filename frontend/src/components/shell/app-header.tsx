"use client";

import Link from "next/link";
import { useAuth } from "@/state/auth-provider";
import { useLocale, useT } from "@/i18n/locale-provider";
import { displayFullName } from "@/i18n/transliterate-name";
import { Mark } from "@/components/brand/mark";
import { landingRouteForRole } from "@/lib/landing-route";

// role.student/roleTeacher/roleAdmin, explicitly, with no default branch —
// a two-way `role === "teacher" ? teacher : student` ternary (this
// component's own previous bug) silently mislabels every OTHER role
// (admin) as "student" instead of erroring, which is worse than showing
// nothing: it tells the viewer they hold permissions they don't have.
const ROLE_LABEL: Record<"student" | "teacher" | "admin", (t: ReturnType<typeof useT>) => string> = {
  student: (t) => t.common.roleStudent,
  teacher: (t) => t.common.roleTeacher,
  admin: (t) => t.common.roleAdmin,
};

// Header (brief §8quater). The logo is one clickable target that goes home
// (overview for students, gradebook for teachers). No language switcher
// here — PRD §12 L-7 is explicit that language is a setting, not a toolbar
// control, and this build follows the PRD where it conflicts with the
// visual brief (docs/decisions.md).
export function AppHeader() {
  const { user, logout } = useAuth();
  const t = useT();
  const { locale } = useLocale();
  const home = user ? landingRouteForRole(user.role) : "/overview";
  // Names are stored only in Armenian, so the header transliterates them for
  // the active locale — see transliterate-name.ts.
  const fullName = displayFullName(user?.firstName, user?.lastName, locale);
  const roleLabel = user ? ROLE_LABEL[user.role]?.(t) : undefined;

  return (
    <header className="fixed left-0 right-0 top-0 z-20 flex h-16 items-center justify-between border-b border-hair bg-panel px-6">
      <Link href={home} className="flex items-center gap-2 transition-opacity hover:opacity-[.82]" style={{ color: "var(--ink)" }}>
        <Mark size={24} />
        <span className="font-serif text-lg">Tessera</span>
      </Link>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-2)" }}>
          <span>{fullName || roleLabel}</span>
          <button type="button" onClick={() => logout()} className="text-xs underline" style={{ color: "var(--ink-3)" }}>
            {t.common.logout}
          </button>
        </div>
      </div>
    </header>
  );
}
