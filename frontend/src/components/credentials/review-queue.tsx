"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useT } from "@/i18n/locale-provider";
import { useAuth } from "@/state/auth-provider";
import { gradebookApi } from "@/lib/api/gradebook";
import { credentialsApi, type CredentialItem, type CredentialStatus } from "@/lib/api/credentials";
import { CredentialCard } from "./credential-card";
import { DecisionDialog } from "./decision-dialog";
import { ScreenError } from "@/components/record/screen-error";

type SubjectFilter = { id: string; nameHy: string; nameEn: string; nameRu: string };

function subjectName(s: SubjectFilter, locale: "hy" | "en" | "ru"): string {
  return locale === "hy" ? s.nameHy : locale === "ru" ? s.nameRu : s.nameEn;
}

// CR-7: the filter's subject list is built from every subject this teacher
// teaches, across all their classes — the queue itself already spans them
// all (the backend's own list scoping), this is only the filter chips.
export function ReviewQueue() {
  const t = useT();
  const { locale } = useLocale();
  const { user } = useAuth();
  const [items, setItems] = useState<CredentialItem[] | null>(null);
  const [itemsError, setItemsError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [status, setStatus] = useState<CredentialStatus | undefined>("pending");
  const [subjectId, setSubjectId] = useState<string | undefined>(undefined);
  const [subjects, setSubjects] = useState<SubjectFilter[]>([]);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [decideError, setDecideError] = useState(false);
  // Guards against the same out-of-order-response race credential-list.tsx
  // documents: rapidly toggling a filter chip can fire a second request
  // before the first resolves, and without this only the most recently
  // *issued* request's response is ever allowed to apply.
  const requestSeq = useRef(0);

  useEffect(() => {
    if (user?.role !== "teacher") return;
    gradebookApi.getClasses().then((classes) => {
      const seen = new Map<string, SubjectFilter>();
      for (const c of classes) seen.set(c.subjectId, { id: c.subjectId, nameHy: c.subjectNameHy, nameEn: c.subjectNameEn, nameRu: c.subjectNameRu });
      setSubjects([...seen.values()]);
    });
  }, [user?.role]);

  useEffect(() => {
    const seq = ++requestSeq.current;
    setItemsError(false);
    credentialsApi.list({ status, subjectId }).then(
      (r) => {
        if (seq === requestSeq.current) setItems(r.items);
      },
      () => {
        // A real bug, found live: no `.catch()` at all — aborting this
        // request left the screen permanently, silently blank.
        if (seq === requestSeq.current) setItemsError(true);
      },
    );
  }, [status, subjectId, reloadTick]);

  async function decide(id: string, decision: "approved" | "declined", reason?: string) {
    setBusy(true);
    setDecideError(false);
    const previous = items;
    // Optimistic: the reviewer is looking at a queue, a round trip per
    // decision makes reviewing twenty feel like work.
    setItems((cur) => cur?.filter((i) => i.id !== id) ?? cur);
    try {
      await credentialsApi.decide(id, decision, reason, crypto.randomUUID());
      setDecidingId(null);
    } catch {
      // A real bug, found live: this reverted the optimistic update but
      // left the dialog open with no indication anything had gone wrong —
      // the reviewer would just see their approve/decline click silently
      // do nothing. `decidingId` deliberately stays set so the dialog
      // remains open with the error visible, rather than also closing it.
      setItems(previous);
      setDecideError(true);
    } finally {
      setBusy(false);
    }
  }

  if (itemsError) return <ScreenError onRetry={() => setReloadTick((n) => n + 1)} />;
  if (!items) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "declined"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className="rounded-full border px-3 py-1.5 text-xs"
            style={{
              borderColor: status === s ? "var(--accent)" : "var(--hair)",
              color: status === s ? "var(--ink)" : "var(--ink-3)",
            }}
          >
            {s === "pending" ? t.scr.cr.pending : s === "approved" ? t.scr.cr.approved : t.scr.cr.declined}
          </button>
        ))}
        {subjects.length > 0 && (
          <select
            value={subjectId ?? ""}
            onChange={(e) => setSubjectId(e.target.value || undefined)}
            className="rounded-full border border-hair px-3 py-1.5 text-xs"
            // A real bug, found live: `bg-transparent` gave the OS-drawn
            // dropdown popup nothing but white to fall back on in dark
            // theme — near-invisible text. An explicit, solid background
            // is the same fix already proven correct on Settings'
            // AdminExportForm selects, which render this popup correctly.
            style={{ background: "var(--surface2)", color: "var(--ink)" }}
          >
            <option value="">{t.scr.cr.subject}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {subjectName(s, locale)}
              </option>
            ))}
          </select>
        )}
      </div>

      {items.length === 0 ? (
        <div className="space-y-1 rounded-[20px] p-6 text-center" style={{ background: "var(--panel)", border: "1px solid var(--hair)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
            {t.scr.q.emptyTitle}
          </p>
          <p className="text-xs" style={{ color: "var(--ink-3)" }}>
            {t.scr.q.emptyBody}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <CredentialCard
              key={item.id}
              item={item}
              showStudent
              actions={
                item.status === "pending" ? (
                  <button type="button" onClick={() => setDecidingId(item.id)} className="text-xs underline" style={{ color: "var(--accent)" }}>
                    {t.scr.q.approve} / {t.scr.q.decline}
                  </button>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      {decidingId && (
        <DecisionDialog
          busy={busy}
          error={decideError}
          onCancel={() => setDecidingId(null)}
          onApprove={() => decide(decidingId, "approved")}
          onDecline={(reason) => decide(decidingId, "declined", reason)}
        />
      )}
    </div>
  );
}
