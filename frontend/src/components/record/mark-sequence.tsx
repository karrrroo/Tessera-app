"use client";

import { gradeColorVar } from "@/design/grade-colors";
import type { SubjectMark } from "@/lib/api/record";

// One chip per mark, oldest first (design's `term.items` grid,
// Tessera.dc.html) — a corrected mark gets a small marker that opens
// MarkHistorySheet; REC-8 means that marker is never hidden from the
// student it concerns. No design copy exists for assessment `kind`
// (lesson/test/exam/project) as a label, so a null `title` just shows the
// date alone rather than an invented translation.
export function MarkSequence({ marks, onOpenHistory }: { marks: SubjectMark[]; onOpenHistory: (markId: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {marks.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => m.supersededFrom && onOpenHistory(m.id)}
          disabled={!m.supersededFrom}
          className="flex items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left disabled:cursor-default"
          style={{ background: "var(--surface2)" }}
        >
          <span
            className="grid h-7.5 w-7.5 flex-none place-items-center rounded-lg font-mono text-[13px] font-semibold"
            style={{ background: gradeColorVar(m.value), color: "var(--mark-tile-fg)" }}
          >
            {m.value}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            {m.title && (
              <span className="truncate text-[11.5px]" style={{ color: "var(--ink)" }}>
                {m.title}
              </span>
            )}
            <span className="font-mono text-[10px]" style={{ color: "var(--ink-3)" }}>
              {m.heldOn}
              {m.supersededFrom ? " · ✎" : ""}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
