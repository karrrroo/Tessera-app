"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/state/auth-provider";
import { landingRouteForRole } from "@/lib/landing-route";

// A real bug, found during a route audit: this unconditionally redirected
// to /overview server-side, regardless of role — an authenticated teacher
// or admin visiting the bare "/" landed on the student page instead of
// their own. This route sits outside (app), so AuthGate never runs here
// either; the server has no way to know a role at request time (the access
// token is held in memory client-side, never a cookie), so the redirect has
// to be resolved client-side once auth state is known, the same way
// login/page.tsx and first-login/page.tsx already do it.
export default function RootPage() {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anon") {
      router.replace("/login");
    } else if (status === "authed" && user) {
      router.replace(user.mustChangePassword ? "/first-login" : landingRouteForRole(user.role));
    }
  }, [status, user, router]);

  return null;
}
