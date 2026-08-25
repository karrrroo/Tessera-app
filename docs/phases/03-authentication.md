# Phase 3 — Authentication

Source: `docs/reference/tessera-roadmap.md`, Phase 3. Real gaps and bugs found and
resolved during this phase are recorded in `docs/decisions.md` D-11 through D-14.

## Delivers

Nobody reaches any screen without logging in; a first-login account cannot escape the
password change; a forgotten password is recoverable without contacting anyone; a
session can be killed from another device.

## What was built

**Backend** (`backend/src/modules/auth/`):

- `password.ts` — Argon2id (OWASP baseline params) for every password this app sets;
  accepts and verifies legacy bcrypt (the seed's format) with transparent upgrade-on-login;
  a fixed dummy-hash verify on "user not found" so real vs. fictional identifiers cost the
  same wall-clock time (AUTH-9).
- `tokens.ts` — 15-minute JWT access tokens (`sub`, `role`, `sid` — the last ties a token to
  the `device_session` it was issued with, needed since the refresh cookie is path-scoped
  and never visible outside `/api/auth/refresh`); opaque, SHA-256-hashed refresh tokens.
- `reset-token.ts` — stateless password-reset tokens with no storage at all (D-11): an
  HMAC over the user id, issue time, and the user's *current* `password_hash`. A password
  change invalidates every outstanding token for that user for free, since the hash they
  were keyed to no longer matches.
- `rotation-tracker.ts` — a small in-memory map recording which refresh-token hashes were
  rotated away, so replaying one of *those* (real reuse/theft) is distinguishable from
  presenting a token whose session was explicitly, legitimately revoked (D-12) — the two
  looked identical from the database alone and conflating them was a real bug caught while
  testing this phase by hand (see below).
- `rate-limit.ts` — in-memory login-attempt counter (6/15min → lockout, durable via
  `user.locked_until`) and the 60-second forgot-password resend cooldown.
- `repo.ts`, `service.ts`, `validation.ts`, `routes.ts` — the 9 endpoints from the roadmap
  table, plus two dev-only ones (`/api/auth/dev/last-reset-token`,
  `/api/auth/dev/demo-accounts`), both unmounted when `NODE_ENV === "production"`.
- `http/errors.ts`, `http/error-handler.ts`, `http/async-handler.ts` — the shared
  `{ error: { code, field?, details? } }` envelope (roadmap §3) and Postgres-error mapping,
  now wired into the whole app, not just auth.
- `http/middleware/require-auth.ts` — bearer verification, `TOKEN_EXPIRED` vs.
  `UNAUTHENTICATED` distinguished.
- `http/middleware/require-password-changed.ts` — AUTH-7 enforced at the API on every
  guarded route except `/api/me`, `/password/change`, and `/logout`, checked live against
  the database (not a JWT claim — a claim would go stale for up to 15 minutes after a
  successful change, since that endpoint deliberately returns `204` with no fresh token).

**Frontend** — a minimal, functional trilingual auth flow (Phase 4 owns the real visual
design system; these screens use plain Tailwind, not yet the token/glass/gradient layer):

- `i18n/dictionary.ts` + `locale-provider.tsx` — the `T` dictionary's `auth`/`set` slices
  only, hy/en/ru. hy strings are original; en/ru are a good-faith functional translation,
  not the design source's final copy (`tessera-data.js` wasn't available while building
  this phase) — Phase 4 should reconcile.
- `lib/api/{token-store,client}.ts` — access token in a module-scoped variable (never
  `localStorage`, C12); `apiFetch` dedupes concurrent silent refreshes behind one shared
  promise and retries once on `TOKEN_EXPIRED`.
- `state/auth-provider.tsx`, `state/auth-gate.tsx` — boots by attempting a silent refresh
  (this is why a splash screen is load-bearing, not decorative: the refresh cookie is
  invisible to Next middleware); gates `(app)/*` to `booting → splash`, `anon → /login`,
  `authed && mustChangePassword → /first-login`.
- `components/auth/` — `LanguagePill`, `PasswordField`, `PasswordChecklist`, `DemoRow`
  (wired to the real `/api/auth/dev/demo-accounts` endpoint, not a hardcoded list),
  `SessionList`.
- Routes: `(auth)/login`, `(auth)/forgot`, `(auth)/forgot/sent`, `(auth)/reset/[token]`,
  `(auth)/first-login`; `(app)/{overview,gradebook,id,settings}` as gating placeholders —
  `settings` includes the real `SessionList` (roadmap: "Active sessions... the Settings
  chrome arrives in Phase 12").

## Two real bugs found and fixed while testing this phase

Refresh-token rotation originally marked the old `device_session` row `revoked_at` and
treated *any* hash matching a revoked row as reuse — enough to detect actual replay of a
rotated-away token, but it couldn't tell that case apart from a session the user had just
explicitly signed out from Settings. Verified by hand: revoking one device from another
device's session list was, before the fix, silently logging out every *other* session for
that user too. Fixed with `rotation-tracker.ts` (D-12) — only a hash this service itself
rotated away triggers the full-family revocation and `AUTH_REFRESH_REUSED`; an explicitly
revoked session now returns a plain `AUTH_SESSION_REVOKED` with no effect on anything else.
Re-verified after the fix (see Done-when below).

The second (D-14) surfaced only once the frontend was driven in a real browser: a full
page navigation remounts `AuthProvider`, and its boot-time silent refresh called
`/api/auth/refresh` directly instead of through the shared dedup guard — so React Strict
Mode's double-invoked mount effect (standard in Next.js dev) sent that request twice with
the same cookie, and the second copy tripped the *first* bug's own fix: D-12's reuse
detection correctly saw a hash that had already been rotated away and nuked the whole
session, just triggered by the client racing itself rather than an attacker. Fixed by
having the boot effect call the existing `refreshOnce()` helper from `lib/api/client.ts`
instead of a raw `fetch`, so every refresh call in the app — boot-time or 401-triggered —
shares one in-flight promise.

## Done when — verified

Backend, verified directly against the running API (see `docs/decisions.md` D-13 — the
seed was re-applied afterward to undo the mutations this testing necessarily made):

- [x] Login with a real demo account returns a signed access token, the role-shaped user
      object (`classLabel` correctly joined for a student, `subjectIds` for a teacher), and
      sets `tsr_rt` as `HttpOnly; Secure; Path=/api/auth/refresh`.
- [x] Logging in as `fixtures.demo.firstLogin`, then calling `GET /api/auth/sessions`
      directly with that access token, returns `AUTH_PASSWORD_CHANGE_REQUIRED` — enforced
      at the API, not just the UI.
- [x] Six wrong passwords lock the account; the 6th and 7th (and the *correct* password,
      while still locked) all return `AUTH_ACCOUNT_LOCKED` with a decreasing
      `retryAfterSeconds`.
- [x] Timing: 5 real-account-wrong-password attempts (~47–53ms) vs. 5
      nonexistent-identifier attempts (~56–71ms) — the fake path is not faster, so the
      dummy-hash verify is doing its job.
- [x] Reset end to end: request → dev-log link → reset (`204`) → reusing the same link
      fails (`AUTH_RESET_TOKEN_INVALID`, falls out of the stateless design for free) → log
      in with the new password.
- [x] Refresh rotation: a rotated-away token replayed afterward returns
      `AUTH_REFRESH_REUSED`, and the *current* legitimate token is also rejected afterward
      (the whole family was correctly revoked). Separately, explicitly revoking one device
      from another returns a clean `AUTH_SESSION_REVOKED` on that device's next refresh,
      with **no effect on the revoking device's own session** (the bug above, confirmed
      fixed).
- [x] Logout clears the refresh cookie (confirmed via cookie jar) and a subsequent refresh
      returns `AUTH_REFRESH_MISSING`.

Frontend, driven in a real headless browser (Playwright, ad hoc script, run against the
live `npm start` server — not yet a project `run` skill):

- [x] Logged-out visit to `/overview` client-side redirects to `/login` (a React effect
      after silent-refresh resolves to "anon", not Next middleware — the refresh cookie is
      invisible to it).
- [x] `/login` renders the demo row (student/teacher/admin/first-login buttons) and the
      ՀԱՅ/EN/РУС language pill; clicking each of the three actually changes visible text
      (title, subtitle, button labels), not just a state flag.
- [x] Clicking the "first login" demo button lands on `/first-login`; typing `/overview`
      directly in the address bar and pressing browser-back both bounce back to
      `/first-login`.
- [x] Fresh login as the student demo account reaches `/overview` with the signed-in
      student's name shown.
- [x] `/settings` renders the real session list with a "this device" row and a
      "sign out all other devices" button (verified against the persisted UI locale at
      that point in the flow, which was hy — the string checked for was
      `Դուրս գալ բոլոր մյուս սարքերից`, the dictionary's `t.set.sessAll` for hy).
- [x] "Log out" returns to `/login`.

A real bug was caught by this run and is fixed, not just noted — see D-14 in
`docs/decisions.md` and the section below: the escape-attempt check (typing `/overview`
directly) initially failed because a full page navigation remounts `AuthProvider`, and
React Strict Mode's double-invoked mount effect fired the boot-time silent refresh twice
against the same refresh cookie, tripping D-12's reuse detection against itself and
logging the session out entirely. Fixed by routing the boot refresh through the same
promise-deduped `refreshOnce()` already used for 401-triggered refreshes. All six checks
above are from the *post-fix* run. The only console output during any run was two expected
401s from the very first, logged-out silent-refresh attempt (`AUTH_REFRESH_MISSING`) — not
an error condition.

## Notes for the next phase

Phase 4 (design tokens, shell, theming) should: reconcile the `T.auth`/`T.set` copy above
against the real design source; replace the plain-Tailwind auth screens with the actual
token/glass/gradient system; and build the real app shell that the `(app)` placeholder
pages currently stand in for.
