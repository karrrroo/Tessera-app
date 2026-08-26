// REC-9: every student-reachable screen in this module has designed copy
// for its empty state — never a bare container, never a spinner that just
// never resolves.
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-8 text-center">
      <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
        {title}
      </p>
      <p className="max-w-xs text-xs leading-relaxed" style={{ color: "var(--ink-3)" }}>
        {body}
      </p>
    </div>
  );
}
