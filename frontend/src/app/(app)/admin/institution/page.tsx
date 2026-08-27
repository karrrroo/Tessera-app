"use client";

import { useEffect, useState } from "react";
import { adminApi, type Institution } from "@/lib/api/admin";
import { useT } from "@/i18n/locale-provider";

export default function InstitutionPage() {
  const t = useT();
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [form, setForm] = useState({ name: "", region: "", type: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi.getInstitution().then((row) => {
      setInstitution(row);
      setForm({ name: row.name, region: row.region, type: row.type });
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const updated = await adminApi.updateInstitution(form);
      setInstitution(updated);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (!institution) return null;

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 p-8">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
        {t.admin.institution}
      </h1>
      <form onSubmit={save} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm" style={{ color: "var(--ink-2)" }}>
            {t.admin.instName}
          </span>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-md border border-hair bg-panel px-3 py-2 text-sm"
            style={{ color: "var(--ink)" }}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm" style={{ color: "var(--ink-2)" }}>
            {t.admin.instRegion}
          </span>
          <input
            value={form.region}
            onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
            className="w-full rounded-md border border-hair bg-panel px-3 py-2 text-sm"
            style={{ color: "var(--ink)" }}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm" style={{ color: "var(--ink-2)" }}>
            {t.admin.instType}
          </span>
          <input
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className="w-full rounded-md border border-hair bg-panel px-3 py-2 text-sm"
            style={{ color: "var(--ink)" }}
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          {t.admin.save}
        </button>
        {saved && (
          <span className="ml-3 text-sm" style={{ color: "var(--ok)" }}>
            {t.admin.saved}
          </span>
        )}
      </form>
    </main>
  );
}
