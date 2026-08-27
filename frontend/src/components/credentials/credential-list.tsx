"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/locale-provider";
import { credentialsApi, type CredentialItem } from "@/lib/api/credentials";
import { CredentialCard } from "./credential-card";
import { SubmitSheet } from "./submit-sheet";
import { ScreenError } from "@/components/record/screen-error";

export function CredentialList() {
  const t = useT();
  const [items, setItems] = useState<CredentialItem[] | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  // The mount-time load and a post-submit reload can resolve out of order
  // (the second call fired quickly enough that the first, slower response
  // arrives last and overwrites the fresh one with stale data) — this
  // sequence counter makes only the most recently *issued* call allowed to
  // ever call setItems, regardless of resolution order.
  const requestSeq = useRef(0);
  const [loadFailed, setLoadFailed] = useState(false);

  function reload() {
    const seq = ++requestSeq.current;
    // The rejection handler was missing, so a failed load left this list on
    // its loading state (`items === null` renders nothing) with an unhandled
    // rejection behind it. Mirrors review-queue.tsx, which already had one.
    //
    // `loadFailed` is cleared in the SUCCESS branch rather than synchronously
    // here: `reload` is the effect body below, so a synchronous setState in it
    // is the set-state-in-effect the linter rightly objects to.
    credentialsApi.list().then(
      (r) => {
        if (seq !== requestSeq.current) return;
        setItems(r.items);
        setLoadFailed(false);
      },
      () => {
        if (seq === requestSeq.current) setLoadFailed(true);
      },
    );
  }

  useEffect(reload, []);

  if (loadFailed) return <ScreenError onRetry={reload} />;
  if (!items) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          {t.scr.cr.sub}
        </p>
        <button
          type="button"
          onClick={() => setSubmitOpen(true)}
          className="rounded-full px-4 py-2 text-sm font-medium"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          {items.length === 0 ? t.scr.cr.emptyBtn : t.scr.cr.newTitle}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="space-y-1 rounded-[20px] p-6 text-center" style={{ background: "var(--panel)", border: "1px solid var(--hair)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
            {t.scr.cr.emptyTitle}
          </p>
          <p className="text-xs" style={{ color: "var(--ink-3)" }}>
            {t.scr.cr.emptyBody}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <CredentialCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {submitOpen && (
        <SubmitSheet
          onClose={() => setSubmitOpen(false)}
          onSubmitted={() => {
            setSubmitOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
