"use client";

import { useEffect, useState } from "react";
import { adminApi, type Institution } from "@/lib/api/admin";
import { useT } from "@/i18n/locale-provider";
import { ScreenError } from "@/components/record/screen-error";

export default function InstitutionPage() {
  const t = useT();
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [form, setForm] = useState({ name: "", region: "", type: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadSeq, setLoadSeq] = useState(0);

  // The rejection handler is the point: without it a failed load left this
  // screen blank forever with an unhandled promise behind it.
  useEffect(() => {
    let cancelled = false;
    adminApi.getInstitution().then(
      (row) => {
        if (cancelled) return;
        setInstitution(row);
        setForm({ name: row.name, region: row.region, type: row.type });
      },
      () => {
        if (!cancelled) setLoadFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [loadSeq]);

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

  if (loadFailed) {
    return (
      <ScreenError
        onRetry={() => {
          setLoadFailed(false);
          setLoadSeq((n) => n + 1);
        }}
      />
    );
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
