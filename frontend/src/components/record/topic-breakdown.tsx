import { gradeColorVar } from "@/design/grade-colors";
import type { SubjectDetailResponse } from "@/lib/api/record";

// Renders nothing when empty (REC-10) — not a "no data" card. The subject
// detail view stands on its own without it; a missing section reads as
// "this subject doesn't break down by topic," not as something broken.
export function TopicBreakdown({ breakdown }: { breakdown: SubjectDetailResponse["topicBreakdown"] }) {
  if (breakdown.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {breakdown.map((t) => (
        <div key={t.topic} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="text-xs leading-snug" style={{ color: "var(--ink)" }}>
              {t.topic}
            </span>
            <span className="flex-none font-mono text-[11.5px]" style={{ color: t.average === null ? "var(--ink-3)" : gradeColorVar(t.average) }}>
              {t.average ?? "—"}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-sm" style={{ background: "var(--surface2)" }}>
            <div
              className="h-full rounded-sm"
              style={{
                width: `${((t.average ?? 0) / 10) * 100}%`,
                background: t.average === null ? "var(--ink-3)" : gradeColorVar(t.average),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
