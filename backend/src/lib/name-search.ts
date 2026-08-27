import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

// Makes a person findable by the name the admin can actually see.
//
// THE BUG THIS FIXES. Person names are stored once, in Armenian, on
// `student`/`teacher` — there is no `first_name_en`, and C2 forbids adding
// one — so the English and Russian UIs transliterate at render time
// (frontend/src/i18n/transliterate-name.ts). The search, meanwhile, sent the
// typed query straight to `ILIKE` against the Armenian columns. The result:
// an admin reading "Abrahamyan" on screen could not find that student by
// typing "Abrahamyan", and the only students a Latin query could ever match
// were the two whose names happen to be *stored* in Latin. Measured against
// the live database before this change: Armenian "ան" -> 200 results, Latin
// "an" -> 2, Latin "Abrahamyan" -> 0, Latin "Artyom" -> 0.
//
// WHY THIS DIRECTION. The alternative is transliterating the query back into
// Armenian, which cannot work: the mapping is many-to-one, so "ts" is both Ծ
// and Ց, "k" is both Կ and Ք, and "ch" is both Ճ and Չ. Going the other way —
// rendering the stored Armenian into Latin and Cyrillic inside the query — is
// deterministic and, more importantly, is the *same* transformation that
// produced the text on screen. That is the property worth having: what you
// see is what you can search.
//
// WHY IN SQL, not in JS over a fetched list. Ranking, the total count and
// paging all have to stay server-side and consistent; filtering in the
// application layer would mean fetching every person on every keystroke,
// which is the roster-dump failure mode admin/search.ts exists to avoid.
//
// The tables below are deliberately identical to
// frontend/src/i18n/transliterate-name.ts. If one changes, change both — the
// verification script (scripts/name-search-check.mjs) compares this module's
// SQL output against that module's JS output for every person in the
// database, and fails loudly if they ever drift.

const ARM_VOWELS = [..."ԱաԵեԷէԸըԻիՈոՕօ"];

/** Armenian letters whose Latin form is more than one character. */
const LATIN_MULTI: [string, string][] = [
  ["Ժ", "Zh"], ["ժ", "zh"],
  ["Խ", "Kh"], ["խ", "kh"],
  ["Ծ", "Ts"], ["ծ", "ts"],
  ["Ձ", "Dz"], ["ձ", "dz"],
  ["Ղ", "Gh"], ["ղ", "gh"],
  ["Ճ", "Ch"], ["ճ", "ch"],
  ["Շ", "Sh"], ["շ", "sh"],
  ["Չ", "Ch"], ["չ", "ch"],
  ["Ց", "Ts"], ["ց", "ts"],
  ["և", "ev"],
];

/** Armenian letters whose Latin form is exactly one character. */
const LATIN_SINGLE: [string, string][] = [
  ["Ա", "A"], ["ա", "a"], ["Բ", "B"], ["բ", "b"], ["Գ", "G"], ["գ", "g"],
  ["Դ", "D"], ["դ", "d"], ["Ե", "E"], ["ե", "e"], ["Զ", "Z"], ["զ", "z"],
  ["Է", "E"], ["է", "e"], ["Ը", "Y"], ["ը", "y"], ["Թ", "T"], ["թ", "t"],
  ["Ի", "I"], ["ի", "i"], ["Լ", "L"], ["լ", "l"], ["Կ", "K"], ["կ", "k"],
  ["Հ", "H"], ["հ", "h"], ["Մ", "M"], ["մ", "m"], ["Յ", "Y"], ["յ", "y"],
  ["Ն", "N"], ["ն", "n"], ["Ո", "O"], ["ո", "o"], ["Պ", "P"], ["պ", "p"],
  ["Ջ", "J"], ["ջ", "j"], ["Ռ", "R"], ["ռ", "r"], ["Ս", "S"], ["ս", "s"],
  ["Վ", "V"], ["վ", "v"], ["Տ", "T"], ["տ", "t"], ["Ր", "R"], ["ր", "r"],
  ["Ւ", "V"], ["ւ", "v"], ["Փ", "P"], ["փ", "p"], ["Ք", "K"], ["ք", "k"],
  ["Օ", "O"], ["օ", "o"], ["Ֆ", "F"], ["ֆ", "f"],
];

const CYRILLIC_MULTI: [string, string][] = [
  ["Ձ", "Дз"], ["ձ", "дз"],
  ["Ջ", "Дж"], ["ջ", "дж"],
  ["և", "ев"],
];

const CYRILLIC_SINGLE: [string, string][] = [
  ["Ա", "А"], ["ա", "а"], ["Բ", "Б"], ["բ", "б"], ["Գ", "Г"], ["գ", "г"],
  ["Դ", "Д"], ["դ", "д"], ["Ե", "Е"], ["ե", "е"], ["Զ", "З"], ["զ", "з"],
  ["Է", "Э"], ["է", "э"], ["Ը", "Ы"], ["ը", "ы"], ["Թ", "Т"], ["թ", "т"],
  ["Ի", "И"], ["ի", "и"], ["Լ", "Л"], ["լ", "л"], ["Խ", "Х"], ["խ", "х"],
  ["Ծ", "Ц"], ["ծ", "ц"], ["Կ", "К"], ["կ", "к"], ["Ղ", "Г"], ["ղ", "г"],
  ["Ճ", "Ч"], ["ճ", "ч"], ["Մ", "М"], ["մ", "м"], ["Յ", "Й"], ["յ", "й"],
  ["Ն", "Н"], ["ն", "н"], ["Շ", "Ш"], ["շ", "ш"], ["Ո", "О"], ["ո", "о"],
  ["Չ", "Ч"], ["չ", "ч"], ["Պ", "П"], ["պ", "п"], ["Ռ", "Р"], ["ռ", "р"],
  ["Ս", "С"], ["ս", "с"], ["Վ", "В"], ["վ", "в"], ["Տ", "Т"], ["տ", "т"],
  ["Ր", "Р"], ["ր", "р"], ["Ց", "Ц"], ["ց", "ц"], ["Ւ", "В"], ["ւ", "в"],
  ["Փ", "П"], ["փ", "п"], ["Ք", "К"], ["ք", "к"], ["Օ", "О"], ["օ", "о"],
  ["Ֆ", "Ф"], ["ֆ", "ф"],
];

/** ու is one vowel; letter-by-letter it becomes "Ov"/"Ов". */
const LATIN_DIGRAPHS: [string, string][] = [["ՈՒ", "U"], ["Ու", "U"], ["ու", "u"]];

const CYRILLIC_DIGRAPHS: [string, string][] = [
  ["ՈՒ", "У"], ["Ու", "У"], ["ու", "у"],
  // Iotated vowels: յ + vowel is one Russian letter. "Погосян" depends on it.
  ["յա", "я"], ["յե", "е"], ["յո", "ё"],
  ["Յա", "Я"], ["Յե", "Е"], ["Յո", "Ё"],
];

function chain(start: SQL, pairs: [string, string][]): SQL {
  let expr = start;
  for (const [from, to] of pairs) expr = sql`replace(${expr}, ${from}, ${to})`;
  return expr;
}

/** One translate() instead of ~60 nested replace() calls for the 1:1 letters. */
function translateSingles(expr: SQL, pairs: [string, string][]): SQL {
  const from = pairs.map((p) => p[0]).join("");
  const to = pairs.map((p) => p[1]).join("");
  return sql`translate(${expr}, ${from}, ${to})`;
}

/**
 * The stored Armenian name rendered to Latin, exactly as the English UI
 * renders it: digraphs first, then the multi-character letters, then a
 * single translate() for everything that maps 1:1.
 */
export function toLatinSql(column: SQLWrapper): SQL {
  let expr = sql`coalesce(${column}, '')`;
  expr = chain(expr, LATIN_DIGRAPHS);
  expr = chain(expr, LATIN_MULTI);
  return translateSingles(expr, LATIN_SINGLE);
}

/**
 * The stored Armenian name rendered to Russian, exactly as the Russian UI
 * renders it — including the two positional rules that make the difference
 * between "Акопян" and "Гакобян".
 *
 * The Հ rule is expanded into one replace() per vowel rather than written as
 * a backreference, because Postgres' regexp_replace cannot upper-case a
 * captured group, and a dropped capital Հ has to hand its capitalisation to
 * the vowel that follows or the name loses its initial.
 *
 * The Լ rule can use regexp_replace: POSIX regex has no lookahead, but
 * `Լ([^vowel])` already encodes "before a consonant" correctly — requiring a
 * following character means an Լ at the end of the name is left hard, which
 * is what the rule wants.
 */
export function toCyrillicSql(column: SQLWrapper): SQL {
  let expr = sql`coalesce(${column}, '')`;

  // Հ before a vowel is dropped; a capital Հ promotes the vowel's case.
  const hPairs: [string, string][] = [];
  for (const v of ARM_VOWELS) {
    hPairs.push(["Հ" + v, v.toUpperCase()]);
  }
  for (const v of ARM_VOWELS) {
    hPairs.push(["հ" + v, v]);
  }
  expr = chain(expr, hPairs);
  // Whatever Հ is left stands before a consonant, where Russian keeps it.
  expr = chain(expr, [["Հ", "Г"], ["հ", "г"]]);

  // Լ before a consonant is soft.
  const vowelClass = ARM_VOWELS.join("");
  expr = sql`regexp_replace(${expr}, ${"Լ([^" + vowelClass + "])"}, ${"Ль\\1"}, 'g')`;
  expr = sql`regexp_replace(${expr}, ${"լ([^" + vowelClass + "])"}, ${"ль\\1"}, 'g')`;

  expr = chain(expr, CYRILLIC_DIGRAPHS);
  expr = chain(expr, CYRILLIC_MULTI);
  return translateSingles(expr, CYRILLIC_SINGLE);
}

/**
 * Every script a stored name can be read in, for one column: the Armenian as
 * stored, plus its Latin and Russian renderings. A query is matched against
 * all three, so it does not matter which language the UI happens to be in
 * when the admin types.
 */
export function nameForms(column: SQLWrapper): SQL[] {
  return [sql`coalesce(${column}, '')`, toLatinSql(column), toCyrillicSql(column)];
}
