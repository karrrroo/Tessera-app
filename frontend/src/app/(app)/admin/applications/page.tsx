"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi, type AdminApplication } from "@/lib/api/admin";
import { useT } from "@/i18n/locale-provider";
import { useAsyncData } from "@/lib/use-async-data";
import { ScreenError } from "@/components/record/screen-error";

// B5 — the admissions queue. Pending first, oldest first (the backend orders
// it; a queue about children that sorts newest-first buries whoever has been
// waiting longest).
//
// Flat --bg-base on every panel that shows applicant data, not glass: this is
// a data-dense admin screen, and tessera-v2-FINAL's rule is "never behind the
// gradebook, mosaic, tables or analytics". The ambient gradient behind the
// admin shell stays where it is; these surfaces paint over it.

type Tab = "pending" | "approved" | "rejected";

const SCHOOL_KEY: Record<string, "schoolMain" | "schoolNorth" | "schoolSouth" | "schoolRegional"> = {
  main: "schoolMain",
  north: "schoolNorth",
  south: "schoolSouth",
  regional: "schoolRegional",
};
const STREAM_KEY: Record<string, "streamGeneral" | "streamScience" | "streamHumanities" | "streamLanguages"> = {
  general: "streamGeneral",
  science: "streamScience",
  humanities: "streamHumanities",
  languages: "streamLanguages",
};

export default function AdminApplicationsPage() {
  const t = useT();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const { data, error, retry } = useAsyncData<AdminApplication[]>(() => adminApi.listApplications(tab), [tab]);

  if (error) return <ScreenError onRetry={retry} />;

  const rows = data ?? [];

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setActionError(false);
    try {
      await fn();
      retry();
    } catch {
      setActionError(true);
    } finally {
      setBusyId(null);
    }
  }

  async function approve(row: AdminApplication) {
    setBusyId(row.id);
    setActionError(false);
    try {
      const result = await adminApi.approveApplication(row.id);
      // B5: approve does not create the account — it opens the EXISTING
      // account-creation form, prefilled. Nothing has been created at this
      // point and the form is where a human decides.
      const params = new URLSearchParams({
        firstName: result.prefill.firstName,
        lastName: result.prefill.lastName,
        birthDate: result.prefill.birthDate ?? "",
        email: result.prefill.email,
      });
      router.push(`/admin/students/new?${params.toString()}`);
    } catch {
      setActionError(true);
      setBusyId(null);
    }
  }

  const panel = {
    borderColor: "var(--hair)",
    background: "var(--bg-base)",
  } as const;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
          {t.admin.apps.title}
        </h1>
      </header>

      <div className="flex gap-1.5" role="tablist">
        {(["pending", "approved", "rejected"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => {
              setTab(k);
              setRejecting(null);
            }}
            className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
            style={{
              background: tab === k ? "var(--accent)" : "transparent",
              color: tab === k ? "var(--accent-fg)" : "var(--ink-2)",
              border: tab === k ? "none" : "1px solid var(--hair)",
            }}
          >
            {k === "pending" ? t.admin.apps.pending : k === "approved" ? t.admin.apps.approved : t.admin.apps.rejected}
          </button>
        ))}
      </div>

      {actionError && (
        <p className="text-sm" style={{ color: "var(--danger)" }} role="alert">
          {t.admin.apps.actionError}
        </p>
      )}

      {data && rows.length === 0 && (
        <p className="rounded-2xl border p-4 text-sm" style={{ ...panel, color: "var(--ink-2)" }}>
          {t.admin.apps.none}
        </p>
      )}

      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="space-y-3 rounded-2xl border p-4" style={panel}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              {/* Applicant names are shown exactly as submitted, never
                  transliterated: an applicant is not yet a student of this
                  school, and their own spelling of their name is the only
                  authority there is for it. */}
              <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                {row.firstName} {row.lastName}
              </span>
              <span className="text-xs" style={{ color: "var(--ink-2)" }}>
                {t.admin.apps.submitted}: {new Date(row.createdAt).toLocaleDateString()}
              </span>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-[12.5px] tablet:grid-cols-2">
              {(
                [
                  [t.apply.birthDate, row.birthDate],
                  [t.apply.email, row.email],
                  [t.apply.phone, row.phone ?? "—"],
                  [t.apply.school, t.apply[SCHOOL_KEY[row.schoolChoice] ?? "schoolMain"]],
                  [t.apply.stream, t.apply[STREAM_KEY[row.streamChoice] ?? "streamGeneral"]],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt style={{ color: "var(--ink-2)" }}>{k}</dt>
                  <dd className="truncate" style={{ color: "var(--ink)" }}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>

            {row.motivation && (
              <div>
                <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--ink-2)" }}>
                  {t.apply.motivation}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed" style={{ color: "var(--ink)" }}>
                  {row.motivation}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {row.transcriptToken ? (
                <button
                  type="button"
                  onClick={() => run(row.id, () => adminApi.downloadTranscript(row.transcriptToken as string))}
                  disabled={busyId === row.id}
                  className="rounded-full border px-3 py-1 text-xs disabled:opacity-50"
                  style={{ borderColor: "var(--hair)", color: "var(--ink-2)" }}
                >
                  {t.admin.apps.transcript}
                </button>
              ) : (
                <span className="text-xs" style={{ color: "var(--ink-2)" }}>
                  {t.admin.apps.noTranscript}
                </span>
              )}

              {row.status === "pending" && (
                <>
                  <button
                    type="button"
                    onClick={() => approve(row)}
                    disabled={busyId === row.id}
                    className="rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
                  >
                    {t.admin.apps.approve}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejecting(rejecting === row.id ? null : row.id);
                      setReason("");
                    }}
                    disabled={busyId === row.id}
                    className="rounded-full border px-3 py-1 text-xs disabled:opacity-50"
                    style={{ borderColor: "var(--hair)", color: "var(--ink-2)" }}
                  >
                    {t.admin.apps.reject}
                  </button>
                </>
              )}

              {/* B6: rejected applications are hard-deletable in one action,
                  including the stored file. Offered only once a decision
                  exists, so a pending application about a child cannot be
                  destroyed before anyone has looked at it. */}
              {row.status !== "pending" && (
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(t.admin.apps.confirmDelete)) return;
                    void run(row.id, () => adminApi.deleteApplication(row.id));
                  }}
                  disabled={busyId === row.id}
                  className="rounded-full border px-3 py-1 text-xs disabled:opacity-50"
                  style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
                >
                  {t.admin.apps.delete}
                </button>
              )}
            </div>

            {rejecting === row.id && (
              <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "var(--hair)" }}>
                <label className="block text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                  {t.admin.apps.reason}
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    className="mt-1 w-full resize-none rounded-xl border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--hair)", background: "var(--surface2)", color: "var(--ink)" }}
                  />
                </label>
                <p className="text-[11px]" style={{ color: "var(--ink-2)" }}>
                  {t.admin.apps.reasonHint}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    run(row.id, async () => {
                      await adminApi.rejectApplication(row.id, reason.trim() || undefined);
                      setRejecting(null);
                    })
                  }
                  disabled={busyId === row.id}
                  className="rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50"
                  style={{ background: "var(--danger)", color: "var(--accent-fg)" }}
                >
                  {t.admin.apps.reject}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
