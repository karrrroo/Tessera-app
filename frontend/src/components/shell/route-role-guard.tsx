"use client";

import { notFound } from "next/navigation";
import { usePathname } from "next/navigation";
import { useAuth } from "@/state/auth-provider";
import { canRoleOpen } from "@/lib/route-access";

// Renders the not-found boundary when the signed-in role has no business on
// this route — the same treatment `(app)/admin/layout.tsx` already gives the
// admin subtree, and for the same stated reason (roadmap Phase 5): not-found
// in place, never a redirect, because a redirect confirms the route exists.
//
// Placed INSIDE AppShell so the 404 renders with the app's own chrome, exactly
// as the admin one does, rather than dropping the person onto a bare page.
//
// Deliberately does nothing when there is no `user`. AppShell degrades to bare
// content in that state (Phase 6 ID-8: an offline boot has no profile), and
// guessing a role in order to gate on it would be the "defaulted to student"
// bug all over again — with no profile there is no role to check, and AuthGate
// above is what decides whether an unauthenticated visitor gets here at all.
export function RouteRoleGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  if (user && !canRoleOpen(pathname, user.role)) {
    notFound();
  }
  return <>{children}</>;
}
