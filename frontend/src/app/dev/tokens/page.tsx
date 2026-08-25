"use client";

import { useEffect, useState } from "react";
import { ACCENTS } from "@/design/accents";
import { GRADE_COLORS } from "@/design/grade-colors";

// Internal proof page (roadmap Phase 4 Done-when #1): every token as a
// labelled swatch, with its actually-computed value — not the literal
// string "var(--…)" or "initial", which is what a broken/unset token
// resolves to. No auth, not part of the (app) shell.
const THEME_TOKENS = [
  "ink",
  "ink-2",
  "ink-3",
  "hair",
  "hair-bright",
  "hair-top",
  "glass",
  "glass-solid",
  "panel",
  "surface2",
  "danger",
  "ok",
  "accent",
  "accent-fg",
  "mesh-1",
  "mesh-2",
  "mesh-3",
  "mesh-4",
];
const BACKGROUND_TOKENS = ["bg-base", "bg-raised"];
const ROOT_TOKENS = ["accent-tint", "g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8", "g9", "g10"];

function Swatch({ name, value }: { name: string; value: string }) {
  const broken = !value || value.trim() === "" || value.includes("var(") || value.trim() === "initial";
  return (
    <div className="flex items-center gap-3 rounded-lg border border-hair p-2">
      <span
        className="h-8 w-8 flex-none rounded-md border border-hair"
        style={{ background: broken ? "transparent" : value }}
      />
      <div className="min-w-0">
        <p className="truncate font-mono text-xs" style={{ color: "var(--ink)" }}>
          --{name}
        </p>
        <p className="truncate font-mono text-[11px]" style={{ color: broken ? "var(--danger)" : "var(--ink-3)" }}>
          {broken ? `BROKEN: "${value}"` : value}
        </p>
      </div>
    </div>
  );
}

function readVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
}

export default function DevTokensPage() {
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [tt, setTt] = useState<"dark" | "light">("dark");
  const [bg, setBg] = useState<"deep" | "coal" | "cream" | "grey">("deep");

  useEffect(() => {
    document.documentElement.setAttribute("data-tt", tt);
    document.documentElement.setAttribute("data-bg", bg);
    const all = [...THEME_TOKENS, ...BACKGROUND_TOKENS, ...ROOT_TOKENS];
    const next: Record<string, string> = {};
    for (const name of all) next[name] = readVar(name);
    // getComputedStyle can only resolve after the attribute write above lands
    // in the DOM — there's no external callback to hang this off, unlike the
    // usual case this rule guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(next);
  }, [tt, bg]);

  if (!values) return null;

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8" style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
          Design tokens
        </h1>
        <p className="text-xs" style={{ color: "var(--ink-3)" }}>
          /dev/tokens — internal proof page, not part of the app shell.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex gap-2">
          {(["dark", "light"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setTt(v)}
              className="rounded-full border border-hair px-3 py-1 text-sm"
              style={{ background: tt === v ? "var(--accent)" : "transparent", color: tt === v ? "var(--accent-fg)" : "var(--ink-2)" }}
            >
              data-tt={v}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(["deep", "coal", "cream", "grey"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setBg(v)}
              className="rounded-full border border-hair px-3 py-1 text-sm"
              style={{ background: bg === v ? "var(--accent)" : "transparent", color: bg === v ? "var(--accent-fg)" : "var(--ink-2)" }}
            >
              data-bg={v}
            </button>
          ))}
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
          Background ([data-bg])
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BACKGROUND_TOKENS.map((name) => (
            <Swatch key={name} name={name} value={values[name]} />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
          Theme ([data-tt])
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {THEME_TOKENS.map((name) => (
            <Swatch key={name} name={name} value={values[name]} />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
          Root (accent-tint)
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Swatch name="accent-tint" value={values["accent-tint"]} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
          Grade scale (fixed — never varies with theme/background/accent)
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {GRADE_COLORS.slice(1).map((hex, i) => (
            <Swatch key={i} name={`g${i + 1}`} value={hex ?? ""} />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
          Accents (7)
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACCENTS.map((a) => (
            <Swatch key={a.id} name={`accent:${a.id}`} value={a.swatch} />
          ))}
        </div>
      </section>
    </main>
  );
}
