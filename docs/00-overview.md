# Tessera — project overview and phase plan

This is the master plan for building Tessera. It summarizes what the product is, the
confirmed tech stack, the repository layout, and the phase-by-phase build order this
project follows. Source material lives in `docs/reference/`; every deviation from that
source material is recorded in `docs/decisions.md`. Each phase gets its own document in
`docs/phases/` once it's done, describing what was built and any decisions made along the
way.

## What Tessera is

A digital gradebook and student-ID platform for Armenian K-12 schools, trilingual
(Armenian / English / Russian, Armenian is the source language). It replaces two things a
school currently does on paper or in parallel spreadsheets: a teacher's gradebook, and a
physical proof-of-enrolment card. It does **not** integrate with Armenia's state EMIS
system — that was a deliberate, already-made decision (the schema and UI already reflect
it); Tessera holds its own data and produces an export file a human can upload to EMIS
separately.

Three roles, fixed per account (no in-app switching):

- **Student** — views their own published marks and grade history, displays a static QR
  digital ID, submits achievement/credential requests, uses the in-app assistant ("Iter").
- **Teacher** — enters marks into a gradebook (draft until explicitly published,
  append-only corrections with a mandatory reason afterward), decides credential requests
  for their subjects, exports their classes' data.
- **Administrator** — sets up the institution (years, terms, subjects, classes), bulk
  imports students/teachers via spreadsheet with a preview-before-commit step, manages
  rosters and teaching assignments, decides any credential, exports everything.

The one hard offline requirement: the digital student ID/QR must work with no network
connection. Everything else may require connectivity.

Full feature-level detail is in `docs/reference/tessera-PRD.md` (normative on behaviour)
and `docs/reference/tessera-roadmap.md` (normative on build order).

## Confirmed tech stack

| Layer | Choice |
|---|---|
| Backend | Node.js, Express, TypeScript, Drizzle (query builder over an existing schema, no migration tooling) |
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Database | PostgreSQL — local instance for now, a Neon project later (`docs/decisions.md` D-3); accessed **only** through this backend, no Neon API, no Supabase, no BaaS of any kind |
| Auth | JWT — short-lived access token held in memory on the client, httpOnly/Secure/SameSite=Lax rotating refresh cookie scoped to the refresh endpoint |
| File storage | Local disk behind a `StorageProvider` interface for now, no Cloudflare/S3 service yet (`docs/decisions.md` D-4) |
| Deployment shape | One origin: Next.js proxies `/api/*` to Express, so the browser only ever talks to one address |
| Repo shape | npm workspaces, root `package.json`, one `npm start` boots both `frontend/` and `backend/` |
| Platform | Responsive web app, installable PWA from Phase 13 onward. No native mobile app in this build (React Native is a possible later, separate project) |

This is what `docs/reference/tessera-roadmap.md` already specified (C3–C9, C11, C12) —
the source documents were already written for this exact stack, so no stack-level fixes
were needed. The only fixes made were to the two infrastructure *timing* decisions (D-3,
D-4 above) and the one open accessibility question (D-5), all logged in
`docs/decisions.md`.

## Repository layout

```
Tessera-app/
├── package.json              # npm workspaces root; `npm start` runs both apps
├── .env.example
├── .gitignore
├── docs/
│   ├── 00-overview.md        # this file
│   ├── decisions.md          # running decisions/deviations log
│   ├── phases/               # one file per completed phase (00-repo-and-health.md, ...)
│   └── reference/            # source-of-truth documents, annotated where we deviate
│       ├── tessera-PRD.md
│       ├── tessera-roadmap.md
│       ├── tessera-schema.sql
│       ├── tessera-seed.sql
│       └── archive/tessera-roadmap-v1-superseded.md
├── scripts/                  # guard-no-migrations.mjs, schema-check, data-audit, i18n-check
├── backend/
│   └── src/{db,http,modules,lib}
└── frontend/
    └── src/{app,components,design,i18n,lib/api,state}
```

`modules/<area>/` on the backend mirrors PRD §9 one-to-one: `auth`, `admin`, `identity`,
`record`, `gradebook`, `export`, `credentials`, `iter`, `settings`.

## Phase plan

Adapted from `docs/reference/tessera-roadmap.md` §0–§3 and its 15 phases, with D-3/D-4/D-5
folded in. Each phase ends in a git commit and its own file in `docs/phases/`.

| # | Phase | Delivers |
|---|---|---|
| 0 | Repository and the single command | `npm install && npm start` boots both apps behind one origin; health check reachable through the proxy; env validation fails loudly on a missing key |
| 1 | Schema, applied and verified | `tessera-schema.sql` applied once to local Postgres (D-3); Drizzle models generated from it; a check script proves the key constraints (append-only marks, supersede-requires-reason, one-current-mark) actually hold |
| 2 | Seed, applied and audited | `tessera-seed.sql` applied once (D-3); an audit script confirms every fixture later phases depend on is present (demo accounts, drafts, superseded marks, a sparse student, etc.) |
| 3 | Authentication | Login (email or institution ID + password), JWT access/refresh, forced first-login password change, lockout, password reset, per-device session list/revocation — trilingual from this screen on |
| 4 | Design tokens, shell, theming, 3 languages | The token system (colour, type, spacing, glass/gradient/grain), light/dark themes, 7 accents, 4 backgrounds, web sidebar + mobile pill-nav shells, full hy/en/ru dictionaries. Grade-colour AA exception (D-5) documented here. |
| 5 | Administration setup | Institution/years/terms/subjects/classes, bulk student/teacher import with preview-before-commit, teaching assignments, roster management, printable credential handout sheets |
| 6 | Student ID, static QR, offline | Opaque-handle signed QR (29×29, never rotates), `/api/verify` scanner endpoint with its own key-based auth, anomaly detection on multi-location scans, full offline function for the ID screen |
| 7 | Academic record | Read-only student-facing views: grade mosaic, subject detail, multi-year archive, mark history — zero write endpoints |
| 8 | Teacher gradebook | The grid, keyboard-driven entry, draft → publish workflow, append-only corrections with mandatory reason |
| 9 | Export | Streaming xlsx/csv, published marks only, per-export audit log |
| 10 | Credentials | Submit → pending → approved/declined workflow, attachments through the local-disk `StorageProvider` (D-4), content-sniffed validation |
| 11 | Iter (assistant shell) | The UI is fully built; no model is connected in this release — sending a message shows an honest "not connected yet" state, exactly as designed |
| 12 | Settings, notifications, support, widget gallery | Preferences, the derived notification feed, support tickets, native-widget gallery (design reference only, not implemented) |
| 13 | Motion, PWA, offline | Installable PWA, service worker caching, full motion-token system, `prefers-reduced-motion` |
| 14 | Accessibility, performance, deployment | a11y audit, performance budget, production hardening, and — when it's time — the Neon cutover (swap `DATABASE_URL`, re-apply the same schema/seed, no other changes) |

## Open items carried forward, not blocking development

These come straight from the roadmap's own Appendix C and are about whether the product
*should* exist in its current form, not about whether it can be built — they don't block
any phase above, only a real deployment with real school data:

- Data residency for minors' records (must be answered before real data is loaded)
- Which mail provider sends password resets in production (dev uses a console fallback)
- Retention policy for Iter messages, and the legal questions around connecting a real
  model to Iter at all
- Whether the school can already export its roster (would shrink Phase 5)
- The exact spreadsheet column format schools actually need on export

Full detail in `docs/reference/tessera-roadmap.md` Appendix C.
