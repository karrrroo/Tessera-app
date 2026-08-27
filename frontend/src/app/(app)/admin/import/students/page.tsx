"use client";

import { useCurrentAcademicYear } from "@/components/admin/use-current-academic-year";
import { ImportDropzone } from "@/components/admin/import-dropzone";
import { useT } from "@/i18n/locale-provider";

export default function ImportStudentsPage() {
  const t = useT();
  const year = useCurrentAcademicYear();
  if (!year) return null;

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 p-8">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
        {t.admin.importStudents}
      </h1>
      <ImportDropzone kind="students" academicYearId={year.id} />
    </main>
  );
}
