"use client";

import { useState, type ReactNode } from "react";
import { useAuth } from "@/state/auth-provider";
import { useLayoutMode } from "@/state/layout-mode-provider";
import { useT } from "@/i18n/locale-provider";
import { AppHeader } from "./app-header";
import { SidebarNav, SIDEBAR_EXPANDED_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "./sidebar-nav";
import { PillNav } from "./pill-nav";
import { PhoneFrame } from "./phone-frame";
import { OfflineBanner } from "./offline-banner";
import { sidebarItemsForRole, mobileTabsForRole } from "./nav-items";

const SIDEBAR_DEFAULT_OPEN_MIN_WIDTH = 1024;

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { mode, switchVisible } = useLayoutMode();
  const t = useT();
  const [railOpen, setRailOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth >= SIDEBAR_DEFAULT_OPEN_MIN_WIDTH,
  );

  if (!user) return null;
  const role = user.role;

  if (mode === "mobile") {
    const tabs = mobileTabsForRole(role, t);
    const content = (
      <div className="relative h-full overflow-y-auto bg-base">
        {children}
        <PillNav items={tabs} role={role} />
      </div>
    );
    return (
      <>
        <OfflineBanner />
        {switchVisible ? <PhoneFrame>{content}</PhoneFrame> : content}
      </>
    );
  }

  const items = sidebarItemsForRole(role, t);
  const contentMargin = railOpen ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH;

  return (
    <>
      <OfflineBanner />
      <AppHeader />
      <SidebarNav items={items} open={railOpen} onToggle={() => setRailOpen((o) => !o)} />
      <main
        className="pt-16 transition-[margin-left] duration-200"
        style={{ marginLeft: contentMargin, minHeight: "100vh", transitionTimingFunction: "var(--ease-out)" }}
      >
        {children}
      </main>
    </>
  );
}
