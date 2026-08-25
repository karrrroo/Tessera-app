#!/usr/bin/env node
// Fails if hy/en/ru don't share identical key sets, any string value is
// empty, or an Armenian character appears in src/app or src/components (L-2
// — components must call the dictionary, never hardcode Armenian copy).
// Run via tsx (not plain node) so it can import the .ts dictionaries
// directly: `tsx scripts/i18n-check.mjs`.
// See docs/reference/tessera-roadmap.md Phase 4.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, extname } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const i18nDir = join(root, "frontend", "src", "i18n");
const LOCALES = ["hy", "en", "ru"];
const ARMENIAN_PATTERN = /[԰-֏]/;

let failed = false;
function fail(message) {
  console.error(`FAIL: ${message}`);
  failed = true;
}
function ok(message) {
  console.log(`OK:   ${message}`);
}

function keyPaths(obj, prefix = "") {
  const paths = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      paths.push(...keyPaths(v, p));
    } else {
      paths.push(p);
    }
  }
  return paths;
}

// scr.dlg.sendTo is a deliberately Armenian-only sentence suffix: the publish
// dialog composes its body as `n + sendB + className + (sendTo || '. ') +
// sendB2` (Tessera.dc.html), appending a genitive-case fragment ("...-ի
// աշակերտներին", "to <class>'s students") that Armenian grammar needs and
// English/Russian don't — the source code itself already falls back to
// '. ' when it's empty. Not a translation gap; allowed empty in en/ru.
const ALLOWED_EMPTY = new Set(["en:scr.dlg.sendTo", "ru:scr.dlg.sendTo"]);

function emptyValuePaths(obj, prefix = "") {
  const paths = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      paths.push(...emptyValuePaths(v, p));
    } else if (typeof v === "string" && v.trim() === "") {
      paths.push(p);
    }
  }
  return paths;
}

const dicts = {};
for (const locale of LOCALES) {
  const modPath = join(i18nDir, `${locale}.ts`);
  if (!existsSync(modPath)) {
    fail(`missing frontend/src/i18n/${locale}.ts`);
    continue;
  }
  const mod = await import(`file://${modPath.replace(/\\/g, "/")}`);
  dicts[locale] = mod.default;
}

if (!failed) {
  const keySets = {};
  for (const locale of LOCALES) {
    keySets[locale] = new Set(keyPaths(dicts[locale]));
  }
  const [first, ...rest] = LOCALES;
  const baseline = keySets[first];
  for (const locale of rest) {
    const missing = [...baseline].filter((k) => !keySets[locale].has(k));
    const extra = [...keySets[locale]].filter((k) => !baseline.has(k));
    if (missing.length === 0 && extra.length === 0) {
      ok(`${locale} key set matches ${first} (${baseline.size} keys)`);
    } else {
      if (missing.length) fail(`${locale} is missing keys present in ${first}: ${missing.join(", ")}`);
      if (extra.length) fail(`${locale} has keys not present in ${first}: ${extra.join(", ")}`);
    }
  }

  for (const locale of LOCALES) {
    const empties = emptyValuePaths(dicts[locale]).filter((p) => !ALLOWED_EMPTY.has(`${locale}:${p}`));
    if (empties.length === 0) {
      ok(`${locale} has no unexpected empty string values`);
    } else {
      fail(`${locale} has empty values at: ${empties.join(", ")}`);
    }
  }
}

const scanDirs = ["app", "components"].map((d) => join(root, "frontend", "src", d));
const scannedExtensions = new Set([".ts", ".tsx"]);
const armenianHits = [];

function walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (scannedExtensions.has(extname(full))) {
      const text = readFileSync(full, "utf8");
      if (ARMENIAN_PATTERN.test(text)) {
        armenianHits.push(relative(root, full));
      }
    }
  }
}
for (const dir of scanDirs) walk(dir);

if (armenianHits.length === 0) {
  ok("no Armenian characters found in src/app or src/components");
} else {
  fail(`Armenian characters found outside the i18n dictionaries (hardcoded copy instead of a T lookup): ${armenianHits.join(", ")}`);
}

if (failed) {
  console.error("\ni18n:check FAILED — see above.");
  process.exit(1);
}
console.log("\ni18n:check passed.");
