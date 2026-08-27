"use client";

import { useState } from "react";
import { gradeColorVar } from "@/design/grade-colors";
import type { GradebookAssessment, GradebookMark, GradebookStudent } from "@/lib/api/gradebook";
import { cellKey } from "./draft-store";

export type StudentMarksSheetProps = {
  student: GradebookStudent;
  assessments: GradebookAssessment[];
  marksByCell: Map<string, GradebookMark>;
  displayValue: (studentId: string, assessmentId: string) => number | null;
  onCommit: (studentId: string, assessmentId: string, value: number | null) => void;
  onOpenHistory: (markId: string) => void;
  onRequestCorrection: (markId: string, value: number) => void;
  onAddColumn: () => void;
  onExit: () => void;
  onClose: () => void;
  addColumnLabel: string;
  closeLabel: string;
  historyLabel: string;
};

// GB-12's bottom sheet, opened from MobileStudentList. GB-9: the tap
// picker is primary on mobile, so every row edits through the same
// picker the desktop SupersedeDialog uses, not the keyboard state
// machine — but onCommit/onAddColumn/onExit are the exact same
// callbacks the desktop grid calls, so a draft entered here and one
// entered on the desktop grid are indistinguishable to the backend.
export function StudentMarksSheet({
  student,
  assessments,
  marksByCell,
  displayValue,
  onCommit,
  onOpenHistory,
  onRequestCorrection,
  onAddColumn,
  onExit,
  onClose,
  addColumnLabel,
  closeLabel,
  historyLabel,
}: StudentMarksSheetProps) {
  const [pickingId, setPickingId] = useState<string | null>(null);

  function close() {
    onExit(); // GB-10: closing before the newly-added column got any mark removes it, same as Escape on desktop
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center tablet:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45" onClick={close} aria-hidden />
      <div
        className="relative flex max-h-[85vh] w-full max-w-[420px] flex-col gap-3 overflow-y-auto rounded-t-[34px] p-6 tablet:rounded-[34px]"
        style={{ background: "var(--panel)", border: "1px solid var(--hair)" }}
      >
        <h2 className="font-serif text-base font-semibold" style={{ color: "var(--ink)" }}>
          {student.lastName} {student.firstName}
        </h2>

        <div className="flex flex-col gap-2">
          {assessments.map((a) => {
            const mark = marksByCell.get(cellKey(a.id, student.id));
            const value = displayValue(student.id, a.id);
            const isPublished = mark?.state === "published";
            const isPicking = pickingId === a.id;

            return (
              <div key={a.id} className="flex flex-col gap-1.5 rounded-2xl p-3" style={{ background: "var(--surface2)" }}>
                <div className="flex items-center gap-2.5">
                  <span className="flex-1 text-[12px]" style={{ color: "var(--ink-2)" }}>
                    {a.title ?? a.heldOn}
                  </span>
                  {mark?.hasHistory && (
                    <button
                      type="button"
                      aria-label={historyLabel}
                      onClick={() => onOpenHistory(mark.id)}
                      className="text-[11px]"
                      style={{ color: "var(--ink-3)" }}
                    >
                      ✎
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (isPublished && mark) onRequestCorrection(mark.id, mark.value);
                      else setPickingId(isPicking ? null : a.id);
                    }}
                    className="grid h-9 w-9 flex-none place-items-center rounded-[10px] font-mono text-[13px] font-semibold"
                    style={{ background: value === null ? "var(--surface2)" : gradeColorVar(value), color: "var(--mark-tile-fg)", opacity: mark?.state === "draft" ? 0.72 : 1 }}
                  >
                    {value ?? ""}
                  </button>
                </div>
                {isPicking && !isPublished && (
                  <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          onCommit(student.id, a.id, v);
                          setPickingId(null);
                        }}
                        className="grid h-9 w-9 place-items-center rounded-[10px] font-mono text-[12.5px] font-semibold"
                        style={{ background: gradeColorVar(v), color: "var(--mark-tile-fg)" }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onAddColumn}
          className="rounded-2xl border border-dashed px-4 py-2.5 text-sm"
          style={{ borderColor: "var(--hair-bright)", color: "var(--ink-3)" }}
        >
          {addColumnLabel}
        </button>

        <button type="button" onClick={close} className="rounded-full px-4 py-2 text-sm" style={{ color: "var(--ink-2)" }}>
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
