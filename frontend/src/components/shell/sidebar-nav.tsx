"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "./nav-items";
import { NavIcon } from "./nav-icon";

const EXPANDED_WIDTH = 232;
const COLLAPSED_WIDTH = 68;

// Collapsible sidebar (brief §8quater) — web only. Expanded: LOCKUP-H, icon
// plus label. Collapsed: Mark only, icons only, centred, native title
// tooltips. The control is a 22px circular button on the sidebar's right
// edge, half-overlapping the border.
export function SidebarNav({ items, open, onToggle }: { items: NavItem[]; open: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const width = open ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  return (
    <nav
      className="fixed left-0 top-0 z-10 flex h-screen flex-col border-r border-hair bg-panel py-4 transition-[width] duration-200"
      style={{ width, transitionTimingFunction: "var(--ease-out)" }}
    >
      <ul className="flex flex-1 flex-col gap-1 px-2">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                title={open ? undefined : item.label}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
                style={{
                  color: active ? "var(--accent-fg)" : "var(--ink-2)",
                  background: active ? "var(--accent)" : "transparent",
                  justifyContent: open ? "flex-start" : "center",
                }}
              >
                <NavIcon d={item.icon} />
                {open && <span className="truncate">{item.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
        className="absolute -right-[11px] top-8 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-hair bg-raised"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--ink-2)" }}>
          <path d={open ? "M7.5 2.5 3.5 6l4 3.5" : "M4.5 2.5 8.5 6l-4 3.5"} />
        </svg>
      </button>
    </nav>
  );
}

export { EXPANDED_WIDTH as SIDEBAR_EXPANDED_WIDTH, COLLAPSED_WIDTH as SIDEBAR_COLLAPSED_WIDTH };
