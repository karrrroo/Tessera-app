"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SubjectDetail } from "@/components/record/subject-detail";
import { TermSwitcher } from "@/components/record/term-switcher";
import { ScreenError } from "@/components/record/screen-error";
import { recordApi, type RecordResponse } from "@/lib/api/record";
import { useT } from "@/i18n/locale-provider";
import { useAsyncData } from "@/lib/use-async-data";

export default function SubjectDetailPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const t = useT();
  const [availableTerms, setAvailableTerms] = useState<RecordResponse["availableTerms"]>([]);
  const [termId, setTermId] = useState<string | undefined>(undefined);
  // Was a bare `useEffect` + `.then(setSubject)` with no `.catch()` — the
  // exact unhandled-rejection shape `useAsyncData` exists to fix everywhere
  // else (see that hook's own comment). Live-confirmed here too: a deleted
  // or mistyped subjectId 404s and left this screen permanently blank
  // (just the back link/term switcher, no error, two uncaught
  // ApiRequestError rejections in the console) instead of the same
  // ScreenError/retry every sibling record screen already shows.
  const { data: subject, error, retry } = useAsyncData(() => recordApi.getSubject(subjectId, termId), [subjectId, termId]);

  useEffect(() => {
    // availableTerms doesn't come back from the subject-detail endpoint —
    // fetched once from the record endpoint purely to feed TermSwitcher.
    // Best-effort only: a failure here just leaves the switcher hidden,
    // not the whole page (useAsyncData above owns the page's real content
    // and its own error state).
    if (availableTerms.length === 0) {
      recordApi
        .getRecord(termId)
        .then((r) => setAvailableTerms(r.availableTerms))
        .catch(() => {});
    }
  }, [termId, availableTerms.length]);

  const activeTermId = termId ?? availableTerms[0]?.id ?? "";

  if (error) return <ScreenError onRetry={retry} />;

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
