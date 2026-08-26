import { createHash, createHmac } from "node:crypto";
import { env } from "../../lib/env.js";

// RFC4648 base32, no padding — chosen (over hex) because it's denser (5
// bits/char vs. 4) while every character still sits in QR's alphanumeric set
// (0-9 A-Z space $ % * + - . / :), which is what buys the 29x29 module count
// (roadmap: "alphanumeric mode... EC level Q" measured against this exact
// payload length). Both halves below are exactly 10 bytes (80 bits), so
// encoding/decoding lands on a byte boundary with zero padding either way.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const HANDLE_BYTES = 10;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

export function base32Decode(str: string): Buffer | null {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of str) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) return null;
    value = ((value << 5) | idx) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ID-4: static, no expiry — both keys and `seed` are fixed, so this is a
// pure function of its input with nothing else read. No clock anywhere here.
export function deriveHandle(seed: string): Buffer {
  return createHmac("sha256", env.QR_HANDLE_KEY).update(seed).digest().subarray(0, HANDLE_BYTES);
}

export function deriveMac(handle: Buffer): Buffer {
  return createHmac("sha256", env.QR_SIGNING_SECRET).update(handle).digest().subarray(0, HANDLE_BYTES);
}

export function buildPayload(seed: string): string {
  const handle = deriveHandle(seed);
  const mac = deriveMac(handle);
  return `${base32Encode(handle)}.${base32Encode(mac)}`;
}

export type ParsedPayload = { handle: Buffer; mac: Buffer };

// Malformed shape (wrong length, missing dot, non-alphanumeric char) is a
// request error (SCAN_PAYLOAD_MALFORMED), not a verify result — there isn't
// even a candidate handle to look up. Uppercasing here (not just on the way
// in) means a lowercase base32 string decodes the same as its uppercase
// form, since the alphabet itself is case-sensitive.
export function parsePayload(raw: string): ParsedPayload | null {
  const upper = raw.toUpperCase();
  const parts = upper.split(".");
  if (parts.length !== 2) return null;
  const [handlePart, macPart] = parts;
  if (handlePart.length !== 16 || macPart.length !== 16) return null;
  const handle = base32Decode(handlePart);
  const mac = base32Decode(macPart);
  if (!handle || !mac || handle.length !== HANDLE_BYTES || mac.length !== HANDLE_BYTES) return null;
  return { handle, mac };
}

export function handleKey(handle: Buffer): string {
  return handle.toString("hex");
}

// C14 / PRD §11.5.4 — the card's own identifier, unrelated to
// emis_student_id (which stays null and unread). Derived, not stored: no
// schema change, and the design package's own field for this is literally
// named `emis`, which is exactly the wrong wiring this avoids.
export function deriveTesseraId(studentId: string): string {
  const hex = createHash("md5").update(studentId).digest("hex");
  return `TSR-AM-${hex.slice(0, 4).toUpperCase()}-${hex.slice(4, 8).toUpperCase()}`;
}
