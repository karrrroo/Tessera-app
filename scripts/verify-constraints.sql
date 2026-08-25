-- One-off verification that the two hand-audited invariants actually hold.
-- Everything here runs inside a transaction that is rolled back at the end;
-- nothing persists. Not part of the app — a Phase 1 sanity check only.
begin;

insert into institution (name, region, type) values ('Test School', 'Yerevan', 'high school');
insert into academic_year (institution_id, label, starts_on, ends_on)
  select id, '2026-2027', '2026-09-01', '2027-06-30' from institution where name = 'Test School';
insert into term (academic_year_id, index, label, starts_on, ends_on)
  select id, 1, 'Term 1', '2026-09-01', '2027-01-15' from academic_year where label = '2026-2027';
insert into class (institution_id, academic_year_id, grade, letter)
  select i.id, ay.id, 10, 'A' from institution i, academic_year ay where i.name = 'Test School';
insert into subject (institution_id, name_hy, name_en, name_ru) values
  ((select id from institution where name = 'Test School'), 'Մաթեմատիկա', 'Math', 'Математика');

insert into "user" (email, password_hash, role) values ('teacher.test@example.com', 'x', 'teacher');
insert into teacher (user_id, institution_id, first_name, last_name)
  select u.id, i.id, 'Test', 'Teacher' from "user" u, institution i where u.email = 'teacher.test@example.com';

insert into "user" (email, password_hash, role) values ('student.test@example.com', 'x', 'student');
insert into student (user_id, institution_id, first_name, last_name)
  select u.id, i.id, 'Test', 'Student' from "user" u, institution i where u.email = 'student.test@example.com';

insert into assessment (class_id, subject_id, term_id, held_on, kind, created_by_teacher_id)
  select c.id, sub.id, t.id, '2026-09-10', 'lesson', te.id
  from class c, subject sub, term t, teacher te limit 1;

-- establish one live mark to collide/reference against
insert into mark (assessment_id, student_id, value, state, entered_by_teacher_id, entered_at)
  select a.id, s.id, 8, 'published', te.id, now()
  from assessment a, student s, teacher te limit 1;

savepoint before_test_1;
\echo '--- test 1: expecting a unique-violation on one_current_mark ---'
insert into mark (assessment_id, student_id, value, state, entered_by_teacher_id, entered_at)
  select a.id, s.id, 6, 'draft', te.id, now()
  from assessment a, student s, teacher te limit 1;
rollback to savepoint before_test_1;

savepoint before_test_2;
\echo '--- test 2: expecting a check-violation on reason_required_when_superseding ---'
insert into mark (assessment_id, student_id, value, state, entered_by_teacher_id, entered_at, supersedes_mark_id)
  select a.id, s.id, 6, 'superseded', te.id, now(), m.id
  from assessment a, student s, teacher te, mark m limit 1;
rollback to savepoint before_test_2;

\echo '--- both constraints held; discarding all test data ---'
rollback;
