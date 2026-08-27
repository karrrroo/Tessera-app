"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/state/auth-provider";
import { useLocale, useT } from "@/i18n/locale-provider";
import { termLabel } from "@/i18n/term-label";
import { gradebookApi, type TeacherClass } from "@/lib/api/gradebook";
import { adminApi, type AcademicYear, type SchoolClass, type Subject, type Term } from "@/lib/api/admin";
import { downloadExport, type ExportFormat, type ExportScope } from "@/lib/api/export";
import { useAsyncData } from "@/lib/use-async-data";

function InlineLoadError({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <p className="text-xs" style={{ color: "var(--ink-3)" }}>
        {t.scr.err.body}
      </p>
      <button type="button" onClick={onRetry} className="text-xs underline" style={{ color: "var(--ink-2)" }}>
        {t.scr.err.retry}
      </button>
    </div>
  );
}

function subjectName(s: Subject, locale: "hy" | "en" | "ru"): string {
  return locale === "hy" ? s.nameHy : locale === "ru" ? s.nameRu : s.nameEn;
}

function TeacherExportForm() {
  const t = useT();
  const { locale } = useLocale();
  const { data: classes, error: classesError, retry: retryClasses } = useAsyncData<TeacherClass[]>(
    () => gradebookApi.getClasses(),
    [],
  );
  const [selected, setSelected] = useState("");
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (classes && classes[0] && !selected) {
      setSelected(`${classes[0].classId}:${classes[0].subjectId}:${classes[0].termId}`);
    }
  }, [classes, selected]);

  if (classesError) return <InlineLoadError onRetry={retryClasses} />;
  if (!classes) return null;

  async function run() {
    const [classId, subjectId, termId] = selected.split(":");
    if (!classId || !subjectId || !termId) return;
    setExporting(true);
    setError(null);
    try {
      await downloadExport({ scope: "class-subject-term", classId, subjectId, termId, format, locale });
    } catch {
      setError(t.iter.error);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs" style={{ color: "var(--ink-2)" }}>
          {t.exp.s1}
        </span>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-2xl border px-3 py-2 text-sm"
          style={{ borderColor: "var(--hair)", background: "var(--surface2)", color: "var(--ink)" }}
        >
          {classes.map((c) => (
            <option key={`${c.classId}:${c.subjectId}`} value={`${c.classId}:${c.subjectId}:${c.termId ?? ""}`}>
              {c.classLabel} · {subjectName({ nameHy: c.subjectNameHy, nameEn: c.subjectNameEn, nameRu: c.subjectNameRu } as Subject, locale)}
            </option>
          ))}
        </select>
      </label>
      <FormatToggle value={format} onChange={setFormat} />
      <DownloadButton onClick={run} exporting={exporting} disabled={!selected} />
      {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}

function AdminExportForm() {
  const t = useT();
  const { locale } = useLocale();
  const { data: years, error: yearsError, retry: retryYears } = useAsyncData<AcademicYear[]>(
    () => adminApi.listAcademicYears(),
    [],
  );
  const [yearId, setYearId] = useState("");
  const { data: terms, error: termsError, retry: retryTerms } = useAsyncData<Term[]>(
    () => (yearId ? adminApi.listTerms(yearId) : Promise.resolve([])),
    [yearId],
  );
  const [termId, setTermId] = useState("");
  const { data: classesList, error: classesError, retry: retryClasses } = useAsyncData<SchoolClass[]>(
    () => (yearId ? adminApi.listClasses(yearId) : Promise.resolve([])),
    [yearId],
  );
  const [classId, setClassId] = useState("");
  const { data: subjects, error: subjectsError, retry: retrySubjects } = useAsyncData<Subject[]>(
    () => adminApi.listSubjects(),
    [],
  );
  const [subjectId, setSubjectId] = useState("");
  const [scope, setScope] = useState<ExportScope>("class-subject-term");
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (years && years[0] && !yearId) setYearId(years[0].id);
  }, [years, yearId]);
  useEffect(() => {
    if (terms && terms[0] && !termId) setTermId(terms[0].id);
  }, [terms, termId]);
  useEffect(() => {
    if (classesList && classesList[0] && !classId) setClassId(classesList[0].id);
  }, [classesList, classId]);
  useEffect(() => {
    if (subjects && subjects[0] && !subjectId) setSubjectId(subjects[0].id);
  }, [subjects, subjectId]);

  if (yearsError) return <InlineLoadError onRetry={retryYears} />;
  if (!years) return null;

  async function run() {
    if (!termId) return;
    if (scope !== "institution-term" && !classId) return;
    if (scope === "class-subject-term" && !subjectId) return;
    setExporting(true);
    setError(null);
    try {
      await downloadExport({
        scope,
        classId: scope === "institution-term" ? undefined : classId,
        subjectId: scope === "class-subject-term" ? subjectId : undefined,
        termId,
        format,
        locale,
      });
    } catch {
      setError(t.iter.error);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-1.5">
        <span className="text-xs" style={{ color: "var(--ink-2)" }}>
          {t.exp.scope}
        </span>
        {([
          ["class-subject-term", t.exp.s1],
          ["class-term", t.exp.s2],
          ["institution-term", t.exp.s3],
        ] as const).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm" style={{ color: "var(--ink)" }}>
            <input type="radio" name="export-scope" checked={scope === value} onChange={() => setScope(value)} />
            {label}
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs" style={{ color: "var(--ink-2)" }}>
          {t.exp.term}
        </span>
        <select value={termId} onChange={(e) => setTermId(e.target.value)} className="rounded-2xl border px-3 py-2 text-sm" style={{ borderColor: "var(--hair)", background: "var(--surface2)", color: "var(--ink)" }}>
          {(terms ?? []).map((term) => (
            <option key={term.id} value={term.id}>
              {termLabel(term, t)}
            </option>
          ))}
        </select>
        {termsError && <InlineLoadError onRetry={retryTerms} />}
      </label>

      {scope !== "institution-term" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs" style={{ color: "var(--ink-2)" }}>
            {t.exp.cls}
          </span>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-2xl border px-3 py-2 text-sm" style={{ borderColor: "var(--hair)", background: "var(--surface2)", color: "var(--ink)" }}>
            {(classesList ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.grade}-{c.letter}
              </option>
            ))}
          </select>
          {classesError && <InlineLoadError onRetry={retryClasses} />}
        </label>
      )}

      {scope === "class-subject-term" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs" style={{ color: "var(--ink-2)" }}>
            {t.exp.subj}
          </span>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="rounded-2xl border px-3 py-2 text-sm" style={{ borderColor: "var(--hair)", background: "var(--surface2)", color: "var(--ink)" }}>
            {(subjects ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {subjectName(s, locale)}
              </option>
            ))}
          </select>
          {subjectsError && <InlineLoadError onRetry={retrySubjects} />}
        </label>
      )}

      <FormatToggle value={format} onChange={setFormat} />
      <DownloadButton onClick={run} exporting={exporting} disabled={!termId} />
      {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}

function FormatToggle({ value, onChange }: { value: ExportFormat; onChange: (f: ExportFormat) => void }) {
  const t = useT();
  return (
    <fieldset className="flex flex-col gap-1.5">
      <span className="text-xs" style={{ color: "var(--ink-2)" }}>
        {t.exp.fmt}
      </span>
      <div className="flex gap-2">
        {(["xlsx", "csv"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onChange(f)}
            className="rounded-full px-3.5 py-1.5 text-xs font-medium tracking-wide"
            style={{ background: value === f ? "var(--accent)" : "transparent", color: value === f ? "var(--accent-fg)" : "var(--ink-2)", border: value === f ? "none" : "1px solid var(--hair)" }}
          >
            {f}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function DownloadButton({ onClick, exporting, disabled }: { onClick: () => void; exporting: boolean; disabled: boolean }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={exporting || disabled}
      className="self-start rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50"
      style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
    >
      {exporting ? "…" : t.exp.btn}
    </button>
  );
}

export function ExportPanel() {
  const { user } = useAuth();
  const t = useT();

  if (!user || user.role === "student") return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold tracking-wide" style={{ color: "var(--ink-3)" }}>
        {t.exp.title}
      </h3>
      <p className="text-xs" style={{ color: "var(--ink-3)" }}>
        {t.exp.sub}
      </p>
      <p className="text-xs" style={{ color: "var(--ink-3)" }}>
        {t.exp.only}
      </p>
      {user.role === "teacher" ? <TeacherExportForm /> : <AdminExportForm />}
    </div>
  );
}
