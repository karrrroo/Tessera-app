"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api/client";
import { useLocale, interpolate } from "@/i18n/locale-provider";

type Session = { id: string; deviceLabel: string; lastSeenAt: string; createdAt: string; current: boolean };

async function fetchSessions(): Promise<Session[]> {
  return apiJson<Session[]>("/api/auth/sessions");
}

export function SessionList() {
  const { t } = useLocale();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSessions().then((rows) => {
      if (!cancelled) setSessions(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function revoke(id: string) {
    setBusyId(id);
    try {
      await apiJson(`/api/auth/sessions/${id}`, { method: "DELETE" });
      setSessions(await fetchSessions());
    } finally {
      setBusyId(null);
    }
  }

  async function revokeAllOthers() {
    setBusyId("*");
    try {
      await apiJson("/api/auth/sessions", { method: "DELETE" });
      setSessions(await fetchSessions());
    } finally {
      setBusyId(null);
    }
  }

  if (!sessions) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t.set.sessTitle}</h2>
      <ul className="space-y-2">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
            <div>
              <p className="text-sm font-medium">
                {s.deviceLabel} {s.current && <span className="text-gray-400">({t.set.sessThis})</span>}
              </p>
              <p className="font-mono text-xs text-gray-400">{interpolate(t.set.lastSeen, { when: s.lastSeenAt })}</p>
            </div>
            {!s.current && (
              <button
                onClick={() => revoke(s.id)}
                disabled={busyId === s.id}
                className="text-xs text-red-600 disabled:opacity-50"
              >
                {t.set.sessRevoke}
              </button>
            )}
          </li>
        ))}
      </ul>
      <button onClick={revokeAllOthers} disabled={busyId === "*"} className="text-xs underline disabled:opacity-50">
        {t.set.sessAll}
      </button>
    </section>
  );
}
