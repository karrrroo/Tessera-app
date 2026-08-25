"use client";

import { useEffect, useState } from "react";

type HealthResponse = { status: string; timestamp: string };

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | "error" | "loading">("loading");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setHealth("error"));
  }, []);

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Tessera</h1>
        <p className="text-sm text-gray-500">Phase 0 — repository and the single command.</p>
        <p className="font-mono text-sm">
          {health === "loading" && "checking /api/health..."}
          {health === "error" && "backend unreachable"}
          {typeof health === "object" && `${health.status} @ ${health.timestamp}`}
        </p>
      </div>
    </main>
  );
}
