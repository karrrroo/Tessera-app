"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/state/auth-provider";
import { useT } from "@/i18n/locale-provider";
import { Grain } from "@/components/design/grain";
import { IterMark } from "./iter-mark";
import { useIter } from "./iter-provider";
import { useFocusTrap } from "@/lib/use-focus-trap";

// brief-chain/06-corrections-4 §2: two radial blooms, not a rectangle, on
// the panel's own glass — every stop reaches fully transparent well inside
// the panel so there is no edge anywhere, and each bloom drifts
// independently (18s/26s, linear, alternating) by no more than 8% of the
// panel's width. This exact background appears nowhere else in the
// product, so its keyframe names are scoped accordingly.
//
// PERMANENT, and that is the fix. This used to be called
// IterEmptyBackground and was rendered only while `isEmpty` was true, so the
// blooms vanished the instant the first message was posted — the panel lost
// its background as soon as it was used. The gradient belongs to the PANEL,
// not to the empty state and not to a pending state: "the gradient is
// permanent and belongs to the panel."
//
// It sits behind the scrolling message list rather than inside it, so the
// blooms stay put while messages scroll over them; a bloom that scrolled
// with the list would drag its own soft edge across the panel boundary,
// which is the one thing corrections-4 §2 forbids.
function IterPanelBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.55,
          background: "radial-gradient(ellipse 120% 80% at 30% 15%, var(--accent-tint) 0%, transparent 62%)",
          animation: "tessera-iter-drift-a 18s linear infinite alternate",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.4,
          background: "radial-gradient(ellipse 100% 70% at 75% 5%, var(--qr-bloom-1) 0%, transparent 58%)",
          animation: "tessera-iter-drift-b 26s linear infinite alternate",
        }}
      />
      <Grain />
      <style>{`
        @keyframes tessera-iter-drift-a { from { transform: translateX(-4%); } to { transform: translateX(4%); } }
        @keyframes tessera-iter-drift-b { from { transform: translateX(4%); } to { transform: translateX(-4%); } }
      `}</style>
    </div>
  );
}

// IT-9 (brief-chain/04-corrections-2 "THE THINKING RING", superseding
// 01-v2.1-corrections Fix 9): a 2px conic-gradient ring, four colour stops,
// rotating 360° over 2s linear infinite. This rotation must appear nowhere
// else in the product — not on buttons, cards, or inputs (corrections-3)
// — hence the scoped `tessera-iter-` keyframe/property names. Built with a
// ::before carrying the gradient at a negative inset, with the pill's own
// opaque background painting over its centre so only the outer band shows;
// the pill itself is left-aligned and sized like a short message bubble,
// not a fixed box.
function ThinkingPill({ visible }: { visible: boolean }) {
  const [mounted, setMounted] = useState(visible);
  const [exiting, setExiting] = useState(false);

  // Both branches set state directly rather than in a callback — an
  // exit-transition timer, with no external system to hang a callback off,
  // same reasoning as this codebase's other set-state-in-effect exemptions.
  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      setExiting(false);
      return;
    }
    if (!mounted) return;
    setExiting(true);
    const id = setTimeout(() => setMounted(false), 140);
    return () => clearTimeout(id);
  }, [visible, mounted]);

  if (!mounted) return null;

  return (
    <div className="mt-3 flex" style={{ animation: `${exiting ? "tessera-iter-fade-out 140ms" : "tessera-iter-fade-in 180ms"} var(--ease-out) both` }}>
      <div className="tessera-iter-thinking-pill relative flex h-10 items-center gap-1.5 rounded-full px-4" style={{ background: "var(--panel)" }}>
        <span className="h-[5px] w-[5px] rounded-full" style={{ background: "var(--ink-3)", animation: "tessera-iter-dot 1.2s linear infinite" }} />
        <span className="h-[5px] w-[5px] rounded-full" style={{ background: "var(--ink-3)", animation: "tessera-iter-dot 1.2s linear .2s infinite" }} />
        <span className="h-[5px] w-[5px] rounded-full" style={{ background: "var(--ink-3)", animation: "tessera-iter-dot 1.2s linear .4s infinite" }} />
      </div>
      <style>{`
        @property --iter-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
        .tessera-iter-thinking-pill::before {
          content: "";
          position: absolute;
          inset: -2px;
          z-index: -1;
          border-radius: inherit;
          background: conic-gradient(from var(--iter-angle), var(--accent-tint), var(--qr-bloom-1), var(--iter-mid), var(--iter-bloom-1));
          animation: tessera-iter-spin 2s linear infinite;
        }
        @keyframes tessera-iter-spin { to { --iter-angle: 360deg; } }
        @keyframes tessera-iter-dot { 0%, 100% { opacity: .3; } 50% { opacity: 1; } }
        @keyframes tessera-iter-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tessera-iter-fade-out { from { opacity: 1; } to { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .tessera-iter-thinking-pill::before { animation: none; }
          .tessera-iter-thinking-pill span { animation: none !important; opacity: .6; }
        }
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
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, sending]);

  // Every sibling sheet (mark-history-sheet.tsx, qr-sheet.tsx,
  // cell-history-sheet.tsx) closes on Escape; this one never did.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closePanel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closePanel]);

  if (!open || !user) return null;

  const isEmpty = messages.length === 0 && !sending;
  const chips = user.role === "teacher" ? t.iter.tChips : user.role === "admin" ? t.iter.aChips : t.iter.sChips;
  const firstName = (user.firstName ?? "").trim();
  // A real bug, found live: admin accounts have no firstName/lastName at
  // all (those live on the student/teacher sub-tables only), so this fell
  // back to a *hardcoded* "Student" for every nameless user regardless of
  // role — an admin opening Iter was greeted "Hello, Student." Falls back
  // to a role-correct label instead.
  const roleFallback = user.role === "teacher" ? t.common.roleTeacher : user.role === "admin" ? t.common.roleAdmin : t.common.roleStudent;

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
    <div className="fixed inset-0 z-[100] flex items-end justify-center tablet:items-stretch tablet:justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45 tablet:hidden" onClick={closePanel} aria-hidden />
      <div
        ref={panelRef}
        className="relative flex h-[92%] w-full flex-col rounded-t-[34px] border-t tablet:h-full tablet:w-[420px] tablet:rounded-none tablet:border-l tablet:border-t-0"
        style={{
          background: "var(--glass)",
          backdropFilter: "blur(22px) saturate(160%)",
          WebkitBackdropFilter: "blur(22px) saturate(160%)",
          borderColor: "var(--hair-bright)",
          boxShadow: "inset 0 1px 0 var(--hair-top)",
        }}
      >
        <IterPanelBackground />
        <div className="relative flex justify-center pb-0.5 pt-2.5 tablet:hidden">
          <button type="button" onClick={closePanel} aria-label={t.iter.close} className="h-1.5 w-9 rounded-full" style={{ background: "var(--ink-3)", opacity: 0.5 }} />
        </div>
        <div className="relative flex h-14 flex-none items-center gap-2.5 px-4.5">
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

        <div ref={listRef} className="relative flex flex-1 flex-col overflow-y-auto px-4.5 pb-3.5">
          {isEmpty && (
            <div className="relative flex flex-1 flex-col items-center justify-center gap-4.5 py-5">
              <span className="relative" style={{ color: "var(--iter-fg)" }}>
                <IterMark size={40} />
              </span>
              <div className="relative flex flex-col items-center gap-1 text-center">
                <span className="font-serif text-xl font-semibold" style={{ color: "var(--iter-fg)" }}>
                  {t.iter.hi}
                  {firstName || roleFallback}
                </span>
                <span className="text-sm" style={{ color: "var(--iter-fg)" }}>
                  {t.iter.line2}
                </span>
              </div>
              <div className="relative flex w-full flex-col gap-2">
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

          <ThinkingPill visible={sending} />
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

        <div className="relative flex-none px-4 pb-4 pt-2">
          {/* No border and no second background: the input sits on the
              panel's own surface (see .iter-composer in tessera.css, which
              carries the focus state that replaces the border as the
              affordance). */}
          <div className="iter-composer flex flex-col gap-2.5 p-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t.iter.ph}
              rows={1}
              className="w-full resize-none bg-transparent px-1.5 py-1 text-sm"
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
