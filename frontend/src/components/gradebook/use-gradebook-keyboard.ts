"use client";

import { useCallback, useRef, useState } from "react";

const PENDING_ONE_TIMEOUT_MS = 400;

export type GradebookPosition = { row: number; col: number };

// GB-8 — the part that decides adoption. One state machine, not scattered
// handlers, because every rule below interacts with the others (a pending
// "1" has to be resolved before any other key, including a movement key,
// can be processed).
export function useGradebookKeyboard(input: {
  rowCount: number;
  colCount: number;
  onCommit: (pos: GradebookPosition, value: number | null) => void;
  onExit: () => void;
}) {
  const { rowCount, colCount, onCommit, onExit } = input;
  const [focused, setFocused] = useState<GradebookPosition | null>(null);
  const [pendingDigit, setPendingDigit] = useState<{ pos: GradebookPosition; digit: 1 } | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = useCallback(() => {
    if (pendingTimer.current) {
      clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    }
    setPendingDigit(null);
  }, []);

  // Commits whatever "1" is currently waiting, if any, before doing
  // anything else — every other branch below calls this first.
  const flushPending = useCallback(() => {
    if (!pendingDigit) return;
    clearPending();
    onCommit(pendingDigit.pos, 1);
  }, [pendingDigit, clearPending, onCommit]);

  const move = useCallback(
    (pos: GradebookPosition) => {
      const row = Math.max(0, Math.min(rowCount - 1, pos.row));
      const col = Math.max(0, Math.min(colCount - 1, pos.col));
      setFocused({ row, col });
    },
    [rowCount, colCount],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, pos: GradebookPosition) => {
      const { row, col } = pos;

      if (e.key >= "2" && e.key <= "9") {
        flushPending();
        e.preventDefault();
        onCommit(pos, Number(e.key));
        move({ row: row + 1, col });
        return;
      }

      if (e.key === "1") {
        flushPending();
        e.preventDefault();
        clearTimeout(pendingTimer.current ?? undefined);
        pendingTimer.current = setTimeout(() => {
          setPendingDigit(null);
          onCommit(pos, 1);
        }, PENDING_ONE_TIMEOUT_MS);
        setPendingDigit({ pos, digit: 1 });
        return;
      }

      if (e.key === "0" && pendingDigit && pendingDigit.pos.row === row && pendingDigit.pos.col === col) {
        clearPending();
        e.preventDefault();
        onCommit(pos, 10);
        move({ row: row + 1, col });
        return;
      }

      if (e.key === "Backspace") {
        flushPending();
        e.preventDefault();
        onCommit(pos, null);
        return;
      }

      if (e.key === "Escape") {
        flushPending();
        onExit();
        return;
      }

      if (e.key === "Enter" && e.shiftKey) {
        flushPending();
        e.preventDefault();
        move({ row: row - 1, col });
        return;
      }
      if (e.key === "ArrowUp") {
        flushPending();
        e.preventDefault();
        move({ row: row - 1, col });
        return;
      }
      if (e.key === "Enter") {
        flushPending();
        e.preventDefault();
        // At the bottom of a column, wrap to the first student of the
        // next column rather than doing nothing.
        if (row === rowCount - 1) move({ row: 0, col: col + 1 });
        else move({ row: row + 1, col });
        return;
      }
      if (e.key === "ArrowDown") {
        flushPending();
        e.preventDefault();
        move({ row: row + 1, col });
        return;
      }
      if (e.key === "Tab" && e.shiftKey) {
        flushPending();
        e.preventDefault();
        move({ row, col: col - 1 });
        return;
      }
      if (e.key === "ArrowLeft") {
        flushPending();
        e.preventDefault();
        move({ row, col: col - 1 });
        return;
      }
      if (e.key === "Tab") {
        flushPending();
        e.preventDefault();
        move({ row, col: col + 1 });
        return;
      }
      if (e.key === "ArrowRight") {
        flushPending();
        e.preventDefault();
        move({ row, col: col + 1 });
        return;
      }
      if (e.key === "Home") {
        flushPending();
        e.preventDefault();
        move({ row: 0, col });
        return;
      }
      if (e.key === "End") {
        flushPending();
        e.preventDefault();
        move({ row: rowCount - 1, col });
        return;
      }

      // Any other keypress during the 400ms wait commits the pending "1"
      // first, then lets this key fall through unhandled.
      flushPending();
    },
    [pendingDigit, flushPending, clearPending, onCommit, onExit, move, rowCount],
  );

  const focusCell = useCallback((pos: GradebookPosition) => {
    flushPending();
    setFocused(pos);
  }, [flushPending]);

  return { focused, pendingDigit, handleKeyDown, focusCell, setFocused };
}
