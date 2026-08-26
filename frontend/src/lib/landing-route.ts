// Each role's natural landing page — the first item in its own sidebar
// (nav-items.ts's SIDEBAR_ITEMS). A student has no reason to ever see
// /gradebook and a teacher has none to see /overview (neither is even a
// nav item for the other role), so post-login and post-first-login
// redirects need to pick the right one, not assume /overview for everyone.
export function landingRouteForRole(role: "student" | "teacher" | "admin"): string {
  if (role === "teacher") return "/gradebook";
  if (role === "admin") return "/admin";
  return "/overview";
}
