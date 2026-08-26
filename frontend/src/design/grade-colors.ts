// Generated verbatim from the design source's `G` array (tessera-data.js).
// Index 0 is unused (null) in the source; grades run 1-10.
export const GRADE_COLORS: readonly (string | null)[] = [null,"#6d1414","#8a2318","#a63c1c","#bd6320","#c78d1d","#8f9440","#5f8a6e","#3f7f8c","#2c5f8f","#1d3f79"];

// The design source's own `gc(v) = G[clamp(round(v), 1, 10)]` (tessera-data.js)
// — a var() reference, not the hex itself, so callers stay compliant with
// tokens:check (colours are references outside this file, never literals).
export function gradeColorVar(value: number): string {
  const n = Math.max(1, Math.min(10, Math.round(value)));
  return `var(--g${n})`;
}
