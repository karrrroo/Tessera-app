"use client";

import { Fragment, useEffect, useRef } from "react";
import type { GradebookAssessment, GradebookMark, GradebookStudent } from "@/lib/api/gradebook";
import { cellKey } from "./draft-store";
import { MarkCell } from "./mark-cell";
import { useGradebookKeyboard, type GradebookPosition } from "./use-gradebook-keyboard";

export type GradebookGridProps = {
  students: GradebookStudent[];
  assessments: GradebookAssessment[];
  marksByCell: Map<string, GradebookMark>;
  displayValue: (studentId: string, assessmentId: string) => number | null;
  onCommit: (studentId: string, assessmentId: string, value: number | null) => void;
  onOpenHistory: (markId: string) => void;
  onRequestCorrection: (markId: string, value: number) => void;
  onAddColumn: () => void;
  onExit: () => void;
  studentLabel: string;
  addColumnLabel: string;
  avgLabel: string;
};

// GB-11: a pinned student-name column and a pinned header row, both via
// `position: sticky` — and a flat `--bg-base` behind the grid, never a
// gradient or glass (brief §5.1).
export function GradebookGrid({
  students,
  assessments,
  marksByCell,
  displayValue,
  onCommit,
  onOpenHistory,
  onRequestCorrection,
  onAddColumn,
  onExit,
  studentLabel,
  addColumnLabel,
  avgLabel,
}: GradebookGridProps) {
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());

  const { focused, pendingDigit, handleKeyDown, focusCell } = useGradebookKeyboard({
    rowCount: students.length,
    colCount: assessments.length,
    onCommit: (pos, value) => {
      const student = students[pos.row];
      const assessment = assessments[pos.col];
      if (student && assessment) onCommit(student.id, assessment.id, value);
    },
    onExit,
  });

  // Never 'center' — centring on every keystroke makes the grid lurch
  // during bulk entry. `focus()` must run here too: `move()` only updates
  // React state (which drives the outline/tabIndex), so without an actual
  // DOM focus transfer every subsequent keystroke keeps firing on whatever
  // cell the user originally clicked, not the cell the state machine thinks
  // is current.
  useEffect(() => {
    if (!focused) return;
    const el = cellRefs.current.get(`${focused.row}:${focused.col}`);
    if (!el || el === document.activeElement) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focused]);

  if (assessments.length === 0) {
    return null;
  }

  return (
    <div className="overflow-auto rounded-[26px] border p-4" style={{ background: "var(--bg-base)", borderColor: "var(--hair)" }}>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `160px repeat(${assessments.length}, 64px) 56px 40px`, minWidth: "max-content" }}>
        <div className="sticky left-0 top-0 z-20 bg-[var(--bg-base)] py-1 text-[10.5px] tracking-[.06em]" style={{ color: "var(--ink-3)" }}>
          {studentLabel}
        </div>
        {assessments.map((a) => (
          <div key={a.id} className="sticky top-0 z-10 grid place-items-center bg-[var(--bg-base)] py-1" title={a.title ?? a.heldOn}>
            <span className="font-mono text-[9.5px]" style={{ color: "var(--ink-3)" }}>
              {a.heldOn.slice(5)}
            </span>
          </div>
        ))}
        <div className="sticky top-0 z-10 bg-[var(--bg-base)] text-right text-[10.5px] tracking-[.06em]" style={{ color: "var(--ink-3)" }}>
          {avgLabel}
        </div>
        <div className="sticky top-0 z-10 bg-[var(--bg-base)]">
          <button
            type="button"
            onClick={onAddColumn}
            title={addColumnLabel}
            aria-label={addColumnLabel}
            className="grid h-[30px] w-[40px] place-items-center rounded-[10px] border border-dashed"
            style={{ borderColor: "var(--hair-bright)", color: "var(--ink-3)" }}
          >
            +
          </button>
        </div>

        {students.map((student, row) => {
          const values = assessments.map((a) => marksByCell.get(cellKey(a.id, student.id))?.value ?? null).filter((v): v is number => v !== null);
          const avg = values.length > 0 ? Math.round((values.reduce((x, y) => x + y, 0) / values.length) * 10) / 10 : null;
          return (
            <Fragment key={student.id}>
              <div
                className="sticky left-0 z-10 truncate bg-[var(--bg-base)] py-1 text-[12.5px]"
                style={{ color: student.enrollmentStatus === "active" ? "var(--ink)" : "var(--ink-3)" }}
              >
                {student.lastName} {student.firstName}
              </div>
              {assessments.map((a, col) => {
                const mark = marksByCell.get(cellKey(a.id, student.id));
                const pos: GradebookPosition = { row, col };
                const isFocused = focused?.row === row && focused?.col === col;
                const isPending = pendingDigit?.pos.row === row && pendingDigit?.pos.col === col;
                return (
                  <MarkCell
                    key={a.id}
                    pos={pos}
                    value={displayValue(student.id, a.id)}
                    pendingValue={isPending ? 1 : null}
                    isDraft={mark?.state === "draft"}
                    isPublished={mark?.state === "published"}
                    hasHistory={mark?.hasHistory ?? false}
                    isFocused={isFocused}
                    onFocus={focusCell}
                    onKeyDown={handleKeyDown}
                    onCorrect={() => mark && onRequestCorrection(mark.id, mark.value)}
                    onHistory={() => mark && onOpenHistory(mark.id)}
                    cellRef={(el) => {
                      if (el) cellRefs.current.set(`${row}:${col}`, el);
                      else cellRefs.current.delete(`${row}:${col}`);
                    }}
                  />
                );
              })}
              <div className="text-right font-mono text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                {avg ?? "—"}
              </div>
              <div />
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
