"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SubjectDetail } from "@/components/record/subject-detail";
import { TermSwitcher } from "@/components/record/term-switcher";
import { recordApi, type RecordResponse, type SubjectDetailResponse } from "@/lib/api/record";
import { useT } from "@/i18n/locale-provider";

export default function SubjectDetailPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const t = useT();
  const [availableTerms, setAvailableTerms] = useState<RecordResponse["availableTerms"]>([]);
  const [termId, setTermId] = useState<string | undefined>(undefined);
  const [subject, setSubject] = useState<SubjectDetailResponse | null>(null);

  useEffect(() => {
    recordApi.getSubject(subjectId, termId).then(setSubject);
    // availableTerms doesn't come back from the subject-detail endpoint —
    // fetched once from the record endpoint purely to feed TermSwitcher.
    if (availableTerms.length === 0) {
      recordApi.getRecord(termId).then((r) => setAvailableTerms(r.availableTerms));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, termId]);

  const activeTermId = termId ?? availableTerms[0]?.id ?? "";

  return (
    <main className="mx-auto w-full max-w-xl space-y-4 p-8">
      <div className="flex items-center justify-between gap-3">
        <Link href="/subjects" className="text-sm underline" style={{ color: "var(--ink-2)" }}>
          {t.scr.sj.back}
        </Link>
        {availableTerms.length > 0 && (
          <TermSwitcher terms={availableTerms} activeTermId={activeTermId} onChange={setTermId} />
        )}
      </div>
      {subject && <SubjectDetail subject={subject} />}
    </main>
  );
}
