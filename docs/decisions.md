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
