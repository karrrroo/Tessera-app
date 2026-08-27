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

// "admin" had no T.nav key and no ICON entry at all — the design package
// has no admin screens (roadmap Phase 5: "None of these exist in the design
// package") — so this rendered as plain, undecorated English regardless of
// locale. A real bug (found during a broader HY-mode sweep of the admin
// section): `nav.admin` now has a real translation in all three locales.
const STATIC_LABELS: Partial<Record<NavItemId, string>> = {};

// roadmap Phase 4: "Nav items from T.nav and ICON... filtered by role."
// Sidebar (web) shows every role-appropriate item; the mobile pill (brief
// §9) needs exactly four. Neither the design brief nor the PRD states the
// exact four per role (the brief's §9 nav-pill mechanics are precise, but
// its item *composition* isn't) — this list is a documented Phase 4
// placeholder, not a finalized spec, and should be revisited once the
// screens it points at are actually built (Phases 6-12). The QR/plus button
// itself is not a nav item — it's the pill's docked centre button (§9).
// "analytics" was a real bug, not a gap: /analytics was reachable via this
// nav item on both lists below, but no such route (or any component
// rendering t.scr.an, the dictionary section that assumed one) has ever
// existed — confirmed with `grep -rn "analytics" frontend/src` finding
// nothing but this wiring and unused translation keys. Not in the roadmap,
// PRD, or any design brief as a screen — removed rather than built, per the
// project's own "no invented scope" rule. This leaves the teacher's mobile
// pill at 3 items, one short of brief §9's 4 — flagged, not silently
// filled with a guess at a 4th (see docs/decisions.md).
const SIDEBAR_ITEMS: Record<"student" | "teacher" | "admin", NavItemId[]> = {
  student: ["overview", "subjects", "archive", "creds", "id", "settings"],
  teacher: ["gradebook", "queue", "settings"],
  admin: ["admin", "queue", "settings"],
};

const MOBILE_TAB_ITEMS: Record<"student" | "teacher" | "admin", NavItemId[]> = {
  student: ["overview", "subjects", "archive", "settings"],
  teacher: ["gradebook", "queue", "settings"],
  admin: ["admin", "queue", "settings"],
};

// A real bug, reported live: the admin sidebar's three items all rendered
// the same gear icon. Root cause: ICON (generated verbatim from the design
// source) never had an "admin" or "queue" entry — the design package
// predates those screens — so both silently fell through to `?? ICON.settings`
// below. This affects the teacher sidebar too, for the same reason (it also
// has a "queue" item). Rather than drawing new glyphs the design source
// never specified, each reuses the closest existing shape: admin's own
// screen is a dashboard/checklist, closest to "overview"'s 2x2 grid; queue
// is literally a credential-requests queue, the same concept "creds"
// already draws as a shield/badge. No role ever renders both items of a
// reused pair at once (student-only vs. teacher/admin-only), so there's no
// on-screen collision.
const ICON_OVERRIDE: Partial<Record<NavItemId, string>> = {
  admin: ICON.overview,
  queue: ICON.creds,
};
const ICON_BY_ID: Partial<Record<NavItemId, string>> = { ...ICON, ...ICON_OVERRIDE };

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
