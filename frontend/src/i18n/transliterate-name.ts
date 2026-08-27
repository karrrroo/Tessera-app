import type { Locale } from "./locale-provider";

// Person names are stored once, in Armenian, on `student`/`teacher` — there is
// no `first_name_en`/`first_name_ru`, and C2 forbids adding one. So a name
// shown in the English or Russian UI has to be transliterated at render time.
//
// Two things this is NOT:
//   - It is not the language pill. D-16 is explicit that HY · EN · RU stay
//     Latin codes and are never transliterated per the active locale.
//   - It is not `backend/src/lib/transliterate.ts`, whose own docs say it
//     "exists solely to feed that ASCII fallback" for download filenames.
//     The Latin table below is deliberately kept identical to that one so a
//     name reads the same in the header and in an exported filename; the
//     digraph pass is the one addition, and it fixes a real defect in the
//     shared table rather than diverging from it.
//
// Transliterating a personal name is approximate by nature, and the Russian
// side needs two positional rules to stay recognisable rather than merely
// mechanical. Both were added because a plain letter map produced names their
// owners would not recognise; see each rule for the case that forced it.

const ARM_VOWEL = "ԱաԵեԷէԸըԻիՈոՕօ";

// Armenian Հ has no single Russian equivalent. Before a vowel Russian
// convention drops it (Հակոբյան → Акопян, Անահիտ → Анаит, Աբրահամյան →
// Абраамян); before a consonant it survives as Г (Հրանտ → Грант). A flat
// Հ→Г gave "Гакобян", "Анагит" and "Абрагамян" — all wrong, and wrong in a
// way a person notices about their own surname. Applied to the Armenian text,
// before any other substitution, so the vowel test can still see Armenian
// letters.
function applyCyrillicHRule(text: string): string {
  return (
    text
      // A dropped *capital* Հ has to hand its capitalisation to the vowel that
      // follows, or the name loses its initial: Հակոբյան came out "акобян" and
      // Հայկ came out "айк". Armenian has real Unicode case pairs, so
      // toUpperCase() on the vowel is all this needs. (A promoted Ո followed
      // by ւ is still caught by the /Ու/ digraph below.)
      .replace(new RegExp(`Հ([${ARM_VOWEL}])`, "g"), (_m, v) => v.toUpperCase())
      .replace(new RegExp(`հ([${ARM_VOWEL}])`, "g"), (_m, v) => v)
      // Whatever Հ is left stands before a consonant, where Russian keeps it.
      .replace(/Հ/g, "Г")
      .replace(/հ/g, "г")
  );
}

// Armenian Լ before a consonant is soft in Russian renderings of the borrowed
// names that carry it — Ալբերտ is Альберт, not "Алберт". Before a vowel it
// stays hard (Ցոլակյան → Цолакян).
function applyCyrillicLRule(text: string): string {
  return text.replace(new RegExp(`([Լլ])(?![${ARM_VOWEL}]|$)`, "g"), (m, ch) => (ch === "Լ" ? "Ль" : "ль"));
}

// Digraphs next: Armenian ու is one vowel, and mapping it letter-by-letter
// (ո + ւ) yields "Ov"/"Ов" — Խաչատուր becomes "Khachatovr" instead of
// "Khachatur". The Latin table in the backend has exactly this defect; it is
// invisible in a filename and glaring in a name.
const LATIN_DIGRAPHS: [RegExp, string][] = [
  [/ՈՒ/g, "U"],
  [/Ու/g, "U"],
  [/ու/g, "u"],
];

const CYRILLIC_DIGRAPHS: [RegExp, string][] = [
  [/ՈՒ/g, "У"],
  [/Ու/g, "У"],
  [/ու/g, "у"],
  // Iotated vowels: յ + vowel is a single Russian letter, and "Погосян"
  // depends on it — letter-by-letter would give "Погосйан".
  [/յա/g, "я"],
  [/յե/g, "е"],
  [/յո/g, "ё"],
  [/Յա/g, "Я"],
  [/Յե/g, "Е"],
  [/Յո/g, "Ё"],
];

// Identical to backend/src/lib/transliterate.ts — keep the two in step.
const LATIN: Record<string, string> = {
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

const CYRILLIC: Record<string, string> = {
  Ա: "А", ա: "а", Բ: "Б", բ: "б", Գ: "Г", գ: "г", Դ: "Д", դ: "д",
  Ե: "Е", ե: "е", Զ: "З", զ: "з", Է: "Э", է: "э", Ը: "Ы", ը: "ы",
  Թ: "Т", թ: "т", Ժ: "Ж", ժ: "ж", Ի: "И", ի: "и", Լ: "Л", լ: "л",
  Խ: "Х", խ: "х", Ծ: "Ц", ծ: "ц", Կ: "К", կ: "к",
  Ձ: "Дз", ձ: "дз", Ղ: "Г", ղ: "г", Ճ: "Ч", ճ: "ч", Մ: "М", մ: "м",
  Յ: "Й", յ: "й", Ն: "Н", ն: "н", Շ: "Ш", շ: "ш", Ո: "О", ո: "о",
  Չ: "Ч", չ: "ч", Պ: "П", պ: "п", Ջ: "Дж", ջ: "дж", Ռ: "Р", ռ: "р",
  Ս: "С", ս: "с", Վ: "В", վ: "в", Տ: "Т", տ: "т", Ր: "Р", ր: "р",
  Ց: "Ц", ց: "ц", Ւ: "В", ւ: "в", Փ: "П", փ: "п", Ք: "К", ք: "к",
  Օ: "О", օ: "о", Ֆ: "Ф", ֆ: "ф", և: "ев",
};

const HAS_ARMENIAN = /[԰-֏]/;

function toLatin(text: string): string {
  let out = text;
  for (const [re, to] of LATIN_DIGRAPHS) out = out.replace(re, to);
  return [...out].map((ch) => LATIN[ch] ?? ch).join("");
}

function toCyrillic(text: string): string {
  // Positional rules run on Armenian text, before the digraph and letter
  // passes, because both of them test the *following* Armenian letter.
  let out = applyCyrillicLRule(applyCyrillicHRule(text));
  for (const [re, to] of CYRILLIC_DIGRAPHS) out = out.replace(re, to);
  return [...out].map((ch) => CYRILLIC[ch] ?? ch).join("");
}

/** One name part (given name or surname), rendered for the active locale. */
export function transliterateName(text: string, locale: Locale): string {
  // Nothing Armenian in it — an already-Latin or already-Cyrillic name is
  // returned untouched rather than mangled character by character.
  if (locale === "hy" || !HAS_ARMENIAN.test(text)) return text;
  return locale === "ru" ? toCyrillic(text) : toLatin(text);
}

/** "Given Surname" for the active locale, skipping missing parts. */
export function displayFullName(
  firstName: string | undefined,
  lastName: string | undefined,
  locale: Locale,
): string {
  return [firstName, lastName]
    .filter((p): p is string => Boolean(p && p.trim()))
    .map((p) => transliterateName(p.trim(), locale))
    .join(" ");
}
