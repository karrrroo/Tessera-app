"use client";

import { useCurrentAcademicYear } from "@/components/admin/use-current-academic-year";
import { ImportDropzone } from "@/components/admin/import-dropzone";

export default function ImportStudentsPage() {
  const year = useCurrentAcademicYear();
  if (!year) return null;

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 p-8">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
        Import students
      </h1>
      <ImportDropzone kind="students" academicYearId={year.id} />
    </main>
  );
}
