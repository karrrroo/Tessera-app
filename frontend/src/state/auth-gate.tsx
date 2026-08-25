"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";

// booting -> splash; anon -> /login; authed && mustChangePassword -> /first-login
// and nothing else, including on back-navigation (roadmap Phase 3 AuthGate spec).
export function AuthGate({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anon") {
      router.replace("/login");
    } else if (status === "authed" && user?.mustChangePassword) {
      router.replace("/first-login");
    }
  }, [status, user, router]);

  if (status === "booting") {
    return (
      <main className="flex h-screen items-center justify-center">
        <p className="font-mono text-sm text-gray-500">Tessera</p>
      </main>
    );
  }

  if (status === "anon" || user?.mustChangePassword) {
    return null;
  }

  return <>{children}</>;
}
