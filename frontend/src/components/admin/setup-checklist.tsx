"use client";

import Link from "next/link";
import { adminApi } from "@/lib/api/admin";
import { useLocale } from "@/i18n/locale-provider";
import { pluralize, type PluralForms } from "@/i18n/plural";
import { useAsyncData } from "@/lib/use-async-data";
import { ScreenError } from "@/components/record/screen-error";

type ChecklistItem = { labelKey: "institution" | "years" | "subjects" | "classes" | "roster" | "assignments"; href: string; done: boolean; detail: string };

// Full token layer, no glass, no gradient, no grain, higher density (C13 —
// none of these screens exist in the design package, so none of this copy
// does either — see docs/decisions.md for the translations added here).
export function SetupChecklist() {
  const { t, locale } = useLocale();

  async function load(): Promise<ChecklistItem[]> {
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

    return [
      { labelKey: "institution", href: "/admin/institution", done: Boolean(institution?.name), detail: institution?.name ?? t.admin.notSet },
      { labelKey: "years", href: "/admin/years", done: years.length > 0, detail: pluralize(locale, years.length, t.admin.yearsCount as PluralForms) },
      { labelKey: "subjects", href: "/admin/subjects", done: subjects.length > 0, detail: pluralize(locale, subjects.length, t.admin.subjectsCount as PluralForms) },
      { labelKey: "classes", href: "/admin/classes", done: classes.length > 0, detail: pluralize(locale, classes.length, t.admin.classesCount as PluralForms) },
      { labelKey: "roster", href: "/admin/import/students", done: roster.length > 0, detail: pluralize(locale, roster.length, t.admin.studentsCount as PluralForms) },
      { labelKey: "assignments", href: "/admin/assignments", done: assignments.length > 0, detail: pluralize(locale, assignments.length, t.admin.assignmentsCount as PluralForms) },
    ];
  }

  // A real gap, found while wiring this up (not one of the confirmed-live
  // "Mistakes and errors" — the sequence of Promise.alls above had no
  // `.catch()` at all, the same repeated pattern fixed elsewhere this
  // session): any of the six admin API calls failing left this permanently
  // blank with no indication anything had gone wrong.
  const { data: items, error, retry } = useAsyncData(load, [locale]);

  if (error) return <ScreenError onRetry={retry} />;
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
              <span style={{ color: "var(--ink)" }}>{t.admin[item.labelKey]}</span>
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
