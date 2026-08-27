"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { adminApi, type CreatedTeacher, type SchoolClass, type Subject } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";
import { useCurrentAcademicYear } from "@/components/admin/use-current-academic-year";
import { useAsyncData } from "@/lib/use-async-data";
import { useLocale, useT, interpolate } from "@/i18n/locale-provider";

const FIELD_CLASS = "w-full rounded-2xl border px-3 py-2 text-sm";
const FIELD_STYLE = { borderColor: "var(--hair)", background: "var(--surface2)", color: "var(--ink)" } as const;

type Draft = { lastName: string; firstName: string; patronymic: string; email: string };
const EMPTY: Draft = { lastName: "", firstName: "", patronymic: "", email: "" };

// Creating one teacher account, with what they teach.
//
// NO EMIS ID, deliberately: Tessera replaces that system, so asking an admin to
// type an identifier from the thing being replaced is backwards. The column
// stays nullable in the schema for imported records; nothing this UI creates
// populates it.
//
// What it asks instead is the pair that actually defines a teacher's work:
// the subjects they teach and the classes they teach them to. Those two lists
// are a cross product — three subjects across four classes is twelve teaching
// assignments — because that is exactly what `teaching_assignment` stores, one
// row per class + subject + year.
//
// Both are optional. A teacher hired before the timetable is settled is a
// valid record, and assignments can still be added on /admin/assignments.
//
// Classes are grouped by grade with a whole-grade toggle, because "which
// classes" is nearly always answered a grade at a time — all of grade 9, plus
// one class from grade 10 — and ticking eight boxes to say that is busywork.
//
// The temporary password contract is unchanged from the student form: generated
// server-side, shown exactly once, never stored, and the account starts with
// `must_change_password`.
export default function NewTeacherPage() {
  const t = useT();
  const { locale } = useLocale();
  const year = useCurrentAcademicYear();

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [created, setCreated] = useState<CreatedTeacher | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<"errCreate" | "errEmailTaken" | null>(null);

  const { data: subjects } = useAsyncData<Subject[]>(() => adminApi.listSubjects(), []);
  const { data: classes } = useAsyncData<SchoolClass[]>(
    () => (year ? adminApi.listClasses(year.id) : Promise.resolve([])),
    [year?.id],
  );

  const subjectName = (s: Subject) => (locale === "hy" ? s.nameHy : locale === "ru" ? s.nameRu : s.nameEn);

  // Classes grouped by grade, each grade's own classes sorted by letter, so the
  // whole-grade toggle has something coherent to act on.
  const byGrade = useMemo(() => {
    const groups = new Map<number, SchoolClass[]>();
    for (const c of classes ?? []) {
      const list = groups.get(c.grade) ?? [];
      list.push(c);
      groups.set(c.grade, list);
    }
    return [...groups.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([grade, list]) => [grade, list.slice().sort((a, b) => a.letter.localeCompare(b.letter))] as const);
  }, [classes]);

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) =>
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleSubject = toggle(setSubjectIds);
  const toggleClass = toggle(setClassIds);

  function toggleGrade(list: readonly SchoolClass[]) {
    const ids = list.map((c) => c.id);
    const allOn = ids.every((id) => classIds.includes(id));
    setClassIds((prev) => (allOn ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]));
  }

  const nameComplete = Boolean(draft.lastName.trim() && draft.firstName.trim() && draft.email.trim());
  // Subjects without classes (or the reverse) describes no assignment at all,
  // and the API rejects it — so the form does too, rather than letting someone
  // submit and be told no.
  const pairConsistent = subjectIds.length > 0 === classIds.length > 0;
  const complete = nameComplete && pairConsistent;
  const willCreate = subjectIds.length * classIds.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!complete || busy) return;
    setBusy(true);
    setErrorKey(null);
    try {
      const row = await adminApi.createTeacher({
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        patronymic: draft.patronymic.trim() || undefined,
        email: draft.email.trim(),
        subjectIds: subjectIds.length ? subjectIds : undefined,
        classIds: classIds.length ? classIds : undefined,
        academicYearId: willCreate > 0 ? year?.id : undefined,
      });
      setCreated(row);
      setDraft(EMPTY);
      setSubjectIds([]);
      setClassIds([]);
    } catch (err) {
      // A taken email is the one failure an admin can act on, so it gets its
      // own sentence rather than the generic one.
      setErrorKey(err instanceof ApiRequestError && err.code === "USER_EMAIL_TAKEN" ? "errEmailTaken" : "errCreate");
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  const chip = (on: boolean) =>
    ({
      background: on ? "var(--accent)" : "transparent",
      color: on ? "var(--accent-fg)" : "var(--ink-2)",
      border: on ? "none" : "1px solid var(--hair)",
    }) as const;

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 p-8">
      <Link href="/admin" className="text-sm underline" style={{ color: "var(--ink-3)" }}>
        {t.admin.stu.back}
      </Link>

      <header>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
          {t.admin.teach.newTitle}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
          {t.admin.teach.newSub}
        </p>
      </header>

      {created ? (
        <section className="space-y-4 rounded-2xl border p-4" style={{ borderColor: "var(--ok)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
            {t.admin.teach.created}
          </p>
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt style={{ color: "var(--ink-3)" }}>{t.admin.stu.email}</dt>
              <dd className="truncate font-mono text-xs" style={{ color: "var(--ink)" }}>
                {created.login}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt style={{ color: "var(--ink-3)" }}>{t.admin.stu.password}</dt>
              <dd className="select-all font-mono text-sm" style={{ color: "var(--ink)" }}>
                {created.temporaryPassword}
              </dd>
            </div>
          </dl>
          <p className="text-xs" style={{ color: "var(--warning)" }}>
            {t.admin.stu.once}
          </p>

          {created.assignments.created > 0 && (
            <p className="text-xs" style={{ color: "var(--ink-2)" }}>
              {interpolate(t.admin.teach.assignmentsCreated, { count: created.assignments.created })}
            </p>
          )}
          {/* Not an error: teaching_assignment is unique on (class, subject,
              year), so a pair whose class already has a teacher for that
              subject is reported rather than failing the account. */}
          {created.assignments.skipped.length > 0 && (
            <p className="text-xs" style={{ color: "var(--warning)" }}>
              {interpolate(t.admin.teach.assignmentsSkipped, { count: created.assignments.skipped.length })}
            </p>
          )}
          {created.assignments.created === 0 && created.assignments.skipped.length === 0 && (
            <p className="text-xs" style={{ color: "var(--ink-3)" }}>
              {t.admin.teach.noAssignmentsYet}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCreated(null)}
              className="rounded-full px-4 py-2 text-sm"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
            >
              {t.admin.stu.another}
            </button>
            <Link
              href="/admin/assignments"
              className="rounded-full border px-4 py-2 text-sm"
              style={{ borderColor: "var(--hair)", color: "var(--ink-2)" }}
            >
              {t.admin.teach.toAssignments} →
            </Link>
          </div>
        </section>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-3">
            {(
              [
                ["lastName", t.admin.stu.lastName],
                ["firstName", t.admin.stu.firstName],
                ["patronymic", t.admin.stu.patronymic],
              ] as [keyof Draft, string][]
            ).map(([key, label]) => (
              <label key={key} className="block space-y-1">
                <span className="text-xs" style={{ color: "var(--ink-3)" }}>
                  {label}
                </span>
                <input value={draft[key]} onChange={set(key)} className={FIELD_CLASS} style={FIELD_STYLE} />
              </label>
            ))}

            <label className="block space-y-1">
              <span className="text-xs" style={{ color: "var(--ink-3)" }}>
                {t.admin.stu.email}
              </span>
              <input
                type="email"
                autoComplete="off"
                value={draft.email}
                onChange={set("email")}
                className={FIELD_CLASS}
                style={FIELD_STYLE}
              />
            </label>
          </div>

          {/* --- what they teach --- */}
          <fieldset className="space-y-2 rounded-2xl border p-3" style={{ borderColor: "var(--hair)" }}>
            <legend className="px-1 text-xs" style={{ color: "var(--ink-3)" }}>
              {t.admin.teach.subjects} · {t.admin.teach.subjectsHint}
            </legend>
            {subjects && subjects.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--ink-3)" }}>
                {t.admin.teach.noSubjectsYet}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(subjects ?? []).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={subjectIds.includes(s.id)}
                    onClick={() => toggleSubject(s.id)}
                    className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                    style={chip(subjectIds.includes(s.id))}
                  >
                    {subjectName(s)}
                  </button>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-2 rounded-2xl border p-3" style={{ borderColor: "var(--hair)" }}>
            <legend className="px-1 text-xs" style={{ color: "var(--ink-3)" }}>
              {t.admin.teach.classes} · {t.admin.teach.classesHint}
            </legend>
            {byGrade.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--ink-3)" }}>
                {t.admin.teach.noClassesYet}
              </p>
            ) : (
              <div className="space-y-2">
                {byGrade.map(([grade, list]) => {
                  const allOn = list.every((c) => classIds.includes(c.id));
                  return (
                    <div key={grade} className="flex flex-wrap items-center gap-1.5">
                      {/* The whole-grade toggle: "which classes" is nearly
                          always answered a grade at a time. */}
                      <button
                        type="button"
                        aria-pressed={allOn}
                        onClick={() => toggleGrade(list)}
                        className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
                        style={chip(allOn)}
                        title={interpolate(t.admin.teach.gradeAll, { grade })}
                      >
                        {grade}
                      </button>
                      {list.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          aria-pressed={classIds.includes(c.id)}
                          onClick={() => toggleClass(c.id)}
                          className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                          style={chip(classIds.includes(c.id))}
                        >
                          {c.grade}-{c.letter}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </fieldset>

          {/* How many assignments this will actually create, so the cross
              product is visible before submitting rather than a surprise. */}
          <p className="text-xs" style={{ color: willCreate > 0 ? "var(--ink-2)" : "var(--ink-3)" }}>
            {willCreate > 0
              ? interpolate(t.admin.teach.willCreate, { count: willCreate })
              : t.admin.teach.optionalBoth}
          </p>

          {errorKey && (
            <p className="text-sm" style={{ color: "var(--danger)" }} role="alert">
              {t.admin.teach[errorKey]}
            </p>
          )}

          <button
            type="submit"
            disabled={!complete || busy}
            className="w-full rounded-full px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            {t.admin.teach.newTitle}
          </button>
        </form>
      )}
    </main>
  );
}
