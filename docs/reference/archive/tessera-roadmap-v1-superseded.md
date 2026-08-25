# Tessera — Implementation Roadmap

**Version 1.0 · Plan of record**

This document expands §16 of `tessera-PRD.md` into executable phases. Where this
document and the PRD disagree on sequencing, this document wins and the conflict is
noted. Where they disagree on *product decisions*, the PRD wins.

---

## 0. Current state

Three things are already finished. The roadmap starts from them, not from zero.

| Asset | State | Consequence |
|---|---|---|
| **Database** | Live on Neon. Schema and seed both applied: 1 institution, 8 classes, 10 subjects, 20 teachers, 200 students, 1121 assessments, 25 606 published marks, 40 superseded with reasons, 12 drafts, 8 credential requests, 4 demo accounts | PRD Phases 0–2 collapse into a single setup phase. **No migrations. No Docker Postgres.** |
| **Design system** | `tessera-v2-FINAL` v2.2 — two palettes, two-layer glass, grain overlay, static QR, docked centre button, eleven widgets | Phase 4 has a token contract to implement against |
| **Design** | Screen package produced in Claude Design, superseded by `corrections-6.md` | Source of truth for screens. Gaps listed in §3 |
| **Logo** | Author's own asymmetric free-form glyph, detached secondary element. Iter mark is a looping open stroke | Fixed colours, independent of user accent. Never inverts |

**Files that must sit in the repository root before the first Claude Code session:**
`tessera-PRD.md`, `tessera-roadmap.md`, `tessera-schema.sql`, `tessera-seed.sql`,
`tessera-design-system.dc.html`, and the design export folder.

---

## 1. Constraints

These override anything in any document that contradicts them.

| # | Constraint |
|---|---|
| **C1** | **Tessera does not integrate with EMIS.** Own database, own data, export files. PRD §6.1. The nullable `emis_id` columns exist and stay empty — they are forward compatibility, not a dependency, and no code reads them |
| **C2** | The database already exists and is populated. **No migrations, no schema changes, no `drizzle-kit push`, and no seed script.** Generate types by introspection and verify against `tessera-schema.sql`. If a change is genuinely needed, stop and ask |
| **C2a** | **Nothing in this project wipes data.** No `npm run seed`, no reset command, no truncate, no drop. PRD §10.6 previously described a wipe-and-refill script; it has been replaced and no longer authorises one. If a document anywhere still implies it, that document is out of date |
| **C2b** | **No new tables.** Where a screen appears to need storage that §10 does not provide, derive it from what exists. The notification feed is the worked example — see Phase 13 |
| **C3** | Backend: Node, Express, TypeScript, Drizzle. Frontend: Next.js, TypeScript, Tailwind. Auth: JWT |
| **C4** | Our backend owns every database interaction. No Neon serverless API, no Supabase, no BaaS |
| **C5** | Single origin. Next.js rewrites proxy `/api/*` to Express. Refresh token httpOnly, Secure, SameSite=Lax, path-scoped to the refresh endpoint. Access token in memory only, never localStorage |
| **C6** | Attachments go to Cloudflare R2 (S3-compatible). **In development, R2 as well** — a separate bucket, not MinIO, so no Docker is required anywhere in this project. Store the object key, never a public URL. Backend issues signed links valid five minutes after checking permission |
| **C7** | Web-first, but **offline is not deferred**. Phase 4 ships the PWA manifest *and* a minimal service worker that precaches the application shell. Phase 14 adds the full caching strategy, install prompt and motion system. The ID must survive a cold start with no network (PRD G1), and a cold start needs the shell from somewhere — IndexedDB holds data, not HTML |
| **C8** | Trilingual hy/en/ru from the first screen the user sees. i18n infrastructure is therefore part of **Phase 3**, not Phase 4. Phase 4 owns the switcher UI and the remaining strings |
| **C9** | Backend returns error codes. The client translates. No user-facing text crosses the API |
| **C10** | Root `package.json` with npm workspaces, `backend/` and `frontend/`, single `npm start` |
| **C11** | Admin screens use the full design system token layer — colours, accent, type scale, spacing grid, buttons, inputs, tables, focus states, empty states. They omit only the decorative layer (glass, gradient, grain) where it harms data density. Same product, different weight |
| **C12** | Git from the first commit. Never mention Claude, AI or any assistant in a commit message, comment, README or any file |
| **C13** | **Email transport: Resend.** `RESEND_API_KEY` and `MAIL_FROM` in `.env`. In development, `MAIL_TRANSPORT=console` prints the reset link to the server log instead of sending, so password recovery is testable without a domain. Password reset is the only email the product sends. See Q9 |
| **C14** | **The `emis` field in the design is Tessera's own identifier, not an EMIS one.** Its label is `Tessera ID` and its format is `TSR-AM-####-####`. It is derived deterministically from `student.id` and is never stored in `emis_student_id`, which stays null and unread (**C1**) |

---

## 2. Phase sequence

Sixteen phases, numbered 0 to 15. Each ends with something that can be opened and
looked at.

| # | Phase | Delivers | Sessions |
|---|---|---|---|
| 0 | Foundation | Repo, workspaces, Drizzle introspection, health check | 1 |
| 1 | Data access layer | Typed repositories, no HTTP yet | 1 |
| 2 | Auth backend | JWT, refresh, rate limiting, sessions | 1–2 |
| 3 | Auth frontend | Login and the four password screens, i18n core | 2 |
| 4 | Shell | Tokens, navigation, theming, language switcher, error and offline states | 2 |
| 5 | Administration | Setup, import with preview, assignments, handout | 3 |
| 6 | Student ID | Card, static QR, offline | 1–2 |
| 7 | Teacher Today | Today's lessons, teacher landing | 1 |
| 8 | Academic record | Mosaic, subject detail, archive, empty states | 2–3 |
| 9 | Gradebook | Multi-class, drafts, keyboard entry, publish, history | 3 |
| 10 | Export | xlsx and csv, three scopes | 1 |
| 11 | Credentials | Submission, upload, queue, decisions | 2 |
| 12 | Iter | Panel, attachments, thinking state, honest line. **No model** | 1–2 |
| 13 | Settings and notifications | Settings groups, notification feed, support, widget gallery | 2 |
| 14 | PWA and motion | Service worker, offline cache, install prompt, motion system | 1–2 |
| 15 | Hardening | Accessibility, performance, deployment, demo accounts live | 2 |

**Changes from PRD §16, and why:**

- Phases 0–2 of the PRD become Phase 0 here. The database exists.
- A **data access layer** phase is inserted. Every later phase depends on typed queries;
  writing them once is cheaper than writing them five times inside route handlers.
- Auth is split into backend and frontend. The PRD's single Phase 3 hid two sessions of
  frontend work behind a backend label.
- **Teacher Today** becomes its own phase. In the design, `today` is a screen in the
  teacher's navigation, not a panel on a card — see §3.
- Iter moves from 11 to 12, Settings from 12 to 13, and so on. Net one extra phase.

---

## 3. Design coverage: what exists, what does not

The design package is the source of truth for screens, and `corrections-6.md` is the
latest state of it. Three categories.

### 3.1 Designed and phased — no action

Login, student ID card, mosaic, subject detail, archive, gradebook, credential queue,
Iter panel, settings groups, widget gallery, eleven widgets, seven accents, four
backgrounds. Static QR — the design has already discarded `id.rotate` and `id.until`,
and the seed generates a fixed seed per student, so these agree.

### 3.2 Designed, but no markup exists — build from primitives

These have complete trilingual strings in `tessera-data.js` but no rendered screen.
They are built in their phase using design system primitives, then reviewed before the
phase closes.

| Screen | Strings present | Phase |
|---|---|---|
| Forgot password — email entry | `recTitle`, `recSub` | 3 |
| Forgot password — sent confirmation | `sentTitle`, `sentBody` | 3 |
| New password with rule checklist | `newTitle`, `req8`, `reqNum`, `reqUp` | 3 |
| Forced first-login change | `firstTitle`, `firstBody` | 3 |
| Field and credential errors | `errField`, `errCreds` | 3 |
| "Forgot password?" link, "Remember this device" | `forgot`, `remember` | 3 |
| Load failure state | `T.err.{title, body, retry}` | 4 |
| Password strength meter | `T.set.s0` | 13 |
| Session-only toggle | `T.set.sessOnly` | 13 |
| PWA install prompt | `T.pwa.{title, body, add}` | 14 |

**Phase 14 of the PRD promises to demo a forced password change.** Without the Phase 3
screens there is nothing to demo, which is why they are not optional.

### 3.3 Administration — ten screens with no design precedent

`role` in the design has two values: `student`, `teacher`. The administrator interface
does not exist in the package at all.

Built in Phase 5 from design system primitives under **C11**. Screens required:

1. Institution setup — name, region, type
2. Academic year and terms
3. Subject list
4. Class generator — grade × letter grid
5. Student import — file picker, column mapping
6. Import preview — row status, inline correction, error filter
7. Teacher import — same shape
8. Teaching assignment matrix — class × subject × teacher
9. Credential handout — generated logins, print view
10. Roster management — search, status change, password reset

**This is the largest area of new work in the project and it is unvalidated.** PRD §17
risk 4 says so explicitly, and PRD Q3 could halve it. See §5.

### 3.4 Corrections that override earlier documents

| Item | Correct state |
|---|---|
| **Teacher ID card** | **Deleted.** `corrections-6.md` §2 removes the ID card and QR from the teacher role entirely. The code implements this: `isId: !isT && st.screen === 'id'`. The teacher's "Քարտ" navigation slot became "Այսօր" |
| **Teacher navigation** | `gradebook · today · queue · archive · settings` |
| **Student navigation** | Card, record, credentials, settings, with the docked centre QR button |
| **Mobile shell** | Take it from the current `Tessera.dc.html`, **not** from `Tessera Mobile v2.dc.html`, which is an older build with no `today` screen and a teacher ID card |
| **Version chain** | `v2-FINAL` → `v2.4-fixes` → `corrections-2…6`. Any reference to "v2.4, the most recent" is out of date |

---

## 4. Phases in detail

---

### Phase 0 · Foundation

**Delivers:** a repository that starts, connects to the live database, and proves it.

**Backend**
- Express + TypeScript, `tsx` in development
- Drizzle configured against `DATABASE_URL`
- `drizzle-kit introspect` generates `backend/src/db/schema.ts` from the live database
- Verify the generated schema against `tessera-schema.sql`: every table, every enum,
  every foreign key, the partial unique index `one_current_mark`, and the check
  constraint `reason_required_when_superseding`. Report any difference; change nothing
- `GET /api/health` returns `{ ok: true, tables: <count> }`

**Frontend**
- Next.js App Router, TypeScript, Tailwind
- `next.config` rewrites `/api/:path*` to the Express port
- One page that calls `/api/health` and renders the result

**Repository**
- Root `package.json`, npm workspaces, `concurrently` for `npm start`
- `.gitignore`: `node_modules`, `.env`, `dist`, `.next`, `build`
- `.env.example` with every variable and placeholder values
- `.env` with `DATABASE_URL` left as a placeholder for the author to fill
- `README.md` with setup steps
- `git init`, initial commit

**Done when:** `npm start` runs both services, the health page shows 21 tables, and the
introspected schema matches `tessera-schema.sql` with zero differences.

**Never:** print, log or commit the connection string.

---

### Phase 1 · Data access layer

**Delivers:** typed repository functions covering every read the product needs. No HTTP.

**Backend only.**

| Repository | Functions |
|---|---|
| `users` | by email, by id, update password, update last login, lock |
| `students` | by user, by class, with enrollment, roster search |
| `teachers` | by user, assignments, classes taught |
| `classes` | by year, with student count |
| `subjects` | by institution |
| `assessments` | by class-subject-term, by teacher, by date range |
| `marks` | current for assessment, history for student-assessment, mosaic for student, class column |
| `credentials` | by student, queue for teacher subject, queue for admin |
| `qr` | by student, by seed, revocation state |
| `audit` | append an entry; read by entity, by actor, by date |
| `scans` | append a scan event; anomaly window query |

**The mark queries carry the product.** Two rules, enforced here so no route handler can
break them:

- "Current mark" means `state in ('draft','published')`. There is exactly one per
  `(assessment_id, student_id)` — the database guarantees it
- History means every row for that pair, ordered by `entered_at`, including superseded

**`audit_log` is written here, once, and called everywhere (S-10).** A single
`audit(actor, action, entityType, entityId, before, after, ip)` helper, invoked by every
mark change, credential decision, permission change, import, export and account action.
Writing it into each phase separately guarantees three of them forget.

**Done when:** a script prints the mosaic for `ani@demo.tessera.am`, the full history for
one superseded mark, and the twelve drafts. Numbers match the SQL run directly. Every
repository that mutates has an audit call and a test proving the row lands.

---

### Phase 2 · Auth backend

**Delivers:** the complete authentication API.

| Endpoint | Behaviour |
|---|---|
| `POST /api/auth/login` | Accepts **email address or institution-issued ID** (AUTH-3). Verifies against `$argon2id$` **or** `$2a$` — the four seeded accounts are bcrypt cost 12, verified in the live database. On a successful bcrypt login, rehash to Argon2id and write back (PRD §11.5.2). Issue access (15 min, memory) and refresh (**30 days, or 90 with "Remember this device"**, httpOnly cookie). Return `must_change_password` |
| `POST /api/auth/refresh` | Rotate refresh token. Reject reused tokens and revoke the family |
| `POST /api/auth/logout` | Revoke this device session |
| `POST /api/auth/forgot` | Always returns 200, whether or not the address exists. Sends the reset link via **C13** |
| `POST /api/auth/reset` | Single-use token, **30 minutes** (AUTH-8). The design's `sentBody` says 30 minutes; an hour would make the interface lie |
| `POST /api/auth/change-password` | Requires current password unless `must_change_password` |
| `GET /api/auth/me` | Current user, role, locale |
| `GET /api/sessions`, `DELETE /api/sessions/:id` | Device list and revocation |

**Rules**
- Rate limit: **six** failed attempts per account per fifteen minutes, then `locked_until`
  for fifteen minutes (AUTH-10, S-7)
- **100 API requests per minute per user** across all endpoints (S-7)
- **60-second resend cooldown** on the forgot-password email (AUTH-8)
- Password rules: minimum eight characters, at least one digit, at least one uppercase —
  matching `req8`, `reqNum`, `reqUp` in the design
- Errors are codes: `AUTH_INVALID_CREDENTIALS`, `AUTH_LOCKED`, `AUTH_TOKEN_EXPIRED`,
  `AUTH_PASSWORD_WEAK`, `AUTH_TOKEN_REUSED`. Never text (**C9**)
- Middleware: `requireAuth`, `requireRole('admin')`, `requireOwnClass`

**Done when:** all four demo accounts log in; `nor@demo.tessera.am` is forced to change;
the sixth wrong attempt is locked out; a reused refresh token kills the family.

---

### Phase 3 · Auth frontend

**Delivers:** every screen a user sees before they are logged in, in three languages.

**Screens** — login (exists in the design), plus the five from §3.2.

**i18n core (C8)**
- `frontend/src/locales/{hy,en,ru}.json`
- Locale from user record after login; before login from the switcher, persisted
- Error codes mapped to messages in all three files
- Armenian is the default and the reference; a missing key in any file is a build error

**Login screen, per the design**
- Sliding segmented HY/EN/RU pill at the top
- Title, subtitle, email and password inputs
- "Forgot password?" link, "Remember this device" checkbox
- Primary button, demo account row, support row

**Done when:** a person can log in, fail, recover, reset and be forced to change — in
Armenian, then in Russian, then in English, with no reload and no untranslated string.

---

### Phase 4 · Shell

**Delivers:** the application frame everything else renders inside.

**Tokens** — implement `tessera-design-system.dc.html` as CSS custom properties:
- Palette Deep and Palette Aura
- Seven accents, muted and desaturated, black default
- `--accent-tint` derived token, so the ID card and Iter button stay visible when the
  accent is black
- `--g1` … `--g10` grade colours, warm red to cool blue, **fixed** — never change with
  theme or accent
- Two-layer glass, grain overlay on every gradient surface, non-optional
- Type scale, spacing grid, radii, focus rings, motion timings

**Shell**
- Floating pill navigation; docked centre button as a sibling, `bottom: 29px`,
  background-colour border, no notch
- **The centre button is role-dependent.** `dockGlyph: isT ? '+' : QR`. For a student it
  opens the QR; for a teacher it is a plus that opens a new gradebook column
  (`corrections-6.md`, Verify). It is never a QR for a teacher — teachers have no card
- **Two different navigations, not one.** The desktop rail and the mobile pill carry
  different items, and Settings is not in the pill — it is the header gear.

  | Role | Desktop rail | Mobile pill | Docked centre |
  |---|---|---|---|
  | Student | `overview · subjects · id · creds · archive · settings` | `overview · subjects · creds · archive` | QR |
  | Teacher | `gradebook · today · queue · archive · settings` | `gradebook · queue · archive · today` | **`+`** |
  | Admin | see §3.3 | — | none |
- Iter floating button, position configurable to header in Settings
- Logo plate stays dark in both themes, never inverts, colours independent of accent

**States**
- Load failure: `T.err.{title, body, retry}` as a reusable component
- Offline banner — **owned here, used everywhere.** Phases 6 and 14 consume it, they do
  not reimplement it
- Skeletons for list and grid

**PWA manifest (C7)** — icons, name, theme colour, standalone display. No service worker.

**Admin shell** — the design has no administrator role, so the frame is defined here,
not only the ten screens in §3.3: a desktop-first sidebar with the section list, the same
header and gear, no docked centre button, no mobile pill. Administrators work at a desk.

**Minimal service worker (C7)** — precache the shell, HTML, CSS, JS and fonts. Nothing
else. The caching strategy for data arrives in Phase 14.

**Web/Mobile preview switch (PL-3)** — `st.mode` in the design. Visible only above
900px, a prototype control for showing the mobile shell on a laptop. It is **not** a user
setting and does not appear in Settings. In scope per PRD §7 and needed for the
demonstration.

**Done when:** every token resolves, both palettes render, all seven accents apply
without breaking the ID card, language switches with no reload, the rail and the pill
each show the correct items for student, teacher and administrator, and a cold start with
the network off renders the shell rather than the browser's offline page.

---

### Phase 5 · Administration

**Delivers:** a school can set itself up without a developer. The buyer's screens.

Built from primitives under **C11**. Ten screens as listed in §3.3.

**Backend**

| Endpoint | Notes |
|---|---|
| `POST/PATCH /api/admin/institution` | |
| `POST /api/admin/years`, `/terms` | |
| `POST /api/admin/subjects` | Trilingual names |
| `POST /api/admin/classes/generate` | Grade range × letters, bulk |
| `POST /api/admin/import/preview` | Parse xlsx/csv, validate, write `import_batch` + `import_row`, return statuses. **Nothing is created yet** |
| `PATCH /api/admin/import/:id/rows/:row` | Fix one row inside the preview |
| `POST /api/admin/import/:id/apply` | Transactional. Creates users, students, enrollments |
| `POST /api/admin/import/:id/discard` | |
| `POST /api/admin/assignments` | Bulk matrix write |
| `GET /api/admin/handout/:batchId` | Generated credentials, print layout |
| `GET /api/admin/roster` | Search, filter, paginate |
| `POST /api/admin/users/:id/reset-password` | |

**The preview is the whole point.** `import_row` exists so an administrator can fix
twelve bad rows out of six hundred instead of re-uploading blindly. Generated passwords
are shown exactly once, on the handout screen, and `must_change_password` is true.

**Done when:** a 600-row file imports in under thirty seconds; twelve deliberately
broken rows are correctable inline; discard leaves the database untouched; the handout
prints.

---

### Phase 6 · Student ID

**Delivers:** the feature that must never fail.

**Screen** — ID card, with the fields the design actually renders: `cardKind`,
`userName`, `cardLine2`, `cardSlotLabel` / `cardSlotValue`, **Tessera ID**, `schoolFull`,
the code line, `note`, and the QR opener.

**There is no photo and no initials on the card.** The avatar in the mobile header is a
different element. Adding a photo would require a schema change, which **C2** forbids.

**Tessera ID (C14)** — displayed on the card and in Settings → Account, format
`TSR-AM-####-####`. Derived deterministically from `student.id`:

```
TSR-AM-<first 4 hex of md5(student.id)>-<next 4 hex>
```

Same student, same identifier, every time, with no schema change and no relation to
`emis_student_id`.

**Backend** — `GET /api/id/me` returns name, class, institution, school full name,
**Tessera ID**, and the QR seed from `qr_credential.seed`.

The seed is authoritative from the database. The design's client-side
`hashId(user.emis + ':' + name)` was a prototype convenience; the seeded value is what
a scanner will have to match, so the client renders what the server sends and derives
nothing.

**Frontend**
- QR generated client-side from the seed. **Static** — same code every time, no
  expiry, no rotation. The design has already discarded `id.rotate` and `id.until`
- Card and seed cached in IndexedDB on first successful load
- On launch with no network: render from cache immediately, show the offline banner
  from Phase 4, never a spinner and never an error

### The verification side

`t.scr.id.sub` — *"Ստուգողը սկանավորում է ծածկագիրը՝ ինքնությունը հաստատելու համար"*. A
card nobody can check is decoration. This half is required, and `scan_event` already
exists in the schema.

**What the QR actually contains (ID-7).** Not the raw seed. The payload is a signed
token, and because the code is static it is signed **once and deterministically**:

```
payload = base64url({ sid, iid, iat }) + "." + HMAC-SHA256(payload, QR_SIGNING_KEY)
```

`sid` is the student id, `iid` the institution id, `iat` the `qr_credential.issued_at`
already stored. Because every input is fixed, the token never changes — which is what
"static QR" means. **No name, no marks, no birth date** in the payload.

`qr_credential.seed` remains the stored identity of the credential and the thing a
revocation acts on. The token is derived from it, never replacing it.

| Endpoint | Behaviour |
|---|---|
| `POST /api/verify` | Verifies signature, checks `revoked_at`, writes `scan_event`, returns name, class, institution, photo-free. Requires a scanner credential |
| `GET /api/verify/anomalies` | Admin view: one credential scanned at two scanner ids inside a short window |

**Error codes:** `SCANNER_UNAUTHORISED`, `SCAN_PAYLOAD_MALFORMED`, `SCAN_SIGNATURE_INVALID`,
`CREDENTIAL_REVOKED`.

**Scanner side** — a minimal authenticated web page for the office or the door. Camera,
result, green or red. It is not a student screen and does not need the decorative layer.

**Done when:** aeroplane mode, **cold start**, card and QR visible in under one second;
a scan writes a `scan_event`; a revoked credential is refused; **two scans thirty seconds
apart at different scanner ids raise a flagged anomaly** (PRD acceptance criterion).
This depends on the Phase 4 service worker for the shell and on IndexedDB for the card
data — neither alone is sufficient, which is why the worker is not deferred to Phase 14.
Teacher accounts have no ID card and no QR — verify `sargsyan@demo.tessera.am` sees
"Այսօր" in that navigation slot instead (§3.4).

---

### Phase 7 · Teacher Today

**Delivers:** the teacher's landing screen — a full screen, not a panel.

**Screen** — `today` in `navDefs`. Today's lessons for this teacher: class, subject,
time, and whether a column has already been entered for today's assessment.

**Backend** — `GET /api/teacher/today` joins `teaching_assignment` with today's
assessments and returns entry status per row.

**Frontend** — list of lesson cards, each linking straight into the gradebook column for
that class-subject. Empty state for a day with no lessons.

**Note:** the PRD placed this as a panel under the teacher ID card. That card was deleted
in `corrections-6.md`, so the panel had no parent. It becomes a screen.

---

### Phase 8 · Academic record

**Delivers:** the student's reason to open the app when nobody told them a mark.

**Screens** — overview (mosaic), **subject list** (`sjCols` layout), subject detail,
topic breakdown, archive by year, attestations, empty states.

The subject list and the subject detail share `sc-if isSubjects` in the design but are
distinct layouts. Both are required; naming only "subject detail" loses one.

**Backend**
- `GET /api/record/mosaic?year=` — subject × assessment grid
- `GET /api/record/subject/:id` — every assessment, current mark, history flag
- `GET /api/record/archive` — years available
- `GET /api/record/mark/:id/history` — full chain including superseded, with reasons

**Frontend**
- Mosaic tiles coloured by `--g1`…`--g10`, fixed scale
- A superseded mark shows the current value with a marker; tapping opens the chain
- Empty states are reachable: `nor@demo.tessera.am` has five marks in total

**Teacher archive** — the teacher's `archive` tab shows *published columns for their own
classes*, read-only, by term. Not a student record. ❓ Confirm §5.

**Done when:** the mosaic renders 25 600 marks without jank; the weaker class is visibly
weaker; the sparse student shows empty states rather than blank space.

---

### Phase 9 · Gradebook

**Delivers:** the teacher's peak-load screen. This decides adoption.

**Screens** — class picker, column entry, new assessment, publish confirmation, history.

**Backend**

| Endpoint | Notes |
|---|---|
| `GET /api/gradebook/classes` | This teacher's assignments |
| `GET /api/gradebook/column/:assessmentId` | Roster with current marks |
| `POST /api/assessments` | New column |
| `PUT /api/gradebook/draft` | Upsert drafts, batch |
| `POST /api/gradebook/publish` | Transactional: drafts → published |
| `POST /api/gradebook/supersede` | **Reason required.** Old row to `superseded`, new row inserted with `supersedes_mark_id` |

**Invariant, enforced everywhere:** `mark.value` is never UPDATEd. Corrections insert.
The database already refuses the alternative.

**Frontend**
- Keyboard-first: type a digit, auto-advance. Enter for the next student
- **"1" then "0" must produce 10, not 1 then 0.** A short input window, tested explicitly
- Drafts are private and visible only to the entering teacher
- Publish is a batch with a count and an explicit confirmation
- Superseding demands a reason before the button enables

**Done when:** a full column of 25 marks is entered by keyboard in under sixty seconds;
"1" then "0" gives 10; drafts are invisible to students; a correction produces two rows
and both are visible in the history.

---

### Phase 10 · Export

**Delivers:** the school's ability to submit what it must submit elsewhere (**C1**).

**Backend** — `POST /api/export` with scope class-subject-term, class, or institution;
format `xlsx` or `csv`. Writes `export_log`. Streams the file.

**Frontend** — scope picker, format toggle, download.

**Done when:** Armenian renders correctly in Excel and in LibreOffice; an institution
export of 25 600 marks completes without timing out; `export_log` records the actor and
the scope.

❓ **Q6 blocks the column layout, not the feature.** Build a defensible default; the
administrator interview decides the final shape.

---

### Phase 11 · Credentials

**Delivers:** non-formal achievement, submitted and recognised.

**Screens** — submission form with attachment, student's list, teacher and admin queue,
decision with reason.

**Backend**
- `POST /api/credentials` — multipart upload **through the backend**, which validates
  type and size, then writes to R2 under a generated key. No presigned upload URL ever
  reaches a browser; signed links are download-only and issued after a permission check
  (**C6**)
- `GET /api/credentials/mine`
- `GET /api/credentials/queue` — teacher sees own subject decidable, other subjects
  **read-only and visibly so** (`q.readOnly`); admin sees everything decidable
- `POST /api/credentials/:id/decide` — approve or decline, reason required to decline
- `GET /api/credentials/:id/attachment` — permission check, then a five-minute signed URL

**Storage (C6)** — R2 in both environments, separate buckets. Store the key. Never a
public URL, never a permanent link.

**Done when:** a student uploads a PDF and it appears in the right queue; a teacher can
decide their own subject and cannot decide another's; a declined request shows its
reason; a signed link expires.

---

### Phase 12 · Iter

**Delivers:** the assistant's complete interface, honest about what it is.

**In scope per PRD §7:** panel, suggestion chips, attachment-capable input row, thinking
animation via rotating conic-gradient border, and a plain line stating that responses are
not yet generated.

**Not in scope per PRD §3.2:** generated responses. **No model is connected.** No API key,
no inference call, no placeholder text pretending to be an answer.

**Frontend only, plus one endpoint** — `POST /api/iter/message` returns the honest line.

**Retention (Q10).** Until a retention period is decided, the endpoint **stores nothing**.
Keeping minors' messages when no model reads them creates a data-protection obligation
with no product benefit. If conversation history is wanted later, it arrives with a stated
period and a deletion job.

**Done when:** the panel opens, chips populate, an attachment can be selected, the
thinking state animates, and no generated text exists anywhere in the product.

---

### Phase 13 · Settings and notifications

**Delivers:** the remaining surfaces.

**Settings groups** — account, appearance (theme, four backgrounds, seven accents),
language (full names, not the pill), notifications, export shortcut, Iter button
position, support, widget gallery.

**Notification feed** — this is a **screen**, opened from the bell, with `notifItems`
cards: badge, title, body, timestamp. It is not the same surface as the notification
toggles in settings (`nGrade`, `nStatus`, `nWeekly`), which control what fills it.

**There is no `notification` table, and none is created (C2b).** The schema has only
`notification_pref`. The feed is **derived on read** from data that already exists:

| Card | Derived from |
|---|---|
| New mark | `mark` where `state='published'` and `published_at > user.last_login_at` |
| Mark corrected | `mark` where `supersedes_mark_id is not null`, same window, with its `reason` |
| Credential decided | `credential_request` where `decided_at` is in the window |
| Weekly summary | The same three, aggregated over the last seven days, shown as one card when `nWeekly` is on |

`GET /api/notifications` runs those queries against `notification_pref` and returns
`notifItems`. There is no write path and no `:id/read`; the window advances when
`last_login_at` does.

This keeps PRD **SET-5** honest — *"interface only in this release"* — satisfies the
design's `isNotif` screen, gives `nWeekly` a real source, and adds no table.

**No push delivery** — PRD §3.2. In-app only, no scheduled job.

**Support** — contact, problem report, feedback with rating, FAQ. Writes
`support_ticket`.

**Widget gallery** — eleven designs displayed, including the Ask Iter launcher. Native
implementation is out of scope; this is a gallery.

**Done when:** publishing a column produces notifications for those students; the feed
renders; every settings group works; a support ticket is stored.

---

### Phase 14 · PWA and motion

**Delivers:** installability and polish.

- Service worker: cache the shell, the ID card and the QR seed. Network-first for marks
- Install prompt using `T.pwa.{title, body, add}`
- Motion system from the design system; `prefers-reduced-motion` honoured everywhere

**Done when:** Lighthouse PWA passes; the app installs on Android and iOS Safari; the ID
works with the network off after a cold start; reduced motion removes every animation.

---

### Phase 15 · Hardening

**Audits**
- Accessibility against PRD §11.3, all three languages, keyboard-only pass
- Performance against PRD §11.1 with the full 25 606-mark dataset

**Security — PRD §13 in full, not a subset**

| Ref | Requirement |
|---|---|
| S-1 | TLS everywhere, HSTS, secure headers |
| S-2 | Argon2id for every written password; bcrypt accepted and upgraded (§11.5.2) |
| S-5 | Server-side validation on every endpoint. The client is never trusted |
| S-6 | Upload validation by **content**, not extension. Size cap, type allowlist |
| S-7 | Rate limits live and verified: 6 logins / 15 min, 100 requests / min / user |
| S-9 | `scan_event` detail retained one academic year, then aggregated. Scheduled job |
| S-10 | `audit_log` covers every mutation. Verified by inspection, not assumption |
| S-11 | No third-party scripts in the frontend. CSP enforcing it |
| — | Passwords, tokens, hashes and connection strings absent from every log |

**Deployment**
- **Separate Neon branch for production.** Development and production must not share a
  database. The first mistaken `DELETE` otherwise costs 25 606 marks
- Frontend to Vercel, backend to Fly or Render
- Secrets: `DATABASE_URL`, `JWT_SECRET`, `QR_SIGNING_KEY`, `RESEND_API_KEY`,
  `R2_*` — set in the platform, never committed
- CI: build, typecheck, and **a guard that fails the build if any migration file or seed
  script exists** (**C2**, **C2a**)
- Demo accounts live and documented

**Done when:** the URL is shareable, the four demo accounts work on it, and the targets
in §11.1 and §11.3 are met.

---

## 5. Decisions settled in this revision

| Question | Answer |
|---|---|
| Password hash | **bcrypt in the seed, Argon2id everywhere else.** Both accepted at login; bcrypt rehashed to Argon2id on the way through. Verified: the four demo accounts are `$2a$12$`, 60 characters |
| Notification feed | **Derived on read** from `mark`, `credential_request` and `last_login_at`. No new table, no scheduled job, PRD SET-5 unbroken |
| Verification side | **In v1, Phase 6.** `scan_event` already exists. The QR carries a deterministically signed token, not the raw seed |
| Email | **Resend**, with `MAIL_TRANSPORT=console` in development (C13) |
| Offline | Minimal service worker in Phase 4, full strategy in Phase 14 (C7) |

## 6. Decisions still required

Four are product decisions only the author can make. They do not block Phase 0.

| # | Question | Blocks | Default if unanswered |
|---|---|---|---|
| D1 | **`an` — "Class analysis" screen.** Complete trilingual strings exist (title, subtitle, "Mosaic: student × assessment", footnote). Zero markup, zero phase. Is this in v1? | Phase 8 or 9 | **Out.** Teacher-facing analytics is a second product |
| D2 | **`q.more` — "Request more information".** A third credential decision with its own toast (`ts.askT`, `ts.askB`). Not rendered | Phase 11 | **In.** The strings exist, the workflow is incomplete without it, and it prevents unfair declines |
| D3 | **Teacher archive.** What does a teacher see in their `archive` tab? | Phase 8 | Published columns for own classes, read-only, by term |
| D4 | **Desktop layout.** Is it designed for every screen, or only login? | Phase 4 | Responsive from the mobile design; desktop refinement is Phase 15 |
| D5 | **Weekly digest.** Is `nWeekly` worth a scheduled job in v1? | Phase 13 | **In**, as specified in Phase 13. A toggle that controls nothing is worse than no toggle |

---

## 7. Open questions from the PRD

None of these block building against seeded data. Every one blocks the claim that the
product should exist (PRD §18).

| # | Question | Blocks |
|---|---|---|
| Q1 | Do teachers use the existing electronic gradebook, or avoid it, and why? | **Phase 9's justification.** Three sessions of work rest on this |
| Q2 | Why did the Polytechnic discontinue digital cards? | Phase 6's premise |
| Q3 | Can the school export its roster to a file? | Could halve Phase 5 |
| Q4 | What does the school spend on certificates, paper, staff time, cards? | The commercial argument |
| Q5 | Who decides a software purchase — the school or the ministry? | Go-to-market, not the build |
| Q6 | What format does the school need marks in? | Phase 10's column layout |
| Q7 | May minors' records be hosted outside Armenia? | Real-data deployment, not the demo |
| Q8 | Is curriculum topic data available, and will teachers enter it? | **Phase 8's topic breakdown.** The schema supports it; without the data the screen degrades to nothing |
| Q9 | Which email provider, and does the school require its own SMTP? | Nothing — **C13** picks Resend as the default so Phase 2 is not blocked |
| Q10 | How long are Iter messages retained? | **Phase 12.** Storing minors' messages with no model connected needs a stated retention period, or the endpoint should store nothing at all |

**Q1 and Q3 are worth an interview before Phase 5.** Phase 5 is three sessions and Phase
9 is three more. Six sessions is a large bet on two unanswered questions, and the
interview is one afternoon.

---

## 8. Session protocol

**One phase, one chat.** Chats fill by volume, not by time. The connective tissue is the
files — PRD, roadmap, design system — carried from chat to chat.

Opening prompt for each phase:

```
Implement Phase [N] from tessera-roadmap.md, and nothing beyond it.

The database is live and populated. Do not create migrations or alter the schema.
Follow the design for every screen. Use design system tokens, never invented values.

When done: list what you built, give me the exact steps to test it myself, and commit.
Then stop.
```

If Claude Code starts work outside the phase, stop it and point at this line.

---

*End of document.*
