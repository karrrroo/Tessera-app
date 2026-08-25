"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiJson, refreshOnce } from "../lib/api/client";
import { registerAuthFailureHandler, setAccessToken } from "../lib/api/token-store";

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
type AuthStatus = "booting" | "anon" | "authed";

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

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus("anon");
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
        if (!refreshed) {
          if (!cancelled) setStatus("anon");
          return;
        }
        const me = await apiJson<UserProfile>("/api/me");
        if (!cancelled) {
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
