"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/locale-provider";
import { adminApi, type Subject } from "@/lib/api/admin";

export default function SubjectsPage() {
  const t = useT();
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [newRow, setNewRow] = useState({ nameHy: "", nameEn: "", nameRu: "", code: "" });

  async function reload() {
    setSubjects(await adminApi.listSubjects());
  }
  useEffect(() => {
    // Standard fetch-on-mount — reload() is also reused by the row handlers
    // below, so it can't be inlined without duplicating it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, []);

  async function updateCell(id: string, field: "nameHy" | "nameEn" | "nameRu" | "code", value: string) {
    setSubjects((rows) => rows?.map((r) => (r.id === id ? { ...r, [field]: value } : r)) ?? null);
  }

  async function commitCell(id: string, field: "nameHy" | "nameEn" | "nameRu" | "code", value: string) {
    await adminApi.updateSubject(id, { [field]: value });
  }

  async function addRow(e: React.FormEvent) {
    e.preventDefault();
    if (!newRow.nameHy || !newRow.nameEn || !newRow.nameRu) return;
    await adminApi.createSubject({ ...newRow, code: newRow.code || undefined });
    setNewRow({ nameHy: "", nameEn: "", nameRu: "", code: "" });
    await reload();
  }

  async function removeRow(id: string) {
    await adminApi.deleteSubject(id);
    await reload();
  }

  if (!subjects) return null;

  const cellClass = "w-full bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-panel";

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
        {t.admin.subjects}
      </h1>
      <table className="w-full border border-hair text-sm" style={{ background: "var(--bg-base)" }}>
        <thead>
          <tr className="border-b border-hair" style={{ color: "var(--ink-3)" }}>
            <th className="p-2 text-left">{t.admin.colNameHy}</th>
            <th className="p-2 text-left">{t.admin.colNameEn}</th>
            <th className="p-2 text-left">{t.admin.colNameRu}</th>
            <th className="p-2 text-left">{t.admin.colCode}</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {subjects.map((s) => (
            <tr key={s.id} className="border-b border-hair" style={{ color: "var(--ink)" }}>
              {(["nameHy", "nameEn", "nameRu", "code"] as const).map((field) => (
                <td key={field} className="p-0">
                  <input
                    value={(s[field] ?? "") as string}
                    onChange={(e) => updateCell(s.id, field, e.target.value)}
                    onBlur={(e) => commitCell(s.id, field, e.target.value)}
                    className={cellClass}
                  />
                </td>
              ))}
              <td>
                <button onClick={() => removeRow(s.id)} className="px-2 text-xs text-danger">
                  ✕
                </button>
              </td>
            </tr>
          ))}
          <tr style={{ color: "var(--ink)" }}>
            <td className="p-0">
              <input value={newRow.nameHy} onChange={(e) => setNewRow((f) => ({ ...f, nameHy: e.target.value }))} placeholder={t.admin.newSubject} className={cellClass} />
            </td>
            <td className="p-0">
              <input value={newRow.nameEn} onChange={(e) => setNewRow((f) => ({ ...f, nameEn: e.target.value }))} className={cellClass} />
            </td>
            <td className="p-0">
              <input value={newRow.nameRu} onChange={(e) => setNewRow((f) => ({ ...f, nameRu: e.target.value }))} className={cellClass} />
            </td>
            <td className="p-0">
              <input value={newRow.code} onChange={(e) => setNewRow((f) => ({ ...f, code: e.target.value }))} className={cellClass} />
            </td>
            <td>
              <button onClick={addRow} className="px-2 text-xs" style={{ color: "var(--ok)" }}>
                {t.admin.add}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
