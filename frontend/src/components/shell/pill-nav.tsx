"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "./nav-items";
import { NavIcon } from "./nav-icon";

// Floating pill bottom nav with a docked centre button (brief §9 — the
// section revised most across the design-brief chain; see
// docs/reference/tessera-design-brief-merged.md §9 for the full chronology).
// Geometry, not behaviour: the docked button's real QR/gradebook-insert
// logic is Phase 6/8's job — this renders it correctly shaped and positioned,
// disabled until then.
export function PillNav({ items, role }: { items: NavItem[]; role: "student" | "teacher" | "admin" }) {
  const pathname = usePathname();
  const [left, right] = [items.slice(0, 2), items.slice(2, 4)];

  const renderGroup = (group: NavItem[]) => (
    <div className="flex flex-1 items-center justify-evenly">
      {group.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-medium transition-colors"
            style={{
              background: active ? "var(--accent)" : "transparent",
              color: active ? "var(--accent-fg)" : "var(--ink-3)",
              paddingLeft: active ? 16 : 8,
              paddingRight: active ? 16 : 8,
            }}
          >
            <NavIcon d={item.icon} size={active ? 24 : 22} />
            {active && <span className="whitespace-nowrap">{item.label}</span>}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-[calc(14px+env(safe-area-inset-bottom))]">
      <div className="glass-panel pointer-events-auto flex h-[58px] items-center" style={{ borderRadius: 999, display: "grid", gridTemplateColumns: "1fr 78px 1fr" }}>
        {renderGroup(left)}
        <div />
        {renderGroup(right)}
      </div>
      <button
        type="button"
        aria-label={role === "student" ? "Show QR" : "Add assessment"}
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
        {role === "student" ? (
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
