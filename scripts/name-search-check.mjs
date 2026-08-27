#!/usr/bin/env node
// Verifies that the SQL transliteration in backend/src/lib/name-search.ts
// produces exactly what the UI's own transliteration in
// frontend/src/i18n/transliterate-name.ts produces, for every person in the
// database, in both Latin and Russian.
//
// This is the check that keeps the search honest. The whole point of the
// feature is "what you see is what you can search", and that property is
// only true while these two implementations agree. Read-only.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const databaseUrl = readFileSync(join(root, "backend", ".env"), "utf8")
  .match(/^DATABASE_URL=(.+)$/m)?.[1]
  ?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL not found in backend/.env");
  process.exit(1);
}

// ---- the UI's transliteration, transcribed from transliterate-name.ts ----
const ARM_VOWEL = "ԱաԵեԷէԸըԻիՈոՕօ";

function applyCyrillicHRule(text) {
  return text
    .replace(new RegExp(`Հ([${ARM_VOWEL}])`, "g"), (_m, v) => v.toUpperCase())
    .replace(new RegExp(`հ([${ARM_VOWEL}])`, "g"), (_m, v) => v)
    .replace(/Հ/g, "Г")
    .replace(/հ/g, "г");
}
function applyCyrillicLRule(text) {
  return text.replace(new RegExp(`([Լլ])(?![${ARM_VOWEL}]|$)`, "g"), (m, ch) => (ch === "Լ" ? "Ль" : "ль"));
}
const LATIN_DIGRAPHS = [[/ՈՒ/g, "U"], [/Ու/g, "U"], [/ու/g, "u"]];
const CYRILLIC_DIGRAPHS = [
  [/ՈՒ/g, "У"], [/Ու/g, "У"], [/ու/g, "у"],
  [/յա/g, "я"], [/յե/g, "е"], [/յո/g, "ё"],
  [/Յա/g, "Я"], [/Յե/g, "Е"], [/Յո/g, "Ё"],
];
const LATIN = {
  Ա: "A", ա: "a", Բ: "B", բ: "b", Գ: "G", գ: "g", Դ: "D", դ: "d",
  Ե: "E", ե: "e", Զ: "Z", զ: "z", Է: "E", է: "e", Ը: "Y", ը: "y",
  Թ: "T", թ: "t", Ժ: "Zh", ժ: "zh", Ի: "I", ի: "i", Լ: "L", լ: "l",
  Խ: "Kh", խ: "kh", Ծ: "Ts", ծ: "ts", Կ: "K", կ: "k", Հ: "H", հ: "h",
  Ձ: "Dz", ձ: "dz", Ղ: "Gh", ղ: "gh", Ճ: "Ch", ճ: "ch", Մ: "M", մ: "m",
  Յ: "Y", յ: "y", Ն: "N", ն: "n", Շ: "Sh", շ: "sh", Ո: "O", ո: "o",
  Չ: "Ch", չ: "ch", Պ: "P", պ: "p", Ջ: "J", ջ: "j", Ռ: "R", ռ: "r",
  Ս: "S", ս: "s", Վ: "V", վ: "v", Տ: "T", տ: "t", Ր: "R", ր: "r",
  Ց: "Ts", ց: "ts", Ւ: "V", ւ: "v", Փ: "P", փ: "p", Ք: "K", ք: "k",
  Օ: "O", օ: "o", Ֆ: "F", ֆ: "f", և: "ev",
};
const CYRILLIC = {
  Ա: "А", ա: "а", Բ: "Б", բ: "б", Գ: "Г", գ: "г", Դ: "Д", դ: "д",
  Ե: "Е", ե: "е", Զ: "З", զ: "з", Է: "Э", է: "э", Ը: "Ы", ը: "ы",
  Թ: "Т", թ: "т", Ի: "И", ի: "и", Լ: "Л", լ: "л",
  Խ: "Х", խ: "х", Ծ: "Ц", ծ: "ц", Կ: "К", կ: "к",
  Ձ: "Дз", ձ: "дз", Ղ: "Г", ղ: "г", Ճ: "Ч", ճ: "ч", Մ: "М", մ: "м",
  Յ: "Й", յ: "й", Ն: "Н", ն: "н", Շ: "Ш", շ: "ш", Ո: "О", ո: "о",
  Չ: "Ч", չ: "ч", Պ: "П", պ: "п", Ջ: "Дж", ջ: "дж", Ռ: "Р", ռ: "р",
  Ս: "С", ս: "с", Վ: "В", վ: "в", Տ: "Т", տ: "т", Ր: "Р", ր: "р",
  Ց: "Ц", ց: "ц", Ւ: "В", ւ: "в", Փ: "П", փ: "п", Ք: "К", ք: "к",
  Օ: "О", օ: "о", Ֆ: "Ф", ֆ: "ф", և: "ев",
};
const HAS_ARMENIAN = /[԰-֏]/;

function jsLatin(text) {
  if (!HAS_ARMENIAN.test(text)) return text;
  let out = text;
  for (const [re, to] of LATIN_DIGRAPHS) out = out.replace(re, to);
  return [...out].map((ch) => LATIN[ch] ?? ch).join("");
}
function jsCyrillic(text) {
  if (!HAS_ARMENIAN.test(text)) return text;
  let out = applyCyrillicLRule(applyCyrillicHRule(text));
  for (const [re, to] of CYRILLIC_DIGRAPHS) out = out.replace(re, to);
  return [...out].map((ch) => CYRILLIC[ch] ?? ch).join("");
}

// ---- the SQL side, built the same way name-search.ts builds it ----
const ARM_VOWELS = [...ARM_VOWEL];
const L_DIG = [["ՈՒ", "U"], ["Ու", "U"], ["ու", "u"]];
const L_MULTI = [
  ["Ժ", "Zh"], ["ժ", "zh"], ["Խ", "Kh"], ["խ", "kh"], ["Ծ", "Ts"], ["ծ", "ts"],
  ["Ձ", "Dz"], ["ձ", "dz"], ["Ղ", "Gh"], ["ղ", "gh"], ["Ճ", "Ch"], ["ճ", "ch"],
  ["Շ", "Sh"], ["շ", "sh"], ["Չ", "Ch"], ["չ", "ch"], ["Ց", "Ts"], ["ց", "ts"],
  ["և", "ev"],
];
const L_SINGLE = Object.entries(LATIN).filter(([, v]) => v.length === 1);
const C_DIG = [
  ["ՈՒ", "У"], ["Ու", "У"], ["ու", "у"],
  ["յա", "я"], ["յե", "е"], ["յո", "ё"], ["Յա", "Я"], ["Յե", "Е"], ["Յո", "Ё"],
];
const C_MULTI = [["Ձ", "Дз"], ["ձ", "дз"], ["Ջ", "Дж"], ["ջ", "дж"], ["և", "ев"]];
const C_SINGLE = Object.entries(CYRILLIC).filter(([, v]) => v.length === 1);

const lit = (s) => "'" + s.replace(/'/g, "''") + "'";
function chainSql(expr, pairs) {
  for (const [from, to] of pairs) expr = `replace(${expr}, ${lit(from)}, ${lit(to)})`;
  return expr;
}
function translateSql(expr, pairs) {
  return `translate(${expr}, ${lit(pairs.map((p) => p[0]).join(""))}, ${lit(pairs.map((p) => p[1]).join(""))})`;
}
function sqlLatin(col) {
  let e = `coalesce(${col}, '')`;
  e = chainSql(e, L_DIG);
  e = chainSql(e, L_MULTI);
  return translateSql(e, L_SINGLE);
}
function sqlCyrillic(col) {
  let e = `coalesce(${col}, '')`;
  const hPairs = [];
  for (const v of ARM_VOWELS) hPairs.push(["Հ" + v, v.toUpperCase()]);
  for (const v of ARM_VOWELS) hPairs.push(["հ" + v, v]);
  e = chainSql(e, hPairs);
  e = chainSql(e, [["Հ", "Г"], ["հ", "г"]]);
  const vc = ARM_VOWELS.join("");
  e = `regexp_replace(${e}, ${lit("Լ([^" + vc + "])")}, ${lit("Ль\\1")}, 'g')`;
  e = `regexp_replace(${e}, ${lit("լ([^" + vc + "])")}, ${lit("ль\\1")}, 'g')`;
  e = chainSql(e, C_DIG);
  e = chainSql(e, C_MULTI);
  return translateSql(e, C_SINGLE);
}

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: true } });
await client.connect();
let failures = 0;
let checked = 0;
try {
  for (const table of ["student", "teacher"]) {
    const { rows } = await client.query(
      `select first_name, last_name,
              ${sqlLatin("first_name")} as f_lat, ${sqlLatin("last_name")} as l_lat,
              ${sqlCyrillic("first_name")} as f_cyr, ${sqlCyrillic("last_name")} as l_cyr
       from ${table}`,
    );
    for (const r of rows) {
      for (const [field, stored, sqlOut, jsFn, script] of [
        ["first_name", r.first_name, r.f_lat, jsLatin, "latin"],
        ["last_name", r.last_name, r.l_lat, jsLatin, "latin"],
        ["first_name", r.first_name, r.f_cyr, jsCyrillic, "cyrillic"],
        ["last_name", r.last_name, r.l_cyr, jsCyrillic, "cyrillic"],
      ]) {
        checked++;
        const expected = jsFn(stored ?? "");
        if (sqlOut !== expected) {
          failures++;
          if (failures <= 20) {
            console.error(
              `MISMATCH ${table}.${field} (${script}): stored=${JSON.stringify(stored)} ` +
                `sql=${JSON.stringify(sqlOut)} ui=${JSON.stringify(expected)}`,
            );
          }
        }
      }
    }
    console.log(`OK:   ${table} — ${rows.length} rows compared in both scripts`);
  }
} finally {
  await client.end();
}

console.log(`\n${checked} name renderings compared, ${failures} mismatch(es).`);
if (failures) {
  console.error("name-search:check FAILED — the SQL and the UI disagree, so the search cannot find what the UI shows.");
  process.exit(1);
}
console.log("name-search:check passed.");
