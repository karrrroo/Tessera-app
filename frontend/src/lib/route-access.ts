export type Role = "student" | "teacher" | "admin";

// Which roles may open which route.
//
// WHY THIS EXISTS. `(app)/admin/layout.tsx` already guards the admin subtree,
// citing roadmap Phase 5: "A student hitting /admin sees the not-found screen,
// not a redirect that reveals the route exists." Nothing extended that
// principle to the role-specific routes outside /admin, and a full sweep found
// the consequences: a student typing /queue got the credential-review screen's
// chrome, and a teacher or admin typing /overview got "Could not load" with a
// Try again button that could never succeed, because the API was correctly
// refusing them a student's record. No data ever leaked — every one of those
// endpoints returns 403 — but the screens were wrong, and a retry button that
// cannot work is worse than an honest not-found.
//
// This is not new policy. It is the same allocation the navigation already
// makes in `components/shell/nav-items.ts` (SIDEBAR_ITEMS / MOBILE_TAB_ITEMS)
// and that `landingRouteForRole` already assumes; a hidden nav item was simply
// never a permission, so typing the URL walked straight past it.
//
// LONGEST PREFIX WINS, and an unlisted route is allowed. That default is
// deliberate: shared routes (/settings, /credentials) and parameterised ones
// (/admin/students/[id], /admin/handout/[classId]) should not each need an
// entry, and a route added later should not be silently unreachable for
// everyone until someone remembers this file. The API is the real
// authorisation boundary; this only stops a person landing on a screen their
// role has no use for.
const ROUTE_ROLES: ReadonlyArray<readonly [string, ReadonlyArray<Role>]> = [
  // Student record screens. The endpoints behind them (`/api/me/record`,
  // `/api/me/archive`) return 403 to anyone else.
  ["/overview", ["student"]],
  ["/subjects", ["student"]],
  ["/archive", ["student"]],
  // Identity. `/api/me/credential` answers 200 for a student and a teacher and
  // 403 for an admin, so admin is excluded here to match its own backend.
  ["/id", ["student", "teacher"]],
  // Teacher's mark entry. Only the teacher sidebar has it.
  ["/gradebook", ["teacher"]],
  // Credential review — the deciding side, teacher and admin (both sidebars
  // carry "queue"); a student's own requests live at /credentials.
  ["/queue", ["teacher", "admin"]],
  // Admin subtree. Already guarded by its own layout; listed so this file is
  // the whole picture rather than half of it.
  ["/admin", ["admin"]],
];

/**
 * Whether `role` may open `pathname`. Unlisted routes are allowed — see the
 * note above.
 *
 * Prefix matching is on path SEGMENTS, not raw strings, so "/subjects" cannot
 * accidentally match a future "/subjects-archive".
 */
export function canRoleOpen(pathname: string, role: Role): boolean {
  let best: ReadonlyArray<Role> | null = null;
  let bestLength = -1;
  for (const [prefix, roles] of ROUTE_ROLES) {
    const matches = pathname === prefix || pathname.startsWith(prefix + "/");
    if (matches && prefix.length > bestLength) {
      best = roles;
      bestLength = prefix.length;
    }
  }
  return best === null || best.includes(role);
}
