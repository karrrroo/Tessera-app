"use client";

import { useEffect, useState } from "react";
import { ArchiveYear } from "@/components/record/archive-year";
import { EmptyState } from "@/components/record/empty-state";
import { recordApi, type ArchiveYear as ArchiveYearData } from "@/lib/api/record";
import { useT } from "@/i18n/locale-provider";

export default function ArchivePage() {
  const t = useT();
  const [years, setYears] = useState<ArchiveYearData[] | null>(null);

  useEffect(() => {
    recordApi.getArchive().then((r) => setYears(r.years));
  }, []);

  if (years === null) return <main className="flex-1 p-8" />;

  return (
    <main className="mx-auto w-full max-w-xl space-y-5 p-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--ink)" }}>
          {t.scr.ar.title}
        </h1>
        <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
          {t.scr.ar.sub}
        </p>
      </div>

      {years.length === 0 ? (
        <EmptyState title={t.scr.ar.emptyTitle} body={t.scr.ar.emptyBody} />
      ) : (
        years.map((y) => <ArchiveYear key={y.academicYearId} year={y} />)
      )}
    </main>
  );
}
