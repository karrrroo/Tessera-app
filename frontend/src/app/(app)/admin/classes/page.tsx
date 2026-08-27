"use client";

import { useEffect, useState } from "react";
import { adminApi, type SchoolClass } from "@/lib/api/admin";
import { useCurrentAcademicYear } from "@/components/admin/use-current-academic-year";
import { ClassGenerator } from "@/components/admin/class-generator";
import { useT } from "@/i18n/locale-provider";

export default function ClassesPage() {
  const t = useT();
  const year = useCurrentAcademicYear();
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);

  async function reload(yearId: string) {
    setClasses(await adminApi.listClasses(yearId));
  }

  useEffect(() => {
    // Standard fetch-on-year-change — reload() is also reused by the
    // generator's onGenerated callback, so it can't be inlined without
    // duplicating it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (year) reload(year.id);
  }, [year]);

  if (year === undefined) return null;
  if (year === null) {
    return (
      <main className="p-8 text-sm" style={{ color: "var(--ink-3)" }}>
        {t.admin.createYearFirst}
      </main>
    );
  }

  const sorted = [...(classes ?? [])].sort((a, b) => a.grade - b.grade || a.letter.localeCompare(b.letter));

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
        {t.admin.classesTitle.replace("{year}", year.label)}
      </h1>

      <ClassGenerator academicYearId={year.id} onGenerated={() => reload(year.id)} />

      {classes && (
        <div className="flex flex-wrap gap-2">
          {sorted.map((c) => (
            <span key={c.id} className="rounded-full border border-hair px-3 py-1 text-sm" style={{ color: "var(--ink-2)" }}>
              {c.grade}-{c.letter}
            </span>
          ))}
          {sorted.length === 0 && (
            <span className="text-sm" style={{ color: "var(--ink-3)" }}>
              {t.admin.noClassesYet}
            </span>
          )}
        </div>
      )}
    </main>
  );
}
