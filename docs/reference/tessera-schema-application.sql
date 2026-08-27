-- ============================================================
-- Tessera — additive schema change: the `application` table
--
-- Run this ONCE, by hand, in the Neon SQL Editor. It is additive only:
-- it creates one new table and its indexes and touches nothing that
-- already exists. There is no DROP in this file, deliberately —
-- tessera-schema.sql opens with `drop table if exists ... cascade`, so
-- re-running THAT file would destroy the live data. This one is safe to
-- run against the populated database.
--
-- C2: schema changes are applied by hand, never generated or migrated.
-- Group B1 of the applications brief.
-- ============================================================

create table application (
  id              uuid primary key default gen_random_uuid(),
  first_name      text not null,
  last_name       text not null,
  birth_date      date not null,
  email           text not null,
  phone           text,
  school_choice   text not null,
  stream_choice   text not null,
  motivation      text,
  transcript_key  text,
  status          text not null default 'pending',
  decided_at      timestamptz,
  decided_by      uuid references "user"(id),
  created_at      timestamptz not null default now()
);

create index application_status_created_idx
  on application (status, created_at desc);

create unique index application_pending_email_idx
  on application (lower(email)) where status = 'pending';

-- ------------------------------------------------------------
-- Two additions, both optional — delete either line and the
-- application code still works. Reasons in docs/decisions.md.
-- ------------------------------------------------------------

-- 1. Every other status column in this schema is a constrained enum type
--    (credential_status, import_status, mark_state...). You specified plain
--    text, so this keeps the text column but restores the guarantee the
--    enum convention was giving: no typo can ever reach the column.
alter table application
  add constraint application_status_check
  check (status in ('pending','approved','rejected'));

-- 2. The rate limit in B4 is "3 per hour per email", which queries
--    lower(email) over a time window. The unique index above only covers
--    rows where status = 'pending', so it cannot serve that query.
create index application_email_created_idx
  on application (lower(email), created_at desc);
