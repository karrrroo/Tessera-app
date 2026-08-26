"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiJson, refreshOnce } from "../lib/api/client";
import { registerAuthFailureHandler, setAccessToken } from "../lib/api/token-store";
import { useLocale } from "../i18n/locale-provider";

export type UserProfile = {
  id: string;
  role: "student" | "teacher" | "admin";
  locale: "hy" | "en" | "ru";
  mustChangePassword: boolean;
  firstName?: string;
  lastName?: string;
  institutionId?: string;
  institutionName?: string;
  studentId?: string;
  classLabel?: string | null;
  teacherId?: string;
  subjectIds?: string[];
  preferences: { theme: string; accent: string; background: string; iterPosition: string };
};

type LoginInput = { identifier: string; password: string; remember: boolean; deviceLabel: string };
// "offline": the boot-time silent refresh never reached the server at all
// (no network), on a device that has a real session on it recently — ID-8
// needs this distinguished from "anon" (docs/decisions.md), because a
// hard reload of /id while offline must not present a login screen. There
// is no `user` in this state (no profile was ever fetched this boot) —
// /id renders from its own IndexedDB-cached credential instead.
type AuthStatus = "booting" | "anon" | "authed" | "offline";

// Not a token, not sensitive — just "a real login or refresh succeeded on
// this device before" (see the AuthStatus note above). Deliberately not
// httpOnly/cookie-based: this only ever gates a client-side rendering
// decision, never anything server-trusts.
const HAS_AUTHED_BEFORE_KEY = "tessera.hasAuthedBefore";
function markAuthedBefore() {
  try {
    window.localStorage.setItem(HAS_AUTHED_BEFORE_KEY, "1");
  } catch {
    // private mode / storage disabled — offline boot just won't have this
    // signal, and falls back to "anon", which is always safe.
  }
}
function hasAuthedBefore(): boolean {
  try {
    return window.localStorage.getItem(HAS_AUTHED_BEFORE_KEY) === "1";
  } catch {
    return false;
  }
}
function clearAuthedBefore() {
  try {
    window.localStorage.removeItem(HAS_AUTHED_BEFORE_KEY);
  } catch {
    // nothing to clear if storage never worked in the first place
  }
}

type AuthContextValue = {
  status: AuthStatus;
  user: UserProfile | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("booting");
  const [user, setUser] = useState<UserProfile | null>(null);
  const { syncLocaleFromServer } = useLocale();

  // locale is the one preference that lives on the account, not the device
  // (roadmap Phase 4) — once a profile loads, it overrides whatever the
  // browser's own localStorage had (e.g. a shared school computer left on
  // the previous student's language).
  useEffect(() => {
    if (user) syncLocaleFromServer(user.locale);
  }, [user, syncLocaleFromServer]);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus("anon");
    clearAuthedBefore();
  }, []);

  useEffect(() => {
    registerAuthFailureHandler(clearAuth);
  }, [clearAuth]);

  // Boots by attempting a silent refresh — this is why the splash exists as
  // a real screen and not decoration (roadmap Phase 3 frontend notes): the
  // refresh cookie is path-scoped to /api/auth/refresh, so Next middleware
  // can never see it, and gating has to happen client-side, after this call
  // resolves. Goes through the shared refreshOnce() promise (not a direct
  // fetch) so a double-invoked effect — React Strict Mode in dev, or any
  // other double-mount — awaits one real request instead of firing two: a
  // second concurrent refresh call would present the same now-stale cookie
  // as the first and get read as genuine token reuse, revoking the whole
  // session family (D-12's reuse detection working exactly as designed,
  // just triggered by the client instead of an attacker).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const refreshed = await refreshOnce();
        if (refreshed === false) {
          if (!cancelled) setStatus("anon");
          return;
        }
        if (refreshed === null) {
          // Network never answered — not the same fact as "logged out"
          // (ID-8). Only trust it on a device with a real recent session;
          // one that's never authenticated (or explicitly logged out) has
          // nothing cached to show offline anyway.
          if (!cancelled) setStatus(hasAuthedBefore() ? "offline" : "anon");
          return;
        }
        const me = await apiJson<UserProfile>("/api/me");
        if (!cancelled) {
          markAuthedBefore();
          setUser(me);
          setStatus("authed");
        }
      } catch {
        if (!cancelled) setStatus("anon");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const body = await apiJson<{ accessToken: string; user: UserProfile }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setAccessToken(body.accessToken);
    markAuthedBefore();
    setUser(body.user);
    setStatus("authed");
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiJson("/api/auth/logout", { method: "POST" });
    } catch {
      // already logged out server-side, or unreachable — clear local state regardless
    }
    clearAuth();
  }, [clearAuth]);

  const refreshUser = useCallback(async () => {
    const me = await apiJson<UserProfile>("/api/me");
    setUser(me);
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, login, logout, refreshUser }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
