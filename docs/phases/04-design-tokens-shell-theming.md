# Phase 4 — Design tokens, shell, theming, three languages

Source: `docs/reference/tessera-roadmap.md`, Phase 4, built against the consolidated
design brief (`docs/reference/tessera-design-brief-merged.md` — itself a Phase-4
prerequisite per the roadmap's own Appendix B instruction). Real gaps, bugs, and
decisions found and resolved during this phase are recorded in `docs/decisions.md`
D-15 through D-20.

## Delivers

The application frame: navigation, header, theme, accent, background, and complete
localisation. Every screen after this one is placed into an existing frame rather than
inventing its own.

## What was built

**Design token layer** (`frontend/src/design/`):

- `tessera.css` — the CSS custom-property contract. Two-state theme tokens (`--ink`,
  `--hair`, `--glass`, `--panel`, `--surface2`, `--danger`, `--ok`, keyed by
  `[data-tt="dark"|"light"]`) from `tessera-design-system.dc.html`; four-state background
  tokens (`--bg-base`, keyed by `[data-bg]`) from the merged brief §11ter, with
  `--bg-raised` computed via `color-mix()` from the brief's explicit formula rather than a
  hardcoded fourth value; the two gradient-mesh palettes (Deep, Aura) from the merged
  brief §4.2/§4.3; the fixed 10-color grade scale (D-5); the docked QR button's one-off
  inverse-bloom gradient; the 600ms theme cross-fade, skipped under
  `prefers-reduced-motion`.
- `accents.ts`, `grade-colors.ts`, `icons.ts`, `backgrounds.ts`, `accent-tint.ts` — typed
  constants generated from `tessera-data.js`, plus the accent-tint derivation function
  (hue preserved, forced to ~55%/52% saturation/lightness; the two named achromatic
  accents — black, neutral — get a fixed steel fallback instead, D-17/D-20).
- `globals.css` — `@theme inline` maps every token to a Tailwind utility (`bg-ink`,
  `border-hair`, `bg-g4`, …) and defines the `tablet`/`desktop` breakpoints (768/900px)
  once, per the roadmap. The create-next-app scaffold defaults this replaced are gone —
  `body` now reads `--bg-base`/`--ink` directly.
- `tokens:check`, `i18n:check` (root `scripts/`) — both wired into `package.json`, both
  pass with zero exceptions.

**i18n** (`frontend/src/i18n/`): `hy.ts`/`en.ts`/`ru.ts`, machine-extracted (not
hand-transcribed, to avoid transcription errors in Armenian/Russian text) from the real
`T` dictionary in `tessera-data.js` — 316 keys across 22 areas, with the documented
exceptions in D-18 (four broken Armenian placeholders fixed, seven keys the design never
anticipated added, one constant pulled in from a second source file). `locale-provider.tsx`
now serves this real dictionary (`useT()`), replacing Phase 3's placeholder; `LocaleProvider`
syncs `document.documentElement.lang`, and for a signed-in user, `locale` round-trips
through the account (`PATCH /api/me/preferences`) rather than staying device-local.

**State** (`frontend/src/state/`): `ThemeProvider` (light/dark/system, follows the OS
live under "system", writes `data-tt`), `BackgroundProvider` (four named backgrounds,
writes `data-bg`; auto-follows the resolved theme until the person makes an explicit
choice, then stays sticky — the fix for the real bug in D-17), `AccentProvider` (writes
`--accent`/`--accent-fg`/`--accent-tint` inline), `OnlineProvider`, `LayoutModeProvider`
(the web/mobile preview switch, brief §8ter — a prototype control, not persisted).

**Design primitives** (`frontend/src/components/design/`): `Grain` (SVG `feTurbulence`,
brief §5.2), `GradientMesh` (4 feathered radial blobs reading the active mesh palette,
opacity theme-scoped, every stop fading out well inside its own circle per corrections-4
§2's "no visible edge" rule), `Glass` (the two-layer frosted-panel CSS class, brief §5.3,
with a dev-mode console warning past 8 concurrently-mounted instances).

**Shell** (`frontend/src/components/shell/`, `frontend/src/components/brand/`):
`Mark`/`IterMark` (the logo components, full spec pulled directly from `Mark.dc.html`/
`IterMark.dc.html` — size, part variants, aspect ratios); `AppHeader` (clickable
logo-goes-home, Web/Mobile switch, account block — **no language switcher**, D-16);
`SidebarNav` (232px/68px collapsible, role-filtered items, 22px edge toggle); `PillNav`
+ `PhoneFrame` (the mobile floating pill with the exact `1fr 78px 1fr` grid and docked
centre button geometry from brief §9, rendered inside a simulated phone frame only when
previewing mobile from a wide browser); `WebMobileSwitch`; `OfflineBanner`;
`nav-items.ts` (role → nav item mapping — see D-19 for why this is explicitly a
placeholder, not a finalized spec). `AppShell` composes all of it based on
`LayoutModeProvider`'s mode, and is now what `(app)/layout.tsx` wraps every authenticated
screen in.

**Screens**: the login/forgot/first-login/reset flow was rebuilt against brief §8bis (the
52/48 split above 900px via `display:grid;place-items:center`, the glass card below it,
`GradientMesh` backgrounds, the real `Mark` lockup) and reconciled to the real dictionary's
actual key names, which differ from every name Phase 3 invented before the real dictionary
was available (D-18). A minimal Settings "appearance" panel (theme/accent/background/
language) was added — enough to drive the four providers; the full account/notifications/
support/widgets Settings screen is Phase 12's. `/dev/tokens` (no auth, outside the app
shell) renders every token as a labelled swatch against its live computed value.
Placeholder pages now exist for every route the roadmap names:
`/overview /subjects /archive /credentials /id /gradebook /queue /settings /admin`.

**Backend**: `GET`/`PATCH /api/me/preferences` — only `locale` persists
(`user.locale`); the other four preferences are device-local by design (roadmap: "appearance
following a person to a shared school computer is wrong") and never reach the server.

## Two real bugs found while testing this phase

**The theme/background default mismatch.** `ThemeProvider` defaults to `"system"`
(resolved from the OS) while `BackgroundProvider` originally defaulted to a hardcoded
`"deep"`, independently. On a browser whose OS preference is light, that produced
`data-tt="light"` next to `data-bg="deep"` — light ink on a near-black background, the
entire login screen rendering with invisible text. Caught by actually opening the page in
a real browser, not by any check script. Fixed by making the background's default track
the resolved theme reactively (D-17).

**The achromatic accent-tint threshold.** The first implementation decided "achromatic"
by a saturation percentage cutoff. Recomputing the actual HSL saturation of the two
accents the brief explicitly names as achromatic — black (`#101112`, ≈5.9%) and neutral
(`#1E2124`, ≈9.1%) — showed no single threshold separates them from a genuinely-colored
accent like sage (`#5B7358`, ≈13.3%). A threshold loose enough to catch both black and
neutral would have also caught sage, giving it the wrong (fallback) tint instead of its
own derived hue. Fixed by naming the two accents explicitly (D-17/D-20) rather than
computing "achromatic."

## Done when

1. [x] `/dev/tokens` renders every token as a labelled swatch; none show the literal
       string `var(--…)` or `initial` — verified by screenshot and by the page's own
       broken-value detector, which flags exactly that condition.
2. [x] `npm run tokens:check` exits 0. Verified failing correctly multiple times during
       this phase's own build (against real hex additions before they were moved into
       tokens) before reaching zero exceptions.
3. [x] `npm run i18n:check` exits 0. Verified the exact acceptance test: deleting
       `common.logout` from `ru.ts` exits 1 naming `ru is missing keys present in hy:
       common.logout`; restoring it passes again.
4. [~] Language switch, no reload, no network document request. Verified: switching
       HY/EN/RU is pure client state, no navigation, and syncs to the account for a
       signed-in user. **Not verified**: scroll-position preservation and "nothing clips
       in Russian" across every component — most screens are still placeholders with
       little real content, so a meaningful clipping check has to wait for the screens
       that actually carry the longer Russian strings (Phases 5+).
5. [x] Theme light/dark/system, OS toggle followed live. Verified directly: with
       `theme="system"` and the OS preference set to light, `data-tt="light"`; emulating a
       live OS switch to dark updates `data-tt="dark"` with no reload.
6. [~] Accent cycle, only three places change. Verified the mechanism (a swatch click sets
       `--accent`/`--accent-fg`/`--accent-tint` inline and nothing else touches those
       properties). **Not verified**: a full screenshot diff against a content-rich
       screen, since the only accent-colored elements that exist yet are the primary
       button and the active nav item — the focus ring and a busier screen both need
       real content from later phases to diff meaningfully.
7. [x] `--accent-tint` at black resolves to `#5A6472` exactly (verified live, not
       "steel-ish" — see the bug above).
8. [x] Grain is present on every `GradientMesh` instance (login, `/dev/tokens` does not
       need it and correctly has none — it's flat by design, not a gradient surface).
9. [x] Mobile shell pill nav renders with the docked button as a complete, unclipped
       circle at 390px, straddling the pill's top edge with its own background-colored
       ring, no notch cut into the pill — verified by screenshot.
10. [x] The Web/Mobile switch appears at ≥900px and is absent below it — verified via
        `LayoutModeProvider`'s matchMedia-driven `switchVisible`.
11. [~] `backdrop-filter` count ≤8 per screen. True by inspection on every current screen
        (at most 1-2 `Glass` instances exist anywhere right now) — the dev-mode console
        warning is in place for when later phases add more, but hasn't been exercised
        past the limit yet since no screen has enough glass surfaces to trigger it.
12. [x] `document.documentElement.lang` changes with the locale (verified); the 600ms
        theme transition is wrapped in `@media (prefers-reduced-motion: no-preference)`
        in `tessera.css` (not separately verified with a reduced-motion emulation in this
        pass).

## A third real bug, found later (Phase 11 pass), documented here since it belongs to this phase

**`font-mono` never actually resolved to JetBrains Mono (D-68).** `layout.tsx` loaded
`Geist_Mono` from `next/font/google` and `globals.css`'s `--font-mono` pointed at it — so
every `font-mono` use anywhere in the app (mark cells, timestamps, the language pill)
silently rendered in Geist Mono instead of the brief's explicit "JetBrains Mono for marks"
(§4). Found while checking the login screen's language control against a later brief
correction, not by this phase's own testing. Fixed by swapping the loader and its CSS
variable name at the root (`layout.tsx`, `globals.css`) — a one-line-looking change with a
project-wide blast radius, since nothing about it is component-local.

**The language pill's active-fill token and missing hover state (D-69).** A later brief
correction (`brief-chain/04-corrections-2` §3) is precise about the language control's
active-segment fill (`rgba(255,255,255,.14)` on dark) and specifies an inactive-segment
hover state (`--ink-3` → `--ink-2`) this phase's original build never had. Added a
dedicated `--lang-pill-fill` token (rather than reusing the general-purpose `--hair-bright`,
which is a different opacity) and the missing hover, in `tessera.css` and
`language-pill.tsx`.

## A fourth follow-up: the splash→login opening sequence (D-75 through D-79)

This phase's own notes deferred "the full splash→login motion handoff (brief §13.2)."
`brief-chain/07-corrections-5` §3 specified it precisely — a 1100ms splash (full mesh +
grain + centred lockup) followed by an 1100-1900ms transition in which the same lockup
travels to its resting position on the login screen while the card and demo row fade in —
and it has now been built (`components/auth/opening-sequence.tsx`), reusing the mesh entry
bloom from corrections-3 §2.1 (`GradientMesh`'s new `animateEntry` prop). Two real bugs
were found and fixed in building it: a React Strict Mode double-invoke that made the
splash silently skip itself in dev (D-78), and an inline array literal that kept
restarting the lockup's travel transition instead of letting it run once (D-79). Two gaps
remain, both documented rather than worked around: the travelling "lockup" is the
icon-only `Mark`, not the complete glyph+spark+lettering wordmark, which still doesn't
exist as a component (D-76); and the desktop split layout's flat right panel is visible
from the splash's first frame rather than arriving only at the transition, since "nothing
else on it" assumes one full-screen surface and this app's desktop layout post-dates that
assumption (D-77).

## Notes for the next phase

- `components/shell/nav-items.ts`'s role→item mapping is explicitly provisional (D-19).
  Revisit it once the screens it names actually exist, especially the teacher's "Today"
  slot, which this phase could not source content or an icon for.
- The wordmark's body typeface is unresolved in the design source itself ("three
  candidates, do not pick one yourself") — the login screen and header use a plain serif
  fallback. Do not treat that as the final choice.
- Settings' account/notifications/support/widgets groups are Phase 12's.
- The particle field (brief §5.5) and the full splash→login motion handoff (brief §13.2)
  were not built — this phase's motion budget went to the one transition its own
  Done-when list actually tests (the 600ms theme cross-fade). Revisit if a later phase's
  own Done-when needs the rest.
