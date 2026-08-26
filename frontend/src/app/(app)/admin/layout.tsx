"use client";

import { notFound } from "next/navigation";
import { useAuth } from "@/state/auth-provider";

// roadmap Phase 5: "A student hitting /admin sees the not-found screen, not
// a redirect that reveals the route exists." notFound() renders the nearest
// not-found.tsx boundary in place, with no navigation/redirect at all.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || user.role !== "admin") {
    notFound();
  }
  return <>{children}</>;
}
