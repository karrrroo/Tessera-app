"use client";

export function RoutePlaceholder({ title, builtInPhase }: { title: string; builtInPhase: number }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
        {title}
      </h1>
      <p className="text-xs" style={{ color: "var(--ink-3)" }}>
        Built in Phase {builtInPhase} — this is a gating placeholder.
      </p>
    </main>
  );
}
