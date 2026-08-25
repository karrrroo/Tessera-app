// Derives --accent-tint from a chosen accent's hex (brief §8): "the accent's
// hue, forced to ~55% saturation and ~52% lightness." The two named
// achromatic accents (design/accents.ts ACHROMATIC_ACCENT_IDS) never reach
// this — the caller substitutes the fixed steel fallback for those instead.
// This function still guards the case of an exactly-grey delta (s=0, hue
// undefined) by returning the fallback too, since ~0% saturation has no hue
// to preserve — but that's a defensive floor, not the primary achromatic
// check.
export const FALLBACK_TINT = "#5A6472";
const TINT_SATURATION = 55;
const TINT_LIGHTNESS = 52;

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) {
    h = ((g - b) / delta) % 6;
  } else if (max === g) {
    h = (b - r) / delta + 2;
  } else {
    h = (r - g) / delta + 4;
  }
  h = h * 60;
  if (h < 0) h += 360;

  return { h, s: s * 100, l: l * 100 };
}

export function deriveAccentTint(accentHex: string): string {
  const { h, s } = hexToHsl(accentHex);
  if (s === 0) return FALLBACK_TINT;
  return `hsl(${h.toFixed(1)} ${TINT_SATURATION}% ${TINT_LIGHTNESS}%)`;
}
