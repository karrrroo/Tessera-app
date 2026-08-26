import { randomInt } from "node:crypto";

// Unambiguous charset — no 0/O, 1/l/I, so a director reading it aloud from a
// printed handout sheet (roadmap ADM-6) doesn't have to guess. Format
// "Xxxx-xxx9" style, matching the roadmap's own example ("Kf7-mQ2p"):
// mixed case plus at least one digit, always meeting isPasswordStrongEnough.
const LETTERS_UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const LETTERS_LOWER = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
const CHARSET = LETTERS_UPPER + LETTERS_LOWER + DIGITS;

function randomChar(charset: string): string {
  return charset[randomInt(charset.length)];
}

export function generateTemporaryPassword(): string {
  const half = () =>
    Array.from({ length: 4 }, () => randomChar(CHARSET)).join("");
  // Guarantee at least one uppercase and one digit regardless of what the
  // random draw produced, by overwriting one fixed position in each half.
  const first = replaceAt(half(), 0, randomChar(LETTERS_UPPER));
  const second = replaceAt(half(), 0, randomChar(DIGITS));
  return `${first}-${second}`;
}

function replaceAt(s: string, index: number, char: string): string {
  return s.slice(0, index) + char + s.slice(index + 1);
}
