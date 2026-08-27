"use client";

import { ArchiveYear } from "@/components/record/archive-year";
import { EmptyState } from "@/components/record/empty-state";
import { ScreenError } from "@/components/record/screen-error";
import { recordApi } from "@/lib/api/record";
import { useT } from "@/i18n/locale-provider";
import { useAsyncData } from "@/lib/use-async-data";

export default function ArchivePage() {
  const t = useT();
  const { data: years, error, retry } = useAsyncData(() => recordApi.getArchive().then((r) => r.years), []);

  if (error) return <ScreenError onRetry={retry} />;
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
