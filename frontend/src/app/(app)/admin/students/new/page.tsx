"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { adminApi, type CreatedStudent, type SchoolClass } from "@/lib/api/admin";
import { useCurrentAcademicYear } from "@/components/admin/use-current-academic-year";
import { useT } from "@/i18n/locale-provider";

const FIELD_CLASS = "w-full rounded-2xl border px-3 py-2 text-sm";
const FIELD_STYLE = { borderColor: "var(--hair)", background: "var(--surface2)", color: "var(--ink)" } as const;

type Draft = { lastName: string; firstName: string; patronymic: string; birthDate: string; email: string; classId: string };
const EMPTY: Draft = { lastName: "", firstName: "", patronymic: "", birthDate: "", email: "", classId: "" };

// Creating one student account, with its credentials shown once.
//
// The temporary password is generated server-side and returned exactly once
// (POST /api/admin/students) — the admin does not choose it. That follows the
// pattern the class-handout path already established: every account starts
// with `must_change_password = true`, so the first thing the student does is
// replace it. Nothing here ever stores or re-displays the plaintext, which is
// why the panel below is emphatic about writing it down.
// B5: approving an admissions application does NOT create the account. It
// marks the application approved and opens THIS form, prefilled, so a human
// still creates the account through the path that already exists. That is
// what keeps the PRD's trust model intact — accounts are created by the
// institution, deliberately — and it is why the prefill arrives as query
// parameters rather than as a second code path through the API.
//
// `classId` is deliberately NOT prefillable: an applicant has no class yet,
// and choosing one for the admin is the one decision this form must not make
// on their behalf.
function prefillFrom(params: URLSearchParams): Draft {
  const take = (key: string) => (params.get(key) ?? "").slice(0, 200);
  return {
    lastName: take("lastName"),
    firstName: take("firstName"),
    patronymic: "",
    birthDate: take("birthDate"),
    email: take("email"),
    classId: "",
  };
}

export default function NewStudentPage() {
  const t = useT();
  const year = useCurrentAcademicYear();
  const searchParams = useSearchParams();
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  // Read once, at mount, from the URL — not synced to it. The admin edits
  // these fields afterwards, and re-deriving them on every render would fight
  // whatever they typed.
  const [draft, setDraft] = useState<Draft>(() => prefillFrom(new URLSearchParams(searchParams.toString())));
  const [created, setCreated] = useState<CreatedStudent | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!year) return;
    let cancelled = false;
    adminApi.listClasses(year.id).then((c) => !cancelled && setClasses(c));
    return () => {
      cancelled = true;
    };
  }, [year]);

  const complete = draft.lastName.trim() && draft.firstName.trim() && draft.email.trim() && draft.classId;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!complete || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const row = await adminApi.createStudent({
        classId: draft.classId,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        patronymic: draft.patronymic.trim() || undefined,
        birthDate: draft.birthDate || undefined,
        email: draft.email.trim(),
      });
      setCreated(row);
      setDraft(EMPTY);
    } catch {
      setFailed(true);
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
          {t.admin.stu.newTitle}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
          {t.admin.stu.newSub}
        </p>
      </header>

      {created ? (
        <section className="space-y-4 rounded-2xl border p-4" style={{ borderColor: "var(--ok)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
            {t.admin.stu.created}
          </p>
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt style={{ color: "var(--ink-3)" }}>{t.admin.stu.email}</dt>
              <dd className="font-mono text-xs" style={{ color: "var(--ink)" }}>{created.login}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt style={{ color: "var(--ink-3)" }}>{t.admin.stu.password}</dt>
              <dd className="select-all font-mono text-sm" style={{ color: "var(--ink)" }}>{created.temporaryPassword}</dd>
            </div>
          </dl>
          <p className="text-xs" style={{ color: "var(--warning)" }}>{t.admin.stu.once}</p>
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
              href={`/admin/students/${created.student.id}`}
              className="rounded-full border px-4 py-2 text-sm"
              style={{ borderColor: "var(--hair)", color: "var(--ink-2)" }}
            >
              {t.admin.stu.title} →
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
              <span className="text-xs" style={{ color: "var(--ink-3)" }}>{label}</span>
              <input value={draft[key]} onChange={set(key)} className={FIELD_CLASS} style={FIELD_STYLE} />
            </label>
          ))}

          <label className="block space-y-1">
            <span className="text-xs" style={{ color: "var(--ink-3)" }}>{t.admin.stu.birthDate}</span>
            <input type="date" value={draft.birthDate} onChange={set("birthDate")} className={FIELD_CLASS} style={FIELD_STYLE} />
          </label>

          <label className="block space-y-1">
            <span className="text-xs" style={{ color: "var(--ink-3)" }}>{t.admin.stu.email}</span>
            <input type="email" value={draft.email} onChange={set("email")} className={FIELD_CLASS} style={FIELD_STYLE} />
          </label>

          <label className="block space-y-1">
            <span className="text-xs" style={{ color: "var(--ink-3)" }}>{t.admin.stu.className}</span>
            <select value={draft.classId} onChange={set("classId")} className={FIELD_CLASS} style={FIELD_STYLE}>
              <option value="">{t.admin.stu.chooseClass}</option>
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.grade}-{c.letter}
                </option>
              ))}
            </select>
          </label>

          {failed && <p className="text-xs" style={{ color: "var(--danger)" }}>{t.admin.stu.error}</p>}

          <button
            type="submit"
            disabled={!complete || busy}
            className="rounded-full px-4 py-2 text-sm disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            {busy ? t.admin.stu.creating : t.admin.stu.create}
          </button>
        </form>
      )}
    </main>
  );
}
