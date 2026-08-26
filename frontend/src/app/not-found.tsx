export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
        404
      </h1>
      <p className="text-sm" style={{ color: "var(--ink-3)" }}>
        This page does not exist.
      </p>
    </main>
  );
}
