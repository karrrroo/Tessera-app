"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { Mark } from "@/components/brand/mark";

// booting -> splash; anon -> /login; authed && mustChangePassword -> /first-login
// and nothing else, including on back-navigation (roadmap Phase 3 AuthGate spec).
//
// "offline" (Phase 6, ID-8) is deliberately let through like "authed",
// without a redirect: the boot-time refresh never reached the server at
// all on a device with a real recent session, and a hard reload of /id
// offline must not present a login screen. There is no `user` in this
// state, so mustChangePassword can't apply — routes that need a live
// profile degrade on their own (most already null-check `user`).
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
      <main className="flex h-screen items-center justify-center bg-base">
        <Mark size={48} />
      </main>
    );
  }

  if (status === "anon" || user?.mustChangePassword) {
    return null;
  }

  return <>{children}</>;
}
