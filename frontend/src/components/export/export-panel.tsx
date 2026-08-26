"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/state/auth-provider";
import { useLocale, useT } from "@/i18n/locale-provider";
import { gradebookApi, type TeacherClass } from "@/lib/api/gradebook";
import { adminApi, type AcademicYear, type SchoolClass, type Subject, type Term } from "@/lib/api/admin";
import { downloadExport, type ExportFormat, type ExportScope } from "@/lib/api/export";

function subjectName(s: Subject, locale: "hy" | "en" | "ru"): string {
  return locale === "hy" ? s.nameHy : locale === "ru" ? s.nameRu : s.nameEn;
}

function TeacherExportForm() {
  const t = useT();
  const { locale } = useLocale();
  const [classes, setClasses] = useState<TeacherClass[] | null>(null);
  const [selected, setSelected] = useState("");
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gradebookApi.getClasses().then((rows) => {
      setClasses(rows);
      if (rows[0]) setSelected(`${rows[0].classId}:${rows[0].subjectId}:${rows[0].termId}`);
    });
  }, []);

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
  const [years, setYears] = useState<AcademicYear[] | null>(null);
  const [yearId, setYearId] = useState("");
  const [terms, setTerms] = useState<Term[]>([]);
  const [termId, setTermId] = useState("");
  const [classesList, setClassesList] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [scope, setScope] = useState<ExportScope>("class-subject-term");
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.listAcademicYears().then((rows) => {
      setYears(rows);
      if (rows[0]) setYearId(rows[0].id);
    });
    adminApi.listSubjects().then((rows) => {
      setSubjects(rows);
      if (rows[0]) setSubjectId(rows[0].id);
    });
  }, []);

  useEffect(() => {
    if (!yearId) return;
    adminApi.listTerms(yearId).then((rows) => {
      setTerms(rows);
      if (rows[0]) setTermId(rows[0].id);
    });
    adminApi.listClasses(yearId).then((rows) => {
      setClassesList(rows);
      if (rows[0]) setClassId(rows[0].id);
    });
  }, [yearId]);

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
          {terms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.label}
            </option>
          ))}
        </select>
      </label>

      {scope !== "institution-term" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs" style={{ color: "var(--ink-2)" }}>
            {t.exp.cls}
          </span>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-2xl border px-3 py-2 text-sm" style={{ borderColor: "var(--hair)", background: "var(--surface2)", color: "var(--ink)" }}>
            {classesList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.grade}-{c.letter}
              </option>
            ))}
          </select>
        </label>
      )}

      {scope === "class-subject-term" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs" style={{ color: "var(--ink-2)" }}>
            {t.exp.subj}
          </span>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="rounded-2xl border px-3 py-2 text-sm" style={{ borderColor: "var(--hair)", background: "var(--surface2)", color: "var(--ink)" }}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {subjectName(s, locale)}
              </option>
            ))}
          </select>
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
