# Phase 5 — Administration setup

Source: `docs/reference/tessera-roadmap.md`, Phase 5. Real gaps, bugs, and decisions found
and resolved during this phase are recorded in `docs/decisions.md` D-21 through D-27.

## Delivers

A director sets the school up in one sitting, imports six hundred students from a
spreadsheet after seeing every problem before anything is written, and prints a login
sheet per class. The largest area of new work in the project (roadmap, PRD §16 risk 4).

## What was built

**Backend** (`backend/src/modules/admin/`): `repo.ts`, `validation.ts`, `xlsx.ts` (template
generation and upload parsing via `exceljs`), `import-validation.ts` (the row-level
validators — the same functions run at preview, at every row patch, and again at apply, so
apply can never resolve a row differently than what was reviewed on screen, D-23),
`temp-password.ts` (unambiguous-charset temporary passwords), `service.ts`, `routes.ts`.
`http/middleware/require-admin.ts` gates the whole router — `FORBIDDEN` for a non-admin
token, not a 404 (the not-found *experience* is a frontend-only choice). Every route
resolves "the actor's institution" through `resolveActorInstitutionId` (D-21, since no
schema link exists at all). `db/pg-errors.ts` gained `CLASS_ALREADY_EXISTS` for the
single-class-create collision the generator's own pre-check doesn't cover.

Full endpoint surface from the roadmap's table: institution, academic years, terms,
subjects, classes + generator, roster + mid-year add + enrollment transitions, teacher
assignments, and the whole import pipeline (template → upload/preview → row patch → apply
→ discard) plus credential reissue. `backend/src/index.ts` now sets
`UV_THREADPOOL_SIZE = os.cpus().length - 1` before any other import, for real parallel
Argon2id hashing during bulk apply (D-25).

**Frontend** (`frontend/src/app/(app)/admin/`, `frontend/src/components/admin/`): every
screen the roadmap names — `/admin` (setup checklist), `/institution`, `/years`,
`/subjects` (inline three-language table), `/classes` (with `ClassGenerator`'s live
name-preview before pressing), `/import/students`, `/import/teachers` (`ImportDropzone`,
template link above the drop zone), `/import/[batchId]` (`ImportPreviewTable` — virtualized
via `@tanstack/react-virtual`, filter chips defaulting to Errors, row state as an icon *and*
a border, inline cell edit with `PATCH` on blur), `/assignments` (`AssignmentGrid` — pinned
header row and first column, subject chips), `/handout/[classId]` (A4 print stylesheet,
black on white), `/roster` (transfer/depart dialogs). `(app)/admin/layout.tsx` calls
Next's `notFound()` for a non-admin — no redirect that would reveal the route exists.
Full token layer, no glass, no gradient, no grain, higher density throughout, per C13 —
these screens have no design precedent at all.

## Real bugs found and fixed while building and testing this phase

**Teacher import silently dropped every `teaching_assignment` row.** The first draft of
`applyTeacherImport` inserted `user`/`teacher` rows and stopped — it never used the
resolved `subjectId`/`classIds` from validation to create the assignment rows the roadmap
explicitly requires and tests (Done-when #12: `select count(*) from teaching_assignment`
must match). Caught by re-reading the function against the roadmap before running it, not
by the test failing. Fixed, and then verified directly: 8 teachers with 3–5 classes each
produced exactly the expected 26 rows.

**Student apply's class resolution duplicated, rather than reused, the row validator's own
logic** — re-deriving `classId` from the raw class-label text with its own parsing instead
of calling `validateStudentRow` again. Harmless while the two implementations agreed, but a
latent source of exactly the kind of drift D-23 is about. Fixed to re-run the real
validators during apply.

**The theme/background bug's sibling, this time in the roster screen.** `GET
/api/admin/roster` has no academic-year filter at all (matching the roadmap's own spec),
so an unfiltered fetch returns every student the institution has ever had. The roster page
resolved class *labels* only against the current year's own class list, so any student
whose class belonged to a different year rendered with an unresolvable `?` instead of a
label. Caught by screenshotting the page, not by any check. Fixed by filtering the
unfiltered roster client-side to the current year's own class IDs when no explicit class
filter is chosen.

**The achromatic-accent-tint mechanism from Phase 4 was reused correctly here, not
re-broken** — worth noting only because this phase's own testing (via `/dev/tokens`-style
direct verification) is what originally caught that bug; it stayed fixed.

## Verified directly (not just by inspection)

Against the running API and a real, planted-defect 600-row file, then confirmed against the
database itself, not just the API's own response:

- Institution, one academic year, two terms, ten subjects entered from empty.
- Class generator: grades 9–12 × letters Ա–Դ → 16 created; re-run → 16 skipped, 0 created.
- Template download: real Armenian headers, two example rows, opens in Excel/exceljs
  cleanly.
- 600-row upload with exactly 12 planted defects (3 missing surnames, 2 malformed dates, 2
  unknown classes, 3 duplicated in-file, 2 duplicating an existing student) → preview in
  380ms, `errorCount` exactly 12, every defect's row index and code correct.
- All twelve fixed inline via `PATCH .../rows/:rowIndex` → `errorCount` reaches 0; re-`GET`
  (simulating a reload) shows the fixes persisted.
- Apply → 600 students/users/enrollments created (600, not the roadmap text's own "588" —
  D-26), every new user `must_change_password = true`, zero exceptions; ~13s total,
  including all 600 Argon2id hashes.
- Re-apply the same batch → `IMPORT_BATCH_NOT_PREVIEWING`.
- A second batch with one uncorrected error, applied → `IMPORT_HAS_ERRORS` naming the exact
  row, and `student`/`user` counts confirmed unchanged in the database.
- A renamed `.exe` uploaded as `.xlsx` → `UNSUPPORTED_MEDIA_TYPE`, rejected by real content
  sniffing (`file-type`), not the filename.
- Teacher import, 8 teachers with 3–5 classes each → exactly 26 `teaching_assignment` rows,
  confirmed in the database.
- Roster: transfer (classId changes, status stays active, audit_log entry written),
  depart (status → departed, row never deleted, a second depart correctly rejected with
  `ENROLLMENT_TRANSITION_INVALID`), confirmed via direct query that the departed student's
  row still exists.
- Credential reissue: first call reissues for every active student in a class; after
  manually marking one as already-changed, a second call skips exactly that one with
  `CREDENTIALS_ALREADY_CHANGED` and reissues the rest.
- `FORBIDDEN` confirmed via `curl` with a student's token against an admin endpoint.

Shown in a real browser (screenshots taken, per C13's "shown to the author before moving
on"): the setup checklist, the subjects table, the class generator, the import preview
table (filter chips, per-row error borders and icons, virtualized scroll), the assignment
grid (real seeded teachers × classes, subject chips, pinned header/column), and the roster
table with working transfer/depart controls.

**Not verified in this pass**: the handout screen's actual printed output (the print
stylesheet is written and the screen renders, but printing to PDF and inspecting the result
wasn't done); the `Idempotency-Key` header the roadmap mentions for apply (the
`IMPORT_BATCH_NOT_PREVIEWING` status guard already prevents the double-apply outcome that
header exists to prevent, so it was treated as covered rather than separately implemented).

## Notes for the next phase

- `useCurrentAcademicYear`'s tie-breaking limitation (D-27) — fine for now, revisit if a
  later phase needs to look at more than one year at a time.
- The admin screens are deliberately undecorated (C13) — if a later pass wants to bring
  them closer to the rest of the app's visual language, that's a design decision to make
  explicitly, not an oversight to quietly fix.
