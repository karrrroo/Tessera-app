# Phase 2 — Data audit and the fixture register

Source: `docs/reference/tessera-roadmap.md`, Phase 2. Corrected against the real seed
data per `docs/decisions.md` D-9/D-10.

## Delivers

Written proof of what's actually in the seeded database, and a stable list of
identifiers (`fixtures.json`) that every later phase's manual test refers to.

## What was built

- **`tessera-seed.sql` applied** to the local database (D-3) — 1 institution, 8 classes,
  10 subjects, 20 teachers, 200 students, 1121 assessments, 25,622 published / 12 draft /
  40 superseded marks, 8 credential requests, 4 demo accounts, 200 qr_credentials. Matches
  the PRD front matter's stated numbers exactly.
- **`scripts/data-audit.mjs`** — read-only, prints the full counts report (institutions
  through credential requests by status, with min/median/max where the roadmap asks for
  it), then checks all 9 fixtures and writes `fixtures.json` (committed) and, if anything's
  missing, `data-gaps.md` with a suggested fix and a non-zero exit.
- **`scripts/data-topup.mjs`** — prepared but **not run**. Idempotent, narrowly-scoped
  `UPDATE`s (not inserts — see D-9) for exactly the two gaps found. Only runs on explicit
  instruction, never wired into any other script.
- Four corrections made to `docs/reference/tessera-roadmap.md`'s Phase 2 fixture table,
  annotated in place (D-9): the demo-account hash format, the sparse-student threshold,
  the heavy-class-subject-term threshold, and clarifying that the missing fixtures are
  real gaps, not threshold mismatches.

## The two real gaps — reported, and deliberately deferred

`data-audit.mjs` found two fixtures the seed genuinely doesn't provide:

1. **No departed enrollment.** Every one of the 200 enrollments is `active`; nothing
   exercises Phase 5's "departed never deletes historical marks" behavior.
2. **No assessment has a topic.** `tessera-seed.sql` never sets that column — the same
   fact as the PRD's open question Q8, here as a concrete data gap.

Asked directly, the decision was **to defer both** rather than run `data:topup`. This is
recorded in `docs/decisions.md` D-10. Consequence: `npm run data:audit` exits 1 and will
keep doing so — that's correct, expected behavior, not a broken build. `fixtures.json`
has no `departedStudent` or `taggedAssessment` key. **Phase 5 and Phase 7 need to check
`data-gaps.md` before assuming either fixture is available**, and re-run `data:audit`
first if this is ever revisited.

## Done when — verified

- [x] `npm run data:audit` prints the full report. It exits **1**, not 0 — expected,
      given the two deferred gaps above; every other fixture passed.
- [x] `fixtures.json` exists; every UUID in it resolves, spot-checked by hand:
      the sparse student (`0c813970-…`) is a real student row (Արամ Գրիգորյան); the
      draft-owner teacher has exactly 12 draft marks; the first superseded-mark id has a
      non-null reason (`Սխալ սյունակում մուտքագրված գնահատական`).
- [x] The audit is provably read-only: ran twice, `count(*)` on `mark` (25,674),
      `"user"` (221), and `student` (200) identical both times.
- [x] `data-gaps.md` exists, names both gaps precisely, and includes the SQL that would
      fix each — and the phase waited for an explicit author decision before doing
      anything with it, per the roadmap's own instruction. Decision: defer both.
- [x] `node scripts/guard-no-migrations.mjs` still exits 0.
- [x] One commit for this phase.

## Notes for the next phase

Phase 3 (authentication) needs `fixtures.json`'s `demo` block — all four accounts are
present with valid (bcrypt) password hashes, so nothing here blocks it.
