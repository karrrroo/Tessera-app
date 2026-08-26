"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/state/auth-provider";
import { useT } from "@/i18n/locale-provider";
import { IterMark } from "./iter-mark";
import { useIter } from "./iter-provider";

// IT-9: the 2px animated conic-gradient border. This animation must appear
// nowhere else in the product — its keyframe/property names are scoped
// with an `iter-` prefix for exactly that reason.
function ThinkingPill() {
  return (
    <div className="mt-3 flex">
      <div className="relative grid h-10 w-[90px] place-items-center overflow-hidden rounded-full">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from var(--iter-angle), var(--accent-tint), var(--qr-bloom-1), var(--iter-mid), var(--iter-bloom-1), var(--accent-tint))",
            animation: "tessera-iter-spin 1400ms linear infinite",
          }}
        />
        <div className="absolute inset-[2px] rounded-full" style={{ background: "var(--panel)" }} />
        <div className="relative flex gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ink-3)", animation: "tessera-iter-dot 1.2s linear infinite" }} />
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ink-3)", animation: "tessera-iter-dot 1.2s linear .2s infinite" }} />
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ink-3)", animation: "tessera-iter-dot 1.2s linear .4s infinite" }} />
        </div>
      </div>
      <style>{`
        @property --iter-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
        @keyframes tessera-iter-spin { to { --iter-angle: 360deg; } }
        @keyframes tessera-iter-dot { 0%, 100% { opacity: .3; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}

export function IterPanel() {
  const { open, messages, sending, error, greeted, closePanel, send } = useIter();
  const { user } = useAuth();
  const t = useT();
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, sending]);

  if (!open || !user) return null;

  const isEmpty = messages.length === 0 && !sending;
  const chips = user.role === "teacher" ? t.iter.tChips : user.role === "admin" ? t.iter.aChips : t.iter.sChips;
  const firstName = (user.firstName ?? "").trim();

  function submit() {
    const text = draft;
    if (!text.trim() || sending) return;
    setDraft("");
    void send(text);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center tablet:items-stretch tablet:justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45 tablet:hidden" onClick={closePanel} aria-hidden />
      <div
        className="relative flex h-[92%] w-full flex-col rounded-t-[34px] border-t tablet:h-full tablet:w-[420px] tablet:rounded-none tablet:border-l tablet:border-t-0"
        style={{
          background: "var(--glass)",
          backdropFilter: "blur(22px) saturate(160%)",
          WebkitBackdropFilter: "blur(22px) saturate(160%)",
          borderColor: "var(--hair-bright)",
          boxShadow: "inset 0 1px 0 var(--hair-top)",
        }}
      >
        <div className="flex justify-center pb-0.5 pt-2.5 tablet:hidden">
          <button type="button" onClick={closePanel} aria-label={t.iter.close} className="h-1.5 w-9 rounded-full" style={{ background: "var(--ink-3)", opacity: 0.5 }} />
        </div>
        <div className="flex h-14 flex-none items-center gap-2.5 px-4.5">
          <span className="flex-none" style={{ color: "var(--ink)" }}>
            <IterMark size={22} />
          </span>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="font-serif text-[17px] font-semibold" style={{ color: "var(--ink)" }}>
              {t.iter.name}
            </span>
            <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
              {t.iter.sub}
            </span>
          </div>
          <button type="button" onClick={closePanel} aria-label={t.iter.close} className="grid h-11 w-11 flex-none place-items-center rounded-full" style={{ color: "var(--ink-3)" }}>
            <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3.4 3.4 13.6 13.6M13.6 3.4 3.4 13.6" />
            </svg>
          </button>
        </div>

        <div ref={listRef} className="flex flex-1 flex-col overflow-y-auto px-4.5 pb-3.5">
          {isEmpty && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4.5 py-5">
              <span style={{ color: "var(--ink)", opacity: 0.85 }}>
                <IterMark size={40} />
              </span>
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="font-serif text-xl font-semibold" style={{ color: "var(--ink)" }}>
                  {t.iter.hi}
                  {firstName || t.common.roleStudent}
                </span>
                <span className="text-sm" style={{ color: "var(--ink-2)" }}>
                  {t.iter.line2}
                </span>
              </div>
              <div className="flex w-full flex-col gap-2">
                {chips.map((chip, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setDraft(chip)}
                    className="rounded-[18px] px-3.5 py-3 text-left text-[12.5px] leading-snug"
                    style={{ background: "var(--glass-solid)", border: "1px solid var(--hair)", color: "var(--ink)" }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`mt-2.5 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <span
                className="max-w-[85%] whitespace-pre-wrap rounded-[18px] px-3.5 py-2.5 text-sm leading-relaxed"
                style={
                  m.role === "user"
                    ? { background: "var(--accent)", color: "var(--accent-fg)", borderRadius: "18px 18px 6px 18px" }
                    : { background: "var(--surface2)", color: "var(--ink-2)", borderRadius: "18px 18px 18px 6px" }
                }
              >
                {m.text}
              </span>
            </div>
          ))}

          {sending && <ThinkingPill />}
          {error && (
            <div className="mt-3 flex justify-start">
              <span className="max-w-[85%] rounded-[18px] px-3.5 py-2.5 text-sm" style={{ background: "var(--surface2)", color: "var(--danger)" }}>
                {t.iter.error}
              </span>
            </div>
          )}

          {!isEmpty && greeted && (
            <p className="pt-4 text-center text-[11px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
              {t.iter.disclaimer}
            </p>
          )}
        </div>

        <div className="flex-none px-4 pb-4 pt-2">
          <div className="flex flex-col gap-2.5 rounded-[26px] p-3" style={{ background: "var(--surface2)", border: "1px solid var(--hair)" }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t.iter.ph}
              rows={1}
              className="w-full resize-none bg-transparent px-1.5 py-1 text-sm outline-none"
              style={{ color: "var(--ink)" }}
            />
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={submit}
                disabled={!draft.trim() || sending}
                aria-label={t.iter.send}
                className="grid h-10 w-10 flex-none place-items-center rounded-full disabled:opacity-40"
                style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 14.5V3.5M4.4 8.1 9 3.5l4.6 4.6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
