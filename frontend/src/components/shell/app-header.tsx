"use client";

import Link from "next/link";
import { useAuth } from "@/state/auth-provider";
import { useT } from "@/i18n/locale-provider";
import { Mark } from "@/components/brand/mark";
import { WebMobileSwitch } from "./web-mobile-switch";

// Header (brief §8quater). The logo is one clickable target that goes home
// (overview for students, gradebook for teachers). No language switcher
// here — PRD §12 L-7 is explicit that language is a setting, not a toolbar
// control, and this build follows the PRD where it conflicts with the
// visual brief (docs/decisions.md).
export function AppHeader() {
  const { user, logout } = useAuth();
  const t = useT();
  const home = user?.role === "teacher" ? "/gradebook" : "/overview";
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  return (
    <header className="fixed left-0 right-0 top-0 z-20 flex h-16 items-center justify-between border-b border-hair bg-panel px-6">
      <Link href={home} className="flex items-center gap-2 transition-opacity hover:opacity-[.82]" style={{ color: "var(--ink)" }}>
        <Mark size={24} />
        <span className="font-serif text-lg">Tessera</span>
      </Link>

      <div className="flex items-center gap-4">
        <WebMobileSwitch />
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-2)" }}>
          <span>{fullName || (user?.role === "teacher" ? t.common.roleTeacher : t.common.roleStudent)}</span>
          <button type="button" onClick={() => logout()} className="text-xs underline" style={{ color: "var(--ink-3)" }}>
            {t.common.logout}
          </button>
        </div>
      </div>
    </header>
  );
}
