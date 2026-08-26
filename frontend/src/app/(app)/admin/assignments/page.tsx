"use client";

import { useEffect, useState } from "react";
import { adminApi, type Assignment, type SchoolClass, type Subject } from "@/lib/api/admin";
import { useCurrentAcademicYear } from "@/components/admin/use-current-academic-year";
import { AssignmentGrid } from "@/components/admin/assignment-grid";

export default function AssignmentsPage() {
  const year = useCurrentAcademicYear();
  const [teachers, setTeachers] = useState<{ id: string; firstName: string; lastName: string }[] | null>(null);
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);

  async function reload(yearId: string) {
    const [t, c, s, a] = await Promise.all([
      adminApi.listTeachers(),
      adminApi.listClasses(yearId),
      adminApi.listSubjects(),
      adminApi.listAssignments(yearId),
    ]);
    setTeachers(t);
    setClasses(c);
    setSubjects(s);
    setAssignments(a);
  }

  useEffect(() => {
    // Standard fetch-on-year-change — reload() is also reused by the
    // grid's onChanged callback, so it can't be inlined without
    // duplicating it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (year) reload(year.id);
  }, [year]);

  if (year === undefined) return null;
  if (year === null) {
    return (
      <main className="p-8 text-sm" style={{ color: "var(--ink-3)" }}>
        Create an academic year first.
      </main>
    );
  }
  if (!teachers || !classes || !subjects || !assignments) return null;

  return (
    <main className="w-full space-y-4 p-8">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
        Teacher assignments — {year.label}
      </h1>
      {teachers.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ink-3)" }}>
          No teachers yet — import some first.
        </p>
      ) : (
        <AssignmentGrid
          teachers={teachers}
          classes={classes}
          subjects={subjects}
          assignments={assignments}
          academicYearId={year.id}
          onChanged={() => reload(year.id)}
        />
      )}
    </main>
  );
}
