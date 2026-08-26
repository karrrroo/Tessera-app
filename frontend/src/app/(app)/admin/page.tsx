import Link from "next/link";
import { SetupChecklist } from "@/components/admin/setup-checklist";

export default function AdminOverviewPage() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
          Administration
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
          What to do next, in order.
        </p>
      </div>
      <SetupChecklist />
      <Link href="/admin/scan-anomalies" className="text-sm underline" style={{ color: "var(--ink-2)" }}>
        Scan anomalies →
      </Link>
    </main>
  );
}
