// Generated from the design source's `BGS` array (Tessera.dc.html) and
// brief §11ter's background table — the four named backgrounds. `hex` is
// for rendering a swatch before the corresponding CSS variable applies
// (e.g. a picker button for a background that isn't the active one); it
// must match tessera.css's [data-bg="…"] --bg-base exactly.
export type BackgroundId = "deep" | "coal" | "cream" | "grey";

export const BACKGROUNDS: { id: BackgroundId; light: boolean; hex: string }[] = [
  { id: "deep", light: false, hex: "#05070D" },
  { id: "coal", light: false, hex: "#101114" },
  { id: "cream", light: true, hex: "#F4F2EE" },
  { id: "grey", light: true, hex: "#E8E8EC" },
];
