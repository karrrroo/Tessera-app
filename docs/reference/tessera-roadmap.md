# Tessera — Implementation Roadmap

**v2.0** · 15 phases (0–14) · C1–C13 · 5 appendices · August 2026 · **Ready to execute**
Supersedes v1.0. Changes in v2.0: the QR payload is an opaque handle at 29×29 (Phase 6);
`/api/scan` renamed `/api/verify`; scanner authentication and its accepted limitation stated;
the QR signing keys marked permanent; a derived notification feed added (Phase 12); D6 raised
as a blocking Phase 4 decision (Appendix E); the `PRD §` / `brief §` reference convention
and its guard script; and Appendix B corrected — the visual brief is nine files, not one.
**Companion to** `tessera-PRD.md` v2.0 (feature truth) and the Claude Design handoff
bundle (visual truth). This document is the *build order* and nothing else. Where it
restates a requirement it is for convenience; the PRD remains normative on behaviour.

> **Build note (this repository).** This copy is otherwise unchanged from the original
> v2.0, but three of its premises were revisited before this build started — see
> `docs/decisions.md` D-3, D-4, D-5. In short: **C1/C2** (below) are followed in spirit
> against a local PostgreSQL instance rather than an already-live Neon database, since no
> Neon project exists yet for this build (D-3); **C10** (below) is not followed — there is
> no Cloudflare R2 and no MinIO, attachments go to local disk behind a swappable
> `StorageProvider` interface (D-4); and **D6** (Appendix E) is resolved as its documented
> option (c), a recorded AA exception, with no token or component change (D-5). Everything
> else in this document — the phase list, the API conventions, C3–C9 and C11–C13, the error
> registry, the screen index — is followed as written.

**Audience** — Claude Code, one phase per session. Open each session at the repository root
and give it exactly this, nothing more:

```
Read tessera-roadmap.md sections 0 through 3. Do not read the phase details yet.
Then execute Phase N only. Stop at its "Done when" and report against each item.
Do not start Phase N+1.
```

That last line matters. Without it the session continues and the next phase begins without a
human having checked the previous one.

---

## 0. How to use this document

Each phase is a complete unit of work and ends with a git commit and a demonstrable
increment. A phase has five parts, always in the same order:

1. **Delivers** — the user-visible capability, in one sentence.
2. **Screens** — every screen touched, with its design reference.
3. **Backend** — endpoints, request shape, response shape, error codes.
4. **Frontend** — components, state, routing.
5. **Done when** — a test *the author can run by hand*, in order, with the expected
   result. If a criterion cannot be checked by doing something and looking at the
   result, it is written wrong and must be rewritten.

**Do not start a phase before the previous one's "Done when" passes in full.** The
ordering exists because each phase consumes the previous phase's output.

---

## 1. Constraints that override the PRD

These were decided after PRD v2.0 was written. Where they conflict with the PRD, **these
win**, and the PRD text is to be treated as superseded on that point.

| # | Constraint | What it supersedes |
|---|---|---|
| C1 | **The PostgreSQL database already exists on Neon.** Schema and seed data are both applied. | PRD §16 Phase 1 (migrations) and Phase 2 (seed script) |
| C2 | **No migrations. No schema changes.** The backend reads the live schema and adapts to it. | PRD §10's implied "we create this" framing |
| C3 | Backend: **Node · Express · TypeScript · Drizzle**. | PRD §11.5's unspecified "Node.js" |
| C4 | Frontend: **Next.js · TypeScript · Tailwind**. Auth: **JWT**. | — |
| C5 | **No Neon API, no Supabase, no BaaS.** Our backend owns every database interaction. | reinforces PRD §11.5 |
| C6 | **Web app first, PWA from day one.** React Native is later, not now. | PRD §3.2, reinforced |
| C7 | **Trilingual hy/en/ru from the first screen.** The login screen is trilingual before anything behind it is built. | PRD §12, tightened — i18n is not a late phase |
| C8 | **Backend returns error codes, never translated text.** | PRD §12 L-3, reinforced |
| C9 | Root `package.json` with **npm workspaces**, `backend/` and `frontend/`, a single `npm start`. | PRD §11.5, tightened |
| C10 | **Attachments live in S3-compatible object storage** (Cloudflare R2 in production, MinIO in development). The backend is the only gateway; no presigned URL ever reaches a browser. | brief §13 S-6, made concrete |
| C11 | **Frontend and backend share one origin.** Next.js `rewrites` proxy `/api/*` to Express. | new |
| C12 | Refresh token: **httpOnly, Secure, SameSite=Lax, path-scoped to the refresh endpoint only.** Access token **in memory**, never in `localStorage`. | brief §13 S-3, made concrete |
| C13 | **Administrator screens are part of the same application**, using the full design system token layer without exception — colours, accent, type scale, spacing grid, buttons, inputs, tables, focus states, empty states, motion. They omit only the decorative layer (glass, gradient, grain), and only where it harms the task. Density is higher because they are data screens. **Where an admin screen has no precedent in the design package, build it from primitives and show it to the author before moving on.** | PRD §9.2, which was silent on visual treatment |

### 1.1 What C1 and C2 do to the phase list

PRD §16 Phase 1 was "write the schema" and Phase 2 was "write the seed". Neither is work
any more. They are replaced by their inverses:

- **Phase 1 becomes schema *introspection and verification*.** Drizzle models are
  generated from the live database, then a check script asserts the live schema against
  PRD §10 and fails loudly on drift. The constraints are not created — they are *proved to
  exist*.
- **Phase 2 becomes data *audit*.** The seed is already there. What is not yet known is
  whether it contains the specific fixtures the later phases' tests depend on: an
  unpublished draft, a superseded mark with a reason, a nearly-empty student, a departed
  student, four demo accounts. Phase 2 finds out and writes down the identifiers.

Everything from Phase 3 onward keeps its PRD number, so `PRD §16` and this document stay
readable side by side.

> **Build note.** Under D-3, there is no pre-existing database, so Phase 1 additionally
> applies `tessera-schema.sql` once to the local instance before introspecting it (the
> introspect-and-verify step then runs exactly as written and must still pass), and Phase
> 2 additionally applies `tessera-seed.sql` once before auditing it. Both application steps
> are one-time, plain `psql -f` runs recorded in `docs/phases/`, never migration tooling —
> the rule in §1.2 still holds. Once a Neon project exists, the same two files are applied
> there the same way and this note no longer applies.

### 1.2 The one rule that protects C2

There is no `drizzle-kit generate`, no `drizzle-kit push`, and no `migrate()` call
anywhere in the repository. Not disabled — **absent**. A `predev` guard greps for them
and refuses to start if one appears:

```json
"predev": "node scripts/guard-no-migrations.mjs"
```

The guard is nine lines and it is the reason a future session cannot quietly destroy the
production database while trying to be helpful.

---

## 2. Repository shape

```
tessera/
├── package.json                 # workspaces, single `npm start`
├── .env.example
├── scripts/
│   ├── guard-no-migrations.mjs
│   ├── schema-check.ts
│   ├── data-audit.ts
│   └── i18n-check.ts
├── backend/
│   ├── package.json
│   ├── drizzle.config.ts        # introspection only
│   └── src/
│       ├── index.ts             # express bootstrap
│       ├── env.ts               # zod-validated process.env
│       ├── db/
│       │   ├── client.ts        # pg Pool → drizzle
│       │   └── schema.ts        # GENERATED by drizzle-kit pull — do not hand-edit
│       ├── http/
│       │   ├── errors.ts        # AppError + the code registry
│       │   ├── respond.ts
│       │   └── middleware/      # auth, rbac, ratelimit, validate, audit
│       ├── modules/             # one folder per PRD §9 area
│       │   └── <area>/{router,service,repo,schema}.ts
│       └── lib/                 # argon2, jwt, qr, storage, xlsx
└── frontend/
    ├── package.json
    ├── next.config.ts           # rewrites /api/* → backend
    ├── tailwind.config.ts       # maps design tokens, defines no colours of its own
    └── src/
        ├── app/                 # App Router
        ├── components/
        ├── design/tessera.css   # the token file — the design contract
        ├── i18n/{hy,en,ru}.ts
        ├── lib/api/             # typed client, one file per module
        └── state/               # providers
```

`modules/<area>/` mirrors PRD §9 one-to-one: `auth`, `admin`, `identity`, `record`,
`gradebook`, `export`, `credentials`, `iter`, `settings`. When PRD §9.5 changes, exactly one
folder changes.

---

## 3. API conventions

Fixed once here, obeyed by every phase. Deviating from these in one module is how an API
becomes unlearnable.

**Base path** `/api`. Same origin as the app (C11). The browser never knows the backend's
real address.

**Success** — the resource, unwrapped, with the appropriate 2xx. `201` returns the created
resource. `204` returns nothing at all.

**Failure** — always exactly this shape, and never a human sentence:

```json
{
  "error": {
    "code": "MARK_REASON_REQUIRED",
    "field": "reason",
    "details": { }
  }
}
```

`code` is `UPPER_SNAKE_CASE` and stable — it is a key in the client's locale files, so
renaming one is a breaking change. `field` is present only for field-level validation.
`details` is machine-readable context (row indexes, limits, allowed values) and never
prose. **There is no `message` key.** If one appears, a translation has leaked into the
backend and C8 is broken.

**Authentication** — `Authorization: Bearer <accessToken>`. Access token life 15 minutes.

**Refresh** — cookie `tsr_rt`, `HttpOnly; Secure; SameSite=Lax; Path=/api/auth/refresh`.
Because the path is scoped, the cookie is not attached to any other request, which means
CSRF on the mutating endpoints is structurally impossible rather than defended against.

**Locale** — the client sends `Accept-Language: hy|en|ru`. The backend uses it for
**generated file contents only** (export column headers, the import template). It never
uses it to build a response body string.

**Idempotency** — mutating endpoints that could be double-fired accept
`Idempotency-Key: <uuid>`. Currently: publish, import apply, credential decision.

**Pagination** — `?limit=&cursor=`, response `{ items: [...], nextCursor: string|null }`.
`limit` defaults 50, caps 200.

**Section references** — a reference to the PRD is always written **`PRD §N`**; a reference
to the visual brief is always **`brief §N`**. A bare `§N` means a section of *this* document.
The convention is not cosmetic: without it nothing can tell a dangling pointer from a
cross-document one, and section renumbering has already left stale pointers twice.

Worth a guard, since this is the second time a section renumbering has left dangling
pointers. **The guard depends on a convention the document must adopt: a reference to the
PRD is always written `PRD §N`, never a bare `§N`.** Without that rule the script cannot
tell a roadmap section from a PRD section and cries wolf — the first version of this script
raised 13 alarms of which 11 were false, and a script that lies eleven times out of thirteen
is deleted after its first run, taking the protection with it.

```bash
#!/usr/bin/env bash
# scripts/check-xrefs.sh — every bare §N must exist as a heading in this file.
# Convention: PRD references are written "PRD §N" and are stripped before checking.
f="${1:-tessera-roadmap-v2.md}"
sed 's/PRD *§[0-9.]*//g' "$f" \
| grep -oE '§[0-9]+(\.[0-9]+)*' | sort -u | while read -r ref; do
    n="${ref#§}"
    grep -qE "^#+ +${n}[. ]" "$f" || echo "dangling: $ref"
  done
```

Two things it fixes over the first attempt: the heading pattern is `${n}[. ]` rather than
`${n}\.`, because headings are written `### 3.2 Designed…` with no trailing dot; and PRD
references are stripped first.

**Timestamps** — ISO 8601 with offset, always. Dates without a time (`held_on`,
`birth_date`, `starts_on`) are `YYYY-MM-DD` strings and are never `Date` objects on the
wire, because a timezone applied to a school term start date is always a bug.

**UUIDs** — every identifier in every payload is the database uuid. No sequential ids, no
slugs, no composite string keys.

### 3.1 Shared error codes

Every module may return these. Module-specific codes are listed with their phase and
collected in Appendix A.

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_FAILED` | 422 | Body or query failed the zod schema. `details.issues[]` |
| `UNAUTHENTICATED` | 401 | Missing or malformed bearer token |
| `TOKEN_EXPIRED` | 401 | Access token expired — the client silently refreshes and retries once |
| `FORBIDDEN` | 403 | Authenticated, role or ownership check failed |
| `NOT_FOUND` | 404 | Resource absent, or present but not visible to this actor |
| `CONFLICT` | 409 | State transition not permitted from the current state |
| `RATE_LIMITED` | 429 | `details.retryAfterSeconds` |
| `PAYLOAD_TOO_LARGE` | 413 | Upload over the limit |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Content inspection rejected the file |
| `INTERNAL` | 500 | Unhandled. Logged with a correlation id returned in `details.ref` |

`NOT_FOUND` covering "exists but not yours" is deliberate. A teacher probing for a class
they do not teach must not learn from the status code that it exists — PRD §13 S-4.

### 3.2 Authorisation is a table, not a habit

PRD §8's matrix is implemented as one middleware fed by one declaration file,
`backend/src/http/rbac.ts`, exporting a map from route to a predicate. Every router
mounts it. A route with no entry **fails closed** — it 403s. This is the only way the PRD §8
table stays true after twelve phases.

---

# Phase 0 — Repository and the single command

### Delivers

`npm install && npm start` at the repository root brings up both services, and the
frontend can reach the backend, and the backend can reach Neon.

### Screens

None. If a screen appears in this phase, scope has leaked.

### Backend

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | liveness + database reachability |

**Response** `200`

```json
{
  "status": "ok",
  "uptimeSeconds": 42,
  "db": { "reachable": true, "latencyMs": 31, "serverVersion": "16.4" },
  "commit": "a1b2c3d"
}
```

If the database is unreachable the endpoint still returns `200` with
`db.reachable: false` — this is a diagnostic, and a diagnostic that fails to respond
diagnoses nothing.

**Error codes** — none. This endpoint does not fail.

`src/env.ts` validates the environment with zod at boot and **exits non-zero with the
list of missing keys** rather than starting half-configured:

```
DATABASE_URL           postgres://…@…neon.tech/…?sslmode=require
JWT_ACCESS_SECRET      ≥32 bytes
JWT_REFRESH_SECRET     ≥32 bytes, different from the above
QR_SIGNING_SECRET      ≥32 bytes. NEVER ROTATED — see below
QR_HANDLE_KEY          ≥32 bytes. NEVER ROTATED — see below
SCANNER_API_KEY        ≥32 bytes. Authenticates door scanners, not people
NOTIFICATION_WINDOW_DAYS  Provisional 400. Set from the Phase 12 query, not from this line
RESEND_API_KEY         Resend, per PRD §11.5.3. Unset when MAIL_TRANSPORT=console
MAIL_TRANSPORT         resend | console. console in development — resets go to the log
MAIL_FROM              e.g. "Tessera <no-reply@tessera.am>"
S3_ENDPOINT            R2 endpoint, or http://localhost:9000 for MinIO
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
PORT                   default 4000
NODE_ENV
APP_ORIGIN             http://localhost:3000
```

**`QR_SIGNING_SECRET` and `QR_HANDLE_KEY` are permanent.** ID-4 says the code is
byte-identical *indefinitely*, so these two keys are the only secrets in the system that
can **never be rotated**. Losing or regenerating either silently invalidates every card ever
issued — no error is raised, no test fails, printed cards and saved screenshots simply stop
matching. Generate them once, store them in the secret manager, **back them up separately
from every other secret**, and record in the deployment notes that a rotation is a
re-issuance of every credential in the institution. Everything else in this list may be
rotated freely.

Neon specifics that will otherwise cost an afternoon: use the **pooled** connection
string, `ssl: { rejectUnauthorized: true }`, and `max: 10` on the pool. Neon closes idle
connections; set `idleTimeoutMillis: 30_000` and let the pool re-establish rather than
holding sockets open.

### Frontend

- `next.config.ts` — `rewrites()` mapping `/api/:path*` → `http://localhost:4000/api/:path*`
  in development and `${BACKEND_INTERNAL_URL}/api/:path*` in production. This is C11 and
  it is the reason the cookie configuration in C12 works without any CORS at all.
- `src/app/layout.tsx` — html lang from a cookie, nothing else.
- `src/app/page.tsx` — a single line reading `/api/health` and printing the JSON. It is
  deleted in Phase 4. Its only purpose is to prove the proxy.
- No Tailwind theme yet beyond the default. Tokens arrive in Phase 4.

### Routing

None yet.

### Done when

1. `cp .env.example .env`, fill in the Neon URL, run `npm install` at the root. One
   lockfile appears at the root; none inside `backend/` or `frontend/`.
2. `npm start` — one command, both services, colour-prefixed logs.
3. `curl -s localhost:4000/api/health | jq` → `db.reachable: true`, a real
   `serverVersion`, `latencyMs` under 200.
4. Open `http://localhost:3000` → the same JSON, fetched through the proxy. Network tab
   shows the request went to `localhost:3000/api/health`, **not** to port 4000.
5. Delete one line from `.env` and `npm start` → process exits non-zero naming the
   missing key. Restore it.
6. `git log --oneline` shows one commit.

---

# Phase 1 — Drizzle over the live schema

### Delivers

Typed database access to the existing Neon database, and a check that screams if the live
schema and PRD §10 ever diverge.

### Screens

None.

### Backend

**Step 1 — pull.** `npx drizzle-kit pull` writes `backend/src/db/schema.ts` from the live
database. The file carries a generated-header and is never hand-edited. When the database
changes (by someone else, deliberately), it is re-pulled, and the diff in that file is the
record of what changed.

`drizzle.config.ts` contains `introspect` configuration and **nothing else** — no
`out` migrations folder, no `schema` output for generation.

> **Build note.** In practice, `drizzle-kit pull` requires an `out` path and always
> writes `schema.ts`/`relations.ts` plus a migration-journal snapshot there together —
> there's no config that produces schema output with no `out` at all. Resolved by pointing
> `out` at a gitignored `backend/.drizzle-introspect/` scratch directory and copying just
> `schema.ts`/`relations.ts` into `backend/src/db/` after each pull; that scratch directory
> is never fed to a migrate step. See `docs/decisions.md` D-8.

**Step 2 — relations.** `src/db/relations.ts` is hand-written and *is* editable. It
declares the joins PRD §10 implies: `student → user`, `enrollment → student, class`,
`teaching_assignment → teacher, class, subject`, `mark → assessment, student`,
`mark → mark` for `supersedes_mark_id`. Drizzle's relational queries make the record and
gradebook reads single round trips instead of six.

**Step 3 — verify.** `npm run schema:check` (`scripts/schema-check.ts`) reads
`information_schema` and `pg_indexes` and asserts, printing a line per item:

- All tables from PRD §10.1–PRD §10.4 exist (**22**, not the 24 stated here — verified
  directly against `information_schema.tables`; see `docs/decisions.md` D-8).
- Every enum has exactly the PRD §10 values, in order — `role`, `locale`, `enrollment.status`,
  `assessment.kind`, `mark.state`, `import_batch.kind`, `import_batch.status`,
  `import_row.status`, `export_log.format`, `credential_request.status`,
  `support_ticket.kind`.
- `mark.value` carries `check (value between 1 and 10)`.
- **`one_current_mark`** exists as a *unique* index on `mark (assessment_id, student_id)`
  with predicate `state in ('draft','published')`. It prints the actual predicate text so
  a subtly wrong one is visible, not merely "found".
- **`reason_required_when_superseding`** exists as a check constraint on `mark`.
- `emis_id` / `emis_student_id` / `emis_teacher_id` exist and are nullable (PRD §6.6).
- `"user".email` is `citext` and unique.

Exit code 0 or 1. Nothing is written. Ever.

**Step 4 — repository layer.** `modules/*/repo.ts` files, all queries via Drizzle's query
builder. Raw SQL is permitted in exactly two places and both are commented with why:
the `ON CONFLICT` clause that leans on the partial index, and the anomaly window query
in Phase 6.

**Error codes** — none exposed. Postgres constraint violations are mapped in
`http/errors.ts` and surface as the module codes of later phases:

| Postgres | becomes |
|---|---|
| `23505` on `one_current_mark` | `MARK_ALREADY_CURRENT` (409) |
| `23514` on `reason_required_when_superseding` | `MARK_REASON_REQUIRED` (422) |
| `23505` on `"user".email` | `USER_EMAIL_TAKEN` (409) |
| `23503` any | `NOT_FOUND` (404) — a dangling reference from a client is not a 500 |

This mapping is the mechanism by which the database, not the application, is the enforcer
of the audit trail (PRD §10.3) while the client still gets a usable code.

### Frontend

None.

### Done when

1. `npm run schema:check` prints one line per assertion and exits 0. Read the printed
   predicate of `one_current_mark` and confirm it says
   `state = ANY (ARRAY['draft','published'])` or the textual equivalent — not `IS NOT NULL`,
   not absent.
2. Prove the constraints are live, by hand, against the real database:

   ```sql
   -- pick any student/assessment pair that already has a published mark
   insert into mark (assessment_id, student_id, value, state, entered_by_teacher_id, entered_at)
   values ('<same assessment>', '<same student>', 7, 'draft', '<teacher>', now());
   -- expect: ERROR duplicate key value violates unique constraint "one_current_mark"
   ```

   ```sql
   insert into mark (assessment_id, student_id, value, state, supersedes_mark_id,
                     entered_by_teacher_id, entered_at)
   values ('<a>', '<s>', 8, 'published', '<some mark id>', '<teacher>', now());
   -- expect: ERROR violates check constraint "reason_required_when_superseding"
   ```

   Both must fail. If either succeeds, stop — the audit trail is decorative and every
   later phase is built on a false claim.
3. `grep -rniE "drizzle-kit (generate|push)|migrate\(" .` → no hits outside this
   document. `node scripts/guard-no-migrations.mjs` exits 0.
4. A throwaway script selecting one class with its students through Drizzle relations
   returns rows, and the query log shows **one** statement, not N+1.

---

# Phase 2 — Data audit and the fixture register

### Delivers

Written proof of what is actually in the seeded database, and a stable list of
identifiers that every later phase's manual test refers to.

### Screens

None.

### Backend

`npm run data:audit` (`scripts/data-audit.ts`) — **read-only**, no writes under any flag —
prints a report and writes `fixtures.json`.

It reports counts for: institutions, academic years, terms, classes, subjects, students by
enrollment status, teachers, teaching assignments per teacher (min/median/max),
assessments per class–subject, marks by state, and credential requests by status.

Then it asserts the specific fixtures the later tests need, and this is the part that
matters, because a phase's "Done when" is unrunnable if the data it names does not exist:

| Fixture | Needed by | Assertion |
|---|---|---|
| 4 accounts with `is_demo = true` — student, teacher with ≥4 assignments, admin, and one with `must_change_password = true` | Phases 3, 14 | exists, and each has a parseable Argon2id hash (`$argon2id$`) |
| ≥1 teacher with ≥12 marks in `state = 'draft'` | Phases 7, 8 | exists |
| ≥3 marks in `state = 'superseded'` with a non-null `reason` and a successor pointing at them | Phase 7 REC-8 | exists |
| ≥1 student with fewer than 3 published marks | Phase 7 REC-9 empty states | exists |
| ≥1 enrollment with status `departed` whose student still has published marks | Phase 5 ADM-7 | **absent** — see below |
| ≥1 class–subject–term with ≥20 assessments and ≥25 students | Phases 8, 9 | real max is 8 in one term (15 across both) — see below |
| ≥1 assessment with a non-null `topic`, and ≥1 with `topic` null | Phase 7 REC-10 degradation | only the null half exists — see below |
| credential requests in all three statuses, ≥1 `declined` with a reason | Phase 10 | exists |
| ≥1 `qr_credential` per student | Phase 6 | count matches student count |

> **Build note.** Four corrections to this table and the fixtures below, found while
> running `scripts/data-audit.mjs` against the real seed — full detail in
> `docs/decisions.md` D-9/D-10:
> 1. Demo-account hashes are bcrypt (`$2a$12$…`), not Argon2id — matches
>    `tessera-PRD.md` §11.5.2, not this document.
> 2. The sparse student has 5 published marks, not "fewer than 3" — the audit finds the
>    minimum and checks it's a clear outlier instead.
> 3. No class-subject-term combo reaches 20 assessments; the real maximum is 8. The audit
>    uses ≥5 assessments and ≥25 students instead.
> 4. **The departed-student and tagged-assessment fixtures don't exist in the seed at
>    all** — not a threshold problem, a real gap. Reported in `data-gaps.md`; the decision
>    was to defer both rather than run `data:topup`. `fixtures.json` has no
>    `departedStudent` or `taggedAssessment` key. Phases 5 and 7 must re-check
>    `data-gaps.md` before relying on either.

For each satisfied fixture it writes the identifiers to `fixtures.json`:

```json
{
  "generatedAt": "2026-08-24T09:00:00+04:00",
  "demo": {
    "student":     { "email": "…", "userId": "…", "studentId": "…" },
    "teacher":     { "email": "…", "userId": "…", "teacherId": "…" },
    "admin":       { "email": "…", "userId": "…" },
    "firstLogin":  { "email": "…", "userId": "…" }
  },
  "heavyClassSubjectTerm": { "classId": "…", "subjectId": "…", "termId": "…",
                             "students": 26, "assessments": 21 },
  "draftOwner":       { "teacherId": "…", "classId": "…", "subjectId": "…", "count": 12 },
  "supersededMarks":  ["…", "…", "…"],
  "sparseStudent":    { "studentId": "…", "publishedMarks": 1 },
  "departedStudent":  { "studentId": "…", "enrollmentId": "…" },
  "untaggedAssessment": "…",
  "taggedAssessment":   "…",
  "credentials": { "pending": "…", "approved": "…", "declined": "…" }
}
```

`fixtures.json` is committed. It is not configuration — it is the test plan's address
book, and having it in the repository is what makes every later "Done when" reproducible
by someone who did not write it.

**If a fixture is missing** the audit exits 1 and writes `data-gaps.md` listing precisely
what is absent and the `INSERT` that would create it. It does **not** run that insert.
`npm run data:topup` exists, is `INSERT`-only, idempotent, touches no schema, and is
**run only on the author's explicit instruction** — because C1 says the seed is applied,
and a script that silently adds rows to a database someone believes they already
understand is worse than a failing test.

**Error codes** — none. This is a script, not an endpoint.

### Frontend

None.

### Done when

1. `npm run data:audit` prints the full report and exits 0.
2. `fixtures.json` exists, and every uuid in it resolves — spot-check three by hand:

   ```sql
   select first_name, last_name from student where id = '<sparseStudent.studentId>';
   select count(*) from mark where state='draft' and entered_by_teacher_id='<draftOwner.teacherId>';
   select value, reason from mark where id = '<supersededMarks[0]>';
   ```

   The third must return a non-null reason.
3. The audit is provably read-only: run it twice and compare
   `select count(*) from mark`, `from "user"`, `from student` before and after. Identical.
4. If the audit exited 1, `data-gaps.md` exists and names the gap — and the phase is
   **not** complete until the author has decided what to do about it. Report and wait.

---

# Phase 3 — Authentication

### Delivers

Nobody reaches any screen without logging in; a first-login account cannot escape the
password change; a forgotten password is recoverable without contacting anyone; a session
can be killed from another device.

### Screens

| Screen | Design reference |
|---|---|
| Splash / bootstrap | brief §13 (motion), the `[data-lock]` intro animation in `Tessera.dc.html` |
| Login | `Tessera.dc.html` → `sc-if isLogin`; brief §8bis. Web layout (two-column, art panel left) at >900px per PRD §8bis "Web layout"; single column below |
| Forgot password — email | `Tessera.dc.html` login block, `T.auth.recTitle` / `recSub` |
| Forgot password — sent, 60s cooldown | `T.auth.sentTitle` / `sentBody` / `next` |
| New password (from reset link) | `T.auth.newTitle`, live checklist `req8` / `reqNum` / `reqUp`, `mismatch` |
| First-login forced change | `T.auth.firstTitle` / `firstBody` / `saveGo` |
| Active sessions (list only; the Settings chrome arrives in Phase 12) | `T.set.sessTitle` / `sessThis` / `sessAll` / `lastSeen`, `SESSIONS` fixture in `tessera-data.js` |

The login screen is **trilingual on delivery** (C7). The HY·EN·RU sliding segmented pill
belongs to this screen and to Settings, and to nowhere else — PRD §12 L-7. Do not put it in
the header. The demo row (`T.auth.demoLabel`, `demoS`, `demoT`, `demoF`) is built here and
wired to the four `is_demo` accounts from `fixtures.json`.

### Backend

`modules/auth/`. Argon2id via `argon2` (`type: argon2id`, `memoryCost: 19456`,
`timeCost: 2`, `parallelism: 1` — the OWASP baseline).

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/auth/login` | public |
| `POST` | `/api/auth/refresh` | refresh cookie |
| `POST` | `/api/auth/logout` | bearer |
| `GET` | `/api/me` | bearer |
| `POST` | `/api/auth/password/change` | bearer |
| `POST` | `/api/auth/password/forgot` | public |
| `POST` | `/api/auth/password/reset` | public |
| `GET` | `/api/auth/sessions` | bearer |
| `DELETE` | `/api/auth/sessions/:id` | bearer |
| `DELETE` | `/api/auth/sessions` | bearer |

**`POST /api/auth/login`**

```json
{ "identifier": "ani.h@school55.am", "password": "…", "remember": true, "deviceLabel": "Chrome · macOS" }
```

`identifier` is an email **or** an institution-issued id (AUTH-3). Resolution order:
`citext` email match, then `student.emis_student_id` / `teacher.emis_teacher_id`, then the
Tessera id shown in Settings (`T.set.kEmis`).

`200`

```json
{
  "accessToken": "eyJ…",
  "expiresIn": 900,
  "user": {
    "id": "…", "role": "student", "locale": "hy",
    "mustChangePassword": false,
    "firstName": "Անի", "lastName": "Հովհաննիսյան",
    "institutionId": "…", "institutionName": "Երևանի թիվ 55 ավագ դպրոց",
    "studentId": "…", "classLabel": "11-Բ",
    "preferences": { "theme": "system", "accent": "black", "background": "deep", "iterPosition": "floating" }
  }
}
```

`teacherId` and `subjectIds` replace `studentId`/`classLabel` for role `teacher`.
`Set-Cookie: tsr_rt=…` per C12; `Max-Age` 30 days, or 90 when `remember` is true (AUTH-5),
and a `device_session` row is written in both cases with `refresh_token_hash`.

| Code | HTTP | Cause |
|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | 401 | wrong identifier **or** wrong password — one code for both (AUTH-9) |
| `AUTH_ACCOUNT_LOCKED` | 423 | `locked_until` in the future. `details.retryAfterSeconds`. Message must not confirm the account exists (AUTH-10) |
| `RATE_LIMITED` | 429 | 6 attempts / 15 min / identifier (S-7) |
| `VALIDATION_FAILED` | 422 | empty field — `T.auth.errField` |

**Timing.** When no user is found, still run `argon2.verify` against a fixed dummy hash
held in memory. Without this, a 4ms response and a 90ms response distinguish a real
account from a fictional one, and the AUTH-9 acceptance criterion explicitly names timing.

**`POST /api/auth/refresh`** — no body; reads `tsr_rt`. Rotates: the presented token's
`device_session` row is updated with the new hash and `last_seen_at`, and a new cookie is
set. A token whose hash matches no live row is a **reuse of a rotated token**, which means
either a race or theft: revoke the entire `device_session` family for that user and return
`AUTH_REFRESH_REUSED`.

`200` `{ "accessToken": "…", "expiresIn": 900 }`

| Code | HTTP |
|---|---|
| `AUTH_REFRESH_MISSING` | 401 |
| `AUTH_REFRESH_INVALID` | 401 |
| `AUTH_REFRESH_REUSED` | 401 |
| `AUTH_SESSION_REVOKED` | 401 |

**`POST /api/auth/password/change`** — `{ "currentPassword": "…", "newPassword": "…" }` →
`204`. Clears `must_change_password`, revokes **every other** `device_session`, rotates the
current one.

| Code | HTTP |
|---|---|
| `AUTH_CURRENT_PASSWORD_INVALID` | 400 |
| `AUTH_PASSWORD_WEAK` | 422 | `details.failed: ["length","digit","uppercase"]` — the client maps each to `T.auth.req8`/`reqNum`/`reqUp` |
| `AUTH_PASSWORD_REUSED` | 422 |

**`POST /api/auth/password/forgot`** — `{ "email": "…" }` → **always `202`, always empty**,
existing account or not. Enumeration through this endpoint would undo AUTH-9. Token: 32
random bytes, stored hashed, single-use, 30-minute expiry, one live token per user (issuing
a second invalidates the first). Cooldown 60s per email → `RATE_LIMITED`.

> ❓ **No mail provider is chosen.** In development the link is written to the server log
> and served by `GET /api/dev/last-reset-token`, which is **mounted only when
> `NODE_ENV !== 'production'`** and whose absence in production is asserted in Phase 14's
> checklist. Choosing a provider is a Phase 14 deployment task, not a blocker here.

**`POST /api/auth/password/reset`** — `{ "token": "…", "newPassword": "…" }` → `204`, and
revokes all sessions for that user.

| Code | HTTP |
|---|---|
| `AUTH_RESET_TOKEN_INVALID` | 400 |
| `AUTH_RESET_TOKEN_EXPIRED` | 410 |
| `AUTH_RESET_TOKEN_USED` | 410 |
| `AUTH_PASSWORD_WEAK` | 422 |

**`GET /api/auth/sessions`** →
`[{ "id":"…", "deviceLabel":"iPhone 13 · Safari", "lastSeenAt":"…", "createdAt":"…", "current":true }]`.
`DELETE /api/auth/sessions/:id` → `204`, `SESSION_NOT_FOUND` 404. `DELETE /api/auth/sessions`
revokes all **except** the current one — `T.set.sessOnly`.

**Middleware.** `requireAuth` verifies the bearer and rejects `TOKEN_EXPIRED` distinctly
from `UNAUTHENTICATED`, because the client's silent-refresh-and-retry hinges on telling
them apart. `requirePasswordChanged` returns `AUTH_PASSWORD_CHANGE_REQUIRED` (403) on
**every** route except `/api/me`, the change endpoint, and logout — this is AUTH-7 enforced
at the API, so browser-back cannot defeat it.

### Frontend

**Routing** — `src/app/`:

```
(auth)/login/page.tsx
(auth)/forgot/page.tsx
(auth)/forgot/sent/page.tsx
(auth)/reset/[token]/page.tsx
(auth)/first-login/page.tsx
(app)/…                      ← Phase 4 onward
```

Next `middleware.ts` cannot gate this: the refresh cookie is path-scoped to
`/api/auth/refresh` (C12), so the edge never sees it. **Gating is client-side and that is
correct** — `AuthProvider` mounts, calls `/api/auth/refresh`, and while the call is in
flight renders the splash. This is why the splash exists in the design and not merely as
decoration.

**Components**

- `AuthProvider` — `{ user, accessToken, status: 'booting'|'anon'|'authed', login, logout }`.
  Access token in a module-scoped variable, never in state that could be serialised, never
  in `localStorage` (C12).
- `apiClient` — injects the bearer; on `TOKEN_EXPIRED` calls refresh **once**, dedupes
  concurrent refreshes through a single shared promise, retries the original request, and
  on a second failure clears state and routes to `/login`.
- `AuthGate` — wraps `(app)`. `booting` → splash; `anon` → `/login`;
  `authed && user.mustChangePassword` → `/first-login` and nothing else, including on
  back-navigation.
- `LoginCard`, `DemoRow`, `LanguagePill`, `PasswordField` (reveal toggle),
  `PasswordChecklist` (live, three rules), `SessionList`.

**State** — `AuthProvider` + `LocaleProvider` only. No store library. Nothing else in this
phase has state worth naming.

### Done when

Run each in order. Every one must produce the stated result.

1. `http://localhost:3000/overview` while logged out → lands on `/login`. Same for
   `/gradebook`, `/settings`, `/id`.
2. Log in with the demo student from `fixtures.json`. Reach the placeholder app.
3. Log in with `fixtures.demo.firstLogin` → `/first-login`. Now try to escape: type
   `/overview` in the address bar; press browser back; open `/settings` in a new tab. All
   three return to `/first-login`. Then `curl` the API directly with that account's access
   token:
   `curl -H "Authorization: Bearer <t>" localhost:3000/api/auth/sessions` →
   `AUTH_PASSWORD_CHANGE_REQUIRED`. The interface is not the enforcement.
4. Six wrong passwords for one account. The 6th and 7th return `AUTH_ACCOUNT_LOCKED` with
   `retryAfterSeconds`. The screen shows `T.auth.errCreds` — one generic sentence — for
   all of them.
5. Enumeration and timing: `curl -w '%{time_total}\n'` on login with a real email + wrong
   password, and with `nobody@nowhere.am` + any password, ten times each. Same code, same
   body, and the two timing distributions overlap. If the second is consistently faster,
   the dummy-hash verify is missing.
6. Reset flow end to end: request → read the token from the log → set a new password →
   `204`. **Use the same link again** → `AUTH_RESET_TOKEN_USED`. Log in with the new
   password.
7. Resend cooldown: press send twice inside 60s → `RATE_LIMITED`, and the button is
   disabled with a visible countdown.
8. Two-device revocation: log in on Chrome and on Firefox as the same user. In Chrome,
   revoke the Firefox session. In Firefox, take any action → the next request fails and it
   returns to `/login`. **Within one request cycle**, not after the 15-minute token
   expiry — this works because the retry path calls refresh, and refresh checks the
   session row.
9. Log out → `localStorage` and `sessionStorage` are empty in devtools, the `tsr_rt` cookie
   is gone, and back-navigation does not restore a screen.
10. Switch the login screen to EN and to RU. Every string changes, including the demo row,
    the checklist and the error. Nothing is clipped at RU's extra length (PRD §12 L-5).

---

# Phase 4 — Design tokens, shell, theming, three languages

### Delivers

The application frame: navigation, header, theme, accent, background, and complete
localisation. From here on every screen is placed into an existing frame rather than
inventing one.

### Screens

| Screen | Design reference |
|---|---|
| Token sheet (internal proof page, `/dev/tokens`) | `design-sistem/project/tessera-design-system.dc.html` |
| Web shell — collapsible sidebar, header | brief §8quater; `Tessera.dc.html` → `isApp` |
| Mobile shell — floating pill nav, docked centre QR button | brief §9. Geometry is exact: `bottom: 29px`, background-colour border, **no notch** |
| Web/Mobile preview switch | brief §8ter. Visible **above 900px only**, and it is a prototype control, not a user setting (PL-3) |
| Theme / accent / background switching | brief §8, brief §4.2 Deep, brief §4.3 Aura |
| Language switching | PRD §12; `T` dictionary in `tessera-data.js` |
| Offline banner component | `T.off.*` |

### Backend

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/me/preferences` | read |
| `PATCH` | `/api/me/preferences` | write |

```json
{ "locale": "hy", "theme": "system", "accent": "black", "background": "deep", "iterPosition": "floating" }
```

→ `204`. `locale` persists to `"user".locale`; the other four persist per device — they are
appearance, and appearance following a person to a shared school computer is wrong. Store
them in `localStorage` and send only `locale` to the server.

| Code | HTTP | Cause |
|---|---|---|
| `VALIDATION_FAILED` | 422 | value outside the enum. `details.allowed[]` |

### Frontend

**The token file is the contract.** `src/design/tessera.css` holds CSS custom properties
and nothing else. Tailwind reads them and **defines no colour of its own**:

```ts
// tailwind.config.ts — colours are references, never literals
colors: {
  ink: 'var(--ink)', 'ink-2': 'var(--ink-2)', 'ink-3': 'var(--ink-3)',
  base: 'var(--bg-base)', surface: 'var(--surface)', surface2: 'var(--surface2)',
  hair: 'var(--hair)', accent: 'var(--accent)', 'accent-tint': 'var(--accent-tint)',
  g1: 'var(--g1)', /* … */ g10: 'var(--g10)',
}
```

A hex literal anywhere in `frontend/src/**` outside `tessera.css` is a defect. Add
`npm run tokens:check` — a grep for `#[0-9a-fA-F]{3,8}` with that one file excluded.

**The grade scale is fixed** (REC-2, brief §14.1). **Read Appendix E before implementing
`MarkTile`** — grades 4 and 8 fail WCAG AA against both ink colours and the decision is due
in this phase, not later. These ten values, from
`tessera-data.js`, never change with theme, background, accent or opacity:

```
--g1 #6d1414   --g2 #8a2318   --g3 #a63c1c   --g4 #bd6320   --g5 #c78d1d
--g6 #8f9440   --g7 #5f8a6e   --g8 #3f7f8c   --g9 #2c5f8f   --g10 #1d3f79
```

**Accent** — seven values from `ACCENTS` in `tessera-data.js`, black `#101112` default,
and it appears in exactly three places (brief §14.2): primary buttons, active navigation,
focus ring. `--accent-tint` is derived — the accent's hue at ~55% saturation, ~52%
lightness, falling back to steel `#5A6472` for black, and **never resolving to pure black
or white** (brief §8, brief §14.7). The ID card and the Iter button read from the tint, which is
why they stay visible under the default black accent.

**Components**

- `ThemeProvider` — writes `data-tt="dark|light"` on the frame element, follows
  `prefers-color-scheme` when `system`. 600ms transition on background and colour, per the
  design's inline transitions.
- `AccentProvider`, `BackgroundProvider` — set `--accent`, `--accentFg`, `--accent-tint`,
  and select mesh opacity (`meshDeepOp` / `meshAuraOp` in the design).
- `GradientMesh` — 4–5 feathered `radial-gradient` blobs, brief §5.1. Rendered **only** on
  login, splash, the ID card, widget surfaces, the Iter panel and full-bleed empty states.
  **Never behind the gradebook, mosaic, tables or analytics** — flat `--bg-base` there,
  because REC-3 says a translucent layer over a gradient destroys the mosaic's only job.
- `Grain` — the `feTurbulence` overlay, `baseFrequency 0.8`, 3 octaves, `opacity .055`,
  `mix-blend-mode: overlay`, `pointer-events: none`. **Not optional** (brief §5.2, brief §14.5).
- `Glass` — the two-layer technique of brief §5.3: a solid object with a frosted panel
  partially over it. Never a single translucent rectangle. A counter enforces **at most 8
  `backdrop-filter` elements per screen** (brief §14.9) and warns in development past that.
- `SidebarNav` (web, collapsible), `PillNav` + `DockedQrButton` (mobile),
  `AppHeader` (**no language switcher** — PRD §12 L-7), `OfflineBanner`, `EmptyState`,
  `Button`, `Input`, `Sheet`, `Dialog`, `Toast`.
- `Breakpoints` — 768px and 900px, matching PL-1, defined once in the Tailwind config.

**i18n** — `src/i18n/{hy,en,ru}.ts`, lifted verbatim from the `T` dictionary in
`tessera-data.js`, keeping the existing area keys so the design and the code use the same
names: `nav`, `common`, `auth`, `set`, `exp`, `ov`, `sj`, `st`, `ar`, `cr`, `q`, `gb`,
`id`, `dlg`, `err`, `off`, `pwa`, `an`, `cls`, `scr`, `ts`, `w`. Armenian is the source
(L-1). `useT()` returns the active dictionary; `<T k="nav.overview" />` is not used —
plain function calls keep types checkable.

`err` maps every backend code to a sentence in three languages. **An unmapped code renders
as the code itself, visibly and ugly, in development** — a silent fallback to "Something
went wrong" is how untranslated errors ship.

`npm run i18n:check` asserts hy/en/ru have identical key sets and no empty values, and
that no file under `src/app` or `src/components` contains an Armenian character (L-2).

**Routing** — the `(app)` group and its layout: `AuthGate` → shell → page. Nav items from
`T.nav` and `ICON` in `tessera-data.js`, filtered by role (PRD §8). Placeholder pages for
`/overview`, `/subjects`, `/archive`, `/credentials`, `/id`, `/gradebook`, `/queue`,
`/settings`, `/admin`.

**State** — `LocaleProvider`, `ThemeProvider`, `AccentProvider`, `BackgroundProvider`,
`LayoutModeProvider` (the preview switch), `OnlineProvider`. All context; still no store
library.

### Done when

1. `/dev/tokens` renders every token as a labelled swatch. Every one resolves — no
   computed value is the literal string `var(--…)` or `initial`.
2. `npm run tokens:check` exits 0. Introduce `color:#ff0000` in a component → it exits 1.
   Remove it.
3. `npm run i18n:check` exits 0. Delete one key from `ru.ts` → exits 1 naming the key.
   Restore it.
4. **Language switch with no reload and no state loss** (SET-4): open a placeholder screen,
   scroll halfway, switch HY → RU. Text changes, scroll position holds, no network
   document request in the Network tab. Repeat at EN. Check the sidebar, the pill nav and
   the buttons at RU — Russian runs 15–20% longer and nothing may clip or wrap to two
   lines (L-5).
5. Theme: light / dark / system. Toggle the OS setting with `system` selected and the app
   follows without a reload.
6. Accent: cycle all seven. **Only** the primary button, the active nav item and the focus
   ring change colour. Screenshot the same screen at black and at ochre and diff — nothing
   else moves.
7. `--accent-tint` at the black accent resolves to `#5A6472`-ish steel, not black. Read it
   in devtools' computed styles.
8. Grain is present on every gradient surface. Zoom to 400% and it is visible; set its
   opacity to 0 and the surface visibly flattens — that difference is why brief §14.5 exists.
9. Mobile shell at 390px: the pill nav floats, the QR button is docked at `bottom: 29px`
   as a sibling of the pill with a background-colour border and **no notch cut into the
   pill**. Measure it in devtools.
10. The Web/Mobile switch appears at 1200px and is **absent** at 899px. Resizing the window
    changes the layout on its own — the user is never asked (PL-3).
11. Count `backdrop-filter` elements on the busiest screen:
    `[...document.querySelectorAll('*')].filter(e=>getComputedStyle(e).backdropFilter!=='none').length`
    → ≤ 8.
12. `document.documentElement.lang` changes with the locale, and the OS's reduce-motion
    setting stops the 600ms theme transition.

---

# Phase 5 — Administration setup

### Delivers

A director sets the school up in one sitting, imports six hundred students from a
spreadsheet after seeing every problem before anything is written, and prints a login
sheet per class.

**Why here.** Without a roster the student and teacher features have nothing to operate
on, and this is the largest area of new work in the project (PRD §16, risk 4). Discovering its
size in Phase 12 would be fatal.

### Screens

**None of these exist in the design package.** Per C13: full token layer, no glass, no
gradient, no grain, higher density, and **shown to the author before moving on**.

| Screen | Route | Build note |
|---|---|---|
| Admin overview / setup checklist | `/admin` | Sequenced list with completion state. It is the answer to "what do I do next" and it is the difference between a director finishing and a director calling the author (PRD §15) |
| Institution | `/admin/institution` | Name, region, type. Entered once (ADM-1) |
| Years and terms | `/admin/years` | Year with dates, terms with dates and index |
| Subjects | `/admin/subjects` | Table, inline edit, three name columns side by side (ADM-2). Trilingual names in one row, not three tabs |
| Classes + generator | `/admin/classes` | The generator is the primary action, not an "advanced" affordance (ADM-3) |
| Import — upload | `/admin/import/students`, `/admin/import/teachers` | Template download above the drop zone, because downloading it is the first thing that happens |
| **Import — preview** | `/admin/import/[batchId]` | The most important screen in the phase. Every row, problems marked in place, inline editable. **Maximum contrast, zero decoration** — the task is finding twelve bad rows in six hundred (ADM-4) |
| Teacher assignment grid | `/admin/assignments` | Teachers as rows, classes as columns, subject in the cell. **A readable grid, never a list of pairs** (ADM-5) — administrators get this wrong and a list of 40 pairs is why |
| Credential handout | `/admin/handout/[classId]` | Print stylesheet, one A4 page per class (ADM-6) |
| Roster | `/admin/roster` | Add mid-year, transfer, mark departed. **Departure sets a status; it never deletes** (ADM-7) |

### Backend

`modules/admin/`. Every route is `role = 'admin'` and scoped to the actor's
`institution_id`; a request naming another institution's id returns `NOT_FOUND`, not
`FORBIDDEN`.

**Structure**

| Method | Path | Notes |
|---|---|---|
| `GET` `PATCH` | `/api/admin/institution` | `{ name, region, type }` |
| `GET` `POST` `PATCH` | `/api/admin/academic-years` | `{ label, startsOn, endsOn }` |
| `GET` `POST` `PATCH` `DELETE` | `/api/admin/terms` | `{ academicYearId, index, label, startsOn, endsOn }` |
| `GET` `POST` `PATCH` `DELETE` | `/api/admin/subjects` | `{ nameHy, nameEn, nameRu, code? }` |
| `GET` `POST` | `/api/admin/classes` | `{ academicYearId, grade, letter }` |
| `POST` | `/api/admin/classes/generate` | the range generator |
| `GET` | `/api/admin/roster` | `?classId=&status=` |
| `POST` | `/api/admin/students` | single mid-year addition |
| `PATCH` | `/api/admin/enrollments/:id` | transfer or depart |
| `GET` `POST` `DELETE` | `/api/admin/assignments` | teaching assignments |
| `GET` | `/api/admin/import/template` | `?kind=students\|teachers` → `.xlsx` |
| `POST` | `/api/admin/import` | multipart, creates a preview batch |
| `GET` | `/api/admin/import/:batchId` | re-read a preview |
| `PATCH` | `/api/admin/import/:batchId/rows/:rowIndex` | fix one row, revalidate it |
| `POST` | `/api/admin/import/:batchId/apply` | transactional commit |
| `POST` | `/api/admin/import/:batchId/discard` | |
| `POST` | `/api/admin/classes/:id/credentials` | reissue temporary passwords |

**`POST /api/admin/classes/generate`**

```json
{ "academicYearId": "…", "grades": [9,10,11,12], "letters": ["Ա","Բ","Գ","Դ"] }
```

`201`

```json
{ "created": [ { "id":"…", "grade":9, "letter":"Ա" } ],
  "skipped": [ { "grade":9, "letter":"Բ", "code":"CLASS_ALREADY_EXISTS" } ] }
```

Sixteen classes in one action. Existing combinations are skipped, not errors — an
administrator re-running the generator after adding a letter must not be punished for it.

| Code | HTTP |
|---|---|
| `CLASS_ALREADY_EXISTS` | (in `skipped`, not a response error) |
| `GENERATE_RANGE_TOO_LARGE` | 422 — over 60 combinations. `details.max` |
| `VALIDATION_FAILED` | 422 |

**`GET /api/admin/import/template?kind=students`** → `.xlsx` stream. Column headers in
Armenian (from `Accept-Language`, defaulting hy) and **two example rows** (ADM-4). Columns:
`Ազգանուն`, `Անուն`, `Հայրանուն`, `Ծննդյան ամսաթիվ`, `Դասարան`, `Էլ. փոստ`.
Teachers: `Ազգանուն`, `Անուն`, `Հայրանուն`, `Էլ. փոստ`, `Առարկա`, `Դասարաններ`
(comma-separated).

**`POST /api/admin/import`** — multipart, `file` + `kind`. Writes one `import_batch`
(`status = 'previewing'`) and one `import_row` per line with `raw` as jsonb (ADM-8), and
**writes nothing to `student`, `teacher` or `"user"`**.

`201`

```json
{
  "batchId": "…", "kind": "students", "filename": "students-2026.xlsx",
  "rowCount": 600, "errorCount": 12, "warningCount": 3,
  "status": "previewing",
  "rows": [
    { "rowIndex": 1, "status": "ok",
      "raw": { "lastName":"Հովհաննիսյան", "firstName":"Անի", "patronymic":"Արամի",
               "birthDate":"2009-04-12", "className":"11-Բ", "email":"ani.h@school55.am" },
      "resolved": { "classId": "…" } },
    { "rowIndex": 47, "status": "error", "issues": [
        { "field": "lastName",  "code": "ROW_MISSING_LAST_NAME" },
        { "field": "className", "code": "ROW_UNKNOWN_CLASS", "details": { "value": "11-Դ" } } ] }
  ]
}
```

Row issue codes — the client translates each; the backend never sends the sentence:

`ROW_MISSING_LAST_NAME` · `ROW_MISSING_FIRST_NAME` · `ROW_INVALID_DATE` ·
`ROW_DATE_IMPLAUSIBLE` (born after the year starts, or over 25) · `ROW_UNKNOWN_CLASS` ·
`ROW_UNKNOWN_SUBJECT` · `ROW_INVALID_EMAIL` · `ROW_DUPLICATE_IN_FILE`
(`details.otherRowIndex`) · `ROW_DUPLICATE_IN_DB` (`details.existingStudentId`) ·
`ROW_EMAIL_TAKEN` · `ROW_EMPTY`.

Batch-level:

| Code | HTTP |
|---|---|
| `IMPORT_FILE_UNREADABLE` | 400 |
| `IMPORT_COLUMNS_MISSING` | 422 — `details.missing[]` |
| `IMPORT_TOO_MANY_ROWS` | 422 — over 2000 |
| `UNSUPPORTED_MEDIA_TYPE` | 415 — content-inspected, not extension-trusted (S-6) |
| `PAYLOAD_TOO_LARGE` | 413 |

**`PATCH /api/admin/import/:batchId/rows/:rowIndex`** — `{ "raw": { … } }`, revalidates
that row alone and returns it. This is what lets twelve bad rows out of six hundred be
fixed **without re-uploading** — and re-uploading a 600-row file to fix a typo is exactly
the moment a director gives up.

**`POST /api/admin/import/:batchId/apply`** — `Idempotency-Key`. One transaction: students,
users with generated temporary passwords, `must_change_password = true` (S-12),
enrollments, and for teachers their `teaching_assignment` rows. Sets
`import_batch.status = 'applied'`, `applied_at`, and each row's `created_entity_id`.

`200`

```json
{
  "batchId": "…", "created": { "students": 588, "users": 588, "enrollments": 588 },
  "credentials": [ { "studentId":"…", "fullName":"Անի Հովհաննիսյան",
                     "login":"ani.h@school55.am", "temporaryPassword":"Kf7-mQ2p",
                     "classLabel":"11-Բ" } ]
}
```

| Code | HTTP |
|---|---|
| `IMPORT_BATCH_NOT_PREVIEWING` | 409 — already applied or discarded |
| `IMPORT_HAS_ERRORS` | 409 — `details.errorRowIndexes[]`. All-or-nothing (PRD §11.2) |
| `IMPORT_BATCH_EXPIRED` | 410 — previews live 24h |

**The temporary-password trap, stated plainly.** `credentials` is returned **once**, at
apply, and the plaintext is never persisted in any form (S-2). If the administrator closes
that tab, those passwords are gone. That is correct and it is also a usability cliff, so
`POST /api/admin/classes/:id/credentials` regenerates temporary passwords for every account
in a class that still has `must_change_password = true`, returns the new sheet, and logs to
`audit_log`. It refuses accounts that have already set their own password —
`CREDENTIALS_ALREADY_CHANGED` in a `skipped[]` array. Build this in the same session as
apply; it will be needed the first day a school uses the product.

**`PATCH /api/admin/enrollments/:id`** — `{ "status": "transferred", "toClassId": "…" }` or
`{ "status": "departed" }` → `200`. **No `DELETE` endpoint exists for students** (ADM-7).
Departure sets a status, and the academic record survives.

| Code | HTTP |
|---|---|
| `ENROLLMENT_TRANSITION_INVALID` | 409 — `details.from`, `details.allowed[]` |
| `ENROLLMENT_TARGET_CLASS_INVALID` | 422 |

**Performance (600 rows under 30s, PRD §11.1).** Three things decide it, and getting any wrong
loses the target by an order of magnitude:

1. **Preview must not be N+1.** Load all classes and all existing student names for the
   institution once into `Map`s, then validate rows in memory. Never one `SELECT` per row.
2. **Insert in bulk.** Drizzle `insert().values(array)` in chunks of 500 inside one
   transaction. Not 600 `INSERT`s.
3. **Argon2 is the bottleneck**, not Postgres. 600 hashes at ~60ms each is 36 seconds on
   one core. Hash across a worker pool sized to `os.cpus().length - 1`, generating all
   passwords first, then hashing in parallel, then inserting. Measure this before assuming
   it is fine.

### Frontend

**Routing** — the `/admin` subtree above, under `(app)`, gated on `role === 'admin'`. A
student hitting `/admin` sees the not-found screen, not a redirect that reveals the route
exists.

**Components**

- `SetupChecklist` — reads a computed completeness object; each item links to its screen.
- `SubjectTable`, `TermEditor` — dense inline-edit tables built from `Input` and the token
  type scale.
- `ClassGenerator` — grade multi-select × letter multi-select, with a live preview of the
  sixteen names it will create *before* the request. Seeing "16 classes" before pressing is
  what makes a bulk action safe to press.
- `ImportDropzone` — drag and drop plus a file picker, template link above it.
- **`ImportPreviewTable`** — virtualised (`@tanstack/react-virtual`); 600 rows of real DOM
  is what breaks the 30-second target on the client side. Row states `ok` / `warning` /
  `error` marked with **an icon and a border, not colour alone** (PRD §11.3). A filter chip row
  — `All · Errors (12) · Warnings (3)` — defaulting to **Errors** when any exist, because
  the administrator's task is those twelve rows and no other. Cells edit in place and
  `PATCH` on blur; the row's status updates from the response.
- `AssignmentGrid` — teachers × classes, subject chips in cells, pinned first column and
  header row.
- `HandoutSheet` — a print stylesheet: `@page { size: A4; margin: 14mm }`,
  `break-after: page` per class, no glass, no gradient, black on white.
- `RosterTable`, `DepartDialog`, `TransferDialog`.

**State**

- `useImportBatch(batchId)` — the batch is **server state**, held in `import_row`, not
  client state. The preview survives a page reload, which is the entire reason ADM-8 says
  the rows are persisted. Poll nothing; refetch on mutation.
- `useSetupProgress` — derived from the structure endpoints, cached.
- The credential sheet from `apply` lives in memory only, and the handout screen warns
  before navigation that the passwords cannot be retrieved and offers the reissue path.

### Done when

1. **Show the author the preview screen and the assignment grid before continuing.** C13.
2. Institution, one year, two terms, ten subjects — entered from empty in one sitting
   without touching the database.
3. Class generator: grades 9–12 × letters Ա–Դ → **16 classes in one action**. Run it again
   → 16 skipped, zero created, no error.
4. Download the student template. Open it in Excel: Armenian headers render, two example
   rows present.
5. Build a 600-row file (copy a good row and vary it) and **plant twelve specific
   defects**: 3 missing surnames, 2 malformed dates, 2 unknown classes, 3 duplicated
   within the file, 2 duplicating a student already in the database. Upload.
   - The preview appears in **under 30 seconds** — time it.
   - `errorCount` is exactly 12 and the filter defaults to Errors.
   - `select count(*) from student` and `from "user"` are **unchanged**. Check this before
     confirming anything.
6. Fix all twelve **inline**, without re-uploading. `errorCount` reaches 0.
7. Reload the browser mid-preview. The preview is still there with the fixes intact —
   because it lives in `import_row`.
8. Confirm. Counts rise by 588. Every new user has `must_change_password = true`:
   `select count(*) from "user" where must_change_password = false and created_at > now() - interval '5 minutes'` → 0.
9. Apply the same batch again → `IMPORT_BATCH_NOT_PREVIEWING`.
10. Upload a file with one error and press apply → `IMPORT_HAS_ERRORS`, and **nothing** is
    written. Verify with counts.
11. Rename `something.exe` to `roster.xlsx` and upload → `UNSUPPORTED_MEDIA_TYPE`, rejected
    by content inspection.
12. Teacher import: 8 teachers with 3–5 assignments each. The grid shows teachers as rows
    and classes as columns. Confirm → `select count(*) from teaching_assignment` matches.
13. Handout: print `/admin/handout/[classId]` to PDF. One A4 page per class, name / login /
    temporary password, legible, no decoration bleeding into the margin.
14. Reissue: `POST /api/admin/classes/:id/credentials` → new passwords for untouched
    accounts, `CREDENTIALS_ALREADY_CHANGED` in `skipped` for one where you first changed the
    password manually.
15. Mark a student departed. `select * from student where id=…` → **the row still exists**;
    the enrollment status is `departed`; their marks are still queryable. There is no
    endpoint that deletes a student — `grep -rn "delete.*student" backend/src` finds no
    route.
16. Transfer a student between classes → the old enrollment reads `transferred`, a new
    `active` one exists, and prior marks stay attached to the old class.
17. Log in as the demo student and hit `/admin` → not found. `curl` an admin endpoint with
    the student's token → `FORBIDDEN`.

---

# Phase 6 — Student ID, static QR, offline

### Delivers

The most-used feature in the product: a student opens their ID and shows it in under three
seconds, with no network.

### Screens

| Screen | Design reference |
|---|---|
| ID card — student | brief §10; `Tessera.dc.html` → `sc-if isId`. Portrait 3:4, vertical gradient from `--accent-tint` (near-white at the top), mark in the upper third, name in the lower third, role and institution beneath |
| QR sheet | brief §10 "The QR sheet"; `sc-if qrOpen`. Slides over the lower two thirds |
| ID card — teacher | brief §10 "Teacher variant". Role, subject, classes as chips, and an "Այսօրվա դասերը" panel below the card (`sc-if isToday`) |
| Offline state | `T.off.*`. **Nothing greyed out, nothing disabled**, and the interface states plainly `Աշխատում է առանց ինտերնետի` (ID-8) |
| Scanner page | **No design precedent** — build from primitives per C13. Camera, result, pass or fail, readable at arm's length in a doorway |
| Scan-anomaly view (admin) | **No design precedent** — dense table. A two-location pair must be obvious at a glance |

### Backend

`modules/identity/`.

| Method | Path | Auth |
|---|---|---|
| `GET` | `/api/me/credential` | bearer |
| `GET` | `/api/me/today` | bearer, teacher |
| `POST` | `/api/verify` | scanner key |
| `GET` | `/api/verify/anomalies` | bearer, admin |

**`GET /api/me/credential`** → `200`

```json
{
  "credentialId": "…",
  "payload": "AEAQCAIBAEAQCAIB.AXCARQXW6OM2GDTQ",
  "issuedAt": "2026-08-20T09:00:00+04:00",
  "holder": {
    "role": "student", "firstName": "Անի", "lastName": "Հովհաննիսյան",
    "institutionName": "Երևանի թիվ 55 ավագ դպրոց", "classLabel": "11-Բ",
    "tesseraId": "TSR-AM-4471-0288"
  }
}
```

For a teacher, `classLabel` is replaced by `subjectName` and `classLabels: []`.

**The payload must be short, and this is a measured constraint, not a preference.**

An earlier draft of this phase specified a compact JWS over `{ sid, iid, iat }`. Measured:
two uuids plus a timestamp, base64url-encoded, with a header and a 256-bit HMAC, is **225
characters** — QR version 11, **61×61 modules**. The design prototype draws `const N = 21`
(`Tessera.dc.html`), a 21×21 code. A 61×61 code on the same physical card makes each module
just over a third the size, and **ID-6's 45%-of-module-width corner rounding was chosen at
21×21**. At triple the density that rounding erodes a meaningful fraction of each module and
scanning gets worse, which defeats the point of the styling.

So the payload is an **opaque handle plus a truncated MAC**, not a self-describing token:

```
payload = base32(handle) + "." + base32(mac)      // 16 + 1 + 16 = 33 characters
handle  = HMAC-SHA256(QR_HANDLE_KEY, qr_credential.seed)[0..10]
mac     = HMAC-SHA256(QR_SIGNING_SECRET, handle)[0..10]
```

**Encode as alphanumeric, error correction level Q.** Both halves of that sentence change
the answer, so neither is optional:

| Encoding | EC L | EC M | **EC Q** | EC H |
|---|---|---|---|---|
| **alphanumeric** | 25×25 | 25×25 | **29×29** | 29×29 |
| byte | 29×29 | 29×29 | 33×33 | 33×33 |

Measured with `segno` on the exact 33-character payload. **29×29 is true only at Q or H**;
a library left on its default lands somewhere else in that table.

- **Alphanumeric mode** works because base32 is **uppercase** and `.` is in QR's
  alphanumeric set (`0-9 A-Z space $ % * + - . / :`). Lowercase **any** character and the
  encoder silently falls back to byte mode and the version jumps. Emit uppercase, and
  uppercase on the way in at `/api/verify` before validating.
- **EC level Q**, not M. ID-6's rounding does not consume error-correction codewords — it
  raises the *probability that a module is misread*, which the EC budget then has to
  absorb. A stylised code needs a larger budget than a plain one, not a smaller one. Q also
  keeps the code readable when the card is a photograph of a screen, which is the normal
  case at a door.

Re-verify if the format changes by even one character.

Deriving `handle` from `qr_credential.seed` rather than using the column directly means the
format is fixed at 10 bytes **whatever the live seed column happens to contain** — which
matters, because C2 forbids changing that column and its current contents are whatever the
applied seed put there.

**`handle` is not stored anywhere, and no column is added for it** (C2). The verifier builds
a `Map<handle, credentialId>` once at boot from `select id, student_id, seed from
qr_credential`. At a few hundred students this is a millisecond and a few kilobytes. Say
this explicitly in the phase text, because the obvious reading of "look up by handle" is
"add an indexed column", and that is exactly the change C2 forbids.

**The map resolves the handle and nothing else. `/api/verify` re-reads `revoked_at` from
the row on every scan.** This matters because the host may run more than one instance: a
revocation performed on instance A never reaches instance B's map, and a map that answered
"revoked?" from memory would wave a revoked card through the door on whichever instance
happened to serve the request. With the row read per scan, a stale map can only fail to
*find* a newly issued credential — the harmless direction, resolved by the next rebuild —
and can never miss a revocation.

Rebuild the map on issuance and on a short interval; do not rely on it for any decision.

Three consequences to hold on to:

- **80-bit MAC is sufficient here.** Forging one requires ~2⁸⁰ work for the reward of
  impersonating one student at one door, and per ID-4's own rationale the real control is
  the server-side scan log (ID-9), not the code's unforgeability.
- **The payload now carries no identifiers at all** — it is a pure lookup handle, which is
  *stronger* than ID-7 and S-8 require, not weaker. But it means a scanner **cannot resolve
  a name offline**; it must reach `/api/verify`. That is already true, because ID-9 requires
  every scan to be logged server-side regardless.
- **`iat` leaves the payload entirely.** `issued_at` is still returned in the JSON envelope
  for display; it is simply no longer inside the code. This removes a whole class of bug —
  a `timestamptz` serialised one way in development and another in production would produce
  two different codes for the same student, silently.

**ID-4 — the code is static, and this is the requirement most likely to be broken by
accident.** Both keys are fixed, `seed` is fixed, so the output is fixed. It has no expiry.

- The same student calling this endpoint on Monday and in March receives a
  **byte-identical** string.
- Assert it in a unit test: derive twice, `expect(a).toBe(b)`. Assert it again in a test
  that stubs the clock to a different date — if a timestamp ever creeps back in, that test
  fails immediately rather than in March.
- Nothing in the derivation reads the clock. `grep` the identity module for `Date.now`,
  `new Date` and `now()` — the credential path must not contain one.

**ID-7 — the payload carries identifiers only, and now not even those.** No name, no marks,
no birth date. Adding a display name "to make scanning nicer" is a data-protection change to
a minor's record, not a convenience.

| Code | HTTP | Cause |
|---|---|---|
| `CREDENTIAL_REVOKED` | 409 | `qr_credential.revoked_at` is set |
| `CREDENTIAL_MISSING` | 404 | no `qr_credential` row — an administrative fault, surfaced not hidden |

**`POST /api/verify`** — the verifier side, satisfying ID-9. Authenticated by
`X-Scanner-Key: $SCANNER_API_KEY`, **not a user token**, because a door reader is not a
person and `"user".role` is `enum('student','teacher','admin')` which C2 forbids extending.
There is no `scanner` role and no `requireRole('scanner')`; the middleware is
`requireScannerKey`, a separate five-line guard that shares nothing with `requireAuth`.
`scan_event.scanner_id` is `text` because it holds a **device label** (`gate-north`), not a
user id — the schema already anticipated this.

**Accepted limitation, recorded as a decision rather than left as a gap.** One shared
`SCANNER_API_KEY` means the door **declares its own `scanner_id`**, unverified. Two
consequences follow and both are accepted for v1:

- ID-9's anomaly rule compares two self-declared labels. A device that lies about its label
  defeats the rule. It does not defeat the rest of the log — the credential, the time and the
  fact of the scan are all still recorded.
- A key leaked at one door cannot be revoked without rotating every door.

At pilot scale — one school, a handful of readers, all physically controlled — this is
proportionate. It stops being proportionate the moment a second institution shares
infrastructure, at which point the fix is per-device keys, which **is** a schema change and
therefore a post-C2 decision. Note it in the risk register now so it is not rediscovered
later as a defect.

```json
{ "payload": "eyJ…", "scannerId": "gate-north", "location": "Main entrance" }
```

`200`

```json
{
  "result": "valid",
  "student": { "firstName": "Անի", "lastName": "Հովհաննիսյան", "classLabel": "11-Բ",
               "institutionName": "…", "enrollmentStatus": "active" },
  "anomaly": { "flagged": true, "reason": "MULTI_LOCATION_WINDOW",
               "previousScannerId": "gate-south", "secondsAgo": 30 }
}
```

`result` ∈ `valid` | `revoked` | `unknown` | `signature_invalid` | `not_enrolled`. **Every
call writes a `scan_event`**, including failures — a log that records only successes cannot
detect the thing it exists to detect.

Anomaly rule: the same `qr_credential_id` scanned at two different `scanner_id`s within 120
seconds. This — not code rotation — is how a shared screenshot is caught (ID-4 rationale).
Raw SQL is permitted here for the window query.

| Code | HTTP |
|---|---|
| `SCANNER_UNAUTHORISED` | 401 |
| `SCAN_PAYLOAD_MALFORMED` | 400 |

`GET /api/verify/anomalies?since=` → the flagged events, paginated.

**`GET /api/me/today`** (teacher) → today's lessons for the ID card panel.

> ❓ **There is no timetable in PRD §10** and timetable is an explicit non-goal (PRD §3.2). So this
> endpoint derives its list from assessments dated today plus the teacher's assignments,
> and returns `[]` when there is nothing. The panel then shows its empty state. Do not
> invent a `lesson` table — that is scope creep wearing a small disguise.

### Frontend

**Routing** — `/id` inside `(app)`. It is the mobile pill nav's docked centre button and a
sidebar item on web.

**Components**

- `IdCard` — 3:4, vertical `--accent-tint` gradient, `GradientMesh` + `Grain`. Dark in both
  themes; at the default black accent the tint resolves to steel and the card reads as
  near-black (ID-2, brief §10).
- **`TesseraQR`** — the exacting one. Matrix from `qrcode-generator` (error correction M),
  then a **custom SVG path builder**, because no off-the-shelf renderer produces ID-6's
  shape language:
  - Adjacent dark modules merge into continuous rounded shapes.
  - A corner is rounded at **45% of a module's width only where there is no neighbour** —
    so it is a per-corner neighbour test, four per module, not a per-module radius.
  - Finder patterns: 30% outer radius, fully rounded inner block.
  - Four L-shaped corner brackets **outside** the quiet zone.
  - **Quiet zone: four clear modules on every side, never reduced.** This is the single
    most common cause of a code that "sometimes" scans.
  - Solid **white** card, 24px radius. White, not cream — scanners are calibrated for white
    (ID-5).
  - No countdown, no progress ring, no refresh affordance, no `setInterval` anywhere in the
    file. Its props are `{ payload }` and it is `React.memo`'d on that string.
- `QrSheet` — slides over the lower two thirds, `Sheet` primitive, swipe to dismiss.
- `TeacherIdCard`, `TodayPanel`.
- `OfflineCredentialStore` — IndexedDB (`idb`), store `credential`, one record. Written on
  every successful `/api/me/credential`, read first on mount.

**State** — `useCredential()`: read IndexedDB → render immediately → revalidate from the
network in the background. Cache-first, not network-first. Network-first costs the
sub-500ms open (PRD §11.1) at a door with one bar of signal, which is precisely the situation
the feature exists for.

**Offline** — Phase 13 owns the service worker, but the `/id` route shell and its assets
are **precached in this phase** because ID-8 is a Phase 6 acceptance criterion and cannot
be deferred. A minimal Workbox precache for the route, extended in Phase 13.

### Done when

1. Log in as the demo student, open `/id`. Card renders: portrait 3:4, steel-dark gradient
   at the default accent, name in the lower third.
2. Open the QR. **Watch it for two continuous minutes.** No change of any kind — no
   flicker, no re-render, no countdown. Confirm in devtools: no timer fires, and React
   DevTools shows zero re-renders of `TesseraQR`.
3. Call `/api/me/credential` three times, an hour apart, and diff the `payload` strings.
   Byte-identical.
4. **Airplane mode.** Enable it, hard-reload `/id`. The card and the QR open and display
   **fully**. `Աշխատում է առանց ինտերնետի` is stated. Nothing is greyed out, nothing is
   disabled.
5. Decode the QR with any phone scanner app. The decoded string is **33 characters**, two
   base32 groups separated by a dot. **No name, no marks, no birth date — and no identifier
   of any kind.** Paste it anywhere you like; without the database it means nothing.
6. **Count the modules.** Zoom the rendered QR and count along one edge: **29**, not 21 and
   not 61. If it is 61, the payload grew back into a self-describing token and ID-6's
   rounding is now working against a code three times denser than it was designed for.
7. **The clock is not an input.** `grep -rnE "Date\.now|new Date|now\(\)" backend/src/modules/identity`
   → no hit on the credential derivation path. Then stub the system clock forward a year in
   a test and derive again → byte-identical.
8. Scan it with a physical scanner, or a phone camera at arm's length, in normal indoor
   lighting. **First attempt.** If it takes two, check the quiet zone before anything else.
9. Measure the quiet zone by hand: count the white modules from the outermost dark module
   to the card edge. Four, on all four sides.
10. `POST /api/verify` twice, 30 seconds apart, with `scannerId: "gate-north"` then
    `"gate-south"`. The second returns `anomaly.flagged: true` with
    `MULTI_LOCATION_WINDOW`. `GET /api/verify/anomalies` lists it. `select count(*) from
    scan_event` rose by 2.
11. Scan with a tampered payload (change one character) → `result: "signature_invalid"`, and
    a `scan_event` **is still written**.
12. **Scanner auth.** `POST /api/verify` with no `X-Scanner-Key` → `SCANNER_UNAUTHORISED`.
    With a *user's* bearer token instead → `SCANNER_UNAUTHORISED`, not a 200. And
    `grep -rn "requireRole('scanner')\|'scanner'" backend/src` → no hit; the role enum was
    never touched.
13. **Revocation under more than one instance.** Pick a seeded credential and revoke it directly:

```sql
update qr_credential set revoked_at = now() where id = '<id>';   -- revoke
-- … scan repeatedly, from several requests …
update qr_credential set revoked_at = null  where id = '<id>';   -- PUT IT BACK
```

**Every** scan must return `revoked`, including ones served by an instance that has not
rebuilt its handle map. If any returns `valid`, the map is being used for the decision
rather than for the lookup.

**Restore `revoked_at` to null when finished.** Forgetting leaves one seeded student holding
a permanently dead card, and the next person to open that account will debug the wrong
thing entirely.
14. Log in as the demo teacher, open `/id`: the teacher variant, role, subject, class chips,
    and the today panel — populated or showing its empty state, never blank.
15. At the ochre accent the card changes hue but stays dark in **both** themes. At black it
    is near-black in both.

---

# Phase 7 — Academic record

### Delivers

A student sees their whole record — this term, this year, previous years — in an interface
built for them, and can see that a correction happened and why.

### Screens

| Screen | Design reference |
|---|---|
| Overview / mosaic | `Tessera.dc.html` → `sc-if isOverview`; `T.ov.*`. One row per subject, one tile per mark |
| Subjects list | `sc-if isSubjects`; `T.sj.*` |
| Subject detail | `T.st.*`. Mark sequence, average, trend, topic breakdown |
| Archive | `sc-if isArchive`; `T.ar.*`, `ARCHIVE` fixture in `tessera-data.js`. Years expanding to final marks and attestations |
| Empty states | `T.scr.*`. **Every** student-reachable screen has designed copy (REC-9) |
| Mark history sheet | `T.dlg.*`. Previous value, new value, date, reason (REC-8) |

**REC-3 is load-bearing.** Mosaic tiles sit on an **opaque** surface — `--surface`, flat.
No `GradientMesh`, no glass, no translucency anywhere beneath a tile. A translucent surface
over a gradient shifts every tile's perceived hue and destroys the only thing the mosaic
exists to do.

### Backend

`modules/record/`. Every route: `role = 'student'`, own data only. A student id in a query
that is not the caller's returns `NOT_FOUND`.

| Method | Path |
|---|---|
| `GET` | `/api/me/record?termId=` |
| `GET` | `/api/me/subjects/:subjectId?termId=` |
| `GET` | `/api/me/archive` |
| `GET` | `/api/me/marks/:markId/history` |

**`GET /api/me/record`** → `200`

```json
{
  "term": { "id":"…", "label":"1-ին կիսամյակ", "index":1, "startsOn":"2026-09-01", "endsOn":"2026-12-28" },
  "availableTerms": [ { "id":"…", "label":"…", "index":1 } ],
  "class": { "id":"…", "label":"11-Բ" },
  "subjects": [
    {
      "subjectId": "…", "nameHy": "Մաթեմատիկա", "nameEn": "Mathematics", "nameRu": "Математика",
      "teacherName": "Ա. Սարգսյան",
      "average": 7.4, "trend": "up",
      "marks": [
        { "id":"…", "value":8, "heldOn":"2026-10-02", "kind":"lesson",
          "title":null, "topic":"Կոտորակային արտահայտություններ",
          "state":"published", "publishedAt":"…", "supersededFrom":null },
        { "id":"…", "value":9, "heldOn":"2026-10-14", "kind":"test",
          "state":"published", "supersededFrom": { "markId":"…", "value":6,
            "reason":"Սխալ գումարում ստուգողական աշխատանքում", "at":"2026-10-16T11:02:00+04:00" } }
      ],
      "credentials": [ { "id":"…", "title":"Օլիմպիադա · ֆիզիկա", "category":"olympiad", "approvedAt":"…" } ]
    }
  ]
}
```

The three name fields ship together and the client picks by locale — subject names are data
(L-4), not interface strings, so they cannot live in the `T` dictionary.

**REC-7, enforced in SQL not in a filter.** The query's `where` clause is
`state in ('published','superseded')`. **Drafts never enter the result set.** Not fetched
and hidden — not fetched. If a draft can be found anywhere in the JSON response, the draft
state is meaningless and GB-4's entire purpose has been lost.

`trend` is computed server-side: compare the mean of the last three marks to the mean of the
three before, `up` / `down` / `flat` at a ±0.4 threshold. Computed once on the server so the
overview and the detail screen can never disagree.

**`GET /api/me/subjects/:subjectId`** → the same subject object plus:

```json
{
  "topicBreakdown": [ { "topic":"Կոտորակային արտահայտություններ", "average":5.2, "markCount":4 } ],
  "topicCoverage": 0.62
}
```

`topicBreakdown` is `[]` and `topicCoverage` is `0` when no assessment carries a topic
(REC-10 ❓). The UI then degrades to the subject-level view. Both fixtures exist — the
audit registered `taggedAssessment` and `untaggedAssessment` in Phase 2 precisely so this
branch is testable.

**`GET /api/me/archive`** → previous years, each with final marks per subject and any
attestation. A `departed` or `graduated` enrollment still appears (ADM-7).

**`GET /api/me/marks/:markId/history`** → the supersession chain, oldest first, with actor
name, timestamp, from-value, to-value and reason.

| Code | HTTP | Cause |
|---|---|---|
| `RECORD_TERM_NOT_FOUND` | 404 | `termId` not in this institution |
| `RECORD_NO_ENROLLMENT` | 409 | authenticated student with no enrollment — an administrative fault, not an empty screen |
| `FORBIDDEN` | 403 | role is teacher or admin. They use the gradebook |

**REC-6 — there is no write endpoint in this module.** Not a guarded one; none. `grep`ing
`modules/record` for `insert`, `update` or `delete` returns nothing, and that is the
verification.

### Frontend

**Routing** — `/overview`, `/subjects`, `/subjects/[subjectId]`, `/archive`.

**Components**

- `Mosaic` → `MosaicRow` → `MarkTile`. `MarkTile` colours from `var(--g{n})` **only** — no
  computed shade, no opacity applied to a grade colour, no hover that lightens it. Opacity
  on a grade colour is a change to a grade colour (REC-2).
- `SubjectCard`, `SubjectDetail`, `MarkSequence`, `TrendIndicator`, `TopicBreakdown` (renders
  nothing when `topicBreakdown` is empty — not a "no data" card, just absent, with the
  detail view standing on its own).
- `ArchiveYear` (accordion), `AttestationCard`.
- `MarkHistorySheet` — old value → new value, date, reason, in full. The student sees this;
  corrections are not hidden from the person they concern (REC-8).
- `TermSwitcher`.
- `EmptyState` variants, one per screen, each with its own copy from `T.scr`: no marks yet,
  no subjects, no archive, no credentials.

**State** — SWR or TanStack Query, `staleTime` 60s, cache persisted to IndexedDB for the
offline read in Phase 13. Optimistic anything is meaningless here; the screen is read-only.

### Done when

1. Log in as the demo student. The mosaic renders one row per subject, tiles coloured by
   value.
2. **The colour test, done properly.** Pick a tile with value 7. In devtools read its
   computed `background-color`. Now change theme (light and dark), then all four
   backgrounds, then all seven accents — **twelve combinations** — re-reading the same
   tile each time. `rgb(95, 138, 110)` every time. One deviation means a grade colour is
   downstream of a theme token.
3. Confirm the mosaic's surface is opaque: select the container, computed
   `backdrop-filter: none`, and its `background-color` has alpha 1. No `GradientMesh` in its
   ancestors.
4. **Drafts are invisible.** From `fixtures.json` take `draftOwner` and find a student in
   that class. Log in as them. `curl` `/api/me/record` with their token and
   `grep -c '"draft"'` → 0. Search the rendered page for the draft's value — absent. Then
   log in as the teacher and confirm in the gradebook (Phase 8) that the draft is there.
   The same mark, visible to one and not the other, is the proof.
5. **Supersession.** Take `fixtures.supersededMarks[0]`, find its owning student, open that
   subject. The mark shows the correction; open the history sheet: **old value, new value,
   date and the reason in full.**
6. Topic breakdown present for the tagged subject; for the untagged one the detail view
   shows no breakdown section and does not look broken.
7. **Every empty state.** Log in as `fixtures.sparseStudent`. Overview, subjects, subject
   detail, archive, credentials — five screens, five designed states with real copy. Not
   one empty container, not one bare spinner that never resolves.
8. Archive: `fixtures.departedStudent` — their previous years and marks are intact and
   visible.
9. **Read-only, proven at the API.** `grep -rniE "\.(insert|update|delete)\(" backend/src/modules/record` →
   no hits. Then, as a student, `curl -X PUT /api/marks` with a real body → `FORBIDDEN`.
10. Switch language on the subject detail screen. Subject names change (they come from the
    payload), interface labels change (they come from `T`), and **mark values and colours do
    not move**.
11. Term switcher: change term, marks change, no full reload.

---

# Phase 8 — Teacher gradebook

### Delivers

A teacher enters a full column of marks with the keyboard alone, checks the work privately,
publishes to the class in one batch, and corrects mistakes afterwards in a way that leaves a
permanent record.

**This is the highest-load screen and adoption is decided here** (PRD §9.5). It is also the
phase where a shortcut is most expensive: a teacher who loses unsaved work once does not
come back.

### Screens

| Screen | Design reference |
|---|---|
| Gradebook grid | `Tessera.dc.html` → `sc-if isGradebook`; `T.gb.*`. Students as rows, assessments as columns |
| Class selector | GB-2. Pills on desktop, horizontally scrolling row on mobile, each showing class, subject and student count. `CLASSES` fixture in `tessera-data.js` |
| New assessment column | GB-10. A `+` cell at the end of the header row — **no dialog** |
| Publish confirmation | `sc-if confirmOpen`; `T.dlg.*` |
| Publish sweep | GB-13. One gradient sweep across the top of the content area. **No toast** |
| Cell history | GB-7. Who, when, from what to what, why |
| Mobile per-student list + bottom sheet | GB-12, below 768px |
| Correction dialog | Mandatory reason field |

### Backend

`modules/gradebook/`. Every route verifies a `teaching_assignment` row exists for
`(actor.teacherId, classId, subjectId, academicYearId)`. Absent → `NOT_FOUND`, per brief §13 S-4
and PRD §3.1.

| Method | Path |
|---|---|
| `GET` | `/api/teacher/classes` |
| `GET` | `/api/gradebook?classId=&subjectId=&termId=` |
| `POST` | `/api/assessments` |
| `PATCH` | `/api/assessments/:id` |
| `DELETE` | `/api/assessments/:id` |
| `PUT` | `/api/marks` |
| `DELETE` | `/api/marks/:id` |
| `POST` | `/api/marks/publish` |
| `POST` | `/api/marks/:id/supersede` |
| `GET` | `/api/marks/:id/history` |

**`GET /api/teacher/classes`** → the pills.

```json
[ { "classId":"…", "subjectId":"…", "termId":"…", "academicYearId":"…",
    "classLabel":"11-Բ", "subjectNameHy":"Հանրահաշիվ", "subjectNameEn":"Algebra",
    "subjectNameRu":"Алгебра", "studentCount":24, "draftCount":12 } ]
```

`draftCount` is on the pill so a teacher returning after a week can see where their
unpublished work is without opening four classes.

**`GET /api/gradebook`** → `200`. Flat arrays, not a nested matrix — the client builds the
grid, and a nested structure would make the 30×20 render budget harder to hit.

```json
{
  "class": { "id":"…", "label":"11-Բ" },
  "subject": { "id":"…", "nameHy":"Հանրահաշիվ" },
  "term": { "id":"…", "label":"1-ին կիսամյակ" },
  "students": [ { "id":"…", "firstName":"Անի", "lastName":"Հովհաննիսյան",
                  "enrollmentStatus":"active" } ],
  "assessments": [ { "id":"…", "heldOn":"2026-10-02", "kind":"lesson",
                     "title":null, "topic":"Կոտորակներ", "publishedMarkCount":24 } ],
  "marks": [ { "id":"…", "assessmentId":"…", "studentId":"…", "value":8,
               "state":"draft", "enteredAt":"…", "hasHistory":false } ]
}
```

Students are ordered by `last_name, first_name` **collated for Armenian** —
`order by last_name collate "hy-AM"`. Default alphabetical order is not Armenian
alphabetical order, and a teacher reading down a list that does not match their paper
register will not trust the screen.

`departed` students appear, marked, at the bottom. Their historical marks must stay
reachable (ADM-7).

**`PUT /api/marks`** — batch draft upsert. The client flushes a debounced buffer here.

```json
{ "classId":"…", "subjectId":"…", "termId":"…",
  "items": [ { "assessmentId":"…", "studentId":"…", "value":8 },
             { "assessmentId":"…", "studentId":"…", "value":null } ] }
```

`value: null` deletes that draft (the Backspace path). `200`

```json
{ "marks": [ { "id":"…", "assessmentId":"…", "studentId":"…", "value":8, "state":"draft" } ],
  "deleted": ["…"],
  "rejected": [ { "assessmentId":"…", "studentId":"…", "code":"MARK_ALREADY_PUBLISHED",
                  "currentMarkId":"…", "currentValue":7 } ] }
```

**Partial success is correct here.** A teacher typing down a column where one cell is
already published must have the other twenty-four saved and be told about the one. Failing
the batch would discard good work to report a foreseeable condition.

Implementation: `insert … on conflict (assessment_id, student_id) where state in
('draft','published') do update set value = excluded.value where mark.state = 'draft'` —
leaning directly on `one_current_mark`. Rows whose conflict target was `published` update
nothing and come back in `rejected`. The database decides; the application reports.

| Code | HTTP / location |
|---|---|
| `MARK_ALREADY_PUBLISHED` | in `rejected[]` — use supersede |
| `MARK_VALUE_OUT_OF_RANGE` | 422 — outside 1–10 |
| `MARK_STUDENT_NOT_IN_CLASS` | 422 |
| `MARK_TERM_MISMATCH` | 422 — assessment's term ≠ `termId` |
| `NOT_FOUND` | 404 — not this teacher's class–subject |

**`POST /api/marks/publish`** — `{ "classId":"…", "subjectId":"…", "termId":"…" }` with
`Idempotency-Key`. Moves every `draft` for that class–subject–term to `published`, sets
`published_at`, writes one `audit_log` row for the batch.

`200` `{ "publishedCount": 24, "publishedAt": "…", "batchId": "…" }`

**Idempotent** (PRD §11.2): a repeat with the same key returns the first result and writes
nothing. Publish is the action most likely to be double-tapped on a phone on a school
network.

| Code | HTTP |
|---|---|
| `PUBLISH_NOTHING_TO_PUBLISH` | 409 — zero drafts |

**`POST /api/marks/:id/supersede`** — the audit trail's whole point.

```json
{ "value": 9, "reason": "Սխալ գումարում ստուգողական աշխատանքում" }
```

One transaction: insert a new `published` mark with `supersedes_mark_id` set and the reason,
then set the old row to `superseded`. **`mark.value` is never `UPDATE`d** (PRD §10.3) — and the
order matters, because the partial index would reject two current marks if the old row were
demoted second.

`201` `{ "mark": { … }, "supersededMarkId": "…" }`

| Code | HTTP |
|---|---|
| `MARK_REASON_REQUIRED` | 422 — empty or whitespace. Enforced client-side, server-side **and** by the database check constraint. Three layers, deliberately |
| `MARK_NOT_PUBLISHED` | 409 — cannot supersede a draft; edit it |
| `MARK_ALREADY_SUPERSEDED` | 409 — supersede the current mark, not a historical one |
| `MARK_VALUE_UNCHANGED` | 422 — a correction to the same value is not a correction |

`PATCH`/`PUT` on `/api/marks/:id` **does not exist**. There is no route that changes a
published value in place, by any path (GB-6).

**`GET /api/marks/:id/history`** → the chain with actor names, timestamps, values, reasons.

**`POST /api/assessments`** — `{ classId, subjectId, termId, heldOn, kind, title?, topic? }`
→ `201`. `heldOn` defaults to today (GB-10). `DELETE` succeeds only while the assessment has
no marks → `ASSESSMENT_HAS_MARKS` (409), which is what makes `Escape`-before-any-mark
removal safe.

### Frontend

**Routing** — `/gradebook?class=&subject=&term=` in the query string, so a teacher's fourth
class survives a reload and can be bookmarked.

**Components**

- `ClassPills` — desktop pills, mobile horizontal scroll, `draftCount` badge.
- `GradebookGrid` — pinned student-name column and pinned header row (GB-11) via
  `position: sticky` on both axes. Flat `--bg-base` behind it; no gradient, no glass
  (brief §5.1).
- `MarkCell` — `role="gridcell"`, `tabIndex`, visible focus ring in `--accent`, draft shown
  in the draft colour (GB-4).
- `NewColumnCell` — the `+` at the end of the header row. **No dialog** (GB-10): press it
  and the column exists, `heldOn` is today, the header enters edit mode, focus moves to the
  first student's cell. `Escape` before any mark removes it. It **overlaps no other
  element** at any width — GB-10 says so explicitly because in the prototype it did.
- `PublishDialog` — the exact copy from GB-5, and the second sentence is the point:
  > 24 գնահատական կհրապարակվի 11-Բ-ի աշակերտներին։ Հրապարակումից հետո ուղղումը կպահանջի նոր գրառում՝ պատճառով։
- `PublishSweep` — one gradient sweep across the top of the content area. **That is the
  confirmation. No toast accompanies it** (GB-13).
- `SupersedeDialog` — value plus a required reason; submit disabled while the reason is
  empty.
- `CellHistorySheet`.
- `MobileStudentList` + `StudentMarksSheet` below 768px (GB-12), sharing the same draft and
  publish logic — not a second implementation.
- `ExportButton` in the class header — a secondary action, **deliberately not beside
  Publish** (GB-14). Wired in Phase 9.

**Keyboard entry — GB-8, the part that decides adoption**

`useGradebookKeyboard` owns this, and it is worth writing as one hook with one state machine
rather than scattering handlers:

- Digits `2`–`9`: fill and **advance down immediately**.
- **`1` waits 400ms.** A following `0` produces `10`; otherwise it commits as `1`. The
  pending `1` renders **dimmed** during the wait. Without this, entering a 10 is impossible,
  and 10 is the mark teachers most want to enter quickly. Any other keypress during the wait
  commits the `1` first and then processes that key.
- `Backspace` clears and **stays**.
- `Enter`/`↓` next student · `Shift+Enter`/`↑` previous · `Tab`/`→` next column ·
  `Shift+Tab`/`←` previous · `Home`/`End` first/last · `Escape` exits the grid.
- At the end of a column, `Enter` **wraps to the first student of the next column**.
- `scrollIntoView({ block: 'nearest' })` — **never** `'center'`. Centring on every keystroke
  makes the grid lurch and is instantly disorienting during bulk entry.

**Latency — the 50ms budget (PRD §11.1).** Above roughly 100ms bulk entry feels laggy and
teachers revert to paper. Therefore:

- The keystroke writes to local state and paints. **Nothing awaits the network.**
- A debounced buffer flushes to `PUT /api/marks` 600ms after the last keystroke, or
  immediately on class switch, publish, or `beforeunload`.
- `MarkCell` is `React.memo`'d on `(value, state, isFocused)`. Without this, a 30×20 grid
  re-renders 600 cells per keypress and the budget is unreachable.
- No context read inside `MarkCell`. Values arrive as props from a single subscribing parent
  row.

**State — GB-3, drafts are per class and losing them once destroys trust permanently**

`draftStore`: a module-level `Map` keyed `` `${classId}:${subjectId}:${termId}` ``, mirrored
to IndexedDB on every flush. Switching class does **not** unmount the store and does not
clear the key. Returning restores the map, then reconciles against the server response:
server-published wins, local-unsaved-draft wins over a server draft with an older
`enteredAt`.

Unflushed entries survive a browser crash because they are in IndexedDB before they are in
Postgres. On mount, if the store holds entries for the current key that the server does not,
flush them and tell the user quietly that unsaved marks were restored.

### Done when

1. Log in as the demo teacher. Four class pills, each with class, subject and student count.
2. **The column of 25.** Click the first cell of an empty column. Type
   `8 Enter 7 Enter 9 Enter …` — **digits and Enter only, hands never leaving the keyboard**
   — for 25 students. All 25 land, each on the right row.
3. **The `1`/`0` test.** Type `1` then `0` within 400ms → **10**. Type `1` and wait a
   second → **1**. Type `1` then `Enter` immediately → 1, and it advances. Type `1` then
   `5` quickly → 1 commits, then 5. Watch the dimmed pending `1` during the wait.
4. Every other key: `Backspace` clears and stays. `Shift+Enter` goes up. `Tab` right,
   `Shift+Tab` left. `Home`/`End`. `Escape` exits. At the bottom of a column, `Enter` wraps
   to the top of the next.
5. Scrolling: enter marks down a long column and watch the viewport. The focused cell comes
   into view at the **nearest** edge. It never jumps to the centre.
6. **Latency.** Devtools Performance, record while typing a column fast. Keystroke to
   painted cell **under 50ms**. Also confirm the Network tab shows roughly one `PUT` per
   burst, not one per keystroke.
7. **GB-3, the trust test.** Enter 6 marks in class A **without publishing**. Switch to B,
   enter 3, switch to C, back to A. **All 6 are exactly as left.** Then, harder: with
   unsaved marks in A, kill the browser tab outright and reopen `/gradebook`. The marks are
   restored from IndexedDB.
8. Drafts are private: the draft colour is visible to the teacher; log in as one of those
   students in another browser → nothing (already proven in Phase 7, re-confirm here with
   marks you just entered).
9. **Publish.** Press it. The dialog shows the count, the class and **the second sentence
   about corrections requiring a reason**. Confirm. One gradient sweep crosses the top of
   the content area and **no toast appears**. The student now sees the marks.
10. Idempotency: `curl` publish twice with the same `Idempotency-Key` →
    identical response, and `select count(*) from mark where state='published'` rises once.
    Publish again with drafts empty → `PUBLISH_NOTHING_TO_PUBLISH`.
11. **A published mark cannot be edited in place, by any path.** Click the cell — it offers
    correction, not editing. Then attack the API directly:
    - `curl -X PUT /api/marks` with that assessment/student and a new value →
      `rejected[0].code: "MARK_ALREADY_PUBLISHED"`, and the value in the database is
      unchanged.
    - `curl -X PATCH /api/marks/<id>` → 404, the route does not exist.
    - `grep -rn "update(mark" backend/src/modules/gradebook` → only the state transitions
      (`draft→published`, `published→superseded`). **No `value` assignment.**
12. **Supersede.** Correct a published mark with a reason. `select value, state, reason,
    supersedes_mark_id from mark where student_id=… and assessment_id=… order by entered_at`
    → **two rows**: the old one `superseded`, the new one `published` with the reason and the
    pointer. Try it with an empty reason: the dialog's submit is disabled; force it with
    `curl` → `MARK_REASON_REQUIRED`; and the raw `INSERT` from Phase 1 already proved the
    database refuses it too. Three layers, all verified.
13. Cell history: who, when, from what to what, why.
14. **The partial index, once more from the app's side.** `curl -X PUT /api/marks` twice
    concurrently for the same cell (`&` two curls) → one draft exists, not two.
15. **The `+` cell.** At **375px, 390px and 430px** viewport widths: press it, and it
    overlaps nothing — not the last column, not the pill nav, not the QR button, not the
    Iter button. Take a screenshot at each width. Press `Escape` before entering any mark →
    the column is gone and no assessment row remains.
16. Below 768px the grid becomes a per-student list; tapping opens the bottom sheet; enter a
    mark there, switch class and back → the draft persists. Publish from mobile → same
    sweep.
17. Armenian ordering: the student list order matches an Armenian alphabetical list. Check
    `Ղազարյան` sorts before `Մկրտչյան` and `Ցոլակյան` last.
18. Export sits in the class header, **not** next to Publish. Look at it and confirm you
    could not hit one meaning to hit the other.

---

# Phase 9 — Export

### Delivers

The school gets a file it can submit elsewhere. This is what replaces the EMIS integration
that PRD §6 removed, and it is the honest version of the claim: enter marks once, then upload a
file instead of retyping six hundred numbers.

### Screens

| Screen | Design reference |
|---|---|
| Export panel in Settings | `T.exp.*`; brief §11ter. Scope selector `T.exp.s1/s2/s3`, format, download |
| Export action in the gradebook class header | GB-14. Secondary, deliberately far from Publish |
| Export log (admin) | Built from primitives per C13. A dense table |

### Backend

`modules/export/`. `xlsx` via `exceljs` (streaming — `xlsx`/SheetJS builds the whole
workbook in memory and an institution-wide export will not fit comfortably).

| Method | Path |
|---|---|
| `GET` | `/api/export` |
| `GET` | `/api/export/logs` |

**`GET /api/export`**

```
?scope=class-subject-term | class-term | institution-term
&classId=…&subjectId=…&termId=…
&format=xlsx|csv
&locale=hy|en|ru
```

Response: a file stream.

```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="Tessera_11-B_Hanrahashiv_1-kisamyak_2026-11-20.xlsx";
                     filename*=UTF-8''Tessera_11-Բ_Հանրահաշիվ_1-կիսամյակ_2026-11-20.xlsx
```

Both filename forms are sent: the ASCII-transliterated one for old clients, the RFC 5987
`filename*` for everything current. EXP-6 exists because this file will sit among forty
others in a downloads folder — `export.xlsx` is a failure.

**Authorisation** — teacher: own class–subjects only. Admin: anything in their institution.
Student: `FORBIDDEN`. The `class-term` and `institution-term` scopes are admin-only; a
teacher requesting them gets `FORBIDDEN`, not a filtered file.

**Layout (EXP-3)** — students as rows, assessments as columns, dates in the header, marks in
cells. **The same shape as the on-screen grid**, so it is recognisable without explanation.
Header rows: institution, class, subject, term, generated-at. Then the grid. Then a summary
row of per-assessment averages. Column headers localised from `locale`; student names always
in Armenian, because they are names.

For `institution-term`: one worksheet per class in xlsx; one file per class zipped for csv.

**EXP-4 — only published marks are exported.** The query is
`where state = 'published'`. **Drafts never leave the product**, in any scope, in any
format. Superseded marks are excluded; their current successors are included.

**EXP-5** — every export writes an `export_log` row: actor, scope jsonb, format, mark count,
timestamp. When someone asks whether a term was submitted, this answers it.

**CSV specifics (L-8)** — UTF-8 **with BOM** (`\uFEFF` first), `\r\n` line endings, comma
separated, quoted fields. Without the BOM, Excel on Windows renders Armenian as mojibake and
the export is worthless to the only people who will open it.

| Code | HTTP | Cause |
|---|---|---|
| `EXPORT_SCOPE_INVALID` | 422 | scope/parameter mismatch. `details.required[]` |
| `EXPORT_NO_PUBLISHED_MARKS` | 409 | nothing to export — a zero-row file looks like data loss |
| `EXPORT_SCOPE_FORBIDDEN` | 403 | teacher requesting a class or institution scope |
| `NOT_FOUND` | 404 | class, subject or term not in this institution |

> ❓ **EXP-7 stands open.** The exact column format the school needs is unknown. Ask the
> administrator to show what they currently type or upload elsewhere; matching that shape
> turns the export from "some data" into "the thing you paste in". Until then ship the
> readable grid — useful regardless. **Build the column layout behind one
> `buildSheet(rows, layout)` function** so that changing to a school-specific shape later is
> editing one file, not rewriting the module.

### Frontend

**Routing** — no route of its own. `ExportButton` in the gradebook class header;
`ExportPanel` in `/settings#export`.

**Components**

- `ExportPanel` — scope radio (`T.exp.s1/s2/s3`, the last two hidden for teachers), format
  toggle, download button.
- `ExportButton` — scope pre-filled from the current class–subject–term.
- `ExportLogTable` (admin).
- Download via a hidden anchor with `credentials: 'include'` semantics — since the app and
  API share an origin (C11), a plain `<a href="/api/export?…">` carries nothing, because the
  access token is in memory. Therefore: `fetch` with the bearer, read the blob,
  `URL.createObjectURL`, click, revoke. Read the filename from `Content-Disposition`, and
  parse `filename*` first.

**State** — a single `exporting` boolean with a progress affordance for the institution
scope, which can take seconds.

### Done when

1. From the gradebook, export the class–subject–term from `fixtures.heavyClassSubjectTerm`
   (26 students × 21 assessments) as `.xlsx`.
2. **Open it in Excel and in LibreOffice.** Both open cleanly, no repair prompt. Students
   are rows, assessments are columns, dates in the header. It looks like the screen.
3. Armenian renders correctly in both applications, in both header and names.
4. Export the same scope as `.csv`. Open in Excel **on Windows** — Armenian is correct, not
   mojibake. Confirm the BOM: `head -c 3 file.csv | xxd` → `efbb bf`.
5. **No draft escapes.** Enter three drafts with distinctive values (say all `3` in a column
   where nothing else is 3). Export without publishing. Search the xlsx and the csv for
   them — absent. Repeat for all three scopes.
6. Filename: check the downloaded file's name matches the EXP-6 pattern and identifies class,
   subject, term and date. Download two different classes into the same folder and confirm
   you can tell them apart without opening either.
7. `select * from export_log order by created_at desc limit 5` → one row per export, with
   the right scope jsonb and a `mark_count` matching the cells in the file.
8. As a teacher, request `scope=institution-term` by URL → `EXPORT_SCOPE_FORBIDDEN`. As an
   admin, the same request produces a workbook with one worksheet per class.
9. Export a class–subject–term with no published marks → `EXPORT_NO_PUBLISHED_MARKS`, and no
   file downloads.
10. Export at `locale=ru` → column headers Russian, student names still Armenian.
11. Time an institution-scope export at seed size. Under 10 seconds, and memory in the
    backend process does not spike proportionally to row count — proof the streaming writer
    is actually streaming.

---

# Phase 10 — Credentials

### Delivers

A student submits a non-formal achievement with an attachment; a teacher of that subject or
an administrator approves or declines it with a stated reason; an approved credential
appears in the student's subject view.

### Screens

| Screen | Design reference |
|---|---|
| Student credentials list | `Tessera.dc.html` → `sc-if isCreds`; `T.cr.*` |
| Submission sheet | `T.cr.*`. Category, title, description, optional subject, one attachment |
| Review queue | `sc-if isQueue`; `T.q.*`. **Spans all the teacher's subjects; it is not class-scoped** (CR-7) |
| Decision dialog | Mandatory reason on decline (CR-4) |
| Approved credential in the subject view | REC/CR-6. **Visually distinct from a regular mark** |

### Backend

`modules/credentials/`. Storage: S3-compatible (C10) — R2 in production, MinIO in
development. Keys `credentials/{institutionId}/{credentialId}/{uuid}{ext}`.

| Method | Path |
|---|---|
| `GET` | `/api/credentials` |
| `POST` | `/api/credentials` |
| `GET` | `/api/credentials/:id` |
| `GET` | `/api/credentials/:id/attachment` |
| `POST` | `/api/credentials/:id/decision` |

**`GET /api/credentials?status=&subjectId=&cursor=`** — the same endpoint for all three
roles, scoped by the actor:

- student → own requests, all statuses
- teacher → requests naming a subject they teach, across **all** their subjects (CR-7)
- admin → the whole institution

```json
{ "items": [
    { "id":"…", "status":"pending", "category":"olympiad",
      "title":"Ֆիզիկայի օլիմպիադա · մարզային փուլ",
      "description":"…",
      "subject": { "id":"…", "nameHy":"Ֆիզիկա" },
      "student": { "id":"…", "firstName":"Անի", "lastName":"Հովհաննիսյան", "classLabel":"11-Բ" },
      "attachment": { "mime":"application/pdf", "sizeBytes":184320, "originalName":"olympiad.pdf" },
      "createdAt":"…",
      "decision": null } ],
  "nextCursor": null }
```

For a decided request, `decision` is
`{ "status":"declined", "reason":"…", "decidedAt":"…", "decidedBy":{ "name":"Ա. Սարգսյան" } }`.
`student` is omitted from a student's own view — it is them.

**`POST /api/credentials`** — multipart: `category`, `title`, `description`, `subjectId?`,
`file`. `201` returns the created request.

**CR-2, enforced properly.** PDF, JPG, PNG, up to 10MB. Validated **server-side by content,
not extension** (S-6): read the magic bytes with `file-type`, and if the sniffed mime is not
in the allowlist, reject — regardless of what the extension or the client-sent
`Content-Type` claims. Store outside any web root; serve only through the authenticated
endpoint below.

| Code | HTTP |
|---|---|
| `CREDENTIAL_FILE_TYPE_INVALID` | 415 — `details.detected`, `details.allowed[]` |
| `CREDENTIAL_FILE_TOO_LARGE` | 413 — `details.maxBytes: 10485760` |
| `CREDENTIAL_FILE_REQUIRED` | 422 |
| `CREDENTIAL_SUBJECT_INVALID` | 422 — subject not in this institution |
| `VALIDATION_FAILED` | 422 — missing title or category |

**`GET /api/credentials/:id/attachment`** — streams from object storage **through the
backend**, after the same authorisation check as the list. `Content-Disposition: inline` for
images, `attachment` for pdf. **No presigned URL is ever returned to a browser** (C10) —
a presigned URL is a bearer token in a query string, it lands in browser history and in any
proxy log, and it points at a minor's document.

**`POST /api/credentials/:id/decision`** — `Idempotency-Key`.

```json
{ "decision": "declined", "reason": "Կցված ֆայլը ընթեռնելի չէ։ Ուղարկեք ավելի հստակ պատճենը։" }
```

`200` returns the updated request. Writes `decided_by_user_id`, `decided_at`,
`decision_reason`, and an `audit_log` row (CR-8).

**CR-3 — states are `pending` → `approved` | `declined`, and no other transition exists.**
Not a reopen, not a revert. A decided request is terminal; a student who disagrees submits a
new one, which leaves both on the record.

| Code | HTTP | Cause |
|---|---|---|
| `CREDENTIAL_REASON_REQUIRED` | 422 | declining with an empty or whitespace reason (CR-4) |
| `CREDENTIAL_ALREADY_DECIDED` | 409 | `details.currentStatus` |
| `CREDENTIAL_NOT_REVIEWABLE` | 403 | teacher does not teach the named subject (CR-5) |
| `CREDENTIAL_SUBJECT_MISSING` | 409 | a request with no subject can only be decided by an admin |

An approved credential joins the student's record read (Phase 7's `subjects[].credentials`)
and renders as **non-formal**, visually distinct from a mark (CR-6). It has no numeric value
and never enters an average or an export — it is recognition, not a grade, and letting it
into a mean would quietly corrupt every average in the product.

### Frontend

**Routing** — `/credentials` (student), `/queue` (teacher and admin).

**Components**

- `CredentialList`, `CredentialCard` with a status chip.
- `SubmitSheet` — category select, title, description, subject select (optional),
  `FileDropzone` with a client-side type and size pre-check that mirrors the server's rules
  but is never trusted by it.
- `ReviewQueue` — filter chips by status and subject, defaulting to **pending**.
- `DecisionDialog` — approve, or decline with a reason field. **Submit disabled while the
  reason is empty**, and the same rule server-side.
- `AttachmentViewer` — inline for images, an embedded object for pdf, fetched with the
  bearer into a blob URL revoked on unmount.
- `CredentialInSubject` — the approved credential in the subject view, marked non-formal.
- `DeclineReasonBlock` — **the reason shown to the student in full** (CR-4). A rejection
  without explanation is worse than no system, and truncating it to two lines with an
  ellipsis is the same failure in a smaller font.

**State** — server state via the query cache. Upload progress local. Optimistic status
change on decision with rollback, since the reviewer is looking at a queue and a 400ms
round trip per decision makes reviewing twenty feel like work.

### Done when

1. As the demo student, submit a credential with a real PDF. It appears as `pending`.
2. As the teacher of that subject, open `/queue`. The request is there. **Add a second
   request naming a different subject the same teacher teaches** — both appear in one queue,
   proving CR-7's "not class-scoped".
3. As a teacher who does **not** teach that subject, `curl` the decision endpoint →
   `CREDENTIAL_NOT_REVIEWABLE`.
4. **Decline with an empty reason.** The dialog's submit is disabled. Force it:
   `curl -X POST … -d '{"decision":"declined","reason":"   "}'` → `CREDENTIAL_REASON_REQUIRED`.
   Whitespace is not a reason.
5. Decline with a real, long reason. As the student, open it: **the reason is shown in
   full**, not truncated.
6. Decide the same request again → `CREDENTIAL_ALREADY_DECIDED`. There is no route that
   reopens it: `grep -rn "pending" backend/src/modules/credentials/service.ts` shows
   `pending` only as a starting state.
7. Approve another request naming a subject. Log in as that student and open the subject
   view: the credential is there, **visually distinct from a mark**, and the subject's
   average is **unchanged** — compare the number before and after.
8. Export that class–subject–term (Phase 9) → the credential does not appear as a mark.
9. **The renamed executable.** `cp /bin/ls evidence.pdf` and upload it →
   `CREDENTIAL_FILE_TYPE_INVALID` with `details.detected`. Then try harder: take a real PDF,
   append executable bytes, rename to `.jpg` → still judged by its sniffed type, and the
   result is consistent.
10. Upload an 11MB image → `CREDENTIAL_FILE_TOO_LARGE`. Upload a 9MB one → accepted.
11. **The attachment is not public.** Copy the attachment URL and open it in a logged-out
    private window → `UNAUTHENTICATED`. Log in as a different student → `NOT_FOUND`. Then
    check the response headers of a successful fetch: no `Location` redirect to an S3 host,
    no signed URL anywhere in the network tab.
12. `select * from audit_log where entity_type='credential_request' order by created_at desc`
    → one row per state change, with actor and timestamp.

---

# Phase 11 — Iter

### Delivers

The complete Iter interface — reachable everywhere, in every role and language, with
attachments and a thinking state — and **no generated response of any kind**.

### Screens

| Screen | Design reference |
|---|---|
| Iter floating button | brief §11bis "Entry point"; IT-2. 44px on mobile with clearance above the pill nav, 48px on web at 28px from the corner |
| Panel — desktop | brief §11bis "The panel"; IT-4. A 420px right sheet |
| Panel — mobile | 92%-height bottom sheet, grab handle, swipe to dismiss |
| Empty state | `sc-if iterEmpty`; IT-5. Greets by **first name only** — `Բարև, Անի` — plus a second line and three role-appropriate suggestion chips |
| Attachment row | IT-6. Four actions, max four attachments, removable thumbnails/chips above the field |
| Thinking pill | IT-9. A 2px border that is an **animated conic gradient**. This animation appears nowhere else in the product |
| The honest line | IT-7 |

### Backend

`modules/iter/`. This module stores messages and returns nothing generated.

| Method | Path |
|---|---|
| `POST` | `/api/iter/attachments` |
| `POST` | `/api/iter/messages` |
| `GET` | `/api/iter/messages?sessionId=` |

**`POST /api/iter/attachments`** — multipart, one file. `201`
`{ "uploadId":"…", "mime":"image/png", "sizeBytes":41231, "originalName":"screen.png" }`.
Content-sniffed and stored exactly as in Phase 10 (C10, S-6). Images, PDF, plain text, and
common audio for the voice action.

**`POST /api/iter/messages`**

```json
{ "sessionId":"…", "text":"Ինչո՞ւ է ֆիզիկայի միջինս ընկել", "screen":"/subjects/…",
  "attachmentIds":["…"] }
```

`201`

```json
{ "id":"…", "storedAt":"2026-08-24T10:14:02+04:00", "reply": null }
```

**`reply` is `null`. Always.** Not an empty string, not a placeholder sentence — `null`, so
that the day a model is connected the field's meaning does not change. The honest line
(IT-7) is a **client-side string from the locale files**, not a server response:

> Iter-ը դեռ միացված չէ։ Հաղորդագրությունը պահվել է։

**IT-8, and it is a design decision worth restating.** No canned answer, no simulated
reasoning, under any circumstance. An input that silently swallows text reads as broken; an
invented answer reads as dishonest. One honest line is the correct third option, and it is
the only one that survives being demonstrated to a teacher who asks what happens next.

| Code | HTTP | Cause |
|---|---|---|
| `ITER_ATTACHMENT_LIMIT` | 422 | more than four (IT-6). `details.max: 4` |
| `ITER_ATTACHMENT_NOT_FOUND` | 404 | unknown or already-consumed `uploadId` |
| `ITER_MESSAGE_EMPTY` | 422 | no text and no attachment |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | |

> ❓ **IT-11 / S-14 remain open, and they are legal questions, not technical ones.** When
> connected, Iter will read the academic records of minors. Where the model runs, what
> leaves the country, and whether the provider retains prompts must be settled before a
> single real response is generated. Note that **this phase stores every message a student
> sends**, which is itself data about a minor — so retention for `iter_message` needs a
> stated policy even now. Raise it with the supervisor in this phase; the interface is
> identical either way.

### Frontend

**Routing** — no route. A layout-level overlay so it is reachable from every screen without
navigation (IT-1).

**Components**

- `IterButton` — floating, position configurable in Settings between floating and header
  (brief §11ter). Colour from `--accent-tint`, shadow
  `0 6px 22px color-mix(in srgb, var(--accent-tint) 32%, transparent)`.
- **`IterPanel`** — 420px right sheet on desktop, 92% bottom sheet with grab handle and
  swipe-to-dismiss on mobile.
- `IterEmptyState` — `Բարև, {firstName}` — **first name only**, once per session (IT-5) —
  a second line, and three suggestion chips chosen by role. Tapping a chip **fills the
  input without sending**.
- `IterComposer` — text field plus four attachment actions: image, file, voice, and
  "screenshot this screen". Drag and drop supported. The screenshot action captures the app
  frame client-side (`html-to-image`) and attaches it like any other file.
- `AttachmentChips` — max four, removable, thumbnails for images.
- **`ThinkingPill`** — the 2px animated conic-gradient border, 1400ms. Implemented with
  `@property --angle` and a `background: conic-gradient(from var(--angle), …)` on a padded
  wrapper. This animation appears on **no other element** (IT-9).
- `IterMessageList` — sent messages persist while the panel is open (IT-10).

**IT-3, and it is a real risk.** Iter must not be confused with the QR button. They differ
in **size (44 vs 58)**, in **hue (violet vs blue-teal)** and in **position**. Size carries
most of the distinction; colour alone is insufficient. Verify this by looking at the mobile
screen with both present and asking whether you could tap the wrong one in a hurry — because
the QR button is pressed at a door, quickly, by someone not looking carefully.

**State** — `IterProvider`: `{ open, sessionId, messages, attachments, sending }`. Session
scoped to the panel's lifetime. Messages persist while open; the greeting fires once per
session, not once per open.

### Done when

1. Open Iter from **every** screen: overview, subjects, subject detail, archive,
   credentials, id, gradebook, queue, settings, admin. Ten screens. It opens on all of them,
   in both web and mobile modes, as student, teacher and admin, in hy, en and ru.
2. The empty state greets with the **first name only** — `Բարև, Անի`, not
   `Բարև, Անի Հովհաննիսյան`. Close and reopen the panel: the greeting does not repeat.
3. Tap a suggestion chip → the input is filled and **nothing is sent**.
4. Send a message. Observe: the message posts, the thinking pill appears for ~1400ms with a
   rotating conic-gradient border, then **exactly** the honest line replaces it. Read it
   character for character against IT-7.
5. **Prove there is no generated text.** Search the frontend bundle and the backend source
   for canned responses: `grep -rniE "(as an|I can help|Հասկանում եմ|Вот что)" frontend/src backend/src`
   → nothing. Check the API response: `reply` is `null`. Check the network tab: no request
   leaves for any model host. Then read `modules/iter/service.ts` in full — it stores and
   returns; there is no branch that produces prose.
6. Attach four files → accepted, four removable chips. Attach a fifth → blocked in the UI,
   and `curl` with five `attachmentIds` → `ITER_ATTACHMENT_LIMIT`.
7. Drag a file onto the panel → attached. Use "screenshot this screen" → a thumbnail of the
   current screen appears as an attachment.
8. **The conic gradient appears nowhere else.** With the pill visible, run
   `[...document.querySelectorAll('*')].filter(e=>getComputedStyle(e).backgroundImage.includes('conic'))`
   → exactly the pill's element. Close the panel and run it again on each screen → empty
   every time.
9. **IT-3 side by side.** On a 390px mobile screen with the QR button docked, measure both:
   Iter 44px, QR 58px. Different hue, different position. Photograph the screen and ask
   someone who has not seen the product which one opens the camera code.
10. Send three messages, scroll, they persist. Close the panel and reopen → session state
    behaves as specified.
11. Send with no text and no attachment → `ITER_MESSAGE_EMPTY`, and the send button was
    disabled anyway.
12. `select count(*) from` the iter message table rises by one per send, with the `screen`
    value recorded.

---

# Phase 12 — Settings, notifications, support, widget gallery

### Delivers

Everything a user changes about the product, and the only channel they have when something
is wrong.

### Screens

| Screen | Design reference |
|---|---|
| Settings shell | brief §11ter; `sc-if isSettings`; `T.set.*`. **Seven groups**: Հաշիվ · Տեսք · Լեզու · Ծանուցումներ · Արտահանում · Աջակցություն · Վիջեթներ. Sticky sub-navigation above 900px, a chip row below (SET-1) |
| Account | SET-2. Read-only identity rows (`T.set.readonly`), inline password change with live strength feedback (`T.set.s0`–`s3`), active sessions |
| Appearance | SET-3. Theme, seven accents, four backgrounds, Iter button position |
| Language | SET-4. Three options, **full names** here (L-7) |
| Notifications | SET-5; `sc-if isNotif`; `T.set.nGrade` / `nStatus` / `nWeekly` |
| Export | SET-6 — Phase 9's panel |
| Support | SET-7. Contact, report a problem, feedback, FAQ, version, terms, privacy |
| Widget gallery | SET-8; brief §11. Eleven designs, browsable, with a clear note that they require a native application |

### Backend

`modules/settings/`.

| Method | Path |
|---|---|
| `GET` `PATCH` | `/api/me/preferences` (from Phase 4) |
| `GET` `PATCH` | `/api/me/notifications` |
| `GET` `DELETE` | `/api/auth/sessions` (from Phase 3) |
| `POST` | `/api/support/tickets` |

**`GET /api/me/feed?cursor=`** — the notification feed. **Derived at read time from
existing tables; no new table and no schema change** (C2).

```json
{ "items": [
    { "kind": "mark", "id": "…", "occurredAt": "…",
      "subjectNameHy": "Հանրահաշիվ", "value": 8, "assessmentKind": "test" },
    { "kind": "credential", "id": "…", "occurredAt": "…",
      "title": "Օլիմպիադա · ֆիզիկա", "status": "approved" } ],
  "nextCursor": null }
```

#### The bug

The feed asks `published_at > user.last_login_at`, and login updates `last_login_at` to
`now()`. By the time the feed runs, the window starts at the moment the query is asked, so
it is always empty except for marks published during the session itself.

#### The fix, and the trap inside the fix

Read the **previous** value before writing the new one, and carry it in the token:

```ts
// modules/auth/service.ts — login
const prev = await repo.readLastLoginAt(user.id);   // BEFORE the write
await repo.touchLastLogin(user.id);                 // now()

// seenBefore is epoch SECONDS, never a Date — see the note below
const seenBefore = Math.floor((prev ?? user.createdAt).getTime() / 1000);

const accessToken  = signAccess({ sub: user.id, role: user.role, seenBefore });
const refreshToken = signRefresh({ sub: user.id, sid: session.id, seenBefore });
```

**The claim is epoch seconds and the type is not negotiable.** A `Date` put into a JWT is
JSON-serialised to an ISO string, and the read side then evaluates
`"2026-08-20T09:00:00.000Z" * 1000` → `NaN` → `new Date(NaN)` → `Invalid Date`. The
comparison does not throw. It silently matches nothing, and the feed is empty again — the
exact bug this patch exists to fix, wearing a different hat. Verified in `node`.

**The trap: refresh must copy `seenBefore` forward unchanged.** The access token lives 15
minutes. If the refresh handler re-reads `last_login_at` to mint the next access token, it
reads the value login just wrote, and the bug returns fifteen minutes into every session —
in a form that is much harder to find, because the feed works right after login and empties
later.

```ts
// modules/auth/service.ts — refresh
const claims = verifyRefresh(cookie);

const accessToken  = signAccess({
  sub: claims.sub, role: claims.role,
  seenBefore: claims.seenBefore,          // copied, never re-read from the database
});

// AUTH-4 rotates the refresh token on EVERY use. The claim must ride forward into the
// new refresh token too, or it survives exactly one rotation and then vanishes.
const refreshToken = signRefresh({
  sub: claims.sub, sid: claims.sid,
  seenBefore: claims.seenBefore,
});
```

Copying it into the access token alone is the same trap one layer deeper: the feed works,
survives one refresh, and empties on the second. Both tokens carry it, or neither does.

`device_session` has no column for this and C2 forbids adding one — which is fine, because
the claim rides in the refresh token itself. `device_session.refresh_token_hash` stores only
a hash, so nothing about this changes the schema.

#### Bound the feed

A "remember this device" session lives 90 days, so `seenBefore` can drift that far back and
a returning user's feed could carry a quarter of a year. **`limit 50` is what bounds it** —
not a time clamp. The section below explains why the obvious clamp does not work and what
replaces it.

**The limit goes on the union, never on the individual queries.** The feed draws on more
than one table and each names its timestamp differently — `mark.published_at`,
`credential_request.decided_at`. Applying `limit 50` per source returns fifty marks and zero
credential decisions, which looks exactly like a broken credentials feature. Normalise to a
common `occurred_at`, combine, sort, **then** limit:

```sql
select * from (
  select 'mark'       as kind, m.id, m.published_at as occurred_at, …
    from mark m  where m.state = 'published' and m.published_at > $since and …
  union all
  select 'credential' as kind, c.id, c.decided_at  as occurred_at, …
    from credential_request c where c.decided_at > $since and …
) feed
order by occurred_at desc
limit 50;
```

Any source added later normalises into `occurred_at` the same way and changes nothing else.

**Thirty days was a guess, and raising it to 400 would have changed nothing.**
`Math.max` of two timestamps returns the **later** one, so the clamp can only ever move
`since` *forward*. `seenBefore` is at most 90 days old — the "remember this device" ceiling
— and `now − 400 days` is older than that, so `seenBefore` always wins and the window is
inert. Verified in `node`:

```
returning user, last login 90d   window= 30d  ->  since = 30d ago  (clamp won)
returning user, last login 90d   window=400d  ->  since = 90d ago  (seenBefore won)
demo acct, someone logged in 1d  window=400d  ->  since =  1d ago  (seenBefore won)
```

A larger number in `.env` that never participates in a comparison is worse than no
variable at all: it reads as a solved problem.

There is also nowhere to put a *second* value. Phase 15 defines exactly two environments,
local development and the deployed production, and **the demo accounts live in production**.
"Wide in demo, narrow in production" is not a configuration that can exist.

**Branch on `is_demo` instead — the column is already in `"user"` for exactly this.**

```ts
// The feed's start time. Two rules, not one clamped rule.
const since = claims.isDemo
  ? new Date(Date.now() - env.NOTIFICATION_WINDOW_DAYS * 86_400_000)  // always looks back
  : new Date(claims.seenBefore * 1000);                               // since your last visit
```

`isDemo` is a token claim set at login and **copied forward on refresh exactly like
`seenBefore`** — same trap, same rule, both tokens. Reading it from the row each request is
also fine; do not read `last_login_at` there.

The `Math.max` is gone entirely, and nothing is lost by removing it: a real user's
`seenBefore` is already bounded at 90 days by the refresh token's own lifetime, and
`limit 50` bounds the feed's size. The clamp was doing neither job.

`NOTIFICATION_WINDOW_DAYS` now means one thing — **how far back a demo account looks**.
**400 is a placeholder, not the answer.** Run the two queries below when you reach Phase 13
and set it from what they return; nothing before Phase 13 depends on the value.

#### Why the demo feed is empty in two ways, not one

Without the `is_demo` branch above, the demo bell is empty in **two** independent ways, and
the second is guaranteed:

- **First visitor.** `last_login_at` is null, so `seenBefore` falls back to `created_at`. If
  the seed ran recently, that is a few days ago, while the marks are backdated across the
  academic year — older. `published_at > created_at` matches nothing.
- **Every visitor after the first.** The demo accounts are shared. The first login sets
  `last_login_at` to that moment, so every subsequent visitor's window starts at the
  previous visitor's session. Empty, permanently, regardless of `created_at` and regardless
  of any window value.

Phase 13's "Done when" is still correct — publishing a column really does produce
notifications — but it needs a **live** publish, and nobody arriving at a shared link does
that before pressing the bell.

Confirm both ranges before choosing the number:

```sql
select min(published_at), max(published_at), count(*) from mark where state = 'published';
select min(created_at),   max(created_at)              from "user";
```

The first sets `NOTIFICATION_WINDOW_DAYS`; 400 covers an academic year, and if the query
says otherwise use what it says. The second tells you whether the *first* layer above is
also live — if the seed did not backdate `created_at`, it is.

With the `is_demo` branch and `limit 50` on the union, a demo account opens the bell to the
fifty most recent events, every time, for every visitor — a plausible recent-activity list
rather than an empty screen. It never clears, which is the correct trade for a shared
account and worth knowing before someone reports it as a bug.

**Also write the live publish into the Phase 15 demo script**, independently of the window:
publish a column from the teacher account *before* opening the student screen. A mark
appearing on a second device is the more convincing demonstration, and it exercises the
path a pre-filled feed does not.

Neither touches the schema and neither touches the seed.

##### Done when — notification feed

1. Log in as a student. Publish marks for their class from a teacher account **in another
   browser**. The student's feed shows them without re-logging-in.
2. **Two consecutive refreshes, and it must be two.** Log in. Force a refresh. Publish
   marks. Force a **second** refresh. The feed still shows everything since the previous
   login. One refresh does not catch a claim that is dropped from the rotated refresh
   token — the first rotation still has it in the access token, so a single-refresh test
   passes while the bug is present. Decode both refresh cookies and confirm `seenBefore` is
   in each, unchanged.
3. **The type.** Decode any access token and read `seenBefore`: an **integer**, roughly
   1.7×10⁹. If it is an ISO string, the clamp is producing `Invalid Date` and the feed is
   silently empty.
4. Log out, publish marks, log back in → they appear. Log out and back in again without
   publishing anything → the same marks still appear, because `seenBefore` moved to the
   previous login, not to now.
5. A brand-new account with `last_login_at` null → the feed renders its empty state, not a
   crash and not every mark ever published. **Use an account created by the Phase 5 import,
   not `fixtures.demo.firstLogin`** — that one is `is_demo = true` and now takes the wide
   branch by design, so it would fail a test it is not meant to be subject to.
6. **The demo branch.** Log in as each demo account in a fresh browser. The bell shows the
   fifty most recent events, **including on the second and third visit**, with no publish in
   between. Then log in as a non-demo account with a recent `last_login_at` → its feed is
   correctly near-empty. The two behaviours coexisting is the point.
7. `grep -rn "last_login_at" backend/src` — the whole tree, not just `modules/auth`, because
   database access lives in the repository layer. Exactly two hits on the login path, a read
   then a write, in that order. **No hit anywhere in the refresh path.**

---

**`GET /api/me/notifications`** →
`[ { "kind":"new_mark", "enabled":true }, { "kind":"request_status", "enabled":true }, { "kind":"weekly_summary", "enabled":false } ]`

`PATCH` with the same shape → `204`. **The toggles govern the in-app feed above, not push or email.** They persist to
`notification_pref` and filter `/api/me/feed`; nothing is *delivered* to a device or an
inbox, because push and email are out of scope (SET-5, PRD §3.2). Say that on the screen —
a toggle that looks like it enables a phone notification and does not is worse than one
labelled honestly.

**`POST /api/support/tickets`**

```json
{
  "kind": "problem",
  "subject": "Գնահատականը չի պահպանվում",
  "body": "…",
  "rating": null,
  "context": {
    "appVersion": "1.0.0+a1b2c3d", "role": "teacher",
    "institutionId": "…", "locale": "hy", "screen": "/gradebook",
    "viewport": "390x844", "online": true,
    "screenData": { "classId":"…", "subjectId":"…", "draftCount":6 }
  }
}
```

`201` `{ "id":"…", "reference":"TSR-8F3K", "createdAt":"…" }` — a short reference the user
can quote.

**SET-7 is explicit that context is attached and visible before sending.** `screenData` is
included **only when the user ticks "attach current screen data"**, and the exact JSON is
shown in a disclosure on the form before the send button. A support payload assembled
silently from a minor's screen is a privacy problem regardless of intent.

| Code | HTTP | Cause |
|---|---|---|
| `SUPPORT_RATING_REQUIRED` | 422 | `kind = 'feedback'` without a 1–5 rating |
| `SUPPORT_BODY_TOO_SHORT` | 422 | under 10 characters |
| `RATE_LIMITED` | 429 | 5 tickets per hour per user |
| `NOTIFICATION_KIND_UNKNOWN` | 422 | `details.allowed[]` |

FAQ content is **static in the locale files**, not an endpoint. Five entries as an
accordion, including *«Ի՞նչ կապ ունի EMIS-ի հետ։»* — answered honestly, in the words PRD §9.9
requires: no direct connection; Tessera keeps the school's own record and produces an export
file the school submits as it always has.

### Frontend

**Routing** — `/settings` with hash sections (`#account`, `#appearance`, `#language`,
`#notifications`, `#export`, `#support`, `#widgets`), so a support instruction can say "open
`/settings#support`" and it works.

**Components**

- `SettingsShell` — sticky sub-nav above 900px, chip row below, scroll-spy on the sections.
- `AccountPanel` — read-only rows (`kName`, `kRole`, `kInst`, `kCls`, `kTeach`, `kEmis`,
  `kEmail`) with the `T.set.readonly` explanation of why they are not editable;
  `PasswordChangeInline` with a live strength meter; `SessionList` with individual and bulk
  revocation.
- `AppearancePanel` — `ThemePicker`, `AccentPicker` (seven swatches from `ACCENTS`, black
  first), `BackgroundPicker` (four), `IterPositionToggle`.
- `LanguagePanel` — **full names** here, unlike the compact HY·EN·RU pill on login (L-7).
- `NotificationsPanel` — three toggles with their help text and the honest not-yet-delivered
  note.
- `SupportPanel` → `ContactForm`, `ProblemForm` (with the "attach current screen data"
  checkbox and the visible payload disclosure), `FeedbackForm` (1–5 plus free text),
  `FaqAccordion`, and the version / terms / privacy footer.
- `WidgetGallery` — the eleven designs from brief §11 as a browsable gallery, each with its
  size (1×1, 2×1, 2×2) and a clear note that **they require a native application** (SET-8,
  PL-6). iOS home-screen widgets need WidgetKit and cannot be delivered by a PWA — a
  platform constraint, not a scheduling decision. Include the **Ask Iter** launcher widget
  (`--accent-tint` bloom).

**State** — preferences from Phase 4's providers; everything else is server state.

### Done when

1. All seven groups present. Above 900px the sub-nav is sticky and highlights the section in
   view; below 900px it is a chip row. Deep-link `/settings#support` → it opens scrolled
   there.
2. Account rows are read-only and the explanation of why is visible. There is no editable
   field among them, and no endpoint that would accept one:
   `grep -rn "PATCH.*students\b" backend/src/modules/settings` → nothing.
3. Change the password inline. The strength meter moves through `s1` → `s2` → `s3`. On
   success, **other sessions are revoked** — confirm from a second browser.
4. Sessions: two devices listed with labels and last-seen times. Revoke one individually;
   then use `T.set.sessAll` and confirm only the current device survives.
5. Appearance: seven accents, four backgrounds, three theme modes. **Re-run the Phase 7
   grade-colour check here** — open the mosaic, cycle every accent and background, and
   confirm the tile hexes never move.
6. Iter button position: switch to header, and it moves; switch back to floating.
7. Language: full names, and switching changes the whole product with **no reload and no
   state loss** — do it from a scrolled subject detail screen.
8. Notifications: toggle all three, reload → they persist. `select * from notification_pref
   where user_id=…` matches. Confirm the screen states that delivery is not yet enabled.
9. Support — contact: fill it in, **see the attached context before sending**, send, get a
   reference. `select context from support_ticket order by created_at desc limit 1` → app
   version, role and institution present.
10. Support — problem, with "attach current screen data" **unticked**: the stored `context`
    has **no** `screenData` key. Tick it: the payload is disclosed on screen before sending,
    and afterwards `screenData` is present and matches what was disclosed.
11. Feedback without a rating → `SUPPORT_RATING_REQUIRED`.
12. FAQ: five entries, and the EMIS one reads honestly — no direct connection, export file,
    school submits as always. Read it in all three languages.
13. Widget gallery: eleven widgets including Ask Iter, each with its size, and the native
    requirement stated plainly rather than implied.
14. Rate limit: send six support tickets in an hour → the sixth returns `RATE_LIMITED`.

---

# Phase 13 — Motion, PWA, offline

### Delivers

The product installs to a home screen, survives losing the network without lying about it,
and moves the way the design brief specifies — including moving not at all when the person
has asked for that.

### Screens

| Screen | Design reference |
|---|---|
| Install prompt | PL-2; `T.pwa.*`. Dismissible, **once**, after first reaching the dashboard, **mobile only** |
| Offline banner | PL-5; `T.off.*` |
| Splash / app icon | brief §12 and brief §13 |
| Every screen | brief §13 — the full motion system |

### Backend

Nothing new. One clarification that matters for the service worker:
`GET /api/health` must respond with `Cache-Control: no-store`, or the offline detector will
happily read a cached "ok" and report the network as present.

### Frontend

**PWA (PL-2, C6)**

- `manifest.webmanifest` — name, short name, the app icon set from brief §12,
  `display: standalone`, `theme_color` `#05070D`, `background_color` matching the splash,
  `start_url: "/overview"`, `orientation: portrait`.
- Service worker via Workbox, extending Phase 6's precache:
  - **Precache**: the app shell, the token CSS, fonts, the `/id` route, and the icon set.
  - **Runtime, record reads** (`/api/me/record`, `/api/me/subjects/*`, `/api/me/archive`):
    stale-while-revalidate, 24h expiry.
  - **Runtime, credential** (`/api/me/credential`): cache-first — the ID must open with no
    network at all.
  - **Never cached**: auth, marks, publish, export, credentials, iter, support. A cached
    write is a lie, and a cached auth response is a security bug.
  - Navigation fallback to the shell for offline route changes.
- `InstallPrompt` — capture `beforeinstallprompt`, show once after the dashboard is first
  reached, dismissible, and **never on desktop** (PL-2). Record the dismissal so it does not
  return.

**Offline (PL-5)**

- `OnlineProvider` — `navigator.onLine` plus a lightweight probe of `/api/health`, because
  `onLine` reports true on a captive portal and a school wifi captive portal is exactly the
  case that matters.
- `OfflineBanner` — appears when offline, with cached record data still shown beneath it.
- **Network-dependent actions are disabled with an explanation**, not silently broken:
  publish, supersede, export, credential submission, credential decisions, support send,
  Iter send. Each disabled control carries the reason from `T.off`, so a teacher who cannot
  publish learns why in the same glance.
- **The ID is the exception and the reason the whole feature exists** — fully functional,
  nothing greyed out, nothing disabled (ID-8).

**Motion (brief §13)**

- Easings and durations as tokens: `--ease-out cubic-bezier(.2,.8,.2,1)`,
  `--ease-in cubic-bezier(.4,0,1,1)`, `--ease-spring cubic-bezier(.34,1.4,.64,1)`.
- Keyframes lifted from the design source: `screenIn`, `sheetUp`, `panelRight`, `chipIn`,
  `msgIn`, `tileIn`, `dialogIn`, `toastIn`, `cardIn`, `sweepX`, `sweepFlash`, `blobIn`,
  `grainIn`, `driftA`, `driftB`.
- The mosaic's `tileIn` staggers; the stagger is capped so a 200-tile mosaic does not take
  four seconds to finish arriving.
- **`prefers-reduced-motion: reduce` disables all of it** (PRD §11.3), matching the design's own
  media block: `animation: none`, `transform: none`, `opacity: 1`. Not "slower" — off. The
  conic-gradient thinking border becomes a static border and the thinking state is conveyed
  by the pill's presence alone.

### Done when

1. Chrome devtools → Application → Manifest: no errors, icons resolve at every size.
   Lighthouse **PWA audit passes** and the app is installable.
2. Install it to a phone home screen. It launches standalone with the correct icon and
   splash, and lands on `/overview`.
3. The install prompt appears **once**, on mobile, after first reaching the dashboard.
   Dismiss it, reload three times → it does not return. Open the app on desktop → it never
   appears.
4. **Airplane mode, cold start.** Kill the app, enable airplane mode, launch from the home
   screen:
   - `/id` opens fully — card and QR, nothing disabled, `Աշխատում է առանց ինտերնետի` shown.
   - `/overview` shows **cached** marks with the offline banner above them.
   - Press Publish in the gradebook → disabled, with the reason visible.
   - Press Export → disabled, with the reason visible.
   - Submit a credential → disabled, with the reason visible.
5. Re-enable the network. The banner disappears within a few seconds without a reload, and
   the disabled controls re-enable.
6. **Captive portal simulation.** Devtools → Network → block `/api/*` while leaving
   `navigator.onLine` true. The app still detects offline via the health probe. If it does
   not, the probe is not wired.
7. Nothing sensitive is cached: Application → Cache Storage, inspect every entry. No
   `/api/auth/*`, no `/api/marks*`, no `/api/credentials*`, no export.
8. **Reduced motion.** Turn it on at the OS level. Reload. Nothing animates: no screen
   transition, no tile stagger, no sheet slide, no publish sweep, no drifting blobs, and the
   Iter thinking border is static. Turn it off → all of it returns.
9. Publish while reduced motion is on: the sweep does not animate, and the state change is
   still unmistakable. If publishing becomes ambiguous without the animation, the
   confirmation was carried entirely by motion and needs a non-motion counterpart.
10. Lighthouse Performance on a throttled 3G profile — record the numbers now as the
    baseline Phase 14 must meet.

---

# Phase 14 — Accessibility, performance, deployment, demo accounts

### Delivers

A shareable URL, four working demo accounts, and evidence that PRD §11.1 and PRD §11.3 are met
rather than assumed.

### Screens

Every screen, audited. No new ones.

### Backend

**Production hardening**

- HSTS (`max-age=31536000; includeSubDomains; preload`), TLS everywhere (S-1).
- `helmet` with a real CSP: `default-src 'self'`, `img-src 'self' data: blob:`,
  `connect-src 'self'`, `font-src 'self' https://fonts.gstatic.com`,
  `frame-ancestors 'none'`. **No third-party script that transmits student data** (S-11) —
  and since fonts are the only external origin, self-host them and drop that exception
  entirely.
- Rate limits live: 6 logins / 15 min / account, 100 API requests / min / user (S-7).
- `GET /api/dev/last-reset-token` **is not mounted** — asserted, not assumed.
- Structured request logs with a correlation id; **passwords, tokens and QR payloads are
  redacted** by a serialiser allowlist, not a denylist, because a denylist misses the next
  field someone adds.
- `audit_log` verified to cover every mark change, credential decision, permission change,
  import, export and account action (S-10).
- Scan-event retention job: `scan_event` detail older than one academic year is aggregated
  and the detail discarded (S-9). A scheduled task; if there is no scheduler yet, a
  documented manual script with the date it must first be run.

**Deployment**

- Backend as a container on a Node-capable host with a persistent process (Fly.io or Render
  both work); frontend on Vercel. `BACKEND_INTERNAL_URL` wired into the Next rewrite so C11
  holds in production too and the API is never addressed cross-origin from a browser.
- Neon: a dedicated production branch, connection string in the host's secret store, pooled
  endpoint, and **no migration step in the deploy pipeline** (C2) — the guard from Phase 0
  runs in CI.
- Object storage: R2 bucket, private, backend credentials only, no public bucket policy.

> ❓ **S-13 data residency is unresolved and this is where it stops being theoretical.**
> Whether minors' educational records may be hosted outside Armenia depends on Armenian data
> protection law. **It must be answered before any deployment holding real student data.**
> Deploying the seeded demo is unaffected — the seed is invented and contains no real
> student and no real school (PRD §10.6). Deploy the demo; do not load a real roster until this
> is answered.

### Frontend

- Self-host the font stack (one stack across all three languages, L-6).
- Route-level code splitting; the gradebook and the admin import preview are the two heavy
  bundles and both are lazy.
- `next/image` for the few raster assets; everything else is SVG or CSS.
- Demo login buttons wired to the four `is_demo` accounts, including the first-login one, so
  a visitor can see the forced password change without being handed a password.

### The audits

**Accessibility — WCAG 2.1 AA (PRD §11.3)**

- `axe-core` via Playwright across twelve routes × two themes × three languages.
  **Zero serious or critical violations.**
- **Contrast measured against what is actually behind the text**, including through
  translucent layers. An automated tool reads the element's own background and will pass
  white-on-glass that a human cannot read; sample the rendered pixels for every glass surface
  by hand.
- Touch targets ≥ 44×44px — audit the pill nav, the QR button, the Iter button, mark cells,
  and the accent swatches.
- Full keyboard operability end to end, with **visible focus indicators and no transition
  delay** on the ring.
- Screen-reader labels on every icon-only control: nav items, the QR button, Iter, the `+`
  cell, attachment actions, the sidebar collapse.
- The gradebook grid announces sensibly: `role="grid"`, row and column headers associated,
  and a live region announcing the publish result — because the publish confirmation is a
  visual sweep and a screen reader user gets nothing from it otherwise.

**Performance (PRD §11.1)**

| Metric | Target | How to measure |
|---|---|---|
| FCP, 3G | < 2.0s | Lighthouse, mobile preset, "Slow 4G" throttling |
| TTI, 3G | < 4.0s | same run |
| ID open → QR visible | < 500ms cached | `performance.mark` around the sheet open, median of 10 |
| Gradebook render, 30×20 | < 300ms | React Profiler commit duration on class switch |
| **Keystroke → cell update** | **< 50ms** | Performance panel, measure input to paint over a 25-mark burst |
| Roster import, 600 rows | < 30s incl. preview | wall clock, Phase 5 |
| API p95 read / write | < 300ms / < 600ms | `k6` or `autocannon` against seeded data |

The keystroke figure is not decorative. Above roughly 100ms, bulk entry feels laggy and
teachers revert to paper, and every other number in this table matters less than that one.

### Done when

1. `axe` suite: **0 serious, 0 critical** across all twelve routes, both themes, all three
   languages. Store the report in the repository.
2. Keyboard-only pass: unplug the mouse. Log in, navigate to every screen, enter a column of
   marks, publish, open Iter, send a message, open Settings, change the accent, log out. All
   of it, with the focus ring visible at every step.
3. Screen reader (VoiceOver or NVDA): the ID card announces the holder; the mosaic announces
   subject and value per tile; every icon-only button has a name; publishing announces its
   result.
4. Contrast: sample ten text-on-glass locations with a colour picker on the **rendered**
   pixels. All ≥ 4.5:1. Do the same in both themes.
5. Touch targets: measure the eight smallest interactive elements in devtools. All ≥ 44px.
6. Lighthouse mobile, throttled: FCP < 2.0s, TTI < 4.0s. Record the run.
7. ID open to QR visible: median of ten timed opens < 500ms, warm cache.
8. Gradebook: React Profiler on a class switch with 30 students × 20 assessments < 300ms
   commit.
9. **Keystroke to cell update < 50ms**, measured over a real 25-mark burst, not a single
   keypress.
10. `k6` against the seeded database: read p95 < 300ms, write p95 < 600ms.
11. Deploy. Open the URL on a phone that has never seen the product. Install it. Log in with
    each of the four demo accounts:
    - student → mosaic, ID, QR
    - teacher → four classes, drafts, publish
    - admin → setup, import, export
    - first-login → forced password change, and no way past it
12. **Production security checks, from outside:**
    - `curl -I https://…` → HSTS present, CSP present.
    - `curl https://…/api/dev/last-reset-token` → 404. The endpoint does not exist.
    - Seven wrong logins → locked, generic message.
    - An attachment URL in a logged-out window → `UNAUTHENTICATED`.
    - `curl -X POST https://…/api/verify -d '{}'` with no `X-Scanner-Key` →
      `SCANNER_UNAUTHORISED`.
    - Devtools → Network on a full session: **no third-party request carries student data**
      (S-11). Ideally, no third-party request at all.
    - **The permanent keys.** Confirm `QR_SIGNING_SECRET` and `QR_HANDLE_KEY` exist in a
      backup separate from the main secret store, and that the deployment notes state they
      are never rotated. Then prove it end to end: read a student's QR before a redeploy,
      redeploy, read it again → **byte-identical**. This is the only check that catches a
      pipeline which regenerates secrets on deploy, and it fails silently otherwise.
13. `select count(*) from audit_log` rises when you: publish, supersede, decide a credential,
    import, export, change a password. Six actions, six kinds of row.
14. Share the URL with someone who has not seen it. They log in as the demo student and reach
    the QR without being told how. **That is the test** — PRD §15's setup metric says a school
    that needs the author's help has not adopted anything, and the same standard applies to a
    demo.

---

# Appendix A — Error code registry

The client's `err` dictionary must contain a hy/en/ru entry for **every** code below. An
unmapped code renders as the raw code in development (Phase 4), which is how a missing
translation is found before a user finds it.

| Code | HTTP | Phase | Module |
|---|---|---|---|
| `VALIDATION_FAILED` | 422 | 0 | shared |
| `UNAUTHENTICATED` | 401 | 3 | shared |
| `TOKEN_EXPIRED` | 401 | 3 | shared |
| `FORBIDDEN` | 403 | 3 | shared |
| `NOT_FOUND` | 404 | 0 | shared |
| `CONFLICT` | 409 | 0 | shared |
| `RATE_LIMITED` | 429 | 3 | shared |
| `PAYLOAD_TOO_LARGE` | 413 | 5 | shared |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | 5 | shared |
| `INTERNAL` | 500 | 0 | shared |
| `AUTH_INVALID_CREDENTIALS` | 401 | 3 | auth |
| `AUTH_ACCOUNT_LOCKED` | 423 | 3 | auth |
| `AUTH_PASSWORD_CHANGE_REQUIRED` | 403 | 3 | auth |
| `AUTH_CURRENT_PASSWORD_INVALID` | 400 | 3 | auth |
| `AUTH_PASSWORD_WEAK` | 422 | 3 | auth |
| `AUTH_PASSWORD_REUSED` | 422 | 3 | auth |
| `AUTH_REFRESH_MISSING` | 401 | 3 | auth |
| `AUTH_REFRESH_INVALID` | 401 | 3 | auth |
| `AUTH_REFRESH_REUSED` | 401 | 3 | auth |
| `AUTH_SESSION_REVOKED` | 401 | 3 | auth |
| `AUTH_RESET_TOKEN_INVALID` | 400 | 3 | auth |
| `AUTH_RESET_TOKEN_EXPIRED` | 410 | 3 | auth |
| `AUTH_RESET_TOKEN_USED` | 410 | 3 | auth |
| `SESSION_NOT_FOUND` | 404 | 3 | auth |
| `USER_EMAIL_TAKEN` | 409 | 5 | admin |
| `CLASS_ALREADY_EXISTS` | — | 5 | admin (in `skipped[]`) |
| `GENERATE_RANGE_TOO_LARGE` | 422 | 5 | admin |
| `IMPORT_FILE_UNREADABLE` | 400 | 5 | admin |
| `IMPORT_COLUMNS_MISSING` | 422 | 5 | admin |
| `IMPORT_TOO_MANY_ROWS` | 422 | 5 | admin |
| `IMPORT_BATCH_NOT_PREVIEWING` | 409 | 5 | admin |
| `IMPORT_BATCH_EXPIRED` | 410 | 5 | admin |
| `IMPORT_HAS_ERRORS` | 409 | 5 | admin |
| `ROW_MISSING_LAST_NAME` | — | 5 | admin (row-level) |
| `ROW_MISSING_FIRST_NAME` | — | 5 | admin (row-level) |
| `ROW_INVALID_DATE` | — | 5 | admin (row-level) |
| `ROW_DATE_IMPLAUSIBLE` | — | 5 | admin (row-level) |
| `ROW_UNKNOWN_CLASS` | — | 5 | admin (row-level) |
| `ROW_UNKNOWN_SUBJECT` | — | 5 | admin (row-level) |
| `ROW_INVALID_EMAIL` | — | 5 | admin (row-level) |
| `ROW_EMAIL_TAKEN` | — | 5 | admin (row-level) |
| `ROW_DUPLICATE_IN_FILE` | — | 5 | admin (row-level) |
| `ROW_DUPLICATE_IN_DB` | — | 5 | admin (row-level) |
| `ROW_EMPTY` | — | 5 | admin (row-level) |
| `CREDENTIALS_ALREADY_CHANGED` | — | 5 | admin (in `skipped[]`) |
| `ENROLLMENT_TRANSITION_INVALID` | 409 | 5 | admin |
| `ENROLLMENT_TARGET_CLASS_INVALID` | 422 | 5 | admin |
| `CREDENTIAL_REVOKED` | 409 | 6 | identity |
| `CREDENTIAL_MISSING` | 404 | 6 | identity |
| `SCANNER_UNAUTHORISED` | 401 | 6 | identity |
| `SCAN_PAYLOAD_MALFORMED` | 400 | 6 | identity |
| `RECORD_TERM_NOT_FOUND` | 404 | 7 | record |
| `RECORD_NO_ENROLLMENT` | 409 | 7 | record |
| `MARK_ALREADY_PUBLISHED` | — | 8 | gradebook (in `rejected[]`) |
| `MARK_ALREADY_CURRENT` | 409 | 8 | gradebook |
| `MARK_VALUE_OUT_OF_RANGE` | 422 | 8 | gradebook |
| `MARK_STUDENT_NOT_IN_CLASS` | 422 | 8 | gradebook |
| `MARK_TERM_MISMATCH` | 422 | 8 | gradebook |
| `MARK_REASON_REQUIRED` | 422 | 8 | gradebook |
| `MARK_NOT_PUBLISHED` | 409 | 8 | gradebook |
| `MARK_ALREADY_SUPERSEDED` | 409 | 8 | gradebook |
| `MARK_VALUE_UNCHANGED` | 422 | 8 | gradebook |
| `PUBLISH_NOTHING_TO_PUBLISH` | 409 | 8 | gradebook |
| `ASSESSMENT_HAS_MARKS` | 409 | 8 | gradebook |
| `EXPORT_SCOPE_INVALID` | 422 | 9 | export |
| `EXPORT_SCOPE_FORBIDDEN` | 403 | 9 | export |
| `EXPORT_NO_PUBLISHED_MARKS` | 409 | 9 | export |
| `CREDENTIAL_FILE_TYPE_INVALID` | 415 | 10 | credentials |
| `CREDENTIAL_FILE_TOO_LARGE` | 413 | 10 | credentials |
| `CREDENTIAL_FILE_REQUIRED` | 422 | 10 | credentials |
| `CREDENTIAL_SUBJECT_INVALID` | 422 | 10 | credentials |
| `CREDENTIAL_REASON_REQUIRED` | 422 | 10 | credentials |
| `CREDENTIAL_ALREADY_DECIDED` | 409 | 10 | credentials |
| `CREDENTIAL_NOT_REVIEWABLE` | 403 | 10 | credentials |
| `CREDENTIAL_SUBJECT_MISSING` | 409 | 10 | credentials |
| `ITER_ATTACHMENT_LIMIT` | 422 | 11 | iter |
| `ITER_ATTACHMENT_NOT_FOUND` | 404 | 11 | iter |
| `ITER_MESSAGE_EMPTY` | 422 | 11 | iter |
| `SUPPORT_RATING_REQUIRED` | 422 | 12 | settings |
| `SUPPORT_BODY_TOO_SHORT` | 422 | 12 | settings |
| `NOTIFICATION_KIND_UNKNOWN` | 422 | 12 | settings |

---

# Appendix B — Screen ↔ design reference index

Design bundle root: `tessera-design/project/`. The design-system bundle root:
`design-sistem/project/`.

| Screen | Design file | Marker |
|---|---|---|
| Login, forgot, reset, first-login | `Tessera.dc.html` | `sc-if isLogin`; `T.auth.*` |
| App shell | `Tessera.dc.html` | `sc-if isApp`; brief §8quater |
| Mobile shell | `Tessera Mobile v2.dc.html` | brief §9 |
| Overview / mosaic | `Tessera.dc.html` | `sc-if isOverview`; `T.ov.*` |
| Subjects | `Tessera.dc.html` | `sc-if isSubjects`; `T.sj.*` |
| Subject detail | `Tessera.dc.html` | `T.st.*` |
| Archive | `Tessera.dc.html` | `sc-if isArchive`; `T.ar.*`; `ARCHIVE` |
| Credentials | `Tessera.dc.html` | `sc-if isCreds`; `T.cr.*` |
| Review queue | `Tessera.dc.html` | `sc-if isQueue`; `T.q.*` |
| ID card | `Tessera.dc.html` | `sc-if isId`; brief §10 |
| QR sheet | `Tessera.dc.html` | `sc-if qrOpen`; brief §10 |
| Teacher today panel | `Tessera.dc.html` | `sc-if isToday` |
| Gradebook | `Tessera.dc.html` | `sc-if isGradebook`; `T.gb.*`; `CLASSES`, `COLS` |
| Publish confirmation | `Tessera.dc.html` | `sc-if confirmOpen`; `T.dlg.*` |
| Iter panel | `Tessera.dc.html` | `sc-if iterOpen` / `iterEmpty`; brief §11bis |
| Settings | `Tessera.dc.html` | `sc-if isSettings`; `T.set.*`; brief §11ter |
| Notifications | `Tessera.dc.html` | `sc-if isNotif` |
| Widget gallery | brief §11 | eleven designs incl. Ask Iter |
| Tokens, primitives | `tessera-design-system.dc.html` | the token contract |
| Logo, Iter mark | `mark-src.svg`, `iter-src.svg`, `Mark.dc.html`, `IterMark.dc.html` | `currentColor`, square viewBox |
| Copy, fixtures, grade scale, accents | `tessera-data.js` | `T`, `G`, `ICON`, `ACCENTS`, `USERS`, `SUBJECTS`, `STUDENTS`, `CLASSES`, `SESSIONS`, `ARCHIVE` |
| Full visual brief | `design/brief-chain/00`–`08` | **nine files — see below** |

### The brief is nine files, not one

There is **no single file that states the current design.** `tessera-v2-FINAL (3).md` is the
**base**; `v2.1`, `v2.2`, `v2.4` and `corrections-2` through `corrections-6` are **deltas**,
each opening "Attach with the current HTML" and listing two to four numbered fixes. The
current design is the base with all eight applied **in order**.

Verified order, from internal evidence rather than filenames: `corrections-2` section 4 opens
*"Restore the gradient fill on the Iter button. But the reason it was removed still
stands"* — the removal is `v2.4` section 1, so `corrections-2` is later.

Seven of nine topics were revised more than once. The QR button alone changed three times:

| Round | QR button |
|---|---|
| `01-v2.1` §1 (of that file) | 56px, pill has a 64px concave **notch**, top edge rises 14px |
| `03-v2.4` §1 (of that file) | **58px**; Iter drops to 44px, glass, no gradient |
| `04-corrections-2` §4 (of that file) | 58px **plus a 5px background-coloured border**; Iter's gradient **restored** at 44px |
| `07-corrections-5` §2 (of that file) | pill becomes `1fr 78px 1fr`; **no notch** |

Reading only the first round gives 56px and a notch. Reading only the last gives nothing at
all about the button's size. **Both are wrong.** Final state: QR 58px + 5px border, Iter 44px
with gradient, pill `1fr 78px 1fr`, no notch.

Consolidating the nine into one merged spec is a task in its own right and belongs **before
Phase 4**, not inside it.

### Two source files, two halves of the token set

`tessera-design-system.dc.html` contains **no screens** — `grep` for `sc-if` returns zero. It
is a token and primitive sheet plus the eleven-widget catalogue. It defines
`--bg-base --surface --surface2 --ink --ink-2 --ink-3 --hair --hair-bright --hair-top` and
**not** `--g1…--g10`, `--accent` or `--accent-tint`. Those live in `tessera-data.js` as
`const G` and `const ACCENTS`.

So the earlier claim that "the token file is the contract" was wrong in a specific way: **no
token file exists in the design.** `tessera.css` is an *output* of Phase 4, authored by
consolidating values from both files. `const G` is the source of the values; `--g1…--g10` is
their runtime form; after Phase 4 the JS constant is never read again, or `tokens:check`
starts failing against its own source.

Also: the two handoff bundles differ. `Tessera.dc.html` is **newer in
`tessera_design-handoff`** (18 lines, all login-language-pill and QR-sheet sizing);
`tessera-design-system.dc.html` exists **only in `design_sistem-handoff`**. The repository's
`design/` folder must be assembled from **both** bundles.

### Surfaces with no design precedent

**Three surfaces have no design precedent.** Build each from primitives per C13 and show
the author before continuing:

| Surface | Phase | Note |
|---|---|---|
| The administration screens (PRD §9.2) | 5 | The largest of the three. Import preview is the critical one |
| The scanner page — camera, result, pass or fail | 6 | Not a user screen: it runs on a door device authenticated by `SCANNER_API_KEY`. Large result state, readable at arm's length, legible in a doorway |
| The scan-anomaly view for `GET /api/verify/anomalies` | 6 | A dense admin table. This is the screen that surfaces a shared screenshot, so it must make a two-location pair obvious at a glance |

Neither Phase 6 surface appeared in the earlier screen inventory. Both are real screens with
no mockup, and the point of this index is that Claude Code knows exactly where a design
exists and where one does not.

---

# Appendix C — Carried-forward open questions

None of these block development against the seeded data. Several block deployment with real
data, and one blocks the claim that the product should exist at all. Both facts are true at
once, which is why the build proceeds.

| # | Question | Blocks | Surfaces in |
|---|---|---|---|
| Q1 | Do teachers use the existing electronic gradebook, or avoid it, and why? | the gradebook's justification | before pilot |
| Q2 | Why did the Polytechnic discontinue digital cards? | the ID's core premise | before pilot |
| Q3 | Can the school export its roster to a file? | could halve Phase 5 | Phase 5 |
| Q4 | What does the school spend on certificates, paper, staff time, cards? | the commercial argument | before pilot |
| Q5 | Who decides a software purchase — school or ministry? | go-to-market | before pilot |
| Q6 | What format does the school need marks in? (EXP-7) | export's usefulness | Phase 9 — isolated behind `buildSheet(rows, layout)` |
| Q7 | May minors' records be hosted outside Armenia? (S-13) | **real-data deployment** | Phase 14 |
| Q8 | Is curriculum topic data available, and will teachers enter it? (REC-10) | topic breakdown | Phase 7 — degrades cleanly |
| Q9 | **New.** Which mail provider sends password resets? | production auth | Phase 14 |
| D6 | **Grades 4 and 8 cannot reach WCAG AA against either ink.** Measured: `#bd6320` 4.47, `#3f7f8c` 4.16. The fixed-grade-colour rule and PRD §11.3 are in direct conflict for these two swatches. Full analysis and three options below this table. | **Phase 4 — before any tile renders** | Phase 4 |
| Q10 | **New.** What is the retention policy for `iter_message`? It is data about minors, stored from Phase 11 onward, with no model attached to justify it. | Iter's data footprint | Phase 11 |

---

# Appendix D — Phase map against PRD §16

| PRD §16 | This document | Change |
|---|---|---|
| 0 Repository, Docker Postgres | **Phase 0** | Docker Postgres removed — Neon exists (C1) |
| 1 Schema and migrations | **Phase 1** | Inverted: introspect and **verify**, never create (C2) |
| 2 Seed script | **Phase 2** | Inverted: **audit** the applied seed and register fixtures (C1) |
| 3 Auth | **Phase 3** | unchanged in substance; cookie and origin made concrete (C11, C12) |
| 4 Tokens, shell, languages | **Phase 4** | unchanged |
| 5 Administration setup | **Phase 5** | visual treatment specified (C13); screens have no design precedent |
| 6 ID and QR | **Phase 6** | unchanged |
| 7 Academic record | **Phase 7** | unchanged |
| 8 Gradebook | **Phase 8** | unchanged |
| 9 Export | **Phase 9** | unchanged |
| 10 Credentials | **Phase 10** | storage made concrete: S3-compatible, backend-gated (C10) |
| 11 Iter | **Phase 11** | unchanged; retention question raised (Q10) |
| 12 Settings, support, widgets | **Phase 12** | unchanged |
| 13 Motion, PWA, offline | **Phase 13** | unchanged |
| 14 A11y, performance, deployment | **Phase 14** | deployment targets made concrete |

Fifteen phases. Phase 1 still comes before any screen. Phase 5 still comes before the
student and teacher features, for the reason PRD §16 gives: without a roster there is nothing
for them to operate on, and it is the largest area of new work, so it must not be discovered
late.

---

---

# Appendix E — D6 in full

> **D6 — two grade colours cannot reach AA against either ink.**
>
> Measured against the real `--ink` tokens, `#F4F2EE` (dark theme) and `#101112` (light
> theme), not against pure white or black:
>
> | Grade | Hex | on `#F4F2EE` | on `#101112` | Best |
> |---|---|---|---|---|
> | **4** | `#bd6320` | 3.78 | **4.47** | 4.47 |
> | **8** | `#3f7f8c` | **4.06** | 4.16 | 4.16 |
>
> The other eight pass comfortably; the worst of them is grade 7 at 4.81. So this is two
> colours, not a systemic failure of the scale.
>
> **The conflict is between two rules that are each correct on their own.** The C-layer says
> grade colours never change with theme, accent or opacity — that is what makes the mosaic
> readable as a single fixed language (REC-2). PRD §11.3 requires WCAG 2.1 AA. For these two
> swatches both cannot hold.
>
> **Options, with what each costs:**
>
> **(a) Darken both hexes slightly.** Measured: grade 4 needs ≈ ×0.90 lightness →
> `#aa591d` (4.52 on light ink); grade 8 needs ≈ ×0.94 → `#3b7784` (4.52). Both then pass
> against `#F4F2EE` only, so it forces one ink for all tiles. Cost: the warm 3→4→5 ramp
> tightens, and the mosaic's colour spacing is the thing the ramp exists for.
>
> **(b) Make the numeral's colour conditional on the tile behind it.** Pick `--ink` or its
> inverse per swatch by luminance. Every grade then clears 4.5 with no hex changed —
> grade 4 at 4.47 on dark ink is a rounding error away, and the others have margin. Cost:
> "grade colours never change" survives intact, but "the numeral is always `--ink`" does
> not; and it introduces a per-tile branch into the one component that must stay cheap to
> render (Phase 8's 50ms budget).
>
> **(c) Accept a documented AA exception for grades 4 and 8**, recorded in PRD §11.3 rather
> than left implicit. Cost: the accessibility claim acquires an asterisk, and an asterisk
> that is written down is defensible where one that is not is a defect.
>
> **Resolve in Phase 4, before any tile is rendered.** (b) is the only option that changes
> no design token, which is why it is worth measuring first — but it is a decision about
> the design language, not a technical one, so it is not made here.

**Resolved (this repository) — option (c).** See `docs/decisions.md` D-5. The ten grade
hexes ship exactly as measured above, unchanged; the AA exception on grades 4 and 8 is
recorded here and must be carried into the Phase 4 design-tokens documentation rather than
silently dropped.

---

*End of document.*
