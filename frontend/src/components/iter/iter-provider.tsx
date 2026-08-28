"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/state/auth-provider";
import { usePathname } from "next/navigation";
import { iterApi, iterHistoryApi } from "@/lib/api/iter";
import { ApiRequestError } from "@/lib/api/client";
import { loadMessages, saveMessages, type IterMessage } from "./iter-store";

type IterContextValue = {
  open: boolean;
  messages: IterMessage[];
  sending: boolean;
  error: string | null;
  greeted: boolean;
  openPanel: () => void;
  closePanel: () => void;
  send: (text: string) => Promise<void>;
};

const IterContext = createContext<IterContextValue | undefined>(undefined);

// Greeting fires once per browser session, not once per panel open (IT-5) —
// a module-level set survives closing/reopening the panel without
// surviving a full reload, which is exactly the "session" the roadmap
// means. Keyed by user id (not a single flag) so a second person signing
// into the same browser session gets their own first greeting rather than
// silently inheriting the previous user's.
const greetedUserIds = new Set<string>();

export function IterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<IterMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setGreetedTick] = useState(0);
  const sessionId = useRef<string>(crypto.randomUUID());
  const userId = user?.id;
  const greeted = userId ? greetedUserIds.has(userId) : false;

  // Group A5: the panel loads history from the SERVER, per user, and the
  // browser store becomes an offline cache rather than the source of truth.
  //
  // IndexedDB is read first and rendered immediately, then the server's copy
  // replaces it. That ordering matters on a phone: the local copy paints at
  // once instead of leaving the panel blank for a round trip, and the server's
  // copy is what wins, so history follows a person to another device.
  //
  // A failed fetch keeps whatever the local cache had. That is the honest
  // degradation — an empty panel would claim the conversation never happened.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const cached = await loadMessages(userId);
      if (!cancelled && cached.length > 0) setMessages(cached);
      try {
        const page = await iterHistoryApi.get({ limit: 50 });
        if (cancelled) return;
        // Stored newest-first, one row per exchange; the panel wants
        // oldest-first, one bubble per turn.
        const flat: IterMessage[] = [];
        for (const row of [...page.items].reverse()) {
          flat.push({ id: row.id + ":u", role: "user", text: row.body, at: row.createdAt });
          if (row.reply) flat.push({ id: row.id, role: "model", text: row.reply, at: row.createdAt });
        }
        setMessages(flat);
        void saveMessages(userId, flat);
      } catch {
        // Offline or refused — the cached copy above stands.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const openPanel = useCallback(() => {
    setOpen(true);
    if (userId && !greetedUserIds.has(userId)) {
      greetedUserIds.add(userId);
      setGreetedTick((n) => n + 1); // forces a re-render so `greeted` (derived above) picks up the mutation
    }
  }, [userId]);
  const closePanel = useCallback(() => setOpen(false), []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !userId || !user) return;
      setError(null);
      const userMsg: IterMessage = { id: crypto.randomUUID(), role: "user", text: trimmed, at: new Date().toISOString() };
      const withUser = [...messages, userMsg];
      setMessages(withUser);
      void saveMessages(userId, withUser);
      setSending(true);
      try {
        const history = withUser.slice(0, -1).map((m) => ({ role: m.role, text: m.text }));
        const result = await iterApi.sendMessage({
          sessionId: sessionId.current,
          text: trimmed,
          screen: pathname,
          locale: user.locale,
          history,
        });
        const modelMsg: IterMessage = {
          id: result.id,
          role: "model",
          text: result.reply ?? "",
          at: result.storedAt,
        };
        const withReply = [...withUser, modelMsg];
        setMessages(withReply);
        void saveMessages(userId, withReply);
      } catch (err) {
        // Three different facts, not two. A model that FAILED says "something
        // went wrong"; one that is momentarily BUSY says "ask me again in a
        // moment"; and one whose free-tier DAY is spent has to say that, because
        // "in a moment" sends the user back to a button that cannot work again
        // until the quota resets. The backend names all three
        // (ITER_UPSTREAM_ERROR / ITER_UPSTREAM_BUSY / ITER_DAILY_QUOTA_SPENT).
        const code = err instanceof ApiRequestError ? err.code : null;
        setError(code === "ITER_DAILY_QUOTA_SPENT" ? "quota" : code === "ITER_UPSTREAM_BUSY" ? "busy" : "error");
      } finally {
        setSending(false);
      }
    },
    [messages, userId, user, pathname],
  );

  const value = useMemo(
    () => ({ open, messages, sending, error, greeted, openPanel, closePanel, send }),
    [open, messages, sending, error, greeted, openPanel, closePanel, send],
  );

  return <IterContext.Provider value={value}>{children}</IterContext.Provider>;
}

export function useIter() {
  const ctx = useContext(IterContext);
  if (!ctx) throw new Error("useIter must be used within IterProvider");
  return ctx;
}
