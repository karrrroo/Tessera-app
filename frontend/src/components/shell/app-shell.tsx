"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "@/state/auth-provider";
import { useT } from "@/i18n/locale-provider";
import { AppHeader } from "./app-header";
import { SidebarNav, SIDEBAR_EXPANDED_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "./sidebar-nav";
import { PillNav } from "./pill-nav";
import { OfflineBanner } from "./offline-banner";
import { sidebarItemsForRole, mobileTabsForRole } from "./nav-items";
import { IterButton } from "../iter/iter-button";
import { IterPanel } from "../iter/iter-panel";

const RAIL_DEFAULT_OPEN_QUERY = "(min-width: 1024px)";

// useSyncExternalStore, not useState(() => window.innerWidth >= ...) and not a
// setState in an effect. The rail's *default* depends on viewport width, which
// the server cannot know: reading window in a useState initializer made the
// server emit an expanded rail while a 900-1023px client rendered a collapsed
// one — a real hydration mismatch on exactly those widths. This hook is the
// one React primitive built for the case: getServerSnapshot supplies the
// server's value, React swaps in the client's after hydration without
// reporting a mismatch, and there is no setState-in-effect for the lint rule
// (or React) to object to. The mobile/web split itself needs none of this —
// that is pure CSS.
function subscribeRailDefault(onChange: () => void) {
  const m = window.matchMedia(RAIL_DEFAULT_OPEN_QUERY);
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}
const railDefaultOpen = () => window.matchMedia(RAIL_DEFAULT_OPEN_QUERY).matches;
const railDefaultOpenOnServer = () => true;

// Mobile vs. web is decided by the `desktop:` breakpoint (900px, defined once
// in globals.css) and by nothing else. No JS state describes the layout, and no
// component branches on one: both shells are always in the tree and CSS shows
// exactly one, so the server's HTML is already correct for whatever viewport
// receives it and nothing has to be corrected after hydration. The preview
// toggle that used to drive this from JS is gone: a narrow desktop window and
// a real phone are the same case, and the viewport already reports both.
//
// `{children}` is rendered exactly ONCE, shared by both shells. Rendering it
// inside each shell would mount every page twice — duplicate <main>
// landmarks and duplicate data fetches — so the chrome is what gets
// duplicated and CSS-gated, never the content.
export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const t = useT();

  // The rail follows the viewport until the user takes control of it, after
  // which their choice sticks at every width.
  const defaultOpen = useSyncExternalStore(subscribeRailDefault, railDefaultOpen, railDefaultOpenOnServer);
  const [railOverride, setRailOverride] = useState<boolean | null>(null);
  const railOpen = railOverride ?? defaultOpen;

  // Offline boot with no live profile (Phase 6, ID-8: AuthProvider's
  // "offline" status never has a `user`) — there is no role to build a nav
  // for, but the route's own content must still render, so this degrades
  // to bare content rather than blocking everything. A real offline nav is
  // Phase 13's job, not this one.
  if (!user) return <>{children}</>;
  const role = user.role;

  return (
    <>
      <OfflineBanner />

      {/* Web chrome. Both children are position:fixed, so this wrapper only
          switches them on and off — it contributes no box of its own and is
          not a flex item of body either way. */}
      <div className="hidden desktop:block">
        <AppHeader />
        <SidebarNav
          items={sidebarItemsForRole(role, t)}
          open={railOpen}
          onToggle={() => setRailOverride(!railOpen)}
        />
      </div>

      {/* The single content region, in both layouts.
          <900px: the one in-flow flex child of body (`h-full flex flex-col`),
          filling the remaining height and scrolling inside itself, padded
          clear of the pill nav — 58px of pill, its own 14px+safe-area dock
          offset, plus a clear 28px. Without that a screen's last row renders
          behind the glass (found live: Settings' Sign-out was unreachable).
          >=900px: ordinary document scroll, offset by the fixed header and by
          whichever rail width is currently showing.
          A `<div>`, not `<main>` — every route under (app) renders its own
          <main> as its page root, and a second one here would be a duplicate
          landmark (a Playwright strict-mode error surfaced this in Phase 7). */}
      <div
        className="flex-1 overflow-y-auto pb-[calc(58px+env(safe-area-inset-bottom)+28px)] desktop:ml-[var(--rail-w)] desktop:min-h-screen desktop:flex-none desktop:overflow-visible desktop:pb-0 desktop:pt-16 desktop:transition-[margin-left] desktop:duration-200"
        style={
          {
            "--rail-w": `${railOpen ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH}px`,
            transitionTimingFunction: "var(--ease-out)",
          } as React.CSSProperties
        }
      >
        {children}
      </div>

      {/* Mobile chrome. PillNav is position:fixed and carries its own
          `desktop:hidden`, so it stays docked to the viewport under either
          scroll model and disappears at the breakpoint. */}
      <PillNav items={mobileTabsForRole(role, t)} role={role} />

      <IterButton />
      <IterPanel />
    </>
  );
}
