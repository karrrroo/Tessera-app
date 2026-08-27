"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useT } from "@/i18n/locale-provider";
import { ApiRequestError } from "@/lib/api/client";
import { credentialsApi, type CredentialCategory } from "@/lib/api/credentials";
import { recordApi } from "@/lib/api/record";

const CATEGORIES: CredentialCategory[] = ["olympiad", "course", "sport", "volunteering", "art"];
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 10 * 1024 * 1024;

type SubjectOption = { id: string; nameHy: string; nameEn: string; nameRu: string };

function subjectName(s: SubjectOption, locale: "hy" | "en" | "ru"): string {
  return locale === "hy" ? s.nameHy : locale === "ru" ? s.nameRu : s.nameEn;
}

// CR-2's client-side pre-check mirrors the server's rules (type, 10MB) but is
// never trusted by it — the server re-sniffs the real bytes regardless of
// what this check, or the file's own extension, claims.
function clientPreCheck(file: File, t: ReturnType<typeof useT>): string | null {
  if (file.size > MAX_BYTES) return t.scr.cr.types;
  if (!ALLOWED_TYPES.includes(file.type)) return t.scr.cr.types;
  return null;
}

export function SubmitSheet({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const t = useT();
  const { locale } = useLocale();
  const [category, setCategory] = useState<CredentialCategory>("olympiad");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    recordApi
      .getRecord()
      .then((r) => setSubjects(r.subjects.map((s) => ({ id: s.subjectId, nameHy: s.nameHy, nameEn: s.nameEn, nameRu: s.nameRu }))))
      .catch(() => setSubjects([]));
  }, []);

  function pickFile(f: File) {
    const problem = clientPreCheck(f, t);
    setError(problem);
    setFile(problem ? null : f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) {
      setError(t.auth.errField);
      return;
    }
    setBusy(true);
    setError(null);
    let submitted = false;
    try {
      await credentialsApi.submit({ category, title: title.trim(), description: description.trim() || undefined, subjectId: subjectId || undefined, file });
      submitted = true;
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "CREDENTIAL_FILE_TYPE_INVALID") setError(t.scr.cr.types);
      else if (err instanceof ApiRequestError && err.code === "CREDENTIAL_FILE_TOO_LARGE") setError(t.scr.cr.types);
      else setError(t.auth.errGeneric);
    } finally {
      setBusy(false);
    }
    // Outside the try/catch above on purpose: onSubmitted (which unmounts
    // this dialog) is the caller's concern, not this submission's — folding
    // it into the same catch would silently swallow an error there and
    // misreport it as if this submission itself had failed.
    if (submitted) onSubmitted();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <form
        onSubmit={submit}
        className="relative flex w-full max-w-md flex-col gap-4 rounded-[26px] p-6"
        style={{ background: "var(--panel)", border: "1px solid var(--hair)" }}
      >
        <h2 className="font-serif text-lg font-semibold" style={{ color: "var(--ink)" }}>
          {t.scr.cr.newTitle}
        </h2>

        <label className="block space-y-1">
          <span className="text-sm" style={{ color: "var(--ink-2)" }}>
            {t.scr.cr.cat}
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CredentialCategory)}
            className="w-full rounded-[14px] border border-hair bg-transparent px-3 py-2 text-sm"
            style={{ color: "var(--ink)" }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t.scr.cr[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm" style={{ color: "var(--ink-2)" }}>
            {t.scr.cr.name}
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.scr.cr.namePh}
            className="w-full rounded-[14px] border border-hair bg-transparent px-3 py-2 text-sm"
            style={{ color: "var(--ink)" }}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm" style={{ color: "var(--ink-2)" }}>
            {t.scr.cr.desc}
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-[14px] border border-hair bg-transparent px-3 py-2 text-sm"
            style={{ color: "var(--ink)" }}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm" style={{ color: "var(--ink-2)" }}>
            {t.scr.cr.subject}
          </span>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded-[14px] border border-hair bg-transparent px-3 py-2 text-sm"
            style={{ color: "var(--ink)" }}
          >
            <option value="">—</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {subjectName(s, locale)}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm" style={{ color: "var(--ink-2)" }}>
            {t.scr.cr.doc}
          </span>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) pickFile(f);
            }}
            onClick={() => inputRef.current?.click()}
            className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] border-2 border-dashed text-center text-xs"
            style={{ borderColor: dragOver ? "var(--accent)" : "var(--hair)", color: "var(--ink-3)" }}
          >
            <span>{file ? file.name : t.scr.cr.pick}</span>
            <span>{t.scr.cr.types}</span>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
              }}
            />
          </div>
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm" style={{ color: "var(--ink-2)" }}>
            {t.scr.cr.cancel}
          </button>
          <button
            type="submit"
            disabled={busy || !file || !title.trim()}
            className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            {t.scr.cr.submit}
          </button>
        </div>
      </form>
    </div>
  );
}
