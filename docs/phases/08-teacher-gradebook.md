# Phase 8 — Teacher gradebook

Source: `docs/reference/tessera-roadmap.md`, Phase 8. Real gaps, bugs, and decisions found
and resolved during this phase are recorded in `docs/decisions.md` D-44 through D-53.

## Delivers

A teacher enters a full column of marks with the keyboard alone, checks the work privately,
publishes to the class in one batch, and corrects mistakes afterwards in a way that leaves a
permanent record.

## What was built

**Backend** (`backend/src/modules/gradebook/`): `repo.ts`, `service.ts`, `validation.ts`,
`routes.ts` — `GET /api/teacher/classes`, `GET /api/gradebook`, `POST`/`PATCH`/`DELETE
/api/assessments/:id`, `PUT /api/marks`, `DELETE /api/marks/:id`, `POST /api/marks/publish`,
`POST /api/marks/:id/supersede`, `GET /api/marks/:id/history`. Every route runs
`requireAssignment` against the caller's own `teaching_assignment` row; absent resolves to
`NOT_FOUND`, never a peek at another teacher's class. Drizzle's query builder
(`db.select/update/insert/transaction`) is used everywhere it can safely express the
operation; raw `pool.query` is kept to exactly the three places it can't — the
partial-unique-index `ON CONFLICT ... WHERE` upsert for draft marks, `unnest()`-based batch
delete, and the `hy-AM`-collated student ordering.

A mark is append-only (GB-6): a correction inserts a new row and demotes the superseded one
to `'superseded'` in the same transaction, demote first (D-45), enforced by a partial unique
index rather than application code. Publishing is idempotent by `Idempotency-Key`, the key
and cached result stored inside `audit_log.after` rather than a new column (D-44, C2).

**Frontend** (`frontend/src/components/gradebook/`, `frontend/src/app/(app)/gradebook/`):
`GradebookGrid`, `MarkCell`, `ClassPills`, `PublishDialog`, `PublishSweep`, `SupersedeDialog`,
`CellHistorySheet`, `useGradebookKeyboard`, a module-level IndexedDB-backed draft store
(`draft-store.ts`), and — for GB-12 — `MobileStudentList` + `StudentMarksSheet` below the
768px `tablet` breakpoint (D-53), sharing every callback the desktop grid uses.

`useGradebookKeyboard` is one state machine (GB-8): digits 2–9 fill and advance; `1` waits
400ms for a following `0` to make 10, dimmed while pending; `Backspace` clears and stays;
`Enter`/`↓`, `Shift+Enter`/`↑`, `Tab`/`→`, `Shift+Tab`/`←`, `Home`/`End`, `Escape` all move or
exit; `Enter` at the last row wraps to the first row of the next column;
`scrollIntoView({block:'nearest'})`, never `'center'`. Drafts persist to IndexedDB
synchronously with every edit, independent of the 600ms debounced network flush, so an
unflushed edit survives a crashed tab (GB-3) — verified directly by typing, reloading before
the flush could have fired, and confirming the value is still there.

## Real bugs found and fixed while building and testing this phase

**Keyboard focus never actually moved (D-50).** The grid's `focused` React state advanced
correctly on every keystroke — the outline and `tabIndex` moved — but nothing called
`.focus()` on the real DOM node, so the browser's actual keyboard focus stayed on whichever
cell was first clicked. Every subsequent keystroke, for the whole session, was silently
handled by that first cell's own stale closure. The entire keyboard state machine was
non-functional past the first commit. Confirmed by reading `document.activeElement` directly
after a scripted keystroke, not by watching the UI. Fixed with one `.focus({preventScroll:
true})` call in the existing scroll effect.

**`MarkCell`'s memo comparator went stale when a column's index shifted (D-49).** Once GB-10
lets a new same-day column sort ahead of existing ones (D-51), every later column's index
moves by one without changing that cell's value, state, or focus — the only things the custom
comparator checked — so `React.memo` bailed out and kept rendering the old `pos`, meaning the
old `data-col` and a keyboard handler still bound to the wrong column. Two same-day columns
have to exist simultaneously to see it, which is why it survived until this phase's own
deeper testing. Fixed by adding `pos.row`/`pos.col` to the comparator.

**Same-day assessment columns had no stable order (D-51).** `ORDER BY heldOn` alone gives
Postgres no tie-break; the identical query, run moments apart, returned a same-day pair in a
different order each time. Fixed by adding `createdAt` as a second sort key.

**Publishing or superseding a mark left the grid showing the old value indefinitely, in the
same session that entered it (D-52).** The local draft-store override always wins over the
server's value in `displayValue`, and neither `onPublish` nor the supersede handler
reconciled the draft store against the fresh response they fetched. Fixed by calling
`reconcileDraftGroup` after both.

**`getMarkHistory` had no ownership check at all (D-47)** — any teacher could view any mark's
correction history by id. Found on a second read of the service, not by testing. Fixed with
the same `requireAssignment` check every other route runs.

**`MARK_REASON_REQUIRED` was unreachable — zod's own schema validation rejected an empty
reason first, as the generic `VALIDATION_FAILED` (D-46).** Fixed by relaxing the schema to
`z.string()` and moving the specific check to the service layer, completing the three-layer
pattern (client disable, application code, database constraint) this build uses elsewhere.

**Idempotent publish returned a differently-shaped response on a cache hit (D-44)** — found
by `curl`-ing the same publish request twice and diffing the two bodies. Fixed by reshaping
the cached hit to match a fresh publish exactly.

**Login and first-login redirects were role-blind (D-48)** — both hardcoded `/overview`
regardless of the signed-in role, which could leave a teacher or admin on a silently-403ing
student screen. Found incidentally while diagnosing an unrelated screenshot during this
phase's own testing. Fixed with `landingRouteForRole()`, used at both call sites.

## Verified directly (not just by inspection)

- Every backend behavior in the roadmap's Done-when list that's testable at the API level:
  class listing; `hy-AM`-collated gradebook fetch; batch mark upsert, delete, and rejection;
  the exact concurrent-`PUT` race (scripted two simultaneous writers, confirmed exactly one
  row survives); assessment create/delete with the has-marks guard; idempotent publish
  (byte-identical response on repeat, after the D-44 fix); supersede with all three
  validation layers, including the demote-before-insert ordering (D-45); the full
  mark-history chain; the literal grep checks (`PATCH` route absence; `update(mark` scope).
- The keyboard state machine end to end, in a real browser, after the D-50 fix: digit
  fill-and-advance, `1`+`0` inside 400ms producing 10, a lone `1` committing after the
  timeout with no move, `Backspace` clearing and staying, `Enter`/`Shift+Enter`,
  `Tab`/`Shift+Tab`/arrows across columns, `Home`/`End`, and `Enter`-wrap at the last row —
  each checked against `document.activeElement`, not just the visual outline.
- `+` adds a column with no dialog; `Escape` before any mark on it removes it again, checked
  by column count before and after.
- Publish end to end: the dialog's exact composed copy, confirm closes it with the sweep
  playing and no toast, and the grid reflects the new value correctly (post D-52 fix).
- Supersede end to end: a published cell opens correction, not editing; submit stays
  disabled until both the value changes and a reason is entered; the corrected value shows
  immediately (post D-52 fix); the resulting history sheet shows the real old→new pair, date,
  reason, and actor name.
- Draft persistence across a simulated crash: typed a value, reloaded before the 600ms flush
  could have reached the server, and the value was still there, restored from IndexedDB —
  then reloaded again and confirmed the server now has it too.
- The mobile view (390×844) at the `tablet` breakpoint: the desktop grid absent, the
  per-student list present with the designed hint copy, tapping a student opens the sheet,
  tapping an empty cell opens the tap-picker, and picking a value commits and displays
  correctly.

**Not verified in this pass**: the full light/dark × background × accent colour sweep for the
new `--mark-tile-fg`/grade-colour tiles (relies on Phase 4's existing guarantee, same as
Phase 7); GB-14's export button (wired in Phase 9 per the roadmap, not this one).

## Notes for the next phase

- The mobile `StudentMarksSheet`'s `onExit` is called on every close, not only when a new
  column was just added — it's a no-op unless `newColumnId` is actually set, matching the
  desktop grid's own Escape behavior, but worth knowing if that guard's condition ever
  changes.
- `docs/decisions.md` D-44 through D-53 cover the idempotency storage choice, the supersede
  ordering proof, the two stale-position bugs, the sort-stability fix, the draft
  reconciliation gap, and the GB-12 build decision — read them before touching
  `gradebook-grid.tsx`, `mark-cell.tsx`, or `repo.ts`'s assessment ordering.
