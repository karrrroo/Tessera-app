"use client";

import { useEffect, useState } from "react";
import { SubjectCard } from "@/components/record/subject-card";
import { TermSwitcher } from "@/components/record/term-switcher";
import { EmptyState } from "@/components/record/empty-state";
import { recordApi, type RecordResponse } from "@/lib/api/record";
import { useT } from "@/i18n/locale-provider";

export default function SubjectsPage() {
  const t = useT();
  const [record, setRecord] = useState<RecordResponse | null>(null);
  const [termId, setTermId] = useState<string | undefined>(undefined);

  useEffect(() => {
    recordApi.getRecord(termId).then(setRecord);
  }, [termId]);

  if (!record) return <main className="flex-1 p-8" />;

  return (
    <main className="mx-auto w-full max-w-xl space-y-4 p-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--ink)" }}>
          {t.scr.sj.title}
        </h1>
        <TermSwitcher terms={record.availableTerms} activeTermId={record.term.id} onChange={setTermId} />
      </div>

      {record.subjects.length === 0 ? (
        <EmptyState title={t.scr.sj.emptyTitle} body={t.scr.sj.emptyBody} />
      ) : (
        <div className="divide-y divide-hair rounded-[26px] border border-hair" style={{ background: "var(--panel)" }}>
          {record.subjects.map((s) => (
            <SubjectCard key={s.subjectId} subject={s} active={false} />
          ))}
        </div>
      )}
    </main>
  );
}
