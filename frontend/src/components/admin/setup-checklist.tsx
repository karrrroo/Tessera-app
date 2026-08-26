"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/api/admin";

type ChecklistItem = { label: string; href: string; done: boolean; detail: string };

// Full token layer, no glass, no gradient, no grain, higher density (C13 —
// none of these screens exist in the design package).
export function SetupChecklist() {
  const [items, setItems] = useState<ChecklistItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [institution, years, subjects] = await Promise.all([
        adminApi.getInstitution(),
        adminApi.listAcademicYears(),
        adminApi.listSubjects(),
      ]);
      const latestYear = [...years].sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0];
      const [classes, roster] = await Promise.all([
        latestYear ? adminApi.listClasses(latestYear.id) : Promise.resolve([]),
        latestYear ? adminApi.listRoster({}) : Promise.resolve([]),
      ]);
      const assignments = latestYear ? await adminApi.listAssignments(latestYear.id) : [];

      if (cancelled) return;
      setItems([
        { label: "Institution", href: "/admin/institution", done: Boolean(institution?.name), detail: institution?.name ?? "not set" },
        { label: "Academic year and terms", href: "/admin/years", done: years.length > 0, detail: `${years.length} year(s)` },
        { label: "Subjects", href: "/admin/subjects", done: subjects.length > 0, detail: `${subjects.length} subject(s)` },
        { label: "Classes", href: "/admin/classes", done: classes.length > 0, detail: `${classes.length} class(es)` },
        { label: "Student roster", href: "/admin/import/students", done: roster.length > 0, detail: `${roster.length} student(s)` },
        { label: "Teacher assignments", href: "/admin/assignments", done: assignments.length > 0, detail: `${assignments.length} assignment(s)` },
      ]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!items) return null;

  return (
    <ul className="max-w-xl divide-y divide-hair border border-hair">
      {items.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className="flex items-center justify-between px-4 py-3 hover:bg-panel">
            <div className="flex items-center gap-3">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[11px]"
                style={{
                  background: item.done ? "var(--ok)" : "transparent",
                  border: item.done ? "none" : "1px solid var(--hair-bright)",
                  color: item.done ? "var(--ok-fg)" : "var(--ink-3)",
                }}
              >
                {item.done ? "✓" : ""}
              </span>
              <span style={{ color: "var(--ink)" }}>{item.label}</span>
            </div>
            <span className="text-xs" style={{ color: "var(--ink-3)" }}>
              {item.detail}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
