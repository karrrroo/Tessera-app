# Tessera — decisions log

Running record of every decision made outside the source documents in `docs/reference/`,
and every place this build deliberately deviates from those documents. New entries are
appended at the bottom, newest last, each with the date and phase it was made in.

## 2026-08-25 — Project setup

**D-1. Repository root.** The application lives inside this folder
(`Tessera-app/`), not at the top-level `tessera/` folder. `Design/`, `Design System/`,
and `Docs/` (siblings of this folder) remain reference-only and are not part of this
repository. The canonical roadmap (`docs/reference/tessera-roadmap.md`) is a copy of
`../../Docs/tessera-roadmap.md` (v2.0) taken at project start; the PRD, schema, and seed
files were already here. The v1.0 roadmap draft is preserved at
`docs/reference/archive/tessera-roadmap-v1-superseded.md` for history only — it is
superseded in full by v2.0 and must not be used.

**D-2. Git.** A git repository was initialized in this folder specifically (not at the
Windows user profile root, where a stray, empty, unrelated `.git` was found and left
untouched at the user's request). Every phase and meaningful checkpoint gets its own
commit.

**D-3. Database timing — local Postgres now, Neon later.** `tessera-schema.sql` and
`tessera-roadmap.md` (C1/C2) assume a Neon database already exists and forbid ever
running migrations against it, on the premise that real student data is already live
there. That premise does not hold yet: no Neon project exists for this build. Decision:
develop against a **local PostgreSQL instance** for now; `tessera-schema.sql` and
`tessera-seed.sql` are applied to it once, directly, exactly as they'd be applied to a
fresh Neon database. C2's *spirit* (no migration tooling, no iterative `ALTER TABLE`,
schema changes go back through the source SQL file) is kept even locally. Once a Neon
project exists, `DATABASE_URL` swaps to point at it and the same schema/seed application
step runs there — nothing else changes, since the backend never talks to any
Neon-specific API. Local-only additional constraint: while the local database holds only
synthetic seed data (not real student records), it may be dropped and recreated freely if
a genuine schema fix is needed before the Neon cutover; C2's hard "never alter, never
drop" rule takes full effect again once real data exists anywhere.

**D-4. File storage — local disk adapter now, no Cloudflare.** `tessera-PRD.md` §11.5.5
and `tessera-roadmap.md` C10 specify Cloudflare R2 (prod) and, per the roadmap, MinIO
(dev) for credential attachments and import files — and disagree with each other about
whether R2 is also used in dev. Decision: skip Cloudflare and any S3-compatible service
entirely for now. Attachments and import files are stored on local disk under
`backend/storage/` (gitignored), behind a small `StorageProvider` interface
(`save`, `getSignedUrl`, `delete`) with one implementation (`LocalDiskStorageProvider`).
Wiring in R2 later is limited to writing a second implementation of that interface and
switching which one is constructed — no call site changes. No MinIO, no Docker container
for storage, is used at any point under this decision.

**D-5. Grade-colour accessibility (roadmap Appendix E, decision D6).** Two of the ten
fixed grade colours (grade 4, grade 8) measure below the 4.5:1 WCAG AA contrast
threshold against the app's `--ink` token in at least one theme (grade 4: 4.47:1 best
case; grade 8: 4.16:1 best case). Decision: **option (c)** from the roadmap — ship the
ten grade hex values exactly as designed, unchanged, and record this as a documented,
deliberate AA exception rather than changing any token or adding per-tile conditional
logic. This will be written explicitly into the design-tokens documentation produced in
the design-system phase, with the measured contrast ratios cited.

**D-6. Stack confirmation.** `tessera-PRD.md` §11.5 and `tessera-roadmap.md` C3/C4/C5/C9
already specify Node + Express + TypeScript + Drizzle (backend), Next.js + TypeScript +
Tailwind (frontend), PostgreSQL accessed only through the backend (no Neon API, no
Supabase, no BaaS), JWT auth, and an npm-workspaces root with a single `npm start`. All
of this matches the requested stack exactly; no changes were needed to align the source
documents with it.

## 2026-08-25 — Phase 1

**D-7. Local Postgres runs as a user-owned process, not the Windows service.**
PostgreSQL 17 was installed via `winget` (D-3's local-database decision), but the silent
install left the `postgresql-x64-17` Windows service with an unknown superuser password
and no way to reset it without administrator rights, which this environment doesn't have.
Rather than require elevation, a second, independent PostgreSQL cluster was initialized
with `initdb` under the current user's own permissions, living at `Tessera-app/.pgdata/`
(gitignored) and listening on **port 5433**, not 5432 — the Windows-service instance on
5432 is simply unused. This cluster is not a service — it has to be started once per
machine session with `npm run db:start` (wrapped automatically into `npm start`'s
`prestart` hook) and can be stopped with `npm run db:stop`. `backend/.env`'s
`DATABASE_URL` points at port 5433 accordingly. This has no bearing on the eventual Neon
cutover (D-3) — Neon is a managed service and none of this local process-management detail
applies to it.

**D-8. Two factual corrections to the roadmap's Phase 1 text**, found while implementing
it, annotated in place in `docs/reference/tessera-roadmap.md`: the schema actually has
**22** tables, not the 24 the roadmap's prose claims (verified by querying
`information_schema.tables` directly — `schema-check.mjs` asserts 22); and `drizzle-kit
pull` does not support an introspection config with no `out` path as the roadmap assumes —
it always writes `schema.ts`/`relations.ts` and a migration-journal snapshot into `out`
together. Worked around by pointing `out` at a gitignored `backend/.drizzle-introspect/`
scratch directory and copying just `schema.ts`/`relations.ts` into `backend/src/db/` after
each pull — `out` is never fed to a migrate step regardless.

## 2026-08-25 — Phase 2

**D-9. Phase 2's fixture table, corrected against the real seed data.** Four of the
roadmap's stated fixture thresholds/details didn't survive contact with the actual
`tessera-seed.sql`, all annotated in place in `docs/reference/tessera-roadmap.md`:

- **Demo-account password format.** The roadmap's Phase 2 says each demo account should
  have "a parseable Argon2id hash (`$argon2id$`)". In fact every seeded account, demo
  included, is bcrypt (`$2a$12$…`) — exactly as `tessera-PRD.md` §11.5.2 itself documents
  (seed data is bcrypt, with a migrate-on-login upgrade path to Argon2id for real logins).
  `scripts/data-audit.mjs` accepts either format.
- **Sparse-student threshold.** The roadmap wants "fewer than 3 published marks"; the seed
  gives its one deliberately-sparse student exactly 5, and every other student has 120+.
  Fixed by finding the minimum and asserting it's a clear outlier (under a quarter of the
  next-lowest) rather than checking a fixed number that no student actually satisfies.
- **Heavy class-subject-term threshold.** The roadmap wants "≥20 assessments"; the real
  maximum for any single class-subject-term is 8 (15 across both terms combined for the
  same class-subject). Fixed by asserting ≥5 assessments and ≥25 students instead — high
  enough to mean something, low enough to actually exist.
- **`data:topup` being "INSERT-only."** The two real gaps found (below) can only be fixed
  by updating an existing row — inserting a second enrollment for a student already
  enrolled that year would violate `enrollment`'s own unique constraint, and the
  assessments needing a topic already exist. `scripts/data-topup.mjs` uses idempotent,
  narrowly-scoped `UPDATE`s instead, each a no-op once the fixture it targets exists.

**D-10. Two real, accepted gaps in the seed data — deferred, not fixed.**
`scripts/data-audit.mjs` found two fixtures the seed genuinely doesn't provide, reported
them in `data-gaps.md`, and stopped rather than deciding unilaterally, per the roadmap's
own instruction. Asked directly, the decision was to **defer both, not run
`data:topup`**:

- No enrollment has any status other than `active` — there is no departed student to
  exercise Phase 5's "departed never deletes historical marks" test against.
- No assessment has a non-null `topic` — `tessera-seed.sql` never populates that column at
  all. This is the same fact as PRD §18 Q8 ("is curriculum topic data available?"), just
  surfacing here as a concrete data gap instead of an abstract open question.

Consequence: `npm run data:audit` exits 1 and will keep doing so until one of these is
revisited — that's the script working as designed, not a broken build. `fixtures.json` is
committed without a `departedStudent` or `taggedAssessment` key. Phase 5's roster-departure
test and Phase 7's topic-breakdown test are untestable against seed data until this is
revisited; both phases must re-check `data-gaps.md` before relying on either fixture.

## 2026-08-25 — Phase 3

**D-11. Password-reset tokens are stateless, not stored anywhere.** The schema has no
table or column for reset tokens at all — a real gap under C2, surfaced and asked about
explicitly rather than silently worked around. Decided design: a token is
`base64url(userId + "." + issuedAtEpochSeconds + "." + mac)`, where `mac` is an
HMAC-SHA256 (keyed by a new `RESET_SECRET` env var) over the payload *and* the user's
current `password_hash`, truncated to 32 chars. Verifying recomputes that MAC against
whatever `password_hash` is live right now. No table, no in-memory map, no schema change,
and the token survives a server restart because there's nothing to lose — everything
needed to verify it lives in the token itself plus one already-existing column.

Single-use falls out for free: a successful reset changes `password_hash`, so every
outstanding token for that user — this one and any other still-live one — stops verifying
against the new hash on its own. Accepted trade-off, stated up front: two reset requests
within the same 30 minutes are both live until either is used, not just the most recent
one (the PRD's literal "issuing a second invalidates the first" isn't quite what happens,
but the practical security property — a stale reset link can't outlive a password change —
holds). `RESET_SECRET` is a new required env var (`backend/src/lib/env.ts`), generated the
same way as `JWT_ACCESS_SECRET`.

**D-12. Refresh-token rotation inserts a new `device_session` row and revokes the old
one, rather than updating a single row in place.** This was necessary to make reuse
detection (roadmap Phase 3: "a token whose hash matches no live row is a reuse of a
rotated token... revoke the entire family") actually implementable: with an in-place
update, the old hash is gone the moment it's rotated, so a replayed old token is
indistinguishable from a typo — there'd be nothing left to detect reuse *of*. Inserting a
new row and marking the old one `revoked_at` instead means the old hash is still a real,
queryable row, so "presented hash matches something, but it's already revoked" becomes a
meaningful signal, with zero schema change (device_session already allows multiple rows
per user).

That signal still isn't enough by itself, though — a session revoked because the user
explicitly signed it out from another device looks identical, in the table, to one
revoked because it was rotated away. Conflating the two was an actual bug caught while
testing this phase by hand: revoking one device from Settings was, before the fix, also
silently logging out every *other* device for that user, since both cases fell into the
same "matches a revoked row → assume theft → nuke everything" branch. Fixed with a small
in-memory map (`rotation-tracker.ts`) recording exactly which hashes were rotated away, and
only *those* trigger the full-family revocation and `AUTH_REFRESH_REUSED`; a hash that
matches a revoked row for any other reason returns a plain `AUTH_SESSION_REVOKED`, with no
effect on the user's other sessions. Losing this map on restart just means a replayed
rotated token gets treated as an ordinary dead session instead of triggering the
aggressive response — the safe direction, unlike D-11's reset tokens.

**D-13. Seed data touched by manual testing was reset.** Phase 3 was verified end to end
by hand against the real login/refresh/reset/lockout/session endpoints (see
`docs/phases/03-authentication.md`), which necessarily mutated real rows (a demo
account's password after a reset-flow test, a teacher's `locked_until` after a lockout
test, several extra `device_session` rows). `tessera-seed.sql` was re-applied afterward
(it's designed to be safe to re-run — truncate and refill) to leave the database in the
same state Phase 2's audit already verified, rather than committing Phase 3 against
quietly-drifted data.

**D-14. The frontend's boot-time silent refresh had to be routed through the same
in-flight-request guard as the 401-triggered refresh, not its own direct `fetch` call.**
Found while driving the frontend in a real browser (a check `tsc`/`eslint` can't perform):
escaping a first-login account to `/overview` via a full page navigation would sometimes
land back on `/login`, fully logged out, instead of bouncing to `/first-login` as
intended. Cause: `AuthProvider`'s boot effect called `/api/auth/refresh` directly, and a
full navigation remounts it — under React Strict Mode (on by default in Next.js dev) a
mount effect always runs, cleans up, and re-runs once, so the direct call fired twice with
the same refresh cookie in near-simultaneous requests. The first request legitimately
rotates the token; the second, still carrying the now-superseded cookie value, matches
D-12's "hash was rotated away" case exactly — which is the correct signal for genuine
token theft, just tripped here by the client racing itself. The result was the entire
session family being revoked on an ordinary page load. Fixed by exporting the
`refreshOnce()` promise-deduping helper already living in `lib/api/client.ts` (built for
concurrent 401-triggered refreshes) and having `AuthProvider`'s boot effect call that
instead of `fetch` directly, so every refresh in the app funnels through one shared
in-flight promise regardless of which code path triggers it. This fixes same-tab
double-firing (Strict Mode, or any other double-mount); it does not cover two separate
browser tabs refreshing at the same moment, which is a harder problem — a cross-tab lock —
and is out of scope for Phase 3.

## 2026-08-25/26 — Phase 4

**D-15. The visual brief's 9-file correction chain was consolidated before Phase 4, per
the roadmap's own instruction (Appendix B: "belongs before Phase 4, not inside it").**
`docs/reference/tessera-design-brief-merged.md` is the result — a base document
(`tessera-v2-FINAL (3).md`) plus eight deltas applied in verified order, each topic
resolved to its final, cumulative state with inline provenance notes wherever a value was
revised more than once (the QR button alone, three times). A decoy file in the same
uploads folder, `tessera-design-brief.md`, explicitly claims to be "the single source of
truth" and is not — it still shows the Iter button as glass-only with no gradient, which
the verified chain's `corrections-2 §4` restores; it and two other non-chain files were
deliberately excluded. Phase 4 and everything after it is built against the merged file,
not any individual original.

**D-16. The header has no language switcher — the PRD wins where it conflicts with the
visual brief.** PRD §12 L-7 is explicit and gives a reason: *"It does not appear in the
application header — language is a setting, not a toolbar control."* The merged design
brief (§8quater, §11ter) places the HY·EN·RU pill in the header anyway, and the brief's
own attempt to reconcile the two produced a garbled, self-contradicting sentence — which
is what surfaced the conflict rather than letting either paraphrase stand unchecked. Asked
directly, the decision was to follow the PRD: `AppHeader` carries the logo, the Web/Mobile
switch, and the account block, and nothing else. The language control exists only on the
login screen and in Settings, per the brief's own compact-pill spec (`LanguagePill`,
§11ter final per `corrections-2 §3`): always the Latin codes **HY · EN · RU**, never
transliterated per the active locale — Phase 3 had this wrong, rendering "ՀԱՅ"/"EN"/"РУС".

**D-17. The token layer draws from three sources, not two, and `--bg-raised` is computed,
not looked up.** `tessera-design-system.dc.html` remains the source for `--ink`/`--hair`/
`--glass`/`--panel`/`--surface2`/`--danger`/`--ok` (two states, keyed by `[data-tt]`
theme lightness); `tessera-data.js` remains the source for the fixed grade scale and the
seven accents. The merged brief (§4) adds a third source: `--bg-base` (four states, keyed
by `[data-bg]` — Խորը/Ածխային/Սերուցք/Մոխրագույն) and the two gradient-mesh palettes,
Palette Deep and Palette Aura, which are keyed to theme lightness and independent of which
of the four backgrounds is active. The brief gives `--bg-raised` as an explicit formula —
"lightening 4% on dark backgrounds, darkening 3% on light ones" — so it's computed with
`color-mix()` from `--bg-base` in `tessera.css`, not a fourth hardcoded hex pulled from the
live prototype's own `BGS` array (which predates this correction and would have baked in a
stale value).

A real bug followed directly from getting this coupling wrong at first: `ThemeProvider`
defaults to `"system"` (resolved from the OS) and `BackgroundProvider` defaulted to a
hardcoded `"deep"`, independently of each other. In a browser whose OS preference is
light, that produced `data-tt="light"` next to `data-bg="deep"` — light ink on a near-black
background, i.e. the entire login screen rendering with invisible text. Caught by actually
opening the page rather than by any check script. Fixed by making the background's
*default* (not a user's explicit later choice, which stays sticky once made) track the
resolved theme reactively — `deep` while dark, `cream` while light — rather than a
hardcoded value that can disagree with "system" on first load.

**D-18. Several real gaps and one real bug were found in the design source's own copy and
in Phase 3's placeholder dictionary, once the real trilingual dictionary (`tessera-data.js`
`T`, 304 keys) replaced Phase 3's stand-in.** All fixed, not just noted:

- `auth.recSub`/`sentBody`/`newSub`/`firstBody` were unresolved `{{ t.auth.* }}` template
  placeholders in the **Armenian** source specifically — hy is supposed to be the source
  language (L-1), but these four were apparently never actually written, while en/ru have
  real copy for the same keys. Replaced with natural Armenian text matching the register of
  the surrounding real strings.
- The design never anticipated an admin demo account, or copy for account lockout, rate
  limiting, an invalid reset link, or a resend countdown. `auth.demoA`/`errLocked`/
  `errRateLimited`/`errGeneric`/`resetInvalid`/`resendWait`/`resendButton` were added,
  matching the surrounding keys' tone, in all three locale files.
- `bg` (the four background names) is real design copy, but from a separate constant
  (`BG_T` in `Tessera.dc.html`) that isn't part of the `T` export the rest of the
  dictionary mirrors — copied in verbatim rather than re-invented.
- Phase 3's own auth screens used invented key names (`identifierLabel`, `loginButton`,
  `newPasswordLabel`, …) that don't exist anywhere in the real dictionary, because it was
  written before the real dictionary was available. Every screen was reconciled to the
  real names (`idLabel`, `submit`, `newPw`, …) — `set.sessRevoke` in particular doesn't
  exist; the real key is `sessOut`.
- `SessionList`'s "last active" row called `interpolate(t.set.lastSeen, {when: ...})`
  against a string with no `{when}` token at all — the real dictionary has no
  placeholder-substitution convention anywhere (every screen concatenates translated
  fragments directly, preserving each language's own word order); the call was a silent
  no-op that dropped the actual timestamp from the UI. Fixed to concatenate directly.

**D-19. Sidebar and mobile-pill navigation item composition is a documented placeholder,
not a finalized spec.** The roadmap says nav items come from `T.nav` "filtered by role"
without stating which; the merged brief's §9 nav-pill mechanics are exact down to the
pixel but never states which four items fill the pill for which role; and the audit
checklist's aside that "the teacher's fourth nav slot is Այսօր (Today), not a credential"
names a screen with no icon, no route, and no entry in the `T` export at all (it lives, if
anywhere, in a `TODAY_T` constant this build never located). Rather than invent that
screen's content now, `components/shell/nav-items.ts` ships a reasonable, explicitly
commented placeholder set (student: overview/subjects/archive/settings; teacher:
gradebook/analytics/queue/settings, substituting the credentials icon for queue, which has
none; admin: queue/settings) to be revisited once Phases 6–12 build the screens it points
at. The QR/plus docked button is never a nav item — it's the pill's own centre button.

**D-20. `npm run tokens:check`'s exemption is the whole `frontend/src/design/` directory,
not the single file the roadmap describes.** The roadmap's "one file, `tessera.css`,
excluded" assumed no other file would ever need to contain a literal color. In practice
several JS-side consumers need typed constants generated from the same design source (an
accent picker's swatch list, the fixed grade legend, the accent-tint fallback, the four
backgrounds' hex for a picker button) — all genuinely canonical, not hardcoded, so the
whole directory is exempt rather than growing a per-file list. `globals.css`'s
create-next-app scaffold defaults (`--background`/`--foreground`) were left as a documented,
intentionally-failing exception through most of this phase's build, per the plan to close
it once `ThemeProvider`/`BackgroundProvider` existed — that cutover happened by the end of
this phase, so `tokens:check` now passes with no exceptions at all.

## 2026-08-26 — Phase 5

**D-21. There is no admin→institution link anywhere in the schema.** Neither `student`
nor `teacher`'s pattern (their own table, with an `institution_id` column) exists for
admins — there's no `admin` table at all, and `"user"` itself has no `institution_id`.
The seed and the current schema are single-tenant in practice (exactly one row in
`institution`), so every admin route resolves "the actor's institution" as that sole row
(`repo.resolveActorInstitutionId`) and throws loudly if that ever stops being true, rather
than guessing. C2 forbids adding the missing link via a schema change; a real multi-tenant
deployment needs one.

**D-22. `enrollment`'s unconditional `unique(student_id, academic_year_id)` makes the
roadmap's own acceptance test for transfer impossible to satisfy literally.** The
roadmap's Done-when #16 describes a transfer as leaving two rows behind — "the old
enrollment reads transferred, a new active one exists" — but the schema allows at most one
enrollment row per student per year, full stop, with no partial/filtered exception (verified
against `tessera-schema.sql` directly, not just the Drizzle introspection). C2 forbids
changing that. Resolved as: a transfer is an in-place update of the same row's `classId`
(status stays `active` — the student *is* actively enrolled, just in a different class),
with the change written to `audit_log` (`before`/`after` = the old and new classId) so the
event itself has a durable record. The other half of that Done-when item — "prior marks
stay attached to the old class" — holds regardless of how enrollment is modeled, since
`assessment`/`mark` reference `class_id` directly and never join through `enrollment` at
all. Verified end to end: transfer, depart, and a rejected double-depart all behave
correctly, and the audit trail records both real events.

**D-23. Import row "resolved" data (a row's looked-up `classId`/`subjectId`) is never
persisted — recomputed by re-running the same validator every time a batch is read,
patched, or applied.** `import_row` has only `raw` (jsonb) and `message` (text); there's
no dedicated column for it. Storing a computed value that could silently drift from `raw`
after an edit was the wrong direction — re-deriving it from the same `validateStudentRow`/
`validateTeacherRow` functions the preview screen already uses means apply can never
resolve a row differently than what the admin reviewed on screen. A first draft of `apply`
re-derived `classId` from the raw class-label text independently instead of reusing the
validator, and teacher import never inserted `teaching_assignment` rows at all despite the
roadmap explicitly requiring and testing it (Done-when #12) — both caught and fixed before
any real testing, by re-reading the code rather than by a failing test.

**D-24. `import_batch` has no `academic_year_id` column**, so every request that touches
an existing batch (re-read, patch a row, apply) takes `academicYearId` explicitly from the
client rather than looking it up server-side. A minor, schema-driven API shape difference
from the roadmap's endpoint table, which doesn't show that parameter.

**D-25. Bulk password hashing uses `UV_THREADPOOL_SIZE`, not a literal `worker_threads`
pool.** The roadmap says "hash across a worker pool sized to `os.cpus().length - 1`."
`argon2`'s async `hash()` is an N-API `AsyncWorker` that already queues onto libuv's
threadpool — sizing that pool (set once, in `backend/src/index.ts`, before anything else
can initialize it) and calling `Promise.all` over plain `hashPassword` calls gets the same
real cross-core parallelism the roadmap is actually after, without hand-rolling a
`worker_threads` pool that would need its own argon2 binding loaded per thread. Measured on
a 600-row apply (as the roadmap's own performance note insists on doing, not assuming): the
full apply — 600 Argon2id hashes plus all writes — completed in ~13s, against the
roadmap's own estimate of 36s for serial hashing alone.

**D-26. A found inconsistency in the roadmap's own Done-when list, not fixed against but
worth recording.** Done-when #5 says fixing all twelve planted defects first (step 6,
"errorCount reaches 0") and only then applying (step 8) should raise counts "by 588" — but
588 is `600 - 12`, the count that would result from applying with the twelve *un-fixed*
rows excluded, not the all-fixed scenario steps 6-7 actually describe. Verified directly:
fixing all twelve first and then applying raises counts by 600, which is the internally
consistent result given the steps as written. Treated as a stale number left over from an
earlier draft of this checklist, not a target to hit.

**D-27. `useCurrentAcademicYear` (frontend) resolves "the current year" as whichever
academic year has the latest `startsOn`, with no way for an admin to pick a different one.**
Deliberately minimal for this phase — a real school has one forward-looking year at a time
in practice, and a year switcher belongs to whichever later phase first needs to look at a
prior year's data. Its real sharp edge: two years with an identical `startsOn` tie-break in
an order this hook doesn't control, and everything scoped to "the current year" (roster,
classes, assignments, an import's class-label resolution) silently resolves against
whichever one wins. Caught while testing this phase, by two of its own test academic years
coincidentally sharing a `startsOn` — not a defect in a school's real data, which won't
create that ambiguity, but worth knowing about if a support request ever looks like "my
import can't find any of my classes" and the school has more than one year on the same
start date.

## 2026-08-26 — Phase 6

**D-28. The Tessera ID (C14) hex-slicing algorithm isn't in the current PRD — it's only in
the archived v1 roadmap.** `tessera-PRD.md` §11.5.4 restates the *rule* ("derived
deterministically from `student.id`, format `TSR-AM-####-####`, no relation to
`emis_student_id`") but not the exact derivation. `docs/reference/archive/tessera-roadmap-v1-superseded.md`
has it: `TSR-AM-<first 4 hex of md5(student.id)>-<next 4 hex>`. Used verbatim
(`modules/identity/crypto.ts`), uppercased, since the roadmap's own worked example
(`TSR-AM-4471-0288`) is otherwise unverifiable against anything current.

**D-29. `scan_event.qr_credential_id` is `not null`, so two of the five `/api/verify`
results can't always be persisted.** A payload whose handle doesn't resolve to any live
credential — the true `unknown` case, and the sliver of `signature_invalid` where the
*handle* half (not just the mac) was corrupted — has no row to log against, and C2 forbids
relaxing the constraint. Resolved the same way D-22 resolved enrollment's unique
constraint: verified against the raw schema first, then scoped the guarantee to what's
actually checkable. ID-9's stated purpose is catching **credential misuse** — a real,
resolvable card replayed, revoked, or shared — and every one of those cases *does* resolve
to a credential and *does* get logged; only content-free noise (a non-Tessera QR code
scanned by mistake, or a handle mangled beyond recognition) is answered to the caller but
not persisted, and there is nothing meaningful to log a pattern about in that case. Also
scoped: `SCAN_PAYLOAD_MALFORMED` (wrong shape entirely — no dot, wrong length, non-base32
characters) is a request-validation error with no candidate handle at all, so "every call
writes a scan_event" is read as "every call that produced a real verify attempt," not
literally every HTTP request.

**D-30. `qr_credential` rows are created lazily, on first `GET /api/me/credential`, not
wired into Phase 5's student-creation paths.** All 200 seeded students already have one
(verified directly against the database), but a mid-year add or bulk import — both written
before this module existed — doesn't. `getOrCreateQrCredential` (identity/repo.ts) inserts
one with a fresh random seed and registers its handle in the in-memory map immediately, so
a brand-new student's card works on first open without Phase 5's admin service ever needing
to know this module exists.

**D-31. The teacher variant of `GET /api/me/credential` carries no `payload`/`credentialId`
at all, and `GET /api/me/today` has no time-of-day, room, or "current lesson" highlight.**
`qr_credential.student_id` is student-only by schema — there is no teacher-credential concept
to speak of, matching the roadmap's own silence on a teacher QR sheet and the design
prototype's `isT` special case (clicking the QR button as a teacher opens a gradebook column
instead, a design-tool artifact, not a spec). Separately, `assessment` has a date
(`held_on`) but no period or start time, and no table has a room column at all — inventing
either would be exactly the "lesson table" the roadmap explicitly forbids (PRD §3.2). The
`today.now`/`today.drafts`/`TODAY_T.room`/`.date` design copy that would need those fields
is left out of the i18n dictionaries rather than added and never truthfully usable; the
draft-count line specifically depends on the gradebook's draft state, which doesn't exist
until Phase 7. Subject names on both endpoints are sent as the full `nameHy`/`nameEn`/`nameRu`
triple, not a single server-picked string — the roadmap's own JSON example shows a single
`"subjectName"`, but C8 ("no translation logic in the backend") is the harder rule, and every
other module in this codebase already sends the full triple and lets the frontend pick.

**D-32. `qs` and `today` are real design copy the Phase 4 i18n extraction missed, not new
copy.** They come from `QRSHEET` and `TODAY_T`/`LESSON_T.title` in `Tessera.dc.html` —
separate top-level constants, never part of the `T.scr.*` object Phase 4's extraction
walked, so they were invisible to it. Added by hand to all three locale files (a bounded,
verified transcription of ~8 short strings, not a full re-extraction), with the omission
documented in each file's own header comment per that file's existing convention.

**D-33. Two deliberate departures from the literal design source, both about what a QR
code and its card are allowed to look like.** First: the design's own `qrRows` builder
(`Tessera.dc.html`) colors every dark module `var(--ink)` — correct-looking in light theme,
but in dark theme `--ink` is light, which would paint light modules on the QR's white card
and defeat the code's own readability (the exact failure ID-6's corner-rounding is trying
not to cause). Fixed tokens instead: `--qr-ink`/`--qr-card-bg` (tessera.css), never
theme-scoped, alongside the equally-fixed `--id-card-*` tokens for the ID card's own
gradient and text (ID-2's "dark in both themes" already established that this card doesn't
follow the app's theme at all). Second: `IdCard` uses `Grain` only, not `GradientMesh`'s
radial blobs, even though the roadmap's own Components list says "GradientMesh + Grain" —
the design source's actual ID-card render (`Tessera.dc.html`) layers one noise overlay on
the accent-tint gradient and nothing else; four colorful mesh blobs on top would visibly
fight the "steel/near-black" result the same roadmap text describes in the same breath.
Followed the literal source over the shorthand list.

**D-34. A real bug chain found while verifying ID-8 (offline), not by inspection but by
actually hard-reloading `/id` in airplane mode and watching it fail.** `AuthProvider`'s
boot-time `refreshOnce()` treated a network-level fetch failure (offline) identically to an
explicit 401 (a genuinely dead session) — both collapsed to `setStatus("anon")`, which
`AuthGate` sends straight to `/login`, discarding everything IndexedDB had already cached.
Fixed by making `refreshOnce()` return `boolean | null` (`null` = the server was never
reached at all) and adding a distinct `"offline"` auth status, trusted only on a device with
a real recent session (a non-sensitive `tessera.hasAuthedBefore` localStorage marker, set on
login/refresh, cleared on logout) — a device that's never authenticated has nothing cached
to show offline anyway. The same distinction was applied to `apiFetch`'s mid-session 401
retry path, so a token expiring during a brief network blip doesn't *also* read as a logout.
Fixing that alone still didn't work: `AppShell`'s `if (!user) return null` blocked every
route's content, not just the nav it actually needs `user.role` for, since the new
`"offline"` status has no live profile by design. Changed to render bare content without
chrome in that case — a real offline nav is Phase 13's job, not this one's. Found in the
same pass, unrelated to any of the above: `next build` failed outright on
`/(auth)/forgot/sent` (`useSearchParams()` requires a Suspense boundary, a build-only error
invisible under `next dev` that had shipped since Phase 3) — fixed with a Suspense wrapper,
the standard shape for this exact Next.js error.

**D-35. The `/id` shell's offline precache is one hand-rolled service worker, not
Workbox.** `public/sw.js` caches-as-it-goes for `/id` and `/_next/static/*` only, and never
touches `/api/*` (credential freshness is IndexedDB's job, via `useCredential`). Verified
against a **production build** (`next build` + `next start`), not `next dev` — the dev
server's HMR websocket noise makes the two impossible to tell apart by symptom alone, and a
production build is what ID-8 actually needs to hold for. Phase 13 owns the real,
general-purpose service worker and should replace this file outright rather than extend it.

**D-36. The Scanner page (`/scan`) and the admin Scan-anomalies view have no design
precedent (C13) and use plain English plus the existing token file, not the `T` dictionary
or new Armenian copy.** Matches the admin module's own precedent (Phase 5,
`nav-items.ts`'s `STATIC_LABELS`) for exactly the same reason: there is nothing in the
design package to translate faithfully, and inventing trilingual copy for a screen the
design never specified would be new product content wearing a translation's clothes. `/scan`
sits outside both `(app)` and `(auth)` — it's gated by a device-entered scanner key in
localStorage, not a JWT, matching `requireScannerKey`'s own reasoning that a door reader is
a device, not a signed-in person.
