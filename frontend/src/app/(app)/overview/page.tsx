"use client";

import { useState } from "react";
import { Mosaic } from "@/components/record/mosaic";
import { TermSwitcher } from "@/components/record/term-switcher";
import { ScreenError } from "@/components/record/screen-error";
import { recordApi } from "@/lib/api/record";
import { useT } from "@/i18n/locale-provider";
import { useAsyncData } from "@/lib/use-async-data";

export default function OverviewPage() {
  const t = useT();
  const [termId, setTermId] = useState<string | undefined>(undefined);
  const { data: record, error, retry } = useAsyncData(() => recordApi.getRecord(termId), [termId]);

  if (error) return <ScreenError onRetry={retry} />;
  if (!record) return <main className="flex-1 p-8" />;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--ink)" }}>
          {t.nav.overview}
        </h1>
        <TermSwitcher terms={record.availableTerms} activeTermId={record.term.id} onChange={setTermId} />
      </div>
      <Mosaic subjects={record.subjects} />
    </main>
  );
}
