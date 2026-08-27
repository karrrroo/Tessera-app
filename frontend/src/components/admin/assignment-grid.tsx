"use client";

import { useState } from "react";
import { adminApi, type Assignment, type SchoolClass, type Subject } from "@/lib/api/admin";
import { useLocale, useT } from "@/i18n/locale-provider";

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
  const t = useT();
  const { locale } = useLocale();
  const [pendingCell, setPendingCell] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const byTeacherAndClass = new Map(assignments.map((a) => [`${a.teacherId}:${a.classId}`, a]));
  // A real bug, found while localizing this screen: every subject name
  // rendered from its `nameHy` field regardless of UI locale.
  const subjectName = (s: Subject) => (locale === "hy" ? s.nameHy : locale === "ru" ? s.nameRu : s.nameEn);

  async function assign(teacherId: string, classId: string, subjectId: string) {
    const key = `${teacherId}:${classId}`;
    setPendingCell(key);
    setError(false);
    try {
      await adminApi.createAssignment({ teacherId, classId, subjectId, academicYearId });
      onChanged();
    } catch {
      // A real bug, found live: a duplicate (class+subject+year) assignment
      // threw an uncaught ApiRequestError with zero UI feedback — the cell
      // just silently reset. (The backend itself also returned the wrong
      // status for this — see pg-errors.ts's DrizzleQueryError unwrap fix —
      // but the cell needs to surface *some* error regardless of which
      // status comes back.)
      setError(true);
    } finally {
      setPendingCell(null);
    }
  }

  async function unassign(assignmentId: string) {
    try {
      await adminApi.deleteAssignment(assignmentId);
      onChanged();
    } catch {
      setError(true);
    }
  }

  const sortedClasses = [...classes].sort((a, b) => a.grade - b.grade || a.letter.localeCompare(b.letter));

  return (
    <div className="space-y-2">
      {error && (
        <div className="flex items-center justify-between rounded-md border p-2 text-xs" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          <span>{t.scr.err.body}</span>
          <button type="button" onClick={() => setError(false)} className="underline">
            {t.scr.err.retry}
          </button>
        </div>
      )}
      <div className="overflow-auto border border-hair" style={{ maxHeight: 560, background: "var(--bg-base)" }}>
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th
              className="sticky left-0 top-0 z-20 border-b border-r border-hair p-2 text-left"
              style={{ background: "var(--panel)", color: "var(--ink-3)" }}
            >
              {t.admin.colTeacher}
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
                        title={t.admin.removeAssignment}
                        className="rounded-full border px-2 py-0.5 text-xs"
                        style={{ borderColor: "var(--accent)", color: "var(--ink)" }}
                      >
                        {(() => {
                          const s = subjectById.get(existing.subjectId);
                          return s ? subjectName(s) : "?";
                        })()}
                      </button>
                    ) : (
                      <select
                        value=""
                        disabled={pendingCell === key}
                        onChange={(e) => e.target.value && assign(teacher.id, c.id, e.target.value)}
                        className="w-full text-xs outline-none"
                        // Same native-popup fix as review-queue.tsx and
                        // roster's Transfer modal — this was the worst of
                        // the three (bg-transparent + 48%-opacity ink-3).
                        style={{ background: "var(--surface2)", color: "var(--ink)" }}
                      >
                        <option value="">—</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {subjectName(s)}
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
    </div>
  );
}
