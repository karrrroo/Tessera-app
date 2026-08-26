"use client";

import { useState } from "react";
import { adminApi, type Assignment, type SchoolClass, type Subject } from "@/lib/api/admin";

type TeacherRow = { id: string; firstName: string; lastName: string };

// Teachers as rows, classes as columns, subject in the cell — "a readable
// grid, never a list of pairs" (roadmap ADM-5). Pinned first column and
// header row via sticky positioning.
export function AssignmentGrid({
  teachers,
  classes,
  subjects,
  assignments,
  academicYearId,
  onChanged,
}: {
  teachers: TeacherRow[];
  classes: SchoolClass[];
  subjects: Subject[];
  assignments: Assignment[];
  academicYearId: string;
  onChanged: () => void;
}) {
  const [pendingCell, setPendingCell] = useState<string | null>(null);
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const byTeacherAndClass = new Map(assignments.map((a) => [`${a.teacherId}:${a.classId}`, a]));

  async function assign(teacherId: string, classId: string, subjectId: string) {
    const key = `${teacherId}:${classId}`;
    setPendingCell(key);
    try {
      await adminApi.createAssignment({ teacherId, classId, subjectId, academicYearId });
      onChanged();
    } finally {
      setPendingCell(null);
    }
  }

  async function unassign(assignmentId: string) {
    await adminApi.deleteAssignment(assignmentId);
    onChanged();
  }

  const sortedClasses = [...classes].sort((a, b) => a.grade - b.grade || a.letter.localeCompare(b.letter));

  return (
    <div className="overflow-auto border border-hair" style={{ maxHeight: 560 }}>
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th
              className="sticky left-0 top-0 z-20 border-b border-r border-hair p-2 text-left"
              style={{ background: "var(--panel)", color: "var(--ink-3)" }}
            >
              Teacher
            </th>
            {sortedClasses.map((c) => (
              <th
                key={c.id}
                className="sticky top-0 z-10 border-b border-hair p-2 text-center"
                style={{ background: "var(--panel)", color: "var(--ink-3)", minWidth: 90 }}
              >
                {c.grade}-{c.letter}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teachers.map((teacher) => (
            <tr key={teacher.id}>
              <td
                className="sticky left-0 z-10 border-b border-r border-hair p-2 whitespace-nowrap"
                style={{ background: "var(--panel)", color: "var(--ink)" }}
              >
                {teacher.lastName} {teacher.firstName}
              </td>
              {sortedClasses.map((c) => {
                const key = `${teacher.id}:${c.id}`;
                const existing = byTeacherAndClass.get(key);
                return (
                  <td key={c.id} className="border-b border-hair p-1 text-center" style={{ minWidth: 90 }}>
                    {existing ? (
                      <button
                        onClick={() => unassign(existing.id)}
                        title="Click to remove"
                        className="rounded-full border px-2 py-0.5 text-xs"
                        style={{ borderColor: "var(--accent)", color: "var(--ink)" }}
                      >
                        {subjectById.get(existing.subjectId)?.nameHy ?? "?"}
                      </button>
                    ) : (
                      <select
                        value=""
                        disabled={pendingCell === key}
                        onChange={(e) => e.target.value && assign(teacher.id, c.id, e.target.value)}
                        className="w-full bg-transparent text-xs outline-none"
                        style={{ color: "var(--ink-3)" }}
                      >
                        <option value="">—</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nameHy}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
