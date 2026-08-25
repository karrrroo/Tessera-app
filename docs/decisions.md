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
