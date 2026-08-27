"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "./nav-items";
import { NavIcon } from "./nav-icon";
import { GlassLayered } from "@/components/design/glass-layered";
import { useT } from "@/i18n/locale-provider";

// Floating pill bottom nav with a docked centre button (brief §9 — the
// section revised most across the design-brief chain; see
// docs/reference/tessera-design-brief-merged.md §9 for the full chronology).
// Geometry, not behaviour: the docked button's real QR/gradebook-insert
// logic is Phase 6/8's job — this renders it correctly shaped and positioned.
//
// NOTE, because the comment above used to say "disabled until then" and that
// is not what the code does: the button carries no onClick and is not
// `disabled` either. It is inert for every role, so it looks pressable and
// does nothing. Reported rather than wired — what it should open for a
// student (the QR sheet lives in /id) and what it should insert for a teacher
// are Phase 6/8 decisions, not this component's.
//
// GEOMETRY, verified rather than assumed: 58px of button plus a 5px ring on
// each side, which is a 68px border box inside brief §9's 78px centre column
// ("the 58px docked button plus its 5px ring on each side"). A measurement of
// the border box therefore reads 68, not 58, and that is correct.
//
// ROLE. student -> QR, teacher -> plus. The teacher case is not a guess:
// brief item 17, final per corrections-6 §2, is "No teacher credential.
// Teachers have no ID card, no QR, and no QR glyph anywhere," and puts a
// Today screen and a plus-glyph docked button in its place. Admin is defined
// nowhere in either the roadmap or the brief, so it follows the student form
// per instruction — see the comment at the glyph below.
export function PillNav({ items, role }: { items: NavItem[]; role: "student" | "teacher" | "admin" }) {
  const pathname = usePathname();
  const t = useT();
  const [left, right] = [items.slice(0, 2), items.slice(2, 4)];

  const renderGroup = (group: NavItem[]) => (
    // min-w-0 here too: a CSS grid item's default `1fr` track still sizes
    // to its content's min-content width unless the item itself allows
    // shrinking below that — without this, a long active label could
    // force this whole group's grid column wider than its fair share,
    // overflowing into the centre button's own space regardless of the
    // truncation on the Link/span further down.
    <div className="flex min-w-0 flex-1 items-center justify-evenly">
      {group.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            className="flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-medium transition-colors"
            style={{
              background: active ? "var(--accent)" : "transparent",
              color: active ? "var(--accent-fg)" : "var(--ink-3)",
              paddingLeft: active ? 16 : 8,
              paddingRight: active ? 16 : 8,
              // A real bug, found live at 390px: an active item's expanded
              // label had nothing stopping it from taking space at its
              // siblings' expense — every item just sized to its own
              // content with no floor. Below 44×44, that's under the
              // minimum tap target. Inactive items get a fixed box that
              // can't shrink further; the active one is still free to grow
              // for its label (justify-evenly above still keeps them apart).
              flex: active ? "0 1 auto" : "0 0 44px",
              minHeight: 44,
            }}
          >
            <NavIcon d={item.icon} size={active ? 24 : 22} />
            {/* A real bug, found live at 390px: a long active label (e.g.
                "Credential requests") had nothing stopping it from
                overflowing this column and running underneath the docked
                centre button — `whitespace-nowrap` alone prevents
                wrapping, not overflow. `min-w-0` on the Link (flex items
                default to a content-based min-width that ignores
                `overflow-hidden` otherwise) plus truncating the label
                itself is what actually keeps it inside its own share of
                the pill. */}
            {active && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[calc(14px+env(safe-area-inset-bottom))] z-[60] desktop:hidden">
      <GlassLayered radius={999} className="pointer-events-auto h-[58px]">
        <div className="grid h-[58px] items-center" style={{ gridTemplateColumns: "1fr 78px 1fr" }}>
          {renderGroup(left)}
          <div />
          {renderGroup(right)}
        </div>
      </GlassLayered>
      <button
        type="button"
        aria-label={role === "teacher" ? t.nav.addAssessment : t.nav.showQr}
        className="pointer-events-auto absolute flex items-center justify-center rounded-full text-white"
        style={{
          left: "50%",
          transform: "translateX(-50%)",
          top: -21,
          width: 58,
          height: 58,
          border: "5px solid var(--bg-base)",
          boxSizing: "content-box",
          background:
            "radial-gradient(circle at 30% 25%, var(--qr-bloom-1) 0%, var(--qr-bloom-2) 55%, var(--qr-bloom-3) 100%)",
          boxShadow: "0 6px 22px rgba(11,63,201,.45)",
        }}
      >
        {/* Only the TEACHER gets the plus. Admin has no defined centre button
            anywhere in the roadmap or the brief, so it takes the student form
            as instructed rather than inheriting the teacher's quick-mark —
            an admin has no gradebook to insert into. Worth knowing if this is
            ever reversed: an admin has no QR credential either
            (`GET /api/me/credential` returns 403 for the admin role), so
            neither glyph is meaningful for them until the button is wired,
            and this choice is cosmetic today. */}
        {role !== "teacher" ? (
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="8" height="8" rx="1" />
            <rect x="15" y="3" width="8" height="8" rx="1" />
            <rect x="3" y="15" width="8" height="8" rx="1" />
            <path d="M16 16h3v3h-3zM21 16h2M16 21h2M21 21h2" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        )}
      </button>
    </div>
  );
}
