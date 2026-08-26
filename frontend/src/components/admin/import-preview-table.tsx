"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ImportRow } from "@/lib/api/admin";

const STUDENT_FIELDS = ["lastName", "firstName", "patronymic", "birthDate", "className", "email"] as const;
const TEACHER_FIELDS = ["lastName", "firstName", "patronymic", "email", "subject", "classNames"] as const;
const ROW_HEIGHT = 40;

type Filter = "all" | "errors" | "warnings";

// The most important screen in the phase (roadmap ADM-4): maximum contrast,
// zero decoration — the task is finding twelve bad rows in six hundred.
// Row state is an icon AND a border, never colour alone (PRD §11.3).
export function ImportPreviewTable({
  rows,
  kind,
  onCellCommit,
}: {
  rows: ImportRow[];
  kind: "students" | "teachers";
  onCellCommit: (rowIndex: number, field: string, value: string) => Promise<void>;
}) {
  const fields = kind === "students" ? STUDENT_FIELDS : TEACHER_FIELDS;
  const errorCount = rows.filter((r) => r.status === "error").length;
  const warningCount = rows.filter((r) => r.status === "warning").length;
  const [filter, setFilter] = useState<Filter>(errorCount > 0 ? "errors" : "all");

  const filtered = useMemo(() => {
    if (filter === "errors") return rows.filter((r) => r.status === "error");
    if (filter === "warnings") return rows.filter((r) => r.status === "warning");
    return rows;
  }, [rows, filter]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  function issuesFor(row: ImportRow, field: string): string | null {
    const issue = row.issues?.find((i) => i.field === field);
    return issue ? issue.code : null;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-sm">
        {([
          ["all", `All (${rows.length})`],
          ["errors", `Errors (${errorCount})`],
          ["warnings", `Warnings (${warningCount})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="rounded-full border px-3 py-1"
            style={{
              borderColor: filter === key ? "var(--accent)" : "var(--hair)",
              background: filter === key ? "var(--accent)" : "transparent",
              color: filter === key ? "var(--accent-fg)" : "var(--ink-2)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="border border-hair">
        <div className="grid grid-cols-[48px_repeat(auto-fit,minmax(0,1fr))] border-b border-hair text-xs font-medium" style={{ color: "var(--ink-3)" }}>
          <div className="p-2">#</div>
          {fields.map((f) => (
            <div key={f} className="p-2">
              {f}
            </div>
          ))}
        </div>
        <div ref={parentRef} style={{ height: 480, overflow: "auto" }}>
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = filtered[virtualRow.index];
              return (
                <div
                  key={row.rowIndex}
                  className="absolute left-0 top-0 grid w-full grid-cols-[48px_repeat(auto-fit,minmax(0,1fr))] items-center border-b"
                  style={{
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                    borderColor: "var(--hair)",
                    borderLeft: row.status === "error" ? "3px solid var(--danger)" : row.status === "warning" ? "3px solid var(--warning)" : "3px solid transparent",
                  }}
                >
                  <div className="flex items-center gap-1 p-2 text-xs" style={{ color: "var(--ink-3)" }}>
                    {row.status === "error" && <span style={{ color: "var(--danger)" }}>✕</span>}
                    {row.status === "warning" && <span style={{ color: "var(--warning)" }}>!</span>}
                    {row.status === "ok" && <span style={{ color: "var(--ok)" }}>✓</span>}
                    {row.rowIndex}
                  </div>
                  {fields.map((field) => {
                    const issue = issuesFor(row, field);
                    return (
                      <div key={field} className="relative p-0" title={issue ?? undefined}>
                        <input
                          defaultValue={row.raw[field] ?? ""}
                          onBlur={(e) => onCellCommit(row.rowIndex, field, e.target.value)}
                          className="w-full bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-panel"
                          style={{ color: issue ? "var(--danger)" : "var(--ink)" }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
