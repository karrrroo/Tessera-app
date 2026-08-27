-- ============================================================
-- Tessera — additive schema change: the `iter_message` table
--
-- Run this ONCE, by hand, in the Neon SQL Editor. Additive only, no DROP.
-- Do NOT re-run tessera-schema.sql; it drops every table first.
--
-- WHY THIS FILE EXISTS: group A5 of the brief says "the iter_message table
-- already exists — no schema change." It does not exist. `\dt` returns 22
-- tables and this is not among them, because D-57 explicitly decided
-- against it: chat history was put in the browser's IndexedDB precisely so
-- that no server-side retention question about minors' data had to be
-- answered. A5 reverses that decision, which is the user's call to make —
-- but it is a schema change, and schema changes are run by hand (C2).
--
-- One row per exchange, not per turn: it maps 1:1 onto the endpoint's
-- existing `{ id, storedAt, reply }` response and onto A5's own wording
-- ("POST stores it, reply stays null").
-- ============================================================

create table iter_message (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references "user"(id) on delete cascade,
  session_id uuid not null,
  screen     text,
  locale     locale_code not null default 'hy',
  body       text not null,
  reply      text,
  created_at timestamptz not null default now()
);

-- The only query the API makes: this user's own messages, newest first,
-- keyset-paginated on created_at. `user_id` leads the index because every
-- read is scoped to one user by the token — never by a parameter.
create index iter_message_user_created_idx
  on iter_message (user_id, created_at desc);

-- Conventions this follows, for review:
--   * `on delete cascade` matches support_ticket / notification_pref /
--     device_session. It also matters here: erasing a user erases their
--     messages, which is the minimum a retention policy will need.
--   * `locale` uses the existing `locale_code` enum rather than text, so
--     schema:check's enum list is unchanged.
--   * the column is `body`, not `text` — `text` is a type name in
--     Postgres, and `support_ticket` already uses `body` for the same
--     thing.
