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
import { IterButton } from "../iter/iter-button";
import { IterPanel } from "../iter/iter-panel";

const SIDEBAR_DEFAULT_OPEN_MIN_WIDTH = 1024;

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { mode, switchVisible } = useLayoutMode();
  const t = useT();
  const [railOpen, setRailOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth >= SIDEBAR_DEFAULT_OPEN_MIN_WIDTH,
  );

  // Offline boot with no live profile (Phase 6, ID-8: AuthProvider's
  // "offline" status never has a `user`) — there is no role to build a nav
  // for, but the route's own content must still render, so this degrades
  // to bare content rather than blocking everything. A real offline nav is
  // Phase 13's job, not this one.
  if (!user) return <>{children}</>;
  const role = user.role;

  if (mode === "mobile") {
    const tabs = mobileTabsForRole(role, t);
    const content = (
      <div className="relative h-full overflow-y-auto bg-base">
        {children}
        <PillNav items={tabs} role={role} />
        <IterButton variant="mobile" style={{ position: "absolute", right: 16, bottom: 116, zIndex: 70 }} />
        <IterPanel />
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
      {/* A `<div>`, not `<main>` — every route under (app) already renders
          its own <main> as its page root (RoutePlaceholder, settings, every
          admin page, and this phase's own pages); nesting a second <main>
          here would be an invalid, confusing duplicate landmark. Found
          while testing Phase 7 (a Playwright locator("main") strict-mode
          error surfaced it), but it dates to Phase 4 and applies app-wide. */}
      <div
        className="pt-16 transition-[margin-left] duration-200"
        style={{ marginLeft: contentMargin, minHeight: "100vh", transitionTimingFunction: "var(--ease-out)" }}
      >
        {children}
      </div>
      <IterButton variant="desktop" style={{ position: "fixed", right: 28, bottom: 28, zIndex: 70 }} />
      <IterPanel />
    </>
  );
}
