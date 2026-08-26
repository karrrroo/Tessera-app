"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useT } from "@/i18n/locale-provider";
import { useOnline } from "@/state/online-provider";
import { TesseraQR } from "./tessera-qr";

const DISMISS_THRESHOLD_PX = 80;

// Slides over the lower two thirds (brief §10), swipe/drag the handle down
// to dismiss. No countdown, no progress ring, no refresh affordance, no
// setInterval anywhere in this file or TesseraQR — the code is static
// (ID-4) and has nothing to refresh.
export function QrSheet({ payload, onClose }: { payload: string; onClose: () => void }) {
  const t = useT();
  const online = useOnline();
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    setIsDragging(true);
    startY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!isDragging) return;
    setDragY(Math.max(0, e.clientY - startY.current));
  }
  function onPointerUp() {
    if (isDragging && dragY > DISMISS_THRESHOLD_PX) {
      onClose();
    }
    setIsDragging(false);
    setDragY(0);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end tablet:justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <div
        className="relative flex w-full max-w-[380px] flex-col items-center gap-3.5 rounded-t-[34px] px-5.5 pb-6.5 pt-3 backdrop-blur-2xl tablet:rounded-[34px]"
        style={{
          background: "var(--glass)",
          borderTop: "1px solid var(--hair-top)",
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? "none" : "transform 200ms var(--ease-out)",
        }}
      >
        <button
          type="button"
          aria-label={t.scr.qs.title}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="h-1.5 w-9 flex-none rounded-full opacity-50"
          style={{ background: "var(--ink-3)", touchAction: "none" }}
        />
        <span className="flex-none font-serif text-[17px] font-semibold" style={{ color: "var(--ink)" }}>
          {t.scr.qs.title}
        </span>
        <div className="relative flex-none rounded-[24px] p-11" style={{ background: "var(--qr-card-bg)" }}>
          <div className="h-[220px] w-[220px]">
            <TesseraQR payload={payload} />
          </div>
        </div>
        <p className="max-w-[280px] flex-none text-center text-xs" style={{ color: "var(--ink-3)" }}>
          {t.scr.qs.show2}
        </p>
        {!online && (
          <p className="flex-none text-center text-xs" style={{ color: "var(--ink-3)" }}>
            {t.scr.qs.offline}
          </p>
        )}
      </div>
    </div>
  );
}
