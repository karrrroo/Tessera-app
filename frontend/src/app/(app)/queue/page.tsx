"use client";

import { useT } from "@/i18n/locale-provider";
import { ReviewQueue } from "@/components/credentials/review-queue";

export default function QueuePage() {
  const t = useT();
  return (
    <main className="mx-auto max-w-2xl space-y-1 p-6">
      <h1 className="font-serif text-2xl" style={{ color: "var(--ink)" }}>
        {t.scr.q.title}
      </h1>
      <p className="text-sm" style={{ color: "var(--ink-2)" }}>
        {t.scr.q.sub}
      </p>
      <div className="pt-3">
        <ReviewQueue />
      </div>
    </main>
  );
}
