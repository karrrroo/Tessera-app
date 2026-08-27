"use client";

import { useState } from "react";
import Link from "next/link";
import { adminApi, type CreatedTeacher } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";
import { useT } from "@/i18n/locale-provider";

const FIELD_CLASS = "w-full rounded-2xl border px-3 py-2 text-sm";
const FIELD_STYLE = { borderColor: "var(--hair)", background: "var(--surface2)", color: "var(--ink)" } as const;

type Draft = { lastName: string; firstName: string; patronymic: string; email: string; emisTeacherId: string };
const EMPTY: Draft = { lastName: "", firstName: "", patronymic: "", email: "", emisTeacherId: "" };

// Creating one teacher account — the counterpart of /admin/students/new.
//
// The temporary password is generated server-side and returned exactly once
// (POST /api/admin/teachers), the same contract the student and class-handout
// paths already use: the admin does not choose it, nothing here stores or
// re-displays the plaintext, and the account starts with
// `must_change_password = true` so the first thing the teacher does is replace
// it. That is why the panel below is emphatic about writing it down.
//
// DELIBERATELY NO CLASS PICKER, and this is the one real difference from the
// student form. A student needs an enrolment to exist meaningfully — their
// marks hang off it — so that form makes a class mandatory. A teacher's
// classes are teaching assignments made per subject and term on
// /admin/assignments, and a teacher with none is a valid record: someone hired
// before the timetable is set. Bundling one in would mean either inventing a
// default assignment or refusing to create a teacher until the timetable
// exists. The success panel links straight to Assignments instead, so the next
// step is one click away rather than hidden.
export default function NewTeacherPage() {
  const t = useT();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [created, setCreated] = useState<CreatedTeacher | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<"errCreate" | "errEmailTaken" | null>(null);

  const complete = draft.lastName.trim() && draft.firstName.trim() && draft.email.trim();

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
        emisTeacherId: draft.emisTeacherId.trim() || undefined,
      });
      setCreated(row);
      setDraft(EMPTY);
    } catch (err) {
      // A taken email is the one failure an admin can actually act on, so it
      // gets its own sentence instead of the generic one.
      setErrorKey(err instanceof ApiRequestError && err.code === "USER_EMAIL_TAKEN" ? "errEmailTaken" : "errCreate");
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

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
          <p className="text-xs" style={{ color: "var(--ink-3)" }}>
            {t.admin.teach.noAssignmentsYet}
          </p>
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
        <form onSubmit={submit} className="space-y-3">
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

          <label className="block space-y-1">
            <span className="text-xs" style={{ color: "var(--ink-3)" }}>
              {t.admin.teach.emisId}
            </span>
            <input
              value={draft.emisTeacherId}
              onChange={set("emisTeacherId")}
              className={FIELD_CLASS}
              style={FIELD_STYLE}
            />
          </label>

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
