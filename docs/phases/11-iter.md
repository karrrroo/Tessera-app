# Phase 11 — Iter

Source: `docs/reference/tessera-roadmap.md`, Phase 11. Built out of order — this build has
only otherwise reached Phase 8 — at the user's explicit direction; see `docs/decisions.md`
D-56 through D-60, which also cover why the roadmap itself stops short of a real model
connection and why this phase overrides that.

## Delivers

Iter, reachable from every screen, answers real questions about the signed-in user's own
record or classes, grounded in their real data, with a generated reply — not the
interface-only, `reply: null` version the roadmap specifies for this phase number.

## What was built

**Backend** (`backend/src/modules/iter/`): `validation.ts`, `service.ts`, `routes.ts` —
`POST /api/iter/messages`. No `iter_message` table and no server-side message storage at
all (D-57): the client sends its own full conversation history with every request, and the
response is `{ id, storedAt, reply }` with a real `reply`, generated via Google's Gemini
API (`@google/genai`, model `gemini-3.6-flash`, D-60) using a system instruction built from
the caller's own real data (D-58) — `record.getRecord` for a student, `gradebook
.getTeacherClasses` for a teacher, nothing role-specific for admin. A simple in-memory
per-user rate limit (12 messages/minute) guards the upstream API from runaway cost; a
Gemini failure returns `ITER_UPSTREAM_ERROR` rather than a fabricated answer.

**Frontend** (`frontend/src/components/iter/`): `IterMark`, `IterButton`, `IterPanel`,
`IterProvider`, and a module-level IndexedDB store (`iter-store.ts`, same pattern as the
gradebook's draft store). Mounted once, at the `(app)` layout level (`IterProvider`) and
inside `AppShell` (`IterButton`/`IterPanel`) — reachable from every authenticated route
without being a route itself, per IT-1. `IterButton` is 44px on mobile / 48px on web,
bottom-right, the violet inverse-bloom fill from `brief §11bis` (now real design tokens —
`--iter-bloom-1/2/3`, `--iter-mid`, `--iter-fg` in `tessera.css` — rather than inlined hex).
`IterPanel` is a 420px right sheet on desktop (app stays visible beside it, no backdrop
dimming) and a 92%-height bottom sheet on mobile, with the empty state's first-name-only
greeting and three role-appropriate suggestion chips (tapping one fills the input without
sending), a message list, the IT-9 animated-conic-gradient thinking pill (`@property
--iter-angle`, scoped keyframe names so the animation appears nowhere else), and a
composer. Editing/sending uses a plain text composer plus Enter-to-send; the GB-9-style tap
picker pattern from the gradebook's `SupersedeDialog` was considered but a free-text
composer is what IT-6's own component list actually specifies for Iter.

Greeting-once-per-session (IT-5) is tracked by a module-level `Set` of user ids that have
already been greeted this browser session, not a single flag — so a second person signing
into the same browser session gets their own first greeting instead of silently inheriting
whichever user greeted first.

## Real bugs found and fixed while building and testing this phase

**The floating launcher stayed visible, and above, its own open panel (D-59).** On desktop
the panel is a 420px right-anchored sheet, not full-screen, so the still-mounted button at
the same bottom-right corner sat inside the panel and intercepted clicks on the composer's
send button — found by a real click failing in Playwright with "element intercepts pointer
events," not by inspection. Fixed by hiding the launcher whenever the panel is open, the
standard pattern for this class of chat widget.

**A real Postgres error was being silently swallowed with no log line at all (D-55/D-59).**
Diagnosing an unrelated 500 from the gradebook (the Neon-collation bug, D-55) took adding a
temporary file-based error dump because the shared `error-handler.ts`'s `isPgError` branch
mapped any object with a `.code` property to a generic `INTERNAL` and returned without
logging anything — a real bug found only by needing to debug through it. Fixed by logging
whenever that branch's own mapping falls through to `INTERNAL`.

## Verified directly (not just by inspection)

- A real Gemini reply, grounded in real seed data: asked a teacher account "which of your
  classes has the most unpublished drafts, and how many students total," got back the
  correct class list and exact counts computed from the live gradebook data; asked a
  student account "which subject am I falling behind in," got back the correct
  lowest-average subject and exact average/trend numbers from their live record.
- The empty state's greeting uses the real signed-in user's first name (checked against two
  different real demo accounts, in a real browser).
- Tapping a suggestion chip fills the composer without sending (checked the network tab: no
  request fires until Send/Enter).
- Desktop (1300×900) and mobile (390×844) screenshots: correct panel geometry, no backdrop
  dimming on desktop, the gradebook remains visible and usable beside the open panel, the
  mobile launcher sits clear of the pill nav and the docked QR/gradebook button with no
  overlap at any of them.
- The disclaimer line appears once a conversation has started, not before.
- `npm run tokens:check` and `npm run i18n:check` both pass with the new `--iter-*` tokens
  and the new top-level `iter` dictionary namespace (hy/en/ru, 337 keys, all three locales
  in sync).

**Not verified in this pass, and explicitly out of scope for this build of the phase**:
attachments (IT-6 — image/file/voice/screenshot, `POST /api/iter/attachments`,
`ITER_ATTACHMENT_LIMIT`); the Settings-configurable header-vs-floating button position
(Phase 12's own Done-when item — `preferences.iterPosition` already exists from Phase 4's
scaffolding and `IterButton` could read it, but the settings UI to change it isn't built
yet, so only the floating variant Phase 11's own Done-when list actually tests was built);
the axe/keyboard/screen-reader accessibility pass (Phase 14's job); export/widget-gallery
integration (Phase 9/12).

## Notes for the next phase

- `docs/decisions.md` D-56 through D-60 cover the out-of-order build decision itself, the
  no-persistence choice, the context-grounding approach and its role-scoped limits, the two
  bugs this phase's own testing found, and the model-name note — read D-56 in particular
  before assuming Iter's scope matches the roadmap's Phase 11 text verbatim.
- If Phase 12 (Settings) adds the header-vs-floating toggle, `IterButton` needs a second
  layout branch reading `user.preferences.iterPosition` — not built now because Phase 11's
  own Done-when list only tests the floating variant.
- Attachments are unbuilt. If a later pass adds them, reuse Phase 10's storage adapter
  (C10, S-6) rather than inventing a second one, per the roadmap's own instruction for
  `POST /api/iter/attachments`.
