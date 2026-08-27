import { useT } from "@/i18n/locale-provider";

// The shared "could not load" state (`t.scr.err`) — already translated in
// every locale file (including a "retry" string) but never actually wired
// to a button before this: see `lib/use-async-data.ts` for why five
// separate screens needed this at once.
export function ScreenError({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
        {t.scr.err.title}
      </p>
      <p className="text-xs" style={{ color: "var(--ink-3)" }}>
        {t.scr.err.body}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full px-4 py-2 text-sm"
        style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
      >
        {t.scr.err.retry}
      </button>
    </main>
  );
}
