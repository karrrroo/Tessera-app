"use client";

import { useAuth } from "@/state/auth-provider";

export default function OverviewPage() {
  const { user, logout } = useAuth();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <p className="text-sm text-gray-500">
        Signed in as {user?.firstName} {user?.lastName} ({user?.role})
      </p>
      <p className="text-xs text-gray-400">Real shell arrives in Phase 4 — this is a placeholder.</p>
      <button onClick={() => logout()} className="rounded-full bg-black px-4 py-2 text-sm text-white">
        Log out
      </button>
    </main>
  );
}
