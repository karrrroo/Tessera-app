"use client";

import { useEffect, useState } from "react";
import { Mosaic } from "@/components/record/mosaic";
import { TermSwitcher } from "@/components/record/term-switcher";
import { recordApi, type RecordResponse } from "@/lib/api/record";
import { useT } from "@/i18n/locale-provider";

export default function OverviewPage() {
  const t = useT();
  const [record, setRecord] = useState<RecordResponse | null>(null);
  const [termId, setTermId] = useState<string | undefined>(undefined);

  useEffect(() => {
    recordApi.getRecord(termId).then(setRecord);
  }, [termId]);

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
