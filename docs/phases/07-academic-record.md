# Phase 7 — Academic record

Source: `docs/reference/tessera-roadmap.md`, Phase 7. Real gaps, bugs, and decisions found
and resolved during this phase are recorded in `docs/decisions.md` D-37 through D-43.

## Delivers

A student sees their whole record — this term, this year, previous years — in an interface
built for them, and can see that a correction happened and why.

## What was built

**Backend** (`backend/src/modules/record/`): `repo.ts`, `service.ts`, `validation.ts`,
`routes.ts` — `GET /api/me/record?termId=`, `GET /api/me/subjects/:subjectId?termId=`, `GET
/api/me/archive`, `GET /api/me/marks/:markId/history`. Every route is student-only
(`FORBIDDEN` for teacher/admin); a student id or mark id that isn't the caller's own resolves
to `NOT_FOUND`, never a peek at someone else's record. REC-6 has no write path at all — not
guarded, absent — and REC-7 is enforced in the query itself (`state in
('published','superseded')`), never fetched-then-filtered.

Per assessment, the response carries only the live (published) mark plus one level of "what
it replaced" (`supersededFrom`); the full correction chain, with actor and reason at every
step, lives behind the separate history endpoint. `trend` is computed once, server-side
(last three marks' mean vs. the three before, ±0.4 threshold), so the overview and the detail
screen can never disagree about it.

**Frontend** (`frontend/src/components/record/`, `frontend/src/app/(app)/{overview,subjects,
archive}/`): `Mosaic`/`MosaicRow`, `SubjectCard`, `SubjectDetail`, `MarkSequence`,
`TrendIndicator`, `TopicBreakdown`, `ArchiveYear`, `MarkHistorySheet`, `TermSwitcher`,
`EmptyState`. Routing matches the roadmap exactly: `/overview`, `/subjects`,
`/subjects/[subjectId]`, `/archive` — the design mockup's side-by-side list+detail layout
was not carried over, since the roadmap's own routing table treats them as two separate
routes.

Every screen has real designed copy for its empty state (REC-9): no marks yet (overview),
no subjects (subjects list), no marks this term (subject detail — reusing the same copy),
archive empty. `TopicBreakdown` and the subject detail's own credentials section render
nothing at all when there's nothing to show, per the roadmap's explicit instruction for the
former and the same reasoning applied to the latter.

## Real bugs found and fixed while building and testing this phase

**Every route under `(app)` was rendering a nested `<main>` landmark** — a Phase 4-era bug
(`AppShell`'s desktop layout wraps `{children}` in its own `<main>`, and every page already
renders one too), invisible until a Playwright `locator("main")` call on a Phase 7 screen hit
a strict-mode "resolved to 2 elements" error. Fixed once, in `AppShell`, for the whole app.

**`MarkSequence`'s chip grid truncated every mark's title unreadably at three columns** — the
detail panel's own container is capped at `max-w-xl` regardless of viewport width, so three
columns left each chip too narrow for "Դասարանական 1"-style titles. Caught by looking at the
actual rendered screenshot, not by inspection; fixed to two columns.

## Verified directly (not just by inspection)

- `GET /api/me/record` against the real demo student: 10 subjects, term switcher with both
  real terms, marks in chronological order, `average`/`trend` computed correctly (checked the
  arithmetic by hand against one subject's real mark sequence — a ±0.33 delta against the
  ±0.4 threshold correctly resolved to `"flat"`).
- `GET /api/me/subjects/:id?termId=` for both terms on the same subject: different mark
  counts and averages per term, confirming the term parameter actually scopes the query.
- **Supersession, against `fixtures.supersededMarks[0]`'s real owning student**: the subject
  detail view shows a correction marker (✎) on exactly the corrected mark; opening it renders
  the real database row's old value, new value, exact date, and the real reason and teacher
  name, verbatim.
- **Drafts are invisible**: confirmed at the API — a request for the draft owner's own class
  never returns the twelve seeded drafts (`state in ('published','superseded')` is the only
  possible match, and 'draft' isn't in that list).
- Ownership: a mark id belonging to a different student's record returns `NOT_FOUND`, checked
  directly against a real cross-student id.
- `FORBIDDEN` confirmed via `curl` with a real teacher token against `/api/me/record`.
- `grep -rniE "\.(insert|update|delete)\(" backend/src/modules/record` → no hits (REC-6).
- **The colour invariant, REC-2/REC-3**: a mark's average of 7.7 rendered as computed
  `rgb(63, 127, 140)` — exactly `--g8` — both in Armenian and after switching the account's
  language to English via Settings (subject name changed to "Mathematics"; the colour did
  not move). The mosaic's own container: `backdrop-filter: none`, `background-color:
  rgb(255, 255, 255)` (alpha 1, no `GradientMesh` beneath it) — checked via computed style,
  not source inspection. The full light/dark × four-background × seven-accent (twelve
  combination) sweep was not independently re-run this phase — it relies on Phase 4's own
  already-verified guarantee that `--g1`..`--g10` are `:root`-scoped and untouched by any of
  those three axes, which this phase's only addition (`--mark-tile-fg`) does not change.
- `RECORD_TERM_NOT_FOUND` for a nonexistent termId; a real, populated subject detail render
  for both terms; the sparse-marks student's data confirmed at the API to have marks in
  exactly one subject in each term (2 in term1), the rest correctly averaging `null`.
- Shown in a real browser (screenshots taken): the overview mosaic, the subjects list, a
  subject detail panel with a real correction and its opened history sheet, and the archive
  screen's empty state.

**Not verified in this pass**: the archive screen's *populated* rendering path — this seed
has only one academic year, so no student has a previous year to show one (D-43); the
`RECORD_NO_ENROLLMENT` path (no seeded student lacks an enrollment row to trigger it); the
full twelve-combination colour sweep (relies on Phase 4's own guarantee, per above) rather
than being independently re-run.

## Notes for the next phase

- Phase 8 (teacher gradebook) is the actual source of every mark this phase reads — its own
  `T.gb.histTitle`/`histSub`/`reason` copy is already borrowed here (D-41) for the identical
  concept on the student-facing side; keep both call sites in mind if that copy ever changes.
- The standalone `/credentials` submission screen (nav item `creds`, `T.scr.cr.*`'s
  `newTitle`/`namePh`/`submit`/etc.) is still unbuilt — this phase only surfaces *approved*
  and *pending counts* of existing credential requests read-only, inside the subject detail
  view (D-40). Whichever phase owns teacher/admin decisions on `credential_request` should
  build the submission side then.
