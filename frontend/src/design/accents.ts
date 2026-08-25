// Generated verbatim from the design source's `ACCENTS` array (tessera-data.js).
export type AccentId = "black" | "neutral" | "steel" | "sage" | "plum" | "brick" | "ochre";

// Hand-added (not from the source): every non-black accent's swatch is dark/
// muted-mid-tone enough that one fixed light foreground works in both
// themes — only black needs the full per-theme inversion tessera.css does
// (brief §8). Matches light theme's own black-accent --accent-fg exactly.
export const NON_BLACK_ACCENT_FG = "#F4F3F1";

// Brief §8, verbatim: "When the accent is achromatic — black, neutral,
// anything with no hue — --accent-tint falls back to a neutral steel
// #5A6472." Named explicitly rather than left to a saturation threshold:
// black (#101112) and neutral (#1E2124) both measure a few percent of real
// HSL saturation (not exactly 0), and a threshold wide enough to catch both
// also catches genuinely-colored accents like sage (~13% saturation) — the
// brief's own two examples don't separate cleanly from the rest by any single
// cutoff, so this lists them by id instead of trying to compute "achromatic."
export const ACHROMATIC_ACCENT_IDS: ReadonlySet<AccentId> = new Set(["black", "neutral"]);

export const ACCENTS = [
  {
    "id": "black",
    "label": {
      "hy": "Սև",
      "en": "Black",
      "ru": "Чёрный"
    },
    "hex": "#101112",
    "swatch": "#101112"
  },
  {
    "id": "neutral",
    "label": {
      "hy": "Չեզոք",
      "en": "Neutral",
      "ru": "Нейтральный"
    },
    "hex": "#1E2124",
    "swatch": "#1e2124"
  },
  {
    "id": "steel",
    "label": {
      "hy": "Մարած պողպատագույն",
      "en": "Muted steel",
      "ru": "Приглушённый стальной"
    },
    "hex": "#47657F",
    "swatch": "#47657f"
  },
  {
    "id": "sage",
    "label": {
      "hy": "Մարած եղեսպակի",
      "en": "Muted sage",
      "ru": "Приглушённый шалфей"
    },
    "hex": "#5B7358",
    "swatch": "#5b7358"
  },
  {
    "id": "plum",
    "label": {
      "hy": "Մարած սալորագույն",
      "en": "Muted plum",
      "ru": "Приглушённый сливовый"
    },
    "hex": "#6B4A63",
    "swatch": "#6b4a63"
  },
  {
    "id": "brick",
    "label": {
      "hy": "Մարած աղյուսագույն",
      "en": "Muted brick",
      "ru": "Приглушённый кирпичный"
    },
    "hex": "#8A4A3E",
    "swatch": "#8a4a3e"
  },
  {
    "id": "ochre",
    "label": {
      "hy": "Մարած օխրա",
      "en": "Muted ochre",
      "ru": "Приглушённая охра"
    },
    "hex": "#87672C",
    "swatch": "#87672c"
  }
] as const;
