"use client";

import { useEffect, useState } from "react";
import { adminApi, type Subject } from "@/lib/api/admin";

export default function SubjectsPage() {
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
        Subjects
      </h1>
      <table className="w-full border border-hair text-sm">
        <thead>
          <tr className="border-b border-hair" style={{ color: "var(--ink-3)" }}>
            <th className="p-2 text-left">Armenian</th>
            <th className="p-2 text-left">English</th>
            <th className="p-2 text-left">Russian</th>
            <th className="p-2 text-left">Code</th>
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
              <input value={newRow.nameHy} onChange={(e) => setNewRow((f) => ({ ...f, nameHy: e.target.value }))} placeholder="+ new subject" className={cellClass} />
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
                Add
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
