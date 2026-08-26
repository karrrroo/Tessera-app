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

## 2026-08-26 — Phase 7

**D-37. The default term, when a request omits `termId`, is the resolved academic year's
first term by `index` — not "whichever term has already started."** This seed data's own
academic year starts a few days *after* the date this phase was built and tested on, so
"already started" would resolve to *no* term at all right now, an edge case with no good
answer. Index 1 is unambiguous and matches the natural reading of "show me my record" with
no other information. `termId`, when given, is validated against the student's own resolved
academic year specifically, not merely "some term in this institution" — a stricter reading
than `RECORD_TERM_NOT_FOUND`'s description, chosen because a student's `classId` is fixed to
one enrollment year; a term from a different year has no assessments to show under it
regardless, and validating loosely would just trade one failure mode for a more confusing
one.

**D-38. Three fields the design mockup renders have no real data behind them, so none of
the three were built.** The subjects list/detail "meta" line (design: weekly-hours count) —
no table anywhere carries hours-per-week for a subject or a class, so `teacherName` (real,
already returned by `/api/me/record`) stands in its place instead. Archive's `attestations`
— no attestation/document table exists at all (the same category of gap as D-24); the field
ships as an always-empty array so the shape is ready the day one gets added, rather than
being invented or silently dropped. Credential *category* (design: `comp`/`course`/`vol`/
`extra`, four made-up values) — the real seed data uses five entirely different values
(`volunteering`/`art`/`course`/`olympiad`/`sport`), none of which the `T` dictionary has a
translation for; category is simply not displayed in the read-only record (title and date
carry the substance), rather than showing an untranslated raw enum string to a student.

**D-39. `TopicBreakdown` renders nothing when empty, full stop — not one of the two designed
empty-state messages (`sj.noTopicsTitle`/`emptyTopicsTitle`) that exist for exactly this
case.** The roadmap is explicit and literal here ("renders nothing when `topicBreakdown` is
empty — not a 'no data' card, just absent, with the detail view standing on its own"),
which overrides the design copy's implied usage. Both design strings are real and
unused by choice, not missed.

**D-40. Two pieces of copy the design defines but never actually binds anywhere in its own
markup are put to real use here.** `ov.legendDraft`/`legendOk` ("informal credential, under
review/approved") — a small colored dot on each overview mosaic row, present only when that
subject has a pending or approved credential request, using this exact copy as its tooltip.
`cr.title` ("Non-formal credentials") — reused as the heading for the subject detail view's
own credentials section, since the design's own screen for `cr.*` (a separate `/credentials`
submission flow) is out of Phase 7's backend/frontend scope entirely — the roadmap's own
Backend and Frontend sections for this phase specify only the record endpoints and screens,
with no `/api/credentials` anywhere; Done-when #7's passing mention of "credentials" as a
fifth screen is read as the subject-detail sub-section built here, not a mandate to build
the standalone submission screen a `/credentials` nav item points at.

**D-41. `MarkHistorySheet`'s heading borrows Phase 8's own copy, because the roadmap's
stated source for it doesn't actually contain it.** The Screens table points this sheet at
`T.dlg.*`, but every key under `dlg` is a teacher-facing publish/discard/decline confirmation
— nothing about "old value, new value, reason" for a student viewing a correction. `T.scr.gb
.histTitle`/`histSub`/`reason` (Phase 8's teacher-facing cell history: "Change history" /
"Complete audit trail — records are never deleted" / "Reason:") is the same real design copy
for the identical underlying concept, just needed here first since Phase 7 ships before
Phase 8. The old→new value pair itself is shown as two colored chips and an arrow, needing
no label text at all.

**D-42. A real, cross-cutting bug found while testing this phase, unrelated to its own
substance: every route under `(app)` renders a nested `<main>` landmark.** `AppShell`'s
desktop layout wraps `{children}` in its own `<main>`, and every page built since Phase 4 —
`RoutePlaceholder`, `/settings`, every admin page, `/id`, and now every Phase 7 page — already
renders `<main>` as its own root, on the reasonable assumption that it *is* the page's main
content landmark. The result is two nested `<main>` elements on every single authenticated
page in the app, invalid per the HTML spec and confusing to any accessibility tooling that
walks landmarks. Found by a Playwright `locator("main")` strict-mode error while testing a
Phase 7 screen, fixed with a one-line change in `AppShell` (`<main>` → `<div>`) rather than
touching any of the many existing pages, since they were already correct.

**D-43. The populated-archive rendering path (a previous year with real final marks) was not
exercised against live data — this seed has exactly one academic year, so `GET
/api/me/archive` returns `{"years":[]}` for every seeded student, verified directly, and that
is the only shape reachable right now.** `ArchiveYear` reuses the same aggregation
(`average()`, group-by-subject) and rendering primitives (`gradeColorVar`, locale-picked
name) already verified live on the overview mosaic and subject list/detail screens, so this
is a real gap in *live coverage*, not in code review, and is recorded rather than quietly
assumed away.

## 2026-08-26 — Phase 8

**D-44. Idempotent publish stores its key and result inside the existing `audit_log.after`
JSONB column, queried by `->>'idempotencyKey'`, rather than a dedicated idempotency table or
column.** C2 forbids schema changes for this build; `audit_log` already records every publish
as a JSONB blob, so the idempotency key rides along in the same row instead of adding new
storage for it. A repeat request with the same key returns the cached blob reshaped to the
exact same `{publishedCount, publishedAt, batchId}` shape a fresh publish returns — the first
implementation leaked the blob's extra fields (`termId`, `classId`, `subjectId`,
`idempotencyKey` itself) on the cache-hit path only, caught by a direct `curl` repeat-request
comparison, not by reading the code.

**D-45. A correction's two writes — demote the old row, insert the new one — run in that
order, demote first, even though the roadmap's own prose describes inserting first.** The
roadmap's stated reason for the ordering ("the partial unique index would reject two current
marks if the old row were demoted second") only holds if Postgres checks a non-deferred
unique index at the end of each statement, not the end of the transaction — which is exactly
what it does. Insert-then-demote would transiently hold two `state in ('draft','published')`
rows for the same `(assessment_id, student_id)` and the index would reject the insert
outright; demote-then-insert never does. Implemented by reasoning through Postgres's
constraint-checking semantics directly, not by trusting the roadmap's example ordering at
face value, with the reasoning recorded in the code itself.

**D-46. `MARK_REASON_REQUIRED` needed its own error code, not zod's generic
`VALIDATION_FAILED`, so the schema's `reason` field is plain `z.string()` and the empty/
whitespace check moved to the service layer.** A `.trim().min(1)` on the zod schema rejects
an empty reason before the service ever runs, which is correct for a form field but wrong for
a named error code a client is meant to branch on. The three-layer pattern already used
elsewhere in this build — client-side disable, application-layer specific code, database
check-constraint backstop — applies here too: the dialog's submit button is disabled with no
reason (client), the service throws `MARK_REASON_REQUIRED` on an empty/whitespace reason
after `.trim()` (application), and the mark table's own check constraint is the backstop.

**D-47. `getMarkHistory` originally let any teacher view any mark's history by id, with no
ownership check at all** — found on a second read of the code, not by testing, since the
symptom (a stranger's mark id returning real data) isn't something a demo walkthrough
surfaces. Fixed by resolving the mark's owning assessment and running the same
`requireAssignment` ownership check every other teacher-facing gradebook route already runs,
after the id-to-assessment chain resolves rather than before, since the chain itself is what
identifies which class/subject/year to check against.

**D-48. Post-login and post-first-login redirects were role-blind — both hardcoded
`/overview`, a student-only screen, regardless of the signed-in account's actual role.** A
teacher or admin landing there got a silent `403` on `/api/me/record` with no `.catch()`,
which could leave the page blank indefinitely if they didn't navigate away manually,
violating this build's own no-bare-spinner principle. Found incidentally while diagnosing an
unrelated Playwright screenshot during this phase's own testing, not by reviewing Phase 3.
Fixed with one small helper, `landingRouteForRole()` (`/gradebook` for teacher, `/admin` for
admin, `/overview` for student — each role's own first sidebar item), used at both call
sites, since the two roles' nav items don't overlap at all and neither has a shared "default"
screen to fall back to.

**D-49. `MarkCell`'s `React.memo` comparator omitted the cell's own position, so a cell whose
column index shifted without any of its other visible props changing kept rendering with a
stale `pos` — stale `data-col`, and a stale `onKeyDown` closure bound to the wrong column.**
Column index is not fixed: a newly added assessment can sort before existing ones (same-day
ties, resolved by D-51 below), which shifts every later column's index by one without
touching that cell's value, draft/published state, history flag, or focus state — the exact
set the comparator checked. `React.memo` then correctly concluded "nothing relevant changed"
and skipped the re-render that would have updated the closure. Found only by instrumenting a
live page and reading actual `data-col` attributes and button `outerHTML` after adding a
column, not by reading the component in isolation — the bug is invisible until two same-day
columns actually exist. Fixed by adding `pos.row`/`pos.col` to the comparator.

**D-50. The grid's internal `focused` state and the DOM's real keyboard focus could
diverge entirely — `move()` only ever updated React state (driving the outline and
`tabIndex`), and nothing called `.focus()` on the newly-focused cell's actual DOM node.**
The visual highlight moved correctly on every keystroke; the browser's real
`document.activeElement` did not, silently staying on whatever cell was first clicked. Every
subsequent keystroke was handled by that original cell's own `onKeyDown` closure — the
keyboard state machine's entire premise (GB-8, "the part that decides adoption") was
non-functional beyond the very first commit-and-move. Confirmed directly: a scripted click on
`(0,0)` followed by `"5"` moved the CSS outline to `(1,0)` but left
`document.activeElement` reporting `(0,0)`. Fixed by calling `el.focus({preventScroll:
true})` in the same effect that already runs `scrollIntoView` on focus change, guarded so it
never re-focuses an element that already has focus.

**D-51. `findAssessmentsForGradebook` sorted by `heldOn` alone, which gives Postgres no
tie-break for two assessments on the same day** — observed directly: the exact same query,
run moments apart with no data change in between, returned a same-day pair in a different
relative order each time. A teacher who enters two lessons on one real calendar day would see
those columns swap position between page loads for no reason a user could explain. Fixed by
adding `assessment.createdAt` as a second sort key, so same-day ties resolve to creation
order and stay there.

**D-52. Publishing or superseding a mark left the grid showing the pre-publish/pre-correction
value indefinitely, in the same browser session that entered the original draft.**
`displayValue` always prefers a local draft-store entry over the server's own mark value, and
nothing cleared that local entry once the server value it shadowed became stale — `flush()`
only clears *rejected* entries, and the initial per-class load effect is the only place that
ever called `reconcileDraftGroup`. `onPublish` and the supersede `onSubmit` handler each
refetch the gradebook afterward but never reconciled the draft store against that fresh
response, so the just-published or just-corrected cell kept showing the old number until the
teacher navigated away and back. Fixed by calling `reconcileDraftGroup(groupKey, g.marks)`
right after both of those refetches, exactly as the initial load already does.

**D-53. GB-12's mobile gradebook — a genuine per-student list with a bottom sheet, not the
desktop grid narrowed and left to scroll — is built as its own pair of components
(`MobileStudentList`, `StudentMarksSheet`) below the `tablet` (768px) breakpoint, sharing
every draft/commit/publish/history callback the desktop `GradebookGrid` uses.** The
interactive design prototype (`Tessera.dc.html`) only ever renders one continuous grid at a
narrower `gbMinW` with a shared floating keypad overlay, not a literal list-plus-sheet
structure — but both the roadmap and the PRD state GB-12 explicitly and identically ("below
768px the grid becomes a per-student list; tapping opens their marks as a bottom sheet"), and
the `T` dictionary already carries `scr.gb.listHint` ("tap the student to edit their marks")
and `scr.gb.close`, copy with no other use anywhere in the app — strong evidence the written
spec, not the prototype's simplified interactivity, is the intended target here. Editing
inside the sheet uses the same tap-picker pattern `SupersedeDialog` already established
(GB-9: the tap picker is primary on mobile) rather than the keyboard state machine, which
assumes a physical keyboard the mobile layout cannot.

## 2026-08-26 — Neon cutover

**D-54. The Neon cutover described in D-3 is done: `DATABASE_URL` now points at the Neon
project, and the local Postgres cluster's connection string is kept as `LOCAL_DATABASE_URL`
for offline dev and rollback only.** No code change was needed — `db/client.ts` already
branched SSL config on whether `DATABASE_URL` resolves to localhost, built at the time of D-3
specifically so this swap would be a one-line `.env` change. Verified with a real login
against the Neon-backed API (`t02@tessera-demo.am`), returning a correct teacher profile.
Neon was found to already contain the same schema and an independently-seeded dataset
matching local in shape (student/teacher/class/enrollment counts identical; assessment and
mark counts differ by a handful, and every row's own id differs — a separate seeding run
from the same generator, not a copy of local's data) — not verified or produced by this
build; presumably seeded by the user directly against the Neon project. Per D-3's own
closing line, C2's full "never alter, never drop" discipline is now in effect for real,
since this database is the one `DATABASE_URL` actually points at.

**D-55. The gradebook's own Armenian-collation query (Phase 8, `findStudentsForClass`)
500'd against Neon the first time it actually ran there — the only real functional
casualty the cutover surfaced.** Postgres 17 (local dev) registers an ICU collation under
both its short alias (`"hy-AM"`) and its canonical name (`"hy-AM-x-icu"`); Postgres 18
(Neon's version) only registers the canonical form, so the bare alias this code used
raised `collation "hy-AM" for encoding "UTF8" does not exist` — silently, since the shared
error handler's `isPgError` branch (any object with a `.code` property, not necessarily a
real Postgres error) mapped it to a generic `INTERNAL` with no logging at all, which is
why finding it took adding a temporary file-based dump rather than reading a log line.
Fixed two things: the query now collates against `"hy-AM-x-icu"` (confirmed present under
that exact name on both Postgres 17 and 18 by querying `pg_collation` directly on each),
and the `isPgError` branch now logs whenever it falls through to the generic `INTERNAL`
code, so a future unmapped Postgres error is visible without repeating this exercise.

## 2026-08-26 — Phase 11 (Iter), built early

**D-56. Iter is built now, in full — entry point, panel, real generated replies — well
ahead of its place in the roadmap's own phase order (Phase 11 of 14; this build has only
reached Phase 8), at the user's explicit direction after being shown the roadmap's own
stated reason for stopping short of a real model connection.** Phase 11 as written ships
the interface with `reply` always `null` and a client-side "not connected yet" line,
specifically because IT-11/S-14 flag an unresolved legal question — Iter reads the
academic records of minors, and where the model runs, what leaves the country, and
whether the provider retains prompts were never settled. The user was shown this exact
reasoning and chose to connect Google's Gemini API anyway; this entry records that the
override was deliberate and informed, not an oversight. The two design decisions the
roadmap left open specifically because of this — message retention and model choice — are
resolved by D-57 and this note, respectively; the underlying legal question itself (data
residency, cross-border transfer, provider retention terms for a minors' data platform) is
a business/legal decision this build cannot resolve on its own and was not asked to.

**D-57. No `iter_message` table, and no server-side message storage of any kind — chat
history lives in the browser (IndexedDB), replayed to the model on every request instead
of being read back from a database.** Given the choice between adding the schema the
roadmap's own design assumed (breaking this build's unbroken no-schema-changes record) and
keeping every message server-side-stateless, the user chose the latter, specifically
because it sidesteps both problems D-56 raises at once: no schema change, and no server-side
retention question for data about minors that this build has no authority to answer. The
backend endpoint (`POST /api/iter/messages`) takes the full prior conversation as part of
the request and returns only a reply — nothing is written to Postgres.

**D-58. Iter answers from the caller's own real data, fetched through the existing
read-only services (`record.getRecord` for a student, `gradebook.getTeacherClasses` for a
teacher), not from a generic knowledge-free prompt.** The roadmap's own disclaimer copy
("Iter reads only your own record") is a real constraint here, not decoration: the service
never accepts a different student's or teacher's id, and a failure to fetch context
degrades to answering without it rather than failing the request — a student asking "which
subject am I falling behind in" gets a real, grounded average-and-trend answer, not a
generic non-answer. Admin gets no equivalent context fetch (no admin-facing read service
existed to reuse, and the design source defines no admin suggestion chips either); its
three suggestion chips are authored fresh, scoped to questions answerable from general
knowledge of the product rather than live data.

**D-59. Two real bugs surfaced by testing Iter itself, both fixed.** The floating launcher
button stayed mounted (and above, via z-index) while its own panel was open, so on desktop
— where the panel is a right-anchored sheet, not a full-screen overlay — the button sat
inside the panel and intercepted clicks on the composer's send button; fixed by hiding the
launcher whenever the panel is open, the standard pattern for this class of widget. The
Postgres-error-swallowing gap D-55 already describes was found *through* this testing, not
during it, but is recorded there rather than twice.

**D-60. The model is `gemini-3.6-flash`, not `gemini-2.5-flash`.** The latter returned a
`404` from Google's API stating it is "no longer available to new users," naming
`gemini-3.6-flash` as its replacement — a straightforward consequence of building against
a model catalog that moves faster than any fixed reference, not a design decision.

## 2026-08-26 — Mobile shell: the floating nav and Iter button weren't actually floating

**D-61. On any screen taller than one viewport, the pill nav and the Iter launcher button
render at a fixed position within the page's own content height, not the viewport —
meaning on a long screen they sit far below the fold, invisible until the user scrolls all
the way down, and on a short screen they can render partially off the top.** Found via a
requested audit at a real 390px viewport width, not by inspection: `/subjects` (a genuinely
tall list) showed no pill nav at all in the initial view; measuring confirmed the mobile
content wrapper (`app-shell.tsx`, `className="relative h-full overflow-y-auto"`) had a
*measured* height equal to its own content (1040px on `/subjects`, 1212px on `/settings`),
not the 844px viewport, because `h-full` (100%) has no ancestor with a *definite* height to
resolve against — `<body>` (`app/layout.tsx`) was `min-h-full`, letting it grow to fit
content instead of staying pinned to the viewport. Both the pill nav and the Iter button are
`position: absolute; bottom: Npx` inside that wrapper, so they inherited whatever height the
wrapper actually ended up being. Fixed by changing body to `h-full` (a *definite* 100%, not
a floor) — confirmed this doesn't affect the desktop layout (native page scroll still works;
`height: 100%` doesn't imply `overflow: hidden`) or the desktop "preview mobile" `PhoneFrame`
mode (its content slot gives `h-full` an explicit pixel height of its own, taking precedence
over `body` regardless of `body`'s value, which is exactly why that mode was never affected
by this bug in the first place).

**D-62. Separately, the pill nav's own outer wrapper had a `className="absolute ..."` and an
inline `style={{ position: "relative" }}` on the same element — the inline style always wins,
so the wrapper was never actually `position: absolute` at all, only `relative` (an offset
from its own normal-flow position, not an anchor to a container edge).** This alone would
have kept the pill nav from floating even after D-61's fix. Likely origin: the inline style
was added so the docked QR/`+` button (itself `position: absolute`) would have a positioned
ancestor to anchor against — but the `absolute` class already sitting on the same element
serves that purpose equally well, so the fix is simply removing the redundant, conflicting
inline style rather than reconciling the two.

**D-63. Fixing D-61 changed how the Iter button's own overlay is layered, in a way worth
recording.** The launcher and its panel background are new this project (Phase 11, built
early); once the mobile content wrapper is genuinely viewport-sized, a `position: absolute`
overlay is layered by CSS *after* every `position: static` sibling within the same stacking
context, regardless of DOM order — so an overlay placed early in the DOM can still paint on
top of later, unpositioned siblings. This surfaced while implementing D-64 (the Iter panel's
own background), not D-61 directly, but is the same mechanism: every sibling meant to sit
*above* a positioned background overlay in this codebase needs its own `position: relative`
(or better), not just DOM order, once it shares a stacking context with that overlay.

## 2026-08-26 — Iter's empty-state background (brief-chain/06-corrections-4 §2)

**D-64. The Iter empty state's background — two drifting radial blooms fading to nothing
well inside the panel, no visible edge anywhere — is implemented per the brief's later
correction, not the interactive prototype's own (smaller, earlier) values.** `Tessera.dc.html`
renders this same empty state with ellipse sizes `48% 46%`/`40% 38%`; `06-corrections-4` §2 —
chronologically later in the nine-file brief chain — explicitly replaces an even earlier
"flat teal rectangle with a hard edge" with `120% 80%`/`100% 70%` ellipses instead, and is
explicit that the fade must complete well inside the panel with no visible edge anywhere.
Built to the correction's exact values, not the prototype's.

**D-65. The background is sized to the whole panel, not the smaller centered flex box the
mark/greeting/chips sit in.** The first attempt scoped the two gradient layers to that inner
box alone; because a percentage-based `ellipse` radius is relative to *its own containing
block*, constraining it to a box only as tall as its own content (a `flex-1` row centered
between the header and composer) made the vertical radius small enough that the `transparent`
stop never actually completed before the box's own edge — producing exactly the hard cutoff
the correction was written to eliminate. Confirmed by screenshot, not by calculation alone.
Moving the background to the full panel (sibling to the header, message list, and composer,
each of which needed its own `position: relative` per D-63) gives the same percentages a tall
enough canvas for the fade to complete naturally, matching the brief's own phrasing — "both
sit on the panel's normal glass background" — literally.

**D-66. Grain reuses the existing `<Grain/>` component (`components/design/grain.tsx`,
built in Phase 4) rather than a second inline `feTurbulence` layer.** The two new colors this
background needed — `--iter-mid` (the thinking pill's own middle conic-gradient stop) and
reusing the already-tokenized `--qr-bloom-1` for the teal bloom — went into `tessera.css`
rather than being inlined, keeping `tokens:check` meaningful. `IterMark`/greeting/second line
are pinned to a fixed white (`--iter-fg`, already defined for the launcher button's own icon)
rather than the theme's `--ink`, because the brief is explicit they render "all in white"
regardless of theme — a saturated bloom needs a fixed-contrast label, not a theme-following one.

## 2026-08-26 — Phase 9 (Export)

**D-70. Institution-wide export took over 60 seconds against Neon, failing the roadmap's
own "under 10 seconds" requirement.** The first implementation fetched every unit's data
(roster, assessments, marks) with fully sequential `await`s, one round-trip at a time,
against a remote database — and re-fetched the same class's roster once per subject it
teaches, instead of once per class. Fixed with a bounded-concurrency worker pool
(`lib/concurrency.ts`'s `mapWithConcurrency`, capped at 8, below the DB pool's max of 10)
around both the mark-counting step and the per-unit data-loading step, plus a `Map`-based
roster cache keyed by class id so a class shared by several subjects only fetches its
roster once. Brought a real institution-wide export from ~60s to 7.15s (xlsx) and 5.4s
(csv/zip) — measured directly against Neon, not estimated.

**D-71. `@types/archiver@8.0.0` doesn't match the installed `archiver@5.3.2` runtime.**
The v8 types describe a class-based API the v5 runtime doesn't have, producing a
"no default export" type error on an import that works fine at runtime. Pinned
`@types/archiver` to `5.3.4` instead — a reminder that this package's major version numbers
don't track the runtime package's own majors.

**D-72. No natural `EXPORT_NO_PUBLISHED_MARKS` scenario exists in the seed data.** Queried
the seed directly, twice — once for an assigned class/subject/term with no published marks,
once for a class/subject with no teaching assignment at all — and both come back empty
everywhere; the seed is fully dense. Rather than destructively editing real seed data to
manufacture a test case, this path is code-reviewed but not empirically exercised, the same
gap and the same reasoning as Phase 7's D-43.

**D-73. Export filenames carry Armenian text, which plain ASCII `Content-Disposition`
headers can't.** Sent both forms per RFC 5987 — an ASCII-transliterated `filename=` for
old clients, and the real UTF-8 name (percent-encoded) as `filename*=UTF-8''...` for
everything else — rather than transliterating everywhere, which would make every
downloaded file's name unreadable in its own language. The transliteration table
(`lib/transliterate.ts`) exists solely to feed that ASCII fallback.

**D-74. The download button can't use a plain `<a href>`.** The access token lives only in
memory (no cookie a plain navigation would send), so a bare link to `/api/export` would hit
an unauthenticated route. Instead the button calls the export endpoint through the app's own
`apiFetch` (reusing its existing 401-retry-on-refresh logic), reads the real filename back
out of the response's `Content-Disposition` header, turns the response body into a
`Blob`/`createObjectURL`, and clicks a throwaway anchor programmatically — the standard
pattern for an authenticated file download in an SPA.

## 2026-08-26 — Three more design-brief corrections applied

**D-67. The Iter thinking ring was built from an outdated round of the brief chain.**
`brief-chain/04-corrections-2` ("THE THINKING RING") supersedes the version this build
originally read, in two ways: four conic-gradient colour stops (`--accent-tint`,
`--qr-bloom-1`, `--iter-mid`, `--iter-bloom-1`), not the five-stop repeating-loop version
built earlier this phase, and a 2s rotation, not 1400ms. Rebuilt to the corrected spec: a
`::before` carrying the gradient at a negative inset with the pill's own opaque background
masking its centre (rather than the earlier two-`<div>` approach), sized like a short
message bubble rather than a fixed 90px, 5px dots, and explicit 180ms-in/140ms-out fades —
the last of which needed the component to own a brief `mounted`/`exiting` state internally
(a delayed unmount) since nothing in this codebase already had an exit-transition pattern to
copy.

**D-68. Fixing the thinking ring surfaced a project-wide bug: `font-mono` was never actually
JetBrains Mono.** `app/layout.tsx` loaded `Geist_Mono` and `globals.css` pointed `--font-mono`
at it — meaning every `font-mono` in the app (mark cells, timestamps, the language pill,
the thinking ring itself) rendered in Geist Mono. The design brief is explicit and singular
about this ("Noto Serif Armenian for headings, Noto Sans Armenian for body, **JetBrains Mono
for marks**," brief §4) — not a per-component choice. Fixed at the root: swapped the loader
to `JetBrains_Mono` and renamed the CSS variable it feeds (`--font-jetbrains-mono`) so it
no longer claims to be a font it isn't.

**D-69. The language control's active-fill colour got its own token
(`--lang-pill-fill`) instead of reusing `--hair-bright`.** The existing implementation
already matched most of `corrections-2` §3 (short HY/EN/RU codes, sliding 200ms fill,
Settings-only caption with the full autonym) — measuring it directly showed the *only* real
gaps were the font (D-68 fixed this for free) and the fill opacity: `--hair-bright` is
`.18`/`.13` (dark/light), a general-purpose token tuned for hairline borders, while the
correction gives this one control a precise `rgba(255,255,255,.14)` **on dark**. Added
`--lang-pill-fill` at exactly `.14`, same value both themes, polarity flipped for light
(the correction only states the dark value; flipping polarity while holding opacity fixed is
the natural reading, matching how `--hair`/`--hair-bright` themselves already flip). Also
added the hover state (`--ink-3` → `--ink-2`) the correction specifies for inactive
segments, which the existing implementation never had at all.

## 2026-08-26 — The login opening sequence (corrections-5 §3)

**D-75. Built the splash→login handoff Phase 4 explicitly deferred.** Phase 4's own
notes flagged this: "the full splash→login motion handoff (brief §13.2) were not built —
revisit if a later phase's own Done-when needs the rest." `brief-chain/07-corrections-5`
§3 is that later need. Built as `components/auth/opening-sequence.tsx`
(`useOpeningSequence` + `OpeningOverlay`), wired into the login page only: a 1100ms splash
(full mesh + grain + centred lockup, reusing the mesh entry bloom from corrections-3 §2.1
via `GradientMesh`'s new `animateEntry` prop), then an 1100-1900ms transition in which the
overlay lockup travels — via a measured-`getBoundingClientRect()` FLIP, not a hand-computed
position — to wherever the login screen's own (real, momentarily-invisible) Mark element
actually sits, before the overlay is swapped for that real element. Once per session
(`sessionStorage`), skipped entirely under `prefers-reduced-motion`.

**D-76. The complete "lockup" (glyph, spark, and the typeset letters) does not exist as a
component, so the splash travels the icon-only `Mark`, not the full wordmark.** Phase 4's
own notes already flagged this as unresolved ("the wordmark's body typeface is unresolved
in the design source itself... do not treat [the plain serif fallback] as the final
choice"). Building the real lockup (with the precise baseline/x-height/overlap rules from
corrections-3 §1 and corrections-5 §1) is a separate, nontrivial typographic task this pass
did not take on. When it exists, `OpeningOverlay` should render it instead of `Mark` — the
travel/measurement logic doesn't otherwise change.

**D-77. On the desktop split layout, "nothing else on it" during the splash is not fully
true.** The brief's splash step assumes one full-screen surface; this app's desktop login
is a 52/48 split where the right column is an opaque flat panel that Phase 4 already
renders unconditionally (`bg-raised`, no mesh, ≥900px). Making that panel itself appear
only at the transition would need the mesh's own container to resize from full-viewport
down to 52%-width without visibly relaying out its blobs — a materially bigger task than
this pass's scope. Accepted as a documented gap: on desktop, the flat right panel is
visible from the first frame; the lockup travel, entry bloom, and card/demo timing are
otherwise unaffected and correct on both layouts.

**D-78. A real bug: the splash silently skipped itself on every load, in dev.** React
Strict Mode's mount→cleanup→mount effect double-invoke meant the first (discarded)
invocation wrote the "seen" flag to `sessionStorage` before the second (surviving)
invocation read it back — so the effect that actually persisted always saw a session
already marked "seen" and jumped straight to the fully-revealed state. Fixed by caching
the pre-write decision in a `useRef`, computed once and reused across the double-invoke,
rather than re-reading the (by then self-mutated) `sessionStorage` value on each
invocation.

**D-79. A second real bug: the lockup's travel kept restarting instead of running once.**
`OpeningOverlay`'s measurement effect depended on a `targetRefs` array passed as an inline
literal from the login page — a new array identity on every render, including the
re-renders `cardVisible`/`demoVisible`'s own timers triggered mid-transition. Each
re-render re-ran the effect, re-measured, and reset the 700ms CSS transition from
whatever position the lockup happened to be in at that moment, so by the time the overlay
unmounted at `revealed` the travel had never actually finished. Caught by logging the
effect's own invocations, not by watching it visually — the wall-clock delay this dev
environment's hydration/compile overhead adds (confirmed independently, by instrumenting
`performance`-relative timestamps, to be large and inconsistent between runs) made
screenshot-based timing sampling alone too unreliable to trust as the primary signal.
Fixed by memoizing the ref array (`useMemo`) in the login page so its identity is stable
across renders; verified via the same instrumentation that the measurement effect now
fires exactly once per transition.

## 2026-08-26 — Login screen corrections and an auth-guard gap

**D-80. `text-transform: uppercase` removed from every Armenian-capable label except the
language pill.** Nine real violations, all bound to translatable `t.*` strings (Settings'
four section headers, the demo-row label, the gradebook grid's two column headers, the ID
card's three labels, Export's two headers, the teacher ID card's role label) — forced
uppercase breaks Armenian legibility and was never how the script is set. Two
non-Armenian spots (`/dev/tokens`'s hardcoded English headers, the xlsx/csv format
toggle/cell) lost it too, per the user's explicit "everywhere except the pill" rule rather
than carving out a second exception myself. Existing `tracking-wide`/`--ink-3` styling on
each was already the emphasis mechanism the correction asked for — removing `uppercase`
was the only change needed anywhere.

**D-81. `auth.title` fixed to a single word, and a duplicated string separated.** "Մուտք
համակարգ" (two bare nominatives) is grammatically wrong; changed to "Մուտք" — matching en's
"Sign in" and ru's already-correct "Вход в систему" (a preposition + accusative, not the
same bug). Scanned all 340 keys across the three locale files for the same bare-noun-pair
pattern; found no other instance. Separately, the login page's left panel was showing
`auth.sub` (the form's own subhead, duplicated across both columns) instead of its own
distinct v2.1 Fix 4 line — added a new key, `auth.tagline`, with hy verbatim from the
brief and my own en/ru translations (the design source is Armenian-only for this string).

**D-82. The mesh bleeds across the 52/48 seam instead of stopping at it (user's explicit
override of a brief gap).** The desktop login's right column was flat `--bg-raised` right
up to a hard vertical line at the column boundary — a real "you can point at where the
colour ends" violation of the brief's own no-visible-edge rule. Rather than extending a
full second `GradientMesh` instance into the right column (whose blob positions are
percentages of their own container and would render wrong cropped shapes at a narrow
width), added one small radial-gradient wash anchored at the seam (`left:0`, reusing
`--mesh-2`, fading to transparent within its own 420px box) as an early child of the right
column — painting on top of that column's own flat background by ordinary box-nesting,
with no separate z-index bookkeeping needed. Verified via a cropped screenshot at the seam
that no edge is visible, at both a normal and a short (700px) viewport height.

**D-83. Rebuilt both login columns with `grid; place-items: center`, not flex with
margins — the flex version was pushing content above the viewport on short screens (v2.1
Fix 5).** This is also what let the (now-fixed) two-line heading get clipped at the top:
flex `items-center` centers a too-tall block by pushing it equally off both edges, and
`overflow:hidden` on the shell then clips whichever edge is currently off-screen. Verified
at 900×700 (short) and 1300×900 — no clipping, no wrap, heading fully visible with
comfortable margin from the top in both.

**D-84. The left panel still renders the bare `Mark`, not `LOCKUP-INTEGRATED`.** Building
the real 200px-wide integrated wordmark (glyph + tucked "e" + spark + typeset second "s" +
"era") needs a chosen typeface, and per corrections-2 §2 ("do not pick one yourself") that
choice is the user's, not mine — I built and published a six-candidate comparison
(essera-typeface-trials artifact) rather than picking one. This is the one open item of
the five reported; the other four are complete.

**D-85. A real gap: `requirePasswordChanged` was wired into only 2 of 8 authenticated
routers.** `admin` and `auth` had it; `record`, `gradebook`, `export`, `iter`,
`credentials`, and `identity`'s two user-auth`d routes, plus `/api/me/preferences`
(defined directly in `app.ts`, not a router), did not — meaning a user with
`mustChangePassword=true` could call the gradebook, export, Iter, credentials, or record
APIs directly (curl, bypassing the frontend's `AuthGate` entirely) despite AUTH-7's intent
that only `/api/me`, `/api/auth/logout`, and `/api/auth/password/change` stay reachable.
Wired the existing middleware into all of them. Verified live: a `mustChangePassword`
account's real access token gets `AUTH_PASSWORD_CHANGE_REQUIRED` from all eight now-guarded
endpoints, while `/api/me`, logout (204), and password/change (reaches its own real
`AUTH_CURRENT_PASSWORD_INVALID` check, not the guard) stay reachable.

**D-86. `/first-login` gained a sign-out escape, not a back link.** A plain link back to
`/login` would leave the still-valid session alive — typing `/overview` by hand would then
enter the app without ever changing the password, since the guard only fires from
`AuthGate`'s own redirect logic, not from URL navigation itself removing the token. Added
a plain-text `--ink-3` button (label `auth.signOut` — "Ելք"/"Sign out"/"Выйти", deliberately
not reusing `common.logout`'s fuller phrasing) that calls the real logout endpoint before
navigating. Verified live via a real browser session: sign-out lands on `/login`, and a
direct post-sign-out navigation to `/overview` also lands on `/login` (not `/first-login`),
confirming the server-side session was actually revoked, not just cleared client-side.

## 2026-08-26 — The login screen as one surface, not two columns

**D-87. The login screen is now one continuous full-bleed surface, not a 52/48 split with
a mesh bled across the join (user's explicit override).** Two prior attempts at softening
the seam between the columns (a small radial patch, then a masked bleed layer) both still
read as an edge, because each was a second, separately-authored gradient that had no reason
to agree with whatever the *other*, independently-clipped mesh measured at its own cut
point. The fix was architectural, not another blend: there is no right column and no left
column anymore, only one `GradientMesh` spanning the full viewport behind everything, with
two content groups (`display:grid;grid-template-columns:1fr 1fr;place-items:center`)
positioned on top of it. This explicitly overrides `tessera-v2-FINAL (3).md` §8bis ("right
48% — flat `--bg-raised`, no gradient, no glass") and the v2.1 corrections' own column
split — the override is deliberate and instructed, not an oversight.

**D-88. The form's surface is three-layer glass (`GlassLayered`), not a flat panel —
because it now sits directly on a gradient rather than `--bg-raised`.** Extracted as a
shared component (`components/design/glass-layered.tsx`) rather than inlined twice, since
the pill nav (D-89) needs the identical technique. Two real construction mistakes were
found and fixed along the way, both from measuring an actual screenshot, not reasoning
about the CSS in the abstract:
1. The frosted layer 2 was sized *larger* than layer 1 (a `-4px` inset) with no
   `overflow:hidden` on the outer wrapper — the opposite of "nothing extends past the
   container's radius." Fixed by making the outer wrapper the single source of clipping
   (`overflow:hidden` + the card's own radius), so no inner layer's own sizing can ever
   cause a visible protrusion, regardless of what that sizing is.
2. Layer 1 (the solid `#0D1017` object) was first sized to whole large fractions of the
   card (45%, then even bigger). A 22px backdrop-filter blur only softens what's within
   roughly a blur-radius of an edge — a block that large has an interior nowhere near any
   edge, which reads as flat opaque colour no matter how translucent layer 2 above it is.
   Fixed by sizing it to a small, fixed-pixel corner accent (56×56px) — comfortably within
   blur's actual reach in both dimensions — so the whole thing genuinely reads as
   *softened*, and the real mesh, not this layer, is what's behind the rest of the card
   for layer 2's blur to act on.

**D-89. The mobile pill nav's glass rebuilt with the same `GlassLayered` component,
replacing the single-div `.glass-panel` utility for this one instance.** `.glass-panel`
approximates glass with `backdrop-filter` alone on one flat translucent div — correct
enough where it's already used (settings sections, dialogs), but insufficient for a
surface the brief specifically calls out ("a single translucent rectangle is a grey box,
not glass") — the pill nav is exactly that call-out's target. Structure (the `1fr 78px
1fr` grid, the docked QR button at 58px with its 5px background-coloured ring) is
unchanged; only the background surface itself is now the three-layer technique.

**D-90. Locale detection now checks `Accept-Language` (via `navigator.languages`) before
falling back to Armenian, instead of defaulting to Armenian unconditionally whenever
nothing is already stored.** Armenian still wins whenever nothing in the browser's
language list resolves to `en` or `ru` specifically — this is an *additional* first-visit
signal ahead of the hy default, not a replacement for it, and an explicit stored choice
(`localStorage`) always wins over both. Verified with three real Playwright contexts: no
locale override (falls through to whatever the browser's own default reports), `en-US`
(picks `en`), and a non-matching `fr-FR` (falls back to `hy`).

