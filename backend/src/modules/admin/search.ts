import { eq, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { db } from "../../db/client.js";
import { student, teacher, user } from "../../db/schema.js";
import { nameForms, toLatinSql } from "../../lib/name-search.js";

// Admin people-search: one query field, every matching person, ranked.
//
// Kept in its own module rather than in repo.ts because the query shape is
// unlike anything else there — dynamic term count, a computed rank, and a
// paged total — and burying it among the CRUD helpers would hide exactly the
// parts that need review.
//
// Three properties this deliberately guarantees:
//
//  1. ONE ROW PER PERSON. The class label is a correlated subquery and class
//     matching is an EXISTS, never a join. Joining `enrollment` would multiply
//     a student into one row per enrolment, which is how a search silently
//     starts reporting a wrong total and showing duplicates.
//  2. A SHORT QUERY MATCHES NOTHING. `searchStudents`/`searchTeachers` return
//     an empty page for anything under MIN_QUERY characters. There is no code
//     path where an absent or short `q` falls through to an unfiltered
//     select, which is the failure mode that turns a picker into a roster dump.
//  3. AND ACROSS TERMS, OR ACROSS FIELDS. "Անի 9-Բ" narrows to students called
//     Անի in 9-Բ; it does not widen to everyone called Անի plus everyone in
//     9-Բ. Each whitespace-separated term must match at least one field.
//
// Case-insensitivity across Armenian is ILIKE's own, verified against this
// database (PostgreSQL 18, C.UTF-8): 'ՀԱԿՈԲՅԱՆ' ILIKE '%հակոբ%' is true, and
// so is the reverse. No lower()/unaccent shim is needed.

export const MIN_QUERY = 2;
export const LIMIT_DEFAULT = 20;
export const LIMIT_MAX = 50;

/** Escapes the LIKE metacharacters so a literal % or _ typed into the box stays literal. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function splitTerms(q: string): string[] {
  return q.trim().split(/\s+/).filter(Boolean);
}

export function clampLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return LIMIT_DEFAULT;
  return Math.min(Math.floor(n), LIMIT_MAX);
}

export function clampOffset(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

export type StudentHit = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  externalId: string | null;
  className: string | null;
};

export type TeacherHit = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  externalId: string | null;
};

export type SearchPage<T> = { items: T[]; total: number };

const EMPTY = { items: [], total: 0 };

// Rank tiers, applied before alphabetical order:
//   0 — the whole query is exactly this person's surname, or their login
//   1 — the query is a prefix of their surname or given name ("Հակ" first)
//   2 — it matched somewhere else, as a substring
function rankExpr(lastName: SQLWrapper, firstName: SQLWrapper, emailCol: SQLWrapper, q: string): SQL<number> {
  const exact = q.trim().toLowerCase();
  const prefix = `${escapeLike(q.trim())}%`;
  // The tiers have to see the same scripts the match did, or a Latin surname
  // query would land at tier 2 and sort below unrelated substring hits.
  const lastLatin = toLatinSql(lastName);
  const firstLatin = toLatinSql(firstName);
  return sql<number>`case
    when lower(${lastName}) = ${exact}
      or lower(${lastLatin}) = ${exact}
      or lower(${emailCol}::text) = ${exact} then 0
    when ${lastName} ilike ${prefix} or ${firstName} ilike ${prefix}
      or ${lastLatin} ilike ${prefix} or ${firstLatin} ilike ${prefix} then 1
    else 2
  end`;
}

// Matches one query term against a person's name in EVERY script it can be
// read in: the Armenian as stored, plus the Latin and Russian renderings the
// UI actually puts on screen (lib/name-search.ts). Both orders of the joined
// full name are included, so "Անի Հակոբյան" and "Հակոբյան Անի" both work and
// so do "Ani Hakobyan" and "Hakobyan Ani".
//
// Before this existed the search compared the typed text only against the
// stored Armenian, so a name the admin could read on screen was unfindable
// unless it happened to be stored in Latin. Measured on the live database:
// Latin "Abrahamyan" returned 0 of 202 students, and Latin "an" returned 2.
function matchesAnyName(firstCol: SQLWrapper, lastCol: SQLWrapper, pattern: string): SQL {
  const first = nameForms(firstCol);
  const last = nameForms(lastCol);
  const parts: SQL[] = [];
  for (const f of first) parts.push(sql`${f} ilike ${pattern}`);
  for (const l of last) parts.push(sql`${l} ilike ${pattern}`);
  // Joined forms script by script — index i is the same script in both
  // lists, so a query is never matched against a Latin given name glued to
  // a Cyrillic surname.
  for (let i = 0; i < first.length; i++) {
    parts.push(sql`(${first[i]} || ' ' || ${last[i]}) ilike ${pattern}`);
    parts.push(sql`(${last[i]} || ' ' || ${first[i]}) ilike ${pattern}`);
  }
  return sql`(${sql.join(parts, sql` or `)})`;
}

export async function searchStudents(
  institutionId: string,
  opts: { q: string; limit: number; offset: number },
): Promise<SearchPage<StudentHit>> {
  const terms = splitTerms(opts.q);
  if (opts.q.trim().length < MIN_QUERY || terms.length === 0) return EMPTY;

  const classLabel = sql<string | null>`(
    select c.grade || '-' || c.letter
    from enrollment e join class c on c.id = e.class_id
    where e.student_id = ${student.id}
    order by e.created_at desc
    limit 1)`;

  const termCondition = (term: string): SQL => {
    const p = `%${escapeLike(term)}%`;
    return sql`(
      ${matchesAnyName(student.firstName, student.lastName, p)}
      or ${user.email}::text ilike ${p}
      or coalesce(${student.emisStudentId}, '') ilike ${p}
      or exists (
        select 1 from enrollment e2 join class c2 on c2.id = e2.class_id
        where e2.student_id = ${student.id} and (c2.grade || '-' || c2.letter) ilike ${p})
    )`;
  };

  const where = sql.join(
    [sql`${student.institutionId} = ${institutionId}`, ...terms.map(termCondition)],
    sql` and `,
  );
  const rank = rankExpr(student.lastName, student.firstName, user.email, opts.q);

  const [items, counted] = await Promise.all([
    db
      .select({
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: user.email,
        externalId: student.emisStudentId,
        className: classLabel,
      })
      .from(student)
      .innerJoin(user, eq(user.id, student.userId))
      .where(where)
      .orderBy(rank, student.lastName, student.firstName)
      .limit(opts.limit)
      .offset(opts.offset),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(student)
      .innerJoin(user, eq(user.id, student.userId))
      .where(where),
  ]);

  return { items, total: counted[0]?.n ?? 0 };
}

export async function searchTeachers(
  institutionId: string,
  opts: { q: string; limit: number; offset: number },
): Promise<SearchPage<TeacherHit>> {
  const terms = splitTerms(opts.q);
  if (opts.q.trim().length < MIN_QUERY || terms.length === 0) return EMPTY;

  // Subject matching is what makes this the query an admin actually runs
  // ("who teaches maths?"), and it is an EXISTS over teaching_assignment for
  // the same one-row-per-teacher reason as above. All three name columns are
  // searched so the admin can type the subject in whichever language the UI
  // is currently showing them.
  const termCondition = (term: string): SQL => {
    const p = `%${escapeLike(term)}%`;
    return sql`(
      ${matchesAnyName(teacher.firstName, teacher.lastName, p)}
      or ${user.email}::text ilike ${p}
      or coalesce(${teacher.emisTeacherId}, '') ilike ${p}
      or exists (
        select 1 from teaching_assignment ta join subject s on s.id = ta.subject_id
        where ta.teacher_id = ${teacher.id}
          and (s.name_hy ilike ${p} or s.name_en ilike ${p} or s.name_ru ilike ${p}))
    )`;
  };

  const where = sql.join(
    [sql`${teacher.institutionId} = ${institutionId}`, ...terms.map(termCondition)],
    sql` and `,
  );
  const rank = rankExpr(teacher.lastName, teacher.firstName, user.email, opts.q);

  const [items, counted] = await Promise.all([
    db
      .select({
        id: teacher.id,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        email: user.email,
        externalId: teacher.emisTeacherId,
      })
      .from(teacher)
      .innerJoin(user, eq(user.id, teacher.userId))
      .where(where)
      .orderBy(rank, teacher.lastName, teacher.firstName)
      .limit(opts.limit)
      .offset(opts.offset),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(teacher)
      .innerJoin(user, eq(user.id, teacher.userId))
      .where(where),
  ]);

  return { items, total: counted[0]?.n ?? 0 };
}
