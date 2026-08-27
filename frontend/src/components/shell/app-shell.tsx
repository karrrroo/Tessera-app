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
    // Brief §8bis: the frame is position:relative/overflow:hidden and ONLY
    // the content region scrolls — chrome (PillNav, the Iter button) must
    // be a sibling of that scrolling region, not a descendant of it. An
    // absolutely-positioned element is still a descendant of whichever
    // ancestor actually scrolls; it rides along with that ancestor's
    // scroll offset regardless of its own position, which is why nesting
    // the chrome inside the same overflow-y-auto div as {children} made it
    // rise with the page.
    const content = (
      <div className="relative h-full overflow-hidden bg-base">
        {/* The pill nav is 58px tall, docked at the bottom with its own
            margin (pill-nav.tsx's `bottom-[calc(14px+safe-area)]`) — a
            screen's own last content row needs at least that much (plus a
            clear 28px, not flush against the pill) below it, or it renders
            underneath/behind the glass rather than above it. Found live:
            Settings' own Sign-out button was completely unreachable,
            scrolled fully behind the pill. */}
        <div className="h-full overflow-y-auto" style={{ paddingBottom: "calc(58px + env(safe-area-inset-bottom) + 28px)" }}>
          {children}
        </div>
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
