-- ============================================================
-- Tessera — seed data (PRD §10.6, §10.7)
-- Safe to re-run. Wipes everything and refills.
-- 1 school · 8 classes · 200 students, every name distinct
-- 20 teachers · 10 subjects · ~1100 assessments · ~25 000 marks
-- ============================================================

truncate table
  audit_log, support_ticket, notification_pref, device_session,
  scan_event, qr_credential, credential_request,
  export_log, import_row, import_batch,
  mark, assessment, teaching_assignment, enrollment,
  teacher, student, "user",
  subject, class, term, academic_year, institution
restart identity cascade;

do $seed$
declare
  v_inst      uuid;
  v_year      uuid;
  v_t1        uuid;
  v_t2        uuid;
  v_hash      text;
  v_demo_hash text;
  v_uid       uuid;
  v_sid       uuid;
  v_tid       uuid;
  v_cid       uuid;
  v_aid       uuid;
  v_admin     uuid;
  i           int;
  j           int;
  k           int;
  n           int;
  v_day       date;
  v_kind      assessment_kind;

  v_female text[] := array[
    'Անի','Մարիամ','Նարե','Լիլիթ','Սոնա','Աստղիկ','Մանե','Արևիկ','Նանե','Գայանե',
    'Հասմիկ','Սիրանուշ','Անահիտ','Էլեն','Միլենա','Ծովինար','Շուշան','Արաքսյա','Լուսինե','Տաթևիկ',
    'Ռուզաննա','Կարինե','Նվարդ','Սյուզաննա','Մերի','Զարուհի','Ալվարդ','Ամալյա','Վիկտորյա','Սառա',
    'Անգին','Հռիփսիմե','Մարինե','Նաիրա','Սվետլանա','Վարդուհի','Ազնիվ','Երանուհի','Լիանա','Քրիստինե'];

  v_male text[] := array[
    'Արամ','Դավիթ','Նարեկ','Տիգրան','Հայկ','Գոռ','Արտյոմ','Վահե','Սամվել','Գևորգ',
    'Արման','Ռուբեն','Վարդան','Գագիկ','Աշոտ','Սուրեն','Կարեն','Հովհաննես','Մհեր','Էդգար',
    'Վազգեն','Արսեն','Լևոն','Գրիգոր','Ալբերտ','Ռաֆայել','Խաչատուր','Անդրանիկ','Սարգիս','Արտակ',
    'Մարտին','Ստեփան','Վրեժ','Համլետ','Զոհրաբ','Բագրատ','Սմբատ','Ներսես','Թորգոմ','Աբրահամ'];

  v_last text[] := array[
    'Հակոբյան','Գրիգորյան','Սարգսյան','Պետրոսյան','Հարությունյան','Ղազարյան','Մկրտչյան','Խաչատրյան',
    'Մարտիրոսյան','Ավետիսյան','Մանուկյան','Սիմոնյան','Ասատրյան','Բաղդասարյան','Դանիելյան','Եղիազարյան',
    'Զաքարյան','Թադևոսյան','Իսրայելյան','Լալայան','Կարապետյան','Հովսեփյան','Ղուկասյան','Մուրադյան',
    'Ներսիսյան','Շահինյան','Ոսկանյան','Չոբանյան','Պողոսյան','Ջանոյան','Ռոստոմյան','Սահակյան',
    'Վարդանյան','Տերտերյան','Ցոլակյան','Ուլիխանյան','Ֆահրադյան','Աբրահամյան','Բադալյան','Գալստյան',
    'Դավթյան','Երիցյան','Զարգարյան','Թումանյան','Ժամկոչյան','Ինճիկյան','Լազարյան','Ծատուրյան',
    'Կիրակոսյան','Համբարձումյան'];

  v_patr text[] := array[
    'Արամի','Դավթի','Նարեկի','Տիգրանի','Հայկի','Գոռի','Վահեի','Սամվելի','Գևորգի','Արմանի',
    'Ռուբենի','Վարդանի','Գագիկի','Աշոտի','Սուրենի','Կարենի','Մհերի','Էդգարի','Լևոնի','Գրիգորի',
    'Սարգսի','Արտակի','Ստեփանի','Համլետի','Սմբատի'];

  v_subj text[][] := array[
    ['Մաթեմատիկա','Mathematics','Математика','MATH'],
    ['Հայոց լեզու և գրականություն','Armenian Language and Literature','Армянский язык и литература','ARM'],
    ['Ֆիզիկա','Physics','Физика','PHYS'],
    ['Քիմիա','Chemistry','Химия','CHEM'],
    ['Կենսաբանություն','Biology','Биология','BIO'],
    ['Հայոց պատմություն','Armenian History','История Армении','HIST'],
    ['Անգլերեն','English','Английский язык','ENG'],
    ['Ռուսերեն','Russian','Русский язык','RUS'],
    ['Աշխարհագրություն','Geography','География','GEO'],
    ['Ֆիզկուլտուրա','Physical Education','Физкультура','PE']];

  v_grades  smallint[] := array[12,11,11,10,10,10,9,9]::smallint[];
  v_letters text[]     := array['Ա','Ա','Բ','Ա','Բ','Գ','Ա','Բ'];

begin

  -- one bcrypt hash reused for the 200+ invented accounts (cost 12 only for demo four)
  v_hash      := crypt('Tessera2026!', gen_salt('bf', 8));
  v_demo_hash := crypt('Tessera2026!', gen_salt('bf', 12));

  ---------------------------------------------------------
  -- institution, year, terms
  ---------------------------------------------------------
  insert into institution (name, region, type)
  values ('«Տեսերա» ցուցադրական դպրոց', 'Երևան', 'ավագ դպրոց')
  returning id into v_inst;

  insert into academic_year (institution_id, label, starts_on, ends_on)
  values (v_inst, '2026–2027', date '2026-09-01', date '2027-06-10')
  returning id into v_year;

  insert into term (academic_year_id, index, label, starts_on, ends_on)
  values (v_year, 1, 'Առաջին կիսամյակ', date '2026-09-01', date '2026-12-25')
  returning id into v_t1;

  insert into term (academic_year_id, index, label, starts_on, ends_on)
  values (v_year, 2, 'Երկրորդ կիսամյակ', date '2027-01-12', date '2027-06-10')
  returning id into v_t2;

  ---------------------------------------------------------
  -- subjects and classes
  ---------------------------------------------------------
  create temp table s_subject (idx int, id uuid) on commit drop;
  for i in 1..array_length(v_subj, 1) loop
    insert into subject (institution_id, name_hy, name_en, name_ru, code)
    values (v_inst, v_subj[i][1], v_subj[i][2], v_subj[i][3], v_subj[i][4])
    returning id into v_sid;
    insert into s_subject values (i, v_sid);
  end loop;

  create temp table s_class (idx int, id uuid, grade smallint, letter text) on commit drop;
  for i in 1..array_length(v_grades, 1) loop
    insert into class (institution_id, academic_year_id, grade, letter)
    values (v_inst, v_year, v_grades[i], v_letters[i])
    returning id into v_cid;
    insert into s_class values (i, v_cid, v_grades[i], v_letters[i]);
  end loop;

  ---------------------------------------------------------
  -- a pool of guaranteed-distinct names
  ---------------------------------------------------------
  create temp table s_names on commit drop as
  select fn, ln, sex, row_number() over (order by random()) as rn
  from (
    select unnest(v_female) as fn, 'f' as sex
    union all
    select unnest(v_male), 'm'
  ) f
  cross join (select unnest(v_last) as ln) l;
  -- 80 first names x 50 surnames = 4000 combinations, shuffled.
  -- The first 220 are taken, so no two people share a full name.

  ---------------------------------------------------------
  -- 20 teachers, two per subject
  ---------------------------------------------------------
  create temp table s_teacher (idx int, id uuid, subject_idx int) on commit drop;
  for i in 1..20 loop
    insert into "user" (email, password_hash, role, must_change_password)
    values ('t' || lpad(i::text, 2, '0') || '@tessera-demo.am', v_hash, 'teacher', false)
    returning id into v_uid;

    insert into teacher (user_id, institution_id, first_name, last_name, patronymic)
    select v_uid, v_inst, n.fn, n.ln, v_patr[1 + floor(random() * array_length(v_patr,1))::int]
    from s_names n where n.rn = i
    returning id into v_tid;

    insert into s_teacher values (i, v_tid, ((i - 1) / 2) + 1);
  end loop;

  ---------------------------------------------------------
  -- teaching assignments: each teacher gets 4 classes of one subject
  ---------------------------------------------------------
  insert into teaching_assignment (teacher_id, class_id, subject_id, academic_year_id)
  select t.id, c.id, s.id, v_year
  from s_teacher t
  join s_subject s on s.idx = t.subject_idx
  join s_class   c on ((t.idx % 2 = 1 and c.idx between 1 and 4)
                    or (t.idx % 2 = 0 and c.idx between 5 and 8));

  ---------------------------------------------------------
  -- 200 students, 25 per class, every name different
  ---------------------------------------------------------
  create temp table s_ability (student_id uuid, ability numeric, sparse boolean default false) on commit drop;

  n := 20;  -- name pool cursor, teachers used 1..20
  for i in 1..8 loop
    select id into v_cid from s_class where idx = i;
    for j in 1..25 loop
      n := n + 1;

      insert into "user" (email, password_hash, role, must_change_password)
      values ('s' || lpad(n::text, 3, '0') || '@tessera-demo.am', v_hash, 'student', false)
      returning id into v_uid;

      insert into student (user_id, institution_id, first_name, last_name, patronymic, birth_date)
      select v_uid, v_inst, nm.fn, nm.ln,
             v_patr[1 + floor(random() * array_length(v_patr,1))::int],
             date '2009-01-01'
               + ((18 - (select grade from s_class where idx = i)) * 365)
               + floor(random() * 330)::int
      from s_names nm where nm.rn = n
      returning id into v_sid;

      insert into enrollment (student_id, class_id, academic_year_id, status)
      values (v_sid, v_cid, v_year, 'active');

      -- hidden ability: bell-shaped around 7, never uniform
      insert into s_ability (student_id, ability)
      values (v_sid, 6.9 + (random() + random() + random() - 1.5) * 1.7);

      insert into qr_credential (student_id, seed)
      values (v_sid, md5(v_sid::text));
    end loop;
  end loop;

  -- one student with almost no marks, so empty states are reachable
  update s_ability set sparse = true
  where student_id = (select student_id from s_ability order by random() limit 1);

  ---------------------------------------------------------
  -- assessments: 14 per class-subject, spread across both terms
  ---------------------------------------------------------
  for i in 1..14 loop
    if i <= 7 then
      v_day := date '2026-09-14' + ((i - 1) * 14);
    else
      v_day := date '2027-01-19' + ((i - 8) * 16);
    end if;

    if i in (7, 14) then      v_kind := 'exam';
    elsif i in (4, 11) then   v_kind := 'test';
    elsif i = 9 then          v_kind := 'project';
    else                      v_kind := 'lesson';
    end if;

    insert into assessment (class_id, subject_id, term_id, held_on, kind, title, created_by_teacher_id)
    select ta.class_id, ta.subject_id,
           case when i <= 7 then v_t1 else v_t2 end,
           v_day + (floor(random() * 4))::int,
           v_kind,
           case v_kind
             when 'exam'    then 'Կիսամյակային ամփոփիչ'
             when 'test'    then 'Ստուգողական աշխատանք'
             when 'project' then 'Նախագիծ'
             else 'Դասարանական ' || i::text
           end,
           ta.teacher_id
    from teaching_assignment ta;
  end loop;

  ---------------------------------------------------------
  -- marks: ability + per-subject affinity + noise. Never random.
  ---------------------------------------------------------
  insert into mark (assessment_id, student_id, value, state,
                    entered_by_teacher_id, entered_at, published_at)
  select a.id,
         e.student_id,
         greatest(1, least(10, round(
             ab.ability
           + ((abs(hashtext(e.student_id::text || a.subject_id::text)) % 7) - 3) * 0.55
           + (random() * 2.2 - 1.1)
           + case when c.grade = 9 and c.letter = 'Բ' then -1.5 else 0 end
         )))::smallint,
         'published',
         a.created_by_teacher_id,
         (a.held_on + time '18:00') at time zone 'Asia/Yerevan',
         (a.held_on + time '18:05') at time zone 'Asia/Yerevan'
  from assessment a
  join class c       on c.id = a.class_id
  join enrollment e  on e.class_id = a.class_id and e.status = 'active'
  join s_ability ab  on ab.student_id = e.student_id
  where random() > 0.08                              -- real gradebooks have gaps
    and ab.sparse = false;                           -- the new student is filled in below

  -- the newly-arrived student: five marks only, so every empty state is reachable
  insert into mark (assessment_id, student_id, value, state,
                    entered_by_teacher_id, entered_at, published_at)
  select a.id, ab.student_id,
         greatest(1, least(10, round(ab.ability + (random() * 2 - 1))))::smallint,
         'published', a.created_by_teacher_id,
         (a.held_on + time '18:00') at time zone 'Asia/Yerevan',
         (a.held_on + time '18:05') at time zone 'Asia/Yerevan'
  from s_ability ab
  join enrollment e  on e.student_id = ab.student_id
  join assessment a  on a.class_id = e.class_id
  where ab.sparse
  order by random()
  limit 5;

  ---------------------------------------------------------
  -- 40 corrected marks with reasons — the audit trail has content
  ---------------------------------------------------------
  create temp table s_super on commit drop as
    select id, assessment_id, student_id, value, entered_by_teacher_id, entered_at
    from mark where state = 'published' order by random() limit 40;

  update mark set state = 'superseded', updated_at = now()
  where id in (select id from s_super);

  insert into mark (assessment_id, student_id, value, state, supersedes_mark_id, reason,
                    entered_by_teacher_id, entered_at, published_at)
  select m.assessment_id, m.student_id,
         greatest(1, least(10, m.value + (1 + floor(random() * 2))::int))::smallint,
         'published', m.id,
         (array['Սխալ սյունակում մուտքագրված գնահատական',
                'Մուտքագրման վրիպակ՝ ուսուցչի կողմից ուղղված',
                'Աշակերտը վերահանձնել է աշխատանքը',
                'Գնահատականը վերանայվել է բողոքարկումից հետո',
                'Բացակայությունը հարգելի է ճանաչվել'])[1 + floor(random() * 5)::int],
         m.entered_by_teacher_id,
         m.entered_at + interval '2 days',
         m.entered_at + interval '2 days'
  from s_super m;

  ---------------------------------------------------------
  -- 12 uncommitted drafts for one teacher
  ---------------------------------------------------------
  select ta.teacher_id, ta.class_id, ta.subject_id
    into v_tid, v_cid, v_sid
  from teaching_assignment ta order by random() limit 1;

  insert into assessment (class_id, subject_id, term_id, held_on, kind, title, created_by_teacher_id)
  values (v_cid, v_sid, v_t2, date '2027-05-18', 'test', 'Ստուգողական — դեռ չհրապարակված', v_tid)
  returning id into v_aid;

  insert into mark (assessment_id, student_id, value, state, entered_by_teacher_id, entered_at)
  select v_aid, e.student_id,
         greatest(1, least(10, round(ab.ability + (random() * 2 - 1))))::smallint,
         'draft', v_tid, now()
  from enrollment e
  join s_ability ab on ab.student_id = e.student_id
  where e.class_id = v_cid limit 12;

  ---------------------------------------------------------
  -- administrator, then the eight credential requests
  ---------------------------------------------------------
  insert into "user" (email, password_hash, role, must_change_password, is_demo)
  values ('direktor@demo.tessera.am', v_demo_hash, 'admin', false, true)
  returning id into v_admin;

  insert into credential_request (student_id, subject_id, category, title, description, status,
                                  decided_by_user_id, decided_at, decision_reason)
  select s.student_id, s.subject_id, s.category, s.title, s.description, s.status,
         case when s.status = 'pending' then null else v_admin end,
         case when s.status = 'pending' then null else now() - interval '3 days' end,
         s.decision_reason
  from (
    select (select student_id from s_ability order by random() limit 1) as student_id,
           (select id from s_subject order by random() limit 1) as subject_id,
           c.category, c.title, c.description, c.status::credential_status, c.decision_reason
    from (values
      ('olympiad','Մաթեմատիկայի հանրապետական օլիմպիադա, II փուլ','Մասնակցության վկայական','approved','Վկայականը ստուգված է'),
      ('olympiad','Ֆիզիկայի մարզային օլիմպիադա, I տեղ','Դիպլոմ կցված է','approved','Հաստատված'),
      ('course','Ծրագրավորման դասընթաց, 72 ժամ','TUMO-ի ավարտական վկայական','pending',null),
      ('course','Անգլերենի B2 մակարդակի հավաստագիր','Միջազգային քննություն','pending',null),
      ('sport','Լողի մարզային մրցաշար, III տեղ','Մեդալի լուսանկար','declined','Փաստաթուղթը ընթեռնելի չէ'),
      ('sport','Շախմատի դպրոցական առաջնություն','Մասնակցություն','approved','Հաստատված'),
      ('volunteering','Կամավորական աշխատանք գրադարանում','40 ժամ, տնօրինության երաշխավորագիր','pending',null),
      ('art','Նկարչության ցուցահանդես','Երկու աշխատանք ընդունվել է','declined','Կրկնակի հայտ')
    ) as c(category, title, description, status, decision_reason)
  ) s;

  ---------------------------------------------------------
  -- demo accounts (§10.7)
  ---------------------------------------------------------
  -- student: first student of 11-Բ
  update "user" set email = 'ani@demo.tessera.am', password_hash = v_demo_hash,
                    is_demo = true, must_change_password = false
  where id = (select st.user_id from student st
              join enrollment e on e.student_id = st.id
              join s_class c on c.id = e.class_id
              where c.grade = 11 and c.letter = 'Բ'
              order by st.created_at limit 1);

  -- teacher with four classes
  update "user" set email = 'sargsyan@demo.tessera.am', password_hash = v_demo_hash,
                    is_demo = true, must_change_password = false
  where id = (select t.user_id from teacher t where t.id = (select id from s_teacher where idx = 1));

  -- first-login account: the nearly-empty student, so empty states are demoable
  update "user" set email = 'nor@demo.tessera.am', password_hash = v_demo_hash,
                    is_demo = true, must_change_password = true
  where id = (select st.user_id from student st
              join s_ability ab on ab.student_id = st.id
              where ab.sparse limit 1);

  insert into notification_pref (user_id, kind, enabled)
  select u.id, k.kind, true
  from "user" u
  cross join (values ('new_mark'), ('mark_corrected'), ('credential_decided')) k(kind)
  where u.is_demo;

end
$seed$;

-- ============================================================
-- verification
-- ============================================================
select 'institution' t, count(*) from institution
union all select 'class',               count(*) from class
union all select 'subject',             count(*) from subject
union all select 'teacher',             count(*) from teacher
union all select 'student',             count(*) from student
union all select 'enrollment',          count(*) from enrollment
union all select 'teaching_assignment', count(*) from teaching_assignment
union all select 'assessment',          count(*) from assessment
union all select 'mark (published)',    count(*) from mark where state='published'
union all select 'mark (draft)',        count(*) from mark where state='draft'
union all select 'mark (superseded)',   count(*) from mark where state='superseded'
union all select 'credential_request',  count(*) from credential_request
union all select 'demo accounts',       count(*) from "user" where is_demo;
