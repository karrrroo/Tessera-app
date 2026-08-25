"use client";

import { useAuth } from "@/state/auth-provider";
import { SessionList } from "@/components/auth/session-list";

export default function SettingsPage() {
  const { logout } = useAuth();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="text-xs text-gray-400">Full chrome arrives in Phase 12 — session list only for now.</p>
      <SessionList />
      <button onClick={() => logout()} className="self-start rounded-full bg-black px-4 py-2 text-sm text-white">
        Log out
      </button>
    </main>
  );
}
