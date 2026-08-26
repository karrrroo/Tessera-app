"use client";

import { memo } from "react";
import { gradeColorVar } from "@/design/grade-colors";
import type { GradebookPosition } from "./use-gradebook-keyboard";

type MarkCellProps = {
  pos: GradebookPosition;
  value: number | null;
  pendingValue: 1 | null;
  isDraft: boolean;
  isPublished: boolean;
  hasHistory: boolean;
  isFocused: boolean;
  onFocus: (pos: GradebookPosition) => void;
  onKeyDown: (e: React.KeyboardEvent, pos: GradebookPosition) => void;
  onCorrect?: (pos: GradebookPosition) => void;
  onHistory?: (pos: GradebookPosition) => void;
  cellRef?: (el: HTMLButtonElement | null) => void;
};

// React.memo'd on (value, state, isFocused) per the roadmap's own explicit
// instruction — a 30x20 grid re-renders 600 cells per keypress without
// this, and the 50ms latency budget is unreachable if it does. No context
// read in here either; everything arrives as props from one subscribing
// parent row.
export const MarkCell = memo(
  function MarkCell({ pos, value, pendingValue, isDraft, isPublished, hasHistory, isFocused, onFocus, onKeyDown, onCorrect, onHistory, cellRef }: MarkCellProps) {
    const displayValue = pendingValue ?? value;
    const bg = displayValue === null ? "var(--surface2)" : gradeColorVar(displayValue);

    return (
      <button
        ref={cellRef}
        type="button"
        role="gridcell"
        tabIndex={isFocused ? 0 : -1}
        data-row={pos.row}
        data-col={pos.col}
        onFocus={() => onFocus(pos)}
        onClick={(e) => {
          // GB-6: a published cell offers correction, not editing.
          if (isPublished && onCorrect) onCorrect(pos);
          e.currentTarget.focus();
        }}
        onKeyDown={(e) => onKeyDown(e, pos)}
        inputMode="numeric"
        className="relative grid h-[34px] w-full place-items-center rounded-[10px] font-mono text-[12.5px] font-semibold outline-none"
        style={{
          background: bg,
          color: "var(--mark-tile-fg)",
          opacity: pendingValue !== null ? 0.55 : isDraft ? 0.72 : 1,
          outline: isFocused ? "2px solid var(--accent)" : "none",
          outlineOffset: -2,
          transition: "background 200ms linear, opacity 120ms linear",
        }}
      >
        {displayValue ?? ""}
        {hasHistory && (
          <span
            role="button"
            aria-label="history"
            onClick={(e) => {
              e.stopPropagation();
              onHistory?.(pos);
            }}
            className="absolute right-0.5 top-0.5 text-[7px] leading-none"
            style={{ color: "var(--mark-tile-fg)" }}
          >
            ✎
          </span>
        )}
      </button>
    );
  },
  (prev, next) =>
    prev.pos.row === next.pos.row &&
    prev.pos.col === next.pos.col &&
    prev.value === next.value &&
    prev.pendingValue === next.pendingValue &&
    prev.isDraft === next.isDraft &&
    prev.isPublished === next.isPublished &&
    prev.hasHistory === next.hasHistory &&
    prev.isFocused === next.isFocused,
);
