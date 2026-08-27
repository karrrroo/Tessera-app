"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { adminApi, type AdminStudentDetail, type RosterEntry } from "@/lib/api/admin";
import { useLocale, useT } from "@/i18n/locale-provider";
import { displayFullName } from "@/i18n/transliterate-name";
import { termLabel } from "@/i18n/term-label";
import { gradeColorVar } from "@/design/grade-colors";
import { ScreenError } from "@/components/record/screen-error";
import { useAsyncData } from "@/lib/use-async-data";

// The admin-side view of one student, reached from the search box on /admin.
// It shows the same per-subject marks and averages the student sees on their
// own record — the endpoint calls record/service's buildSubjects, so the two
// cannot drift apart.
export default function AdminStudentPage() {
  const t = useT();
  const { locale } = useLocale();
  const params = useParams<{ id: string }>();
  const studentId = params.id;

  const [termId, setTermId] = useState<string | undefined>(undefined);
  const { data, error, retry } = useAsyncData<AdminStudentDetail>(
    () => adminApi.getStudent(studentId, termId),
    [studentId, termId],
  );

  if (error) return <ScreenError onRetry={retry} />;
  if (!data) return <main className="mx-auto w-full max-w-3xl p-8" />;

  const { student, enrollment, availableTerms, term, subjects } = data;
  const STATUS_LABEL: Record<RosterEntry["status"], string> = {
    active: t.admin.statusActive,
    transferred: t.admin.statusTransferred,
    departed: t.admin.statusDeparted,
    graduated: t.admin.statusGraduated,
  };
  const subjectName = (s: { nameHy: string; nameEn: string; nameRu: string }) =>
    locale === "hy" ? s.nameHy : locale === "ru" ? s.nameRu : s.nameEn;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-8">
      <Link href="/admin" className="text-sm underline" style={{ color: "var(--ink-3)" }}>
        {t.admin.stu.back}
      </Link>

      <header>
        <p className="text-xs uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
          {t.admin.stu.title}
        </p>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
          {displayFullName(student.firstName, student.lastName, locale)}
        </h1>
        {student.patronymic && (
          <p className="mt-0.5 text-sm" style={{ color: "var(--ink-3)" }}>
            {t.admin.stu.patronymic}: {student.patronymic}
          </p>
        )}
      </header>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-2xl border p-4 text-sm tablet:grid-cols-2" style={{ borderColor: "var(--hair)", background: "var(--bg-base)" }}>
        {(
          [
            [t.admin.stu.email, student.email, true],
            [t.admin.stu.className, enrollment.classLabel, false],
            [t.admin.stu.year, enrollment.yearLabel, false],
            [t.admin.stu.status, STATUS_LABEL[enrollment.status], false],
            [t.admin.stu.birthDate, student.birthDate ?? "—", false],
            [
              t.admin.stu.lastLogin,
              student.lastLoginAt ? new Date(student.lastLoginAt).toLocaleString(locale) : t.admin.stu.neverSignedIn,
              false,
            ],
          ] as [string, string, boolean][]
        ).map(([label, value, mono]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt style={{ color: "var(--ink-3)" }}>{label}</dt>
            <dd className={mono ? "truncate font-mono text-xs" : "truncate"} style={{ color: "var(--ink)" }}>
              {value}
            </dd>
          </div>
        ))}
        {student.mustChangePassword && (
          <div className="tablet:col-span-2">
            <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--warning)", color: "var(--ink)" }}>
              {t.admin.stu.mustChange}
            </span>
          </div>
        )}
      </dl>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wide" style={{ color: "var(--ink-3)" }}>
            {t.admin.stu.subjects}
          </h2>
          {availableTerms.length > 1 && (
            <div className="flex gap-1.5">
              {availableTerms.map((option) => {
                const active = option.id === term.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTermId(option.id)}
                    className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                    style={{
                      background: active ? "var(--accent)" : "transparent",
                      color: active ? "var(--accent-fg)" : "var(--ink-2)",
                      border: active ? "none" : "1px solid var(--hair)",
                    }}
                  >
                    {termLabel(option, t)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <ul className="space-y-2">
          {subjects.map((s) => (
            <li key={s.subjectId} className="rounded-2xl border p-3" style={{ borderColor: "var(--hair)", background: "var(--bg-base)" }}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm" style={{ color: "var(--ink)" }}>
                  {subjectName(s)}
                </span>
                <span className="shrink-0 text-xs" style={{ color: "var(--ink-3)" }}>
                  {s.average === null ? "—" : `${s.average} ${t.admin.stu.average}`}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs" style={{ color: "var(--ink-3)" }}>
                {s.teacherName}
              </p>
              {s.marks.length === 0 ? (
                <p className="mt-2 text-xs" style={{ color: "var(--ink-3)" }}>
                  {t.admin.stu.noMarks}
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.marks.map((m) => (
                    <span
                      key={m.id}
                      title={`${m.heldOn}${m.title ? ` · ${m.title}` : ""}`}
                      className="grid h-6 w-6 place-items-center rounded text-xs font-medium"
                      style={{ background: gradeColorVar(m.value), color: "var(--mark-tile-fg)" }}
                    >
                      {m.value}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
