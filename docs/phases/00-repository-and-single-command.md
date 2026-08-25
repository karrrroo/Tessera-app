# Phase 0 — Repository and the single command

Source: `docs/reference/tessera-roadmap.md`, Phase 0.

## Delivers

`npm install && npm start` boots the whole stack from the project root: an Express
backend and a Next.js frontend, sharing one origin through a proxy, with environment
validation that fails loudly instead of booting half-configured.

## What was built

- **Root** — `package.json` with npm workspaces (`backend`, `frontend`); `npm start` runs
  both via `concurrently`; a `prestart`/`predev` hook runs `scripts/guard-no-migrations.mjs`
  first (see D-3 in `docs/decisions.md` for why this guard still applies against a local
  database).
- **Backend** (`backend/`) — Express + TypeScript, run through `tsx watch`.
  - `src/lib/env.ts` — zod-validated environment (`NODE_ENV`, `PORT`, `DATABASE_URL`),
    throwing a named `EnvValidationError` with the specific missing/invalid keys if
    validation fails.
  - `src/http/app.ts` — the Express app; one route, `GET /api/health`.
  - `src/index.ts` — loads `.env` (via `dotenv`), then boots the app on `env.PORT` (4000
    locally).
- **Frontend** (`frontend/`) — scaffolded with `create-next-app` (App Router, TypeScript,
  Tailwind, ESLint), Next.js 16.3.2 / React 19.2.8.
  - `next.config.ts` — `rewrites()` proxies `/api/*` to `BACKEND_INTERNAL_URL`
    (defaults to `http://localhost:4000`), so the browser only ever talks to port 3000.
  - `src/app/page.tsx` — a throwaway page (per the roadmap's own instruction) that calls
    `/api/health` client-side, purely to prove the proxy path works end to end.
  - Removed the auto-generated `CLAUDE.md` scaffold file.

## Done when — verified

- [x] `npm install` at the root installs and links both workspaces (89 packages added on
      top of the frontend's own install; 0 vulnerabilities).
- [x] `npm start` brings both services up: backend on 4000, frontend on 3000.
- [x] Health check is reachable **through the proxy** on port 3000
      (`GET http://localhost:3000/api/health` → `{"status":"ok","timestamp":"..."}`,
      routed by the Next.js rewrite to the Express backend). Direct access on 4000 also
      works, as expected in dev.
- [x] A missing required env key crashes the backend loudly with a named error: removing
      `DATABASE_URL` from `backend/.env` and starting the backend throws
      `EnvValidationError: Invalid environment configuration: - DATABASE_URL: ...` instead
      of booting.
- [x] `node scripts/guard-no-migrations.mjs` exits 0 — no migration tooling anywhere in
      `backend/` or `frontend/`.
- [x] One commit for this phase.

## Notes for the next phase

Phase 1 needs a real local PostgreSQL instance. PostgreSQL 17 was installed on this
machine via `winget` (native install, not Docker — see the note added mid-plan) and is
running as a Windows service, accepting connections on 5432. Phase 1 still needs to
create the actual `tessera` role/database and apply `tessera-schema.sql` before Drizzle
can introspect it.
