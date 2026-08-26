"use client";

import type { Term } from "@/lib/api/record";

export function TermSwitcher({ terms, activeTermId, onChange }: { terms: Term[]; activeTermId: string; onChange: (termId: string) => void }) {
  if (terms.length <= 1) return null;

  return (
    <div className="flex gap-1.5">
      {terms.map((term) => {
        const active = term.id === activeTermId;
        return (
          <button
            key={term.id}
            type="button"
            onClick={() => onChange(term.id)}
            className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: active ? "var(--accent)" : "transparent",
              color: active ? "var(--accent-fg)" : "var(--ink-2)",
              border: active ? "none" : "1px solid var(--hair)",
            }}
          >
            {term.label}
          </button>
        );
      })}
    </div>
  );
}
