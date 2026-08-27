"use client";

import { type ReactNode, useState } from "react";
import { useLocale, useT } from "@/i18n/locale-provider";
import type { CredentialItem } from "@/lib/api/credentials";
import { AttachmentViewer } from "./attachment-viewer";
import { DeclineReasonBlock } from "./decline-reason-block";

function subjectName(s: { nameHy: string; nameEn: string; nameRu: string }, locale: "hy" | "en" | "ru"): string {
  return locale === "hy" ? s.nameHy : locale === "ru" ? s.nameRu : s.nameEn;
}

function StatusChip({ status }: { status: CredentialItem["status"] }) {
  const t = useT();
  const color = status === "approved" ? "var(--ok)" : status === "declined" ? "var(--danger)" : "var(--ink-3)";
  const label = status === "approved" ? t.scr.cr.approved : status === "declined" ? t.scr.cr.declined : t.scr.cr.pending;
  return (
    <span className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ color, border: `1px solid ${color}` }}>
      {label}
    </span>
  );
}

// The approved/declined credential is deliberately never styled to look
// like a mark (CR-6, REC/CR-6) — no grade tile, no numeric value anywhere.
export function CredentialCard({
  item,
  showStudent,
  actions,
}: {
  item: CredentialItem;
  showStudent?: boolean;
  actions?: ReactNode;
}) {
  const t = useT();
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-[20px] p-4" style={{ background: "var(--panel)", border: "1px solid var(--hair)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium leading-snug" style={{ color: "var(--ink)" }}>
            {item.title}
          </p>
          <p className="text-xs" style={{ color: "var(--ink-3)" }}>
            {t.scr.cr[item.category]}
            {item.subject ? ` · ${subjectName(item.subject, locale)}` : ""}
          </p>
          {showStudent && item.student && (
            <p className="text-xs" style={{ color: "var(--ink-3)" }}>
              {item.student.firstName} {item.student.lastName}
              {item.student.classLabel ? ` · ${item.student.classLabel}` : ""}
            </p>
          )}
          {item.description && (
            <p className="text-xs leading-relaxed" style={{ color: "var(--ink-2)" }}>
              {item.description}
            </p>
          )}
        </div>
        <StatusChip status={item.status} />
      </div>

      {item.decision?.status === "declined" && item.decision.reason && <div className="mt-3"><DeclineReasonBlock reason={item.decision.reason} /></div>}

      {item.decision?.decidedBy?.name && (
        <p className="mt-2 text-[11px]" style={{ color: "var(--ink-3)" }}>
          {t.scr.q.readOnly} {item.decision.decidedBy.name}
        </p>
      )}

      {item.attachment && (
        <div className="mt-3">
          <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs underline" style={{ color: "var(--ink-2)" }}>
            {t.scr.cr.doc}
          </button>
          {open && (
            <div className="mt-2">
              <AttachmentViewer credentialId={item.id} />
            </div>
          )}
        </div>
      )}

      {actions && <div className="mt-3 flex gap-2">{actions}</div>}
    </div>
  );
}
