import type { Dictionary } from "@/i18n/locale-provider";
import { ICON } from "@/design/icons";

export type NavItemId = "overview" | "subjects" | "archive" | "creds" | "id" | "gradebook" | "analytics" | "queue" | "settings" | "admin";

export type NavItem = { id: NavItemId; label: string; icon: string; href: string };

// The dictionary/icon key ("creds") and the actual route ("/credentials")
// disagree for this one item (roadmap Phase 4 frontend routing list) —
// everything else matches its own id.
const ROUTE_FOR: Partial<Record<NavItemId, string>> = { creds: "/credentials" };
function routeFor(id: NavItemId): string {
  return ROUTE_FOR[id] ?? `/${id}`;
}

// "admin" has no T.nav key and no ICON entry at all — the design package
// has no admin screens (roadmap Phase 5: "None of these exist in the design
// package"), so this is plain, undecorated English rather than a fabricated
// translation.
const STATIC_LABELS: Partial<Record<NavItemId, string>> = { admin: "Admin" };

// roadmap Phase 4: "Nav items from T.nav and ICON... filtered by role."
// Sidebar (web) shows every role-appropriate item; the mobile pill (brief
// §9) needs exactly four. Neither the design brief nor the PRD states the
// exact four per role (the brief's §9 nav-pill mechanics are precise, but
// its item *composition* isn't) — this list is a documented Phase 4
// placeholder, not a finalized spec, and should be revisited once the
// screens it points at are actually built (Phases 6-12). The QR/plus button
// itself is not a nav item — it's the pill's docked centre button (§9).
const SIDEBAR_ITEMS: Record<"student" | "teacher" | "admin", NavItemId[]> = {
  student: ["overview", "subjects", "archive", "creds", "id", "settings"],
  teacher: ["gradebook", "analytics", "queue", "settings"],
  admin: ["admin", "queue", "settings"],
};

const MOBILE_TAB_ITEMS: Record<"student" | "teacher" | "admin", NavItemId[]> = {
  student: ["overview", "subjects", "archive", "settings"],
  teacher: ["gradebook", "analytics", "queue", "settings"],
  admin: ["admin", "queue", "settings"],
};

const ICON_BY_ID: Partial<Record<NavItemId, string>> = ICON;

function buildItems(ids: NavItemId[], t: Dictionary): NavItem[] {
  return ids.map((id) => ({
    id,
    label: STATIC_LABELS[id] ?? t.nav[id as keyof Dictionary["nav"]],
    icon: ICON_BY_ID[id] ?? ICON.settings,
    href: routeFor(id),
  }));
}

export function sidebarItemsForRole(role: "student" | "teacher" | "admin", t: Dictionary): NavItem[] {
  return buildItems(SIDEBAR_ITEMS[role], t);
}

export function mobileTabsForRole(role: "student" | "teacher" | "admin", t: Dictionary): NavItem[] {
  return buildItems(MOBILE_TAB_ITEMS[role], t);
}
