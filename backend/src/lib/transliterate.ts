// Armenian → Latin, letter by letter, for the ASCII fallback half of a
// filename (EXP-6): `Tessera_11-B_Hanrahashiv_1-kisamyak_2026-11-20.xlsx`.
// Not a precision, round-trippable romanization — a few letters share a
// Latin target (Ց/Ծ both → "ts", Կ/Ք both → "k") — that is fine here: the
// UTF-8 `filename*` parameter carries the real name, this is only so old
// clients and quick glances at a downloads folder get something readable
// rather than percent-encoded noise or a dropped extension.
const MAP: Record<string, string> = {
  Ա: "A", ա: "a",
  Բ: "B", բ: "b",
  Գ: "G", գ: "g",
  Դ: "D", դ: "d",
  Ե: "E", ե: "e",
  Զ: "Z", զ: "z",
  Է: "E", է: "e",
  Ը: "Y", ը: "y",
  Թ: "T", թ: "t",
  Ժ: "Zh", ժ: "zh",
  Ի: "I", ի: "i",
  Լ: "L", լ: "l",
  Խ: "Kh", խ: "kh",
  Ծ: "Ts", ծ: "ts",
  Կ: "K", կ: "k",
  Հ: "H", հ: "h",
  Ձ: "Dz", ձ: "dz",
  Ղ: "Gh", ղ: "gh",
  Ճ: "Ch", ճ: "ch",
  Մ: "M", մ: "m",
  Յ: "Y", յ: "y",
  Ն: "N", ն: "n",
  Շ: "Sh", շ: "sh",
  Ո: "O", ո: "o",
  Չ: "Ch", չ: "ch",
  Պ: "P", պ: "p",
  Ջ: "J", ջ: "j",
  Ռ: "R", ռ: "r",
  Ս: "S", ս: "s",
  Վ: "V", վ: "v",
  Տ: "T", տ: "t",
  Ր: "R", ր: "r",
  Ց: "Ts", ց: "ts",
  Ւ: "V", ւ: "v",
  Փ: "P", փ: "p",
  Ք: "K", ք: "k",
  Օ: "O", օ: "o",
  Ֆ: "F", ֆ: "f",
  և: "ev",
};

export function transliterate(text: string): string {
  return [...text].map((ch) => MAP[ch] ?? ch).join("");
}

// A filename segment: transliterated, whitespace collapsed to `-`, and
// anything left outside `[A-Za-z0-9-]` dropped rather than percent-escaped
// — a plain `Content-Disposition: filename=` value has to stay ASCII with
// no separator characters at all.
export function filenameSegment(text: string): string {
  return transliterate(text)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9-]/g, "");
}
