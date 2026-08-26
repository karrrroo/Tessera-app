"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/state/auth-provider";
import { usePathname } from "next/navigation";
import { iterApi } from "@/lib/api/iter";
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

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadMessages(userId).then((stored) => {
      if (!cancelled) setMessages(stored);
    });
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
      } catch {
        setError("error");
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
