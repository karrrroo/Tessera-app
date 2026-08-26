# Phase 6 — Student ID, static QR, offline

Source: `docs/reference/tessera-roadmap.md`, Phase 6. Real gaps, bugs, and decisions found
and resolved during this phase are recorded in `docs/decisions.md` D-28 through D-36.

## Delivers

The most-used feature in the product: a student opens their ID and shows it in under three
seconds, with no network — verified as a genuine hard-reload in airplane mode against a
production build, not just reasoned about.

## What was built

**Backend** (`backend/src/modules/identity/`): `crypto.ts` (hand-rolled base32, the
handle/mac HMAC derivation, the Tessera ID hex-slicing derivation — all pure functions,
grep-verified to contain no clock access anywhere in the module), `handle-map.ts` (the
in-memory `handle → {credentialId, studentId}` map, rebuilt at boot and every 5 minutes,
resolving the handle and nothing else — `revoked_at` is re-read from the row on every scan),
`repo.ts`, `service.ts`, `validation.ts`, `routes.ts`. `http/middleware/require-scanner-key.ts`
gates `POST /api/verify` by a shared `X-Scanner-Key` header, not a JWT — there is no
`scanner` role and none was added. Three new env vars (`QR_HANDLE_KEY`, `QR_SIGNING_SECRET`,
`SCANNER_API_KEY`), independent of each other and of the auth secrets.

Full endpoint surface from the roadmap's table: `GET /api/me/credential` (student and
teacher variants), `GET /api/me/today` (teacher), `POST /api/verify` (scanner-key), `GET
/api/verify/anomalies` (admin). The payload is exactly what the roadmap measured: 33
characters, two base32 groups of 16 separated by a dot, alphanumeric mode at EC level Q,
29×29 modules, byte-identical across calls and across a stubbed-forward clock, no
identifiers of any kind.

**Frontend** (`frontend/src/app/(app)/id/`, `frontend/src/components/id/`): `TesseraQR` —
a from-scratch SVG renderer (no off-the-shelf QR component would produce ID-6's shape
language), with its own per-corner neighbour test for merged rounded modules, dedicated
finder-pattern rendering (30% outer radius, fully rounded inner block), and a quiet zone
baked into the SVG's own viewBox (not incidental CSS padding, so it scales exactly with
module size at any render size). `IdCard`, `TeacherIdCard`, `TodayPanel`, `QrSheet` (drag-to-
dismiss via pointer events, no swipe library), `useCredential` (IndexedDB via `idb`,
cache-first then revalidate), `offline-credential-store.ts`. `frontend/public/sw.js` — a
minimal, hand-written service worker precaching the `/id` shell (D-35). `frontend/src/app/scan/`
— the door-side scanner (camera + native `BarcodeDetector`, no decode library shipped).
`frontend/src/app/(app)/admin/scan-anomalies/` — the dense two-location table, linked from
the admin dashboard.

## Real bugs found and fixed while building and testing this phase

**Teacher subject/class chips, roster "?" bug's sibling, didn't recur** — worth noting only
because this phase's own teacher-identity query (most-recent-academic-year scoped, same
shape as D-27's tie-break) was written carefully the first time specifically because that
bug's shape was already known from Phase 5.

**A tampered-payload scan was recorded as an anomaly against a genuinely valid prior scan**
— not a bug: verified this is correct. The admin anomaly query self-joins on
`qr_credential_id`, independent of each row's own `result`, so a stolen-or-corrupted code
presented right after a legitimate scan is exactly the pattern ID-9 wants surfaced,
regardless of which of the two scans "succeeded."

**The Scanner page didn't handle a non-`result` error body.** `SCAN_PAYLOAD_MALFORMED`
(400) doesn't come back shaped like `{result, student?, anomaly?}` — it's `{error:{code}}` —
so the first version rendered a blank fail screen instead of a message. Caught by feeding a
deliberately malformed payload through a real (Chromium fake-device) camera + mocked
`BarcodeDetector` end-to-end test, not by inspection. Fixed to show a plain "could not read
that code" message for any non-401 error response.

**A cross-cutting bug chain in Phase 3's auth boot sequence, found only by actually testing
ID-8 offline** — the largest finding of this phase, written up in full in D-34:
`refreshOnce()` conflated "the server said no" with "the network never answered," which
silently logged out any previously-authenticated device that hard-reloaded `/id` without a
connection; `AppShell`'s `if (!user) return null` then independently blocked the fix from
being visible at all. Both fixed. An unrelated, pre-existing build-only bug
(`/(auth)/forgot/sent` missing a Suspense boundary around `useSearchParams()`) was found in
the same pass and fixed, since it blocked testing against a production build entirely.

## Verified directly (not just by inspection)

- `POST /api/verify` against a real seeded student's real payload, twice, an hour apart in
  spirit (re-derived from the same seed): byte-identical.
- The rendered `TesseraQR` SVG, rasterized in-browser and decoded with an independent
  decoder (`jsQR`, no relation to the encoder or to `TesseraQR`'s own path-building code):
  decodes to exactly the payload the API returned. Module count (viewBox math): 29.
  Explicit `Alphanumeric` mode confirmed necessary — the same payload through
  `qrcode-generator`'s default (byte) mode produces 33×33, not 29×29.
- The QR SVG's own markup, byte-compared before and 4 seconds after render: unchanged. No
  `setInterval`/`Date.now`/`new Date`/`.now()` anywhere in `backend/src/modules/identity`
  (literal grep, zero hits, including in comments — a comment naming those tokens still
  trips the same grep).
- Revocation read fresh every scan, not cached: revoked a real credential directly in the
  database mid-test, confirmed `revoked` on the next scan, restored `revoked_at` to null,
  confirmed `valid` again on the scan after that.
- All five `/api/verify` results produced for real: `valid`, `revoked` (via direct
  revoke/restore), `not_enrolled` (via a temporary `enrollment.status` flip to `departed`
  and back), `signature_invalid` (mac tampered, handle intact — the credential still
  resolves and the scan is still logged), `unknown` (a mac-valid, handle-unregistered
  payload constructed with the real signing key — never persisted, per D-29).
- The anomaly window: two scans of the same credential 0–30s apart at different
  `scannerId`s → `anomaly.flagged: true` with the correct `previousScannerId`/`secondsAgo`;
  `GET /api/verify/anomalies` lists it with both locations and both timestamps side by side.
- Scanner auth: no `X-Scanner-Key` → `SCANNER_UNAUTHORISED`; a real user bearer token
  instead → `SCANNER_UNAUTHORISED`, not a 200; `grep -rn "requireRole('scanner')\|'scanner'"
  backend/src` → no hit, the role enum was never touched.
- **Airplane mode, for real, against a production build.** `next build` + `next start`,
  logged in as the demo student, `/id` loaded once online, then `context.setOffline(true)`
  and a genuine hard reload: the card, the QR button, the note, and "Աշխատում է առանց
  ինտերնետի" all rendered, nothing greyed out or disabled. Screenshotted. Confirmed this
  required all three of D-34's fixes together — reverting any one of them reproduced a
  blank offline screen.
- Teacher variant: role/subject/institution/class chips render; `/api/me/today` returns
  `[]` against real seed data (no assessment dated today), and the panel shows its empty
  state, never blank.
- Admin `GET /api/verify/anomalies`: `FORBIDDEN` for a student's token; renders as a real
  dense table (student, class, result, both locations, both times, Δt) against the
  anomalies produced during this phase's own testing.
- Scanner page, end to end, with a real (Chromium fake-device) camera and a mocked
  `BarcodeDetector`: a detected payload produces the exact expected `POST /api/verify`
  request (headers, scannerId, location), and all three screen states — `VALID` (green,
  real student name and class), `TAMPERED CODE` (red), and the malformed-payload message —
  render correctly.
- `npm run data:audit` after all of the above: `students by enrollment status: active=200`,
  `qr_credential count (200) matches student count (200)`, and the only two gaps reported
  are the pre-existing D-10 ones — nothing this phase's testing left behind.

**Not verified in this pass**: a physical phone's camera or a real hardware scanner reading
the rendered code off an actual screen (only an automated rasterize-and-decode loop and
visual screenshot inspection); the QR sheet's drag-to-dismiss gesture on a real touch
device (verified by code review — pointer events, not touch-specific — and by click-to-open
in the browser, not by an actual swipe); the "watch for two continuous minutes" Done-when
instruction was substituted with a 4-second unchanged-markup check plus a full read of every
file in the render path confirming no timer exists at all, rather than literally watching
for 120 seconds.

## Notes for the next phase

- `public/sw.js` is explicitly disposable — Phase 13 should replace it, not extend it, once
  it owns general offline support with real tooling that understands Next's App Router
  request patterns (this phase's version only works because it's scoped to exactly one
  route and cache-as-you-go, not a build-time precache list).
- The `"offline"` auth status (D-34) has no `user` profile by design. Any future screen
  that needs `user` while rendered under `AppShell`'s offline bare-content fallback will
  need its own graceful null-check, the same way `/id` already gets its identity from
  `useCredential()`'s IndexedDB cache rather than from `useAuth()`.
- A per-device scanner key (rather than one shared `SCANNER_API_KEY`) is a schema change
  (a device/key table) and therefore explicitly deferred past C2, per the roadmap's own
  risk register — not rediscovered as a gap later.
