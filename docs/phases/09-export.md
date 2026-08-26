# Phase 9 — Export

Source: `docs/reference/tessera-roadmap.md`, Phase 9. Built after Phase 11 (Iter), out of
roadmap order, continuing the same out-of-order pattern Phase 11 itself used — see
`docs/decisions.md` D-56. Real gaps, bugs, and decisions found and resolved during this
phase are recorded in D-70 through D-74.

## Delivers

A file the school can submit elsewhere: the honest replacement for the EMIS integration the
PRD removed. Enter marks once in the gradebook, then download a file instead of retyping
them into another system.

## What was built

**Backend** (`backend/src/modules/export/`): `GET /api/export` and `GET /api/export/logs`.

- `validation.ts` — `exportQuerySchema` (scope enum `class-subject-term | class-term |
  institution-term`, optional `classId`/`subjectId`, required `termId`, `format` default
  `xlsx`, `locale` default `hy`); `exportLogsQuerySchema` (limit 1-200, default 50).
- `repo.ts` — institution/class/subject/term/teacher lookups, the class roster query
  (duplicated from the gradebook module rather than shared, matching this codebase's
  established module-independence pattern, including the `hy-AM-x-icu` collation fix from
  D-55), published-assessment/mark queries, `export_log` insert/read.
- `sheet.ts` — `buildSheet()` (EXP-3's layout: header rows, a column-header row, one row per
  student with a per-row average, a summary row of per-column averages) and `renderCsv()`
  (UTF-8 BOM + CRLF + fully-quoted RFC 4180 fields, L-8), both pure functions independent of
  HTTP or the database — the roadmap's own `buildSheet(rows, layout)` isolation for the
  still-open EXP-7 question about a school-specific column shape.
- `service.ts` — `resolveUnits()` (scope-based fan-out: `class-subject-term` pins all three;
  `class-term` fans over every subject taught in the class; `institution-term` fans over
  every class×subject pair in the institution, one unit per worksheet/file); `prepareExport()`
  (role/scope authorisation — teacher restricted to their own class-subjects,
  `class-term`/`institution-term` admin-only per the roadmap, `EXPORT_SCOPE_FORBIDDEN` for a
  teacher requesting either; `EXPORT_NO_PUBLISHED_MARKS` when a resolved scope has zero
  published marks; EXP-6 filenames built via `lib/transliterate.ts`'s ASCII table plus the
  real UTF-8 name); `getExportLogs()` (admin-only).
- `writer.ts` — `loadAllUnits()` fetches every resolved unit's data before any writing
  starts; `writeXlsx()` streams via `exceljs`'s `WorkbookWriter` (one worksheet per unit,
  `addRow().commit()` per row, `workbook.commit()` at the end — never holds the whole
  workbook in memory, per the roadmap's explicit reason for choosing `exceljs` over `xlsx`/
  SheetJS); `writeCsv()` streams one CSV per unit through `archiver` as a zip when there is
  more than one unit, a bare CSV when there is exactly one; `writeExport()` sets the dual
  ASCII/UTF-8 `Content-Disposition` (RFC 5987, EXP-6) and dispatches to whichever writer the
  format calls for.
- `lib/concurrency.ts` — `mapWithConcurrency()`, a capped worker-pool helper (see D-70)
  reused by both the mark-counting step and `loadAllUnits()`.
- `lib/transliterate.ts` — an Armenian→Latin character map feeding the ASCII filename
  fallback (see D-73).
- EXP-4 (drafts never leave the product) and EXP-5 (an `export_log` row per export — actor,
  scope jsonb, format, mark count, timestamp) are enforced directly in `prepareExport`/
  `insertExportLog`, not left to the writer.

**Frontend**:

- `lib/api/export.ts` — `downloadExport()`, an auth-aware blob download through the app's
  own `apiFetch` (so it reuses its 401-retry-on-expiry logic; a plain `<a href>` can't carry
  the bearer token, which lives only in memory) — reads the real filename back out of
  `Content-Disposition`, preferring `filename*` over `filename=` per the roadmap.
  `exportApi.{download,getLogs}`.
- `components/export/export-button.tsx` — the gradebook class header's `ExportButton`
  (GB-14: secondary, deliberately not beside Publish), scope pre-filled from the current
  class/subject/term, a plain `exporting` boolean.
- `components/export/export-panel.tsx` — `ExportPanel`, gated by role (`null` for students):
  `TeacherExportForm` (a single class-subject-term dropdown reusing the existing
  `gradebookApi.getClasses()`) and `AdminExportForm` (the full scope radio plus cascading
  academic-year → term/class/subject dropdowns via the existing admin API), sharing a
  `FormatToggle` and `DownloadButton`.
- `components/export/export-log-table.tsx` — the admin-only dense table (`T.exp.logTitle`/
  `logSub`/`marks`/`empty`), built from primitives per C13 (no design precedent exists for
  this screen).
- Wired in: the gradebook class header (`ExportButton`, replacing the old placeholder span)
  and Settings (`ExportPanel`, plus `ExportLogTable` for admins).

## Real bugs found and fixed while building this phase

**Institution-wide export took over 60 seconds (D-70).** Fully sequential per-unit
round-trips against Neon, plus redundant re-fetching of the same class roster once per
subject, failed the roadmap's own "under 10 seconds" requirement outright. Fixed with
bounded concurrency (cap 8) and a shared roster cache; measured institution-wide xlsx at
7.15s and csv/zip at 5.4s afterward, against the real Neon database.

**`@types/archiver@8.0.0` didn't match the installed `archiver@5.3.2` runtime (D-71).**
The v8 types model a class-based API the v5 runtime doesn't expose; pinned to `5.3.4`.

## Verified directly (not just by inspection)

- Every scope (`class-subject-term`, `class-term`, `institution-term`) and both formats
  (`xlsx`, `csv`) exercised end-to-end via direct requests against the running backend
  (Neon-backed), including as both a teacher and an admin account.
- `EXPORT_SCOPE_FORBIDDEN` on a teacher requesting `class-term`/`institution-term`; a
  student request returns `FORBIDDEN`.
- The CSV's first three bytes are the literal UTF-8 BOM (`EF BB BF`), not a text
  approximation of one.
- Drafts (unpublished marks) do not appear in any exported scope or format — checked by
  entering distinctive unpublished values and confirming their absence in the output.
- The dual-filename `Content-Disposition` header (ASCII `filename=` transliterated,
  real-Armenian `filename*=UTF-8''...`) is present and well-formed on every response.
- An `export_log` row is inserted per export, with the right scope jsonb and a `mark_count`
  matching the number of published marks in that export.
- The institution-wide performance fix (D-70), measured directly, not estimated.
- `npx tsc --noEmit`, `npm run lint`, and `npm run tokens:check` all pass on every frontend
  file this phase touched.

**Not verified in this pass**: the file has not been opened in a real desktop Excel or
LibreOffice install (roadmap Done-when items 2-3) — only its bytes and structure were
checked programmatically, which is not the same proof the roadmap's own Done-when list
asks for. `locale=ru` column headers were built against the same `EXPORT_LABELS`
dictionary pattern as `hy`/`en` but not independently eyeballed in a spreadsheet. The
`EXPORT_NO_PUBLISHED_MARKS` path is code-reviewed but not empirically triggered — the seed
data has no scope with zero published marks anywhere in it (D-72), the same kind of gap
Phase 7 documented in D-43. The Settings progress affordance for a slow institution-scope
export exists as the same `exporting` boolean the class-header button uses, not a distinct
progress indicator — acceptable at the 5-7s range measured, but untested at seed sizes
larger than this project's fixtures.

## Notes for the next phase

- EXP-7 (the exact column shape a real school needs) remains explicitly open, per the
  roadmap's own instruction — `buildSheet(rows, layout)` is the one function to change if a
  school-specific layout is ever specified; nothing else in the module should need to move.
- If a later pass adds the real Excel/LibreOffice open-file check the roadmap's Done-when
  list calls for, do it before treating this phase as fully verified — this build stopped at
  programmatic byte/structure checks.
