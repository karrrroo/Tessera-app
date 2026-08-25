"use client";

import { useState } from "react";

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <label className="block space-y-1">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center rounded-lg border border-gray-300 focus-within:border-black">
        <input
          type={revealed ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="flex-1 rounded-lg bg-transparent px-3 py-2 text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="px-3 text-xs text-gray-400"
          aria-label={revealed ? "Hide password" : "Show password"}
        >
          {revealed ? "hide" : "show"}
        </button>
      </div>
    </label>
  );
}
