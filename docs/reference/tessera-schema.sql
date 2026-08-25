-- ============================================================
-- Tessera — database schema
-- Implements PRD §10 exactly. PostgreSQL 15+ / Neon.
-- Run once, in the Neon SQL Editor.
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------- enums ----------

drop type if exists user_role cascade;
drop type if exists locale_code cascade;
drop type if exists enrollment_status cascade;
drop type if exists assessment_kind cascade;
drop type if exists mark_state cascade;
drop type if exists import_kind cascade;
drop type if exists import_status cascade;
drop type if exists import_row_status cascade;
drop type if exists export_format cascade;
drop type if exists credential_status cascade;
drop type if exists support_kind cascade;

create type user_role         as enum ('student','teacher','admin');
create type locale_code       as enum ('hy','en','ru');
create type enrollment_status as enum ('active','transferred','departed','graduated');
create type assessment_kind   as enum ('lesson','test','exam','project');
create type mark_state        as enum ('draft','published','superseded');
create type import_kind       as enum ('students','teachers','assignments');
create type import_status     as enum ('previewing','applied','discarded');
create type import_row_status as enum ('ok','warning','error');
create type export_format     as enum ('xlsx','csv');
create type credential_status as enum ('pending','approved','declined');
create type support_kind      as enum ('contact','problem','feedback');

-- ---------- 10.1 institution and structure ----------

drop table if exists audit_log, support_ticket, notification_pref, device_session,
  scan_event, qr_credential, credential_request, export_log, import_row, import_batch,
  mark, assessment, teaching_assignment, enrollment, teacher, student, "user",
  subject, class, term, academic_year, institution cascade;

create table institution (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  emis_id     text,                       -- nullable, unused, retained per §6.6
  region      text not null,
  type        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

create table academic_year (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  label          text not null,
  starts_on      date not null,
  ends_on        date not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz,
  check (ends_on > starts_on)
);

create table term (
  id               uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_year(id) on delete cascade,
  index            smallint not null,
  label            text not null,
  starts_on        date not null,
  ends_on          date not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz,
  check (ends_on > starts_on),
  unique (academic_year_id, index)
);

create table class (
  id               uuid primary key default gen_random_uuid(),
  institution_id   uuid not null references institution(id) on delete cascade,
  academic_year_id uuid not null references academic_year(id) on delete cascade,
  grade            smallint not null check (grade between 1 and 12),
  letter           text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz,
  unique (academic_year_id, grade, letter)
);

create table subject (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  name_hy        text not null,
  name_en        text not null,
  name_ru        text not null,
  code           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);

-- ---------- 10.2 people ----------

create table "user" (
  id                   uuid primary key default gen_random_uuid(),
  email                citext not null unique,
  password_hash        text not null,
  role                 user_role not null,
  locale               locale_code not null default 'hy',
  must_change_password boolean not null default true,
  is_demo              boolean not null default false,
  last_login_at        timestamptz,
  locked_until         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz
);

create table student (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references "user"(id) on delete cascade,
  institution_id   uuid not null references institution(id) on delete cascade,
  emis_student_id  text,
  first_name       text not null,
  last_name        text not null,
  patronymic       text,
  birth_date       date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz
);

create table teacher (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references "user"(id) on delete cascade,
  institution_id   uuid not null references institution(id) on delete cascade,
  emis_teacher_id  text,
  first_name       text not null,
  last_name        text not null,
  patronymic       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz
);

create table enrollment (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references student(id) on delete cascade,
  class_id         uuid not null references class(id) on delete cascade,
  academic_year_id uuid not null references academic_year(id) on delete cascade,
  status           enrollment_status not null default 'active',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz,
  unique (student_id, academic_year_id)
);

-- a teacher with four classes has four rows here, never a column on teacher
create table teaching_assignment (
  id               uuid primary key default gen_random_uuid(),
  teacher_id       uuid not null references teacher(id) on delete cascade,
  class_id         uuid not null references class(id) on delete cascade,
  subject_id       uuid not null references subject(id) on delete cascade,
  academic_year_id uuid not null references academic_year(id) on delete cascade,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz,
  unique (class_id, subject_id, academic_year_id)
);

-- ---------- 10.3 marks ----------

create table assessment (
  id                    uuid primary key default gen_random_uuid(),
  class_id              uuid not null references class(id) on delete cascade,
  subject_id            uuid not null references subject(id) on delete cascade,
  term_id               uuid not null references term(id) on delete cascade,
  held_on               date not null,
  kind                  assessment_kind not null,
  title                 text,
  topic                 text,
  created_by_teacher_id uuid not null references teacher(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz
);

-- INVARIANT: mark.value is never UPDATEd. Corrections insert a new row.
create table mark (
  id                    uuid primary key default gen_random_uuid(),
  assessment_id         uuid not null references assessment(id) on delete cascade,
  student_id            uuid not null references student(id) on delete cascade,
  value                 smallint not null check (value between 1 and 10),
  state                 mark_state not null,
  supersedes_mark_id    uuid references mark(id),
  reason                text,
  entered_by_teacher_id uuid not null references teacher(id),
  entered_at            timestamptz not null,
  published_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz
);

-- the two constraints that must live in the database, not in application code
create unique index one_current_mark
  on mark (assessment_id, student_id)
  where state in ('draft','published');

alter table mark add constraint reason_required_when_superseding
  check (supersedes_mark_id is null or reason is not null);

-- ---------- 10.4 import, export, credentials, identity, operations ----------

create table import_batch (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  actor_user_id  uuid not null references "user"(id),
  kind           import_kind not null,
  filename       text not null,
  row_count      int not null default 0,
  error_count    int not null default 0,
  status         import_status not null default 'previewing',
  applied_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);

create table import_row (
  id                uuid primary key default gen_random_uuid(),
  import_batch_id   uuid not null references import_batch(id) on delete cascade,
  row_index         int not null,
  raw               jsonb not null,
  status            import_row_status not null,
  message           text,
  created_entity_id uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz
);

create table export_log (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institution(id) on delete cascade,
  actor_user_id  uuid not null references "user"(id),
  scope          jsonb not null,
  format         export_format not null,
  mark_count     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);

create table credential_request (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references student(id) on delete cascade,
  subject_id         uuid references subject(id),
  category           text not null,
  title              text not null,
  description        text,
  attachment_url     text,
  attachment_mime    text,
  status             credential_status not null default 'pending',
  decided_by_user_id uuid references "user"(id),
  decided_at         timestamptz,
  decision_reason    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz
);

create table qr_credential (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references student(id) on delete cascade,
  seed       text not null,
  issued_at  timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table scan_event (
  id               uuid primary key default gen_random_uuid(),
  qr_credential_id uuid not null references qr_credential(id) on delete cascade,
  scanner_id       text not null,
  scanned_at       timestamptz not null default now(),
  result           text not null,
  location         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz
);

create table device_session (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references "user"(id) on delete cascade,
  device_label       text not null,
  refresh_token_hash text not null,
  last_seen_at       timestamptz,
  revoked_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz
);

create table notification_pref (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references "user"(id) on delete cascade,
  kind       text not null,
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (user_id, kind)
);

create table support_ticket (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references "user"(id) on delete cascade,
  kind       support_kind not null,
  subject    text not null,
  body       text not null,
  rating     smallint check (rating between 1 and 5),
  context    jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid references "user"(id),
  action        text not null,
  entity_type   text not null,
  entity_id     uuid,
  before        jsonb,
  after         jsonb,
  ip            inet,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);

-- ---------- indexes for the read paths that matter ----------

create index idx_mark_student        on mark (student_id);
create index idx_mark_assessment     on mark (assessment_id);
create index idx_mark_state          on mark (state);
create index idx_assessment_class    on assessment (class_id, subject_id, term_id);
create index idx_assessment_held_on  on assessment (held_on);
create index idx_enrollment_class    on enrollment (class_id, status);
create index idx_ta_teacher          on teaching_assignment (teacher_id);
create index idx_student_institution on student (institution_id);
create index idx_credreq_status      on credential_request (status);
create index idx_qr_student          on qr_credential (student_id);
