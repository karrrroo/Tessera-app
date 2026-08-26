"use client";

import type { GradebookAssessment, GradebookMark, GradebookStudent } from "@/lib/api/gradebook";
import { cellKey } from "./draft-store";

export type MobileStudentListProps = {
  students: GradebookStudent[];
  assessments: GradebookAssessment[];
  marksByCell: Map<string, GradebookMark>;
  displayValue: (studentId: string, assessmentId: string) => number | null;
  onOpenStudent: (studentId: string) => void;
  listHint: string;
  avgLabel: string;
};

// GB-12: below 768px the grid becomes a per-student list; tapping a row
// opens that student's marks as a bottom sheet (StudentMarksSheet). Same
// students/assessments/marksByCell/displayValue the desktop grid uses —
// this is a different view onto identical state, not a second gradebook.
export function MobileStudentList({ students, assessments, marksByCell, displayValue, onOpenStudent, listHint, avgLabel }: MobileStudentListProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>
        {listHint}
      </p>
      <div className="flex flex-col gap-1.5">
        {students.map((student) => {
          const values = assessments
            .map((a) => marksByCell.get(cellKey(a.id, student.id))?.value ?? displayValue(student.id, a.id))
            .filter((v): v is number => v !== null);
          const avg = values.length > 0 ? Math.round((values.reduce((x, y) => x + y, 0) / values.length) * 10) / 10 : null;
          const draftCount = assessments.filter((a) => marksByCell.get(cellKey(a.id, student.id))?.state === "draft").length;
          return (
            <button
              key={student.id}
              type="button"
              onClick={() => onOpenStudent(student.id)}
              className="flex min-h-[52px] items-center gap-3 rounded-2xl border px-3.5 py-2 text-left"
              style={{ borderColor: "var(--hair)", background: "var(--surface)" }}
            >
              <span className="flex-1 truncate text-[13px]" style={{ color: student.enrollmentStatus === "active" ? "var(--ink)" : "var(--ink-3)" }}>
                {student.lastName} {student.firstName}
              </span>
              {draftCount > 0 && (
                <span className="flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--hair-bright)", color: "var(--ink-2)" }}>
                  {draftCount}
                </span>
              )}
              <span className="flex-none text-right font-mono text-[13px] font-semibold" style={{ color: "var(--ink)" }} title={avgLabel}>
                {avg ?? "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
