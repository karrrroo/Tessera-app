#!/usr/bin/env node
// Fails if any hex color literal appears anywhere under frontend/src except
// the design token source files themselves. Colors must resolve through the
// CSS custom properties tessera.css defines — "the token file is the
// contract" (roadmap Phase 4). See docs/reference/tessera-roadmap.md Phase 4.
//
// The roadmap describes a single exempt file (tessera.css), but this build's
// entire frontend/src/design/ directory is the token source — tessera.css
// for CSS custom properties, plus typed TS constants for JS-side consumers
// (an accent picker's swatch list, a grade legend, the accent-tint fallback)
// generated straight from the design source. Anything under design/ is
// canonical, not a hardcoded color, so the whole directory is exempt.
// frontend/src/app/globals.css is NOT exempt: its remaining hex values are
// create-next-app scaffold defaults that predate this token system and are
// expected to fail here until Phase 4 actually builds ThemeProvider and cuts
// the app shell over to the tokens.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, extname, sep } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(root, "frontend", "src");
const exemptDir = join(srcDir, "design") + sep;
const scannedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);
const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;

let failed = false;
const violations = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (scannedExtensions.has(extname(full)) && !full.startsWith(exemptDir)) {
      const text = readFileSync(full, "utf8");
      const matches = text.match(HEX_PATTERN);
      if (matches) {
        violations.push({ file: relative(root, full), matches });
      }
    }
  }
}

walk(srcDir);

if (violations.length > 0) {
  failed = true;
  for (const v of violations) {
    console.error(`FAIL: ${v.file} — hex literal(s): ${v.matches.join(", ")}`);
  }
}

if (failed) {
  console.error("\ntokens:check FAILED — move these colors into frontend/src/design/tessera.css and reference them as CSS custom properties / Tailwind utilities instead.");
  process.exit(1);
}
console.log("tokens:check passed — no hex literals outside tessera.css.");
