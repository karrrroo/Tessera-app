# Tessera v2 — Design brief, consolidated (final state)

**This document is a consolidation, not a tenth source file.** The visual brief for
Tessera is not one document — per `tessera-roadmap.md` Appendix B ("The brief is nine
files, not one"), it is a base document plus eight correction/delta files that only
make sense applied cumulatively, in order, each one building on the state left by the
last. This file reads all nine, resolves every point where a later file changes what an
earlier one said, and writes down the result as a single coherent spec — the design as
it stands today, not a changelog of how it got here.

Per Appendix B's own instruction, this consolidation belongs **before Phase 4** (design
tokens, shell, theming) — Phase 4 and everything after it should be built against this
file, not against any of the nine originals individually.

**Source chain, in required reading/application order:**

0. `tessera-v2-FINAL (3).md` — base
1. `tessera-v2.1-corrections.md`
2. `tessera-v2.2-final-fixes.md`
3. `tessera-v2.4-fixes.md`
4. `tessera-corrections-2.md`
5. `tessera-corrections-3.md`
6. `tessera-corrections-4.md`
7. `tessera-corrections-5.md`
8. `tessera-corrections-6.md`

All nine live under `Design System/design sistem-handoff/design-sistem/project/uploads/`.
**Not part of this chain, and not consulted for anything that conflicts with it:**
`tessera-design-brief.md` / `tessera-design-brief (1).md` (an earlier, abandoned
"final" draft — it claims to be the single source of truth and is not; it still shows
the Iter button as glass-only with no gradient, which this chain restores in
corrections-2 §4), `tessera-v2-restyle-brief.md` / `(1).md`, and
`tessera-without-emis.md`.

Where a value below was revised more than once across the chain, an inline bracketed
note gives its provenance, e.g. `[final per corrections-5 §2, superseding v2.1 §1 and
v2.4 §1]`, so a future reader can see why the value is what it is without re-deriving
the chronology. Unrevised details carry no such note — only genuinely contested points
are annotated, to keep this readable as a spec rather than a diff.

---

## 0. How to use this

You are given a working prototype and told to **restyle it, not rebuild it.** Unchanged
throughout the whole chain: every screen that exists, the navigation structure, the
data, the copy, the interaction logic, the state model, the feature set — except where
a delta explicitly changes behaviour (the QR's validity mechanic, the teacher's
credential, keyboard grade entry), and those changes are called out below exactly
where they occur.

Changed across the chain: surface, colour, depth, radius, motion, the logo, the bottom
navigation, the login screen, the ID card, the widgets, the app icon, and the addition
of Iter — all as amended by the eight deltas, not as first stated in the base.

If a visual change would require altering behaviour, that is flagged rather than
shipped silently — see §18.

---

## 0.1 The contract

The base brief listed twenty items that must exist. Eight rounds of corrections later,
several of those items have changed shape or been retired outright. This is the
current list — confirm each one, in the current form, not the original one.

| # | Must exist | Section | Note |
|---|---|---|---|
| 1 | **Login screen** — the app starts here (after a once-per-session splash), nothing renders behind it | 8bis |  |
| 2 | **Web / Mobile preview switch** — working from the login screen onward | 8ter |  |
| 3 | Floating pill bottom navigation with an expanding active item, laid out as two fixed-width groups either side of a reserved centre | 9 | layout rebuilt, corrections-5 §2 |
| 4 | **Docked circular QR button**, blue, set into the centre of the nav pill — **not detached** | 9 | moved off the pill entirely then docked into it; no longer floating anywhere [final per v2.1 §1, refined through v2.4 §1–2, corrections-2 §4–5, corrections-4 §3.1, corrections-5 §2] |
| 5 | **Floating circular Iter button**, violet, bottom-right, independent of the QR — **not stacked above it** | 11bis | position and existence toggled repeatedly before settling; see §11bis |
| 6 | **Iter chat panel** — header, empty state (greeting + drifting gradient band, no orb), chips, attachments row, message list, pinned input | 11bis |  |
| 7 | **All eleven widgets**, fully rendered, on a mock home screen, each with its own hue | 11 | five in the base, nine by v2.2 §7, eleven by v2.2 §7 with the colour system replaced again by corrections-6 §3 |
| 8 | **Student ID card** as a credential, with the QR sheet, present on both mobile and web | 10 | web version added, corrections-6 §1 |
| 9 | **App icon** at 1024 / 180 / 120 / 64 / 32 | 12 | unaffected by any delta |
| 10 | The wordmark in every logo position, in its three forms (Mark / LOCKUP‑H / LOCKUP‑INTEGRATED) | 3 |  |
| 11 | Black accent with the dark-theme inversion | 8 |  |
| 12 | Gradient mesh **plus grain** on every gradient surface, with no visible edge anywhere a gradient meets a surface | 5.1, 5.2 | "no visible edge" rule added, corrections-4 §2 |
| 13 | Two-layer glass everywhere glass is used | 5.3 |  |
| 14 | **The full motion system** — every animation in §13, as amended (the orb is gone; six mesh-based motions and a splash sequence replace it) | 13 |  |
| 15 | **Eleven widgets**, including the Ask Iter launcher | 11 | see #7 |
| 16 | **Settings** with the support / feedback group, and **without** the Iter-position row (removed) | 11ter | Iter position setting introduced then removed, v2.2 §3.3 → v2.4 §1 |
| 17 | **No teacher credential.** Teachers have no ID card, no QR, and no QR glyph anywhere. In its place: an "Այսօր" (Today) screen and a plus-glyph docked button | 10bis | reverses the base's teacher card variant entirely [final per corrections-6 §2] |
| 18 | Collapsible sidebar, and a clickable logo that goes home | 8quater |  |
| 19 | Swipe-to-dismiss notifications | 13 |  |
| 20 | Every v1 screen still present and working | 15 |  |

Items 1, 2, 5, 6, 7 and 14 were called out in the base as easy to miss. Given how many
times items 4, 5, 7, 14, 16 and 17 were revised across the chain, check those twice as
well.

---

## 1. What Tessera is

Unchanged through all eight deltas. A digital academic record and student ID for
Armenian schools. It sits on top of the state EMIS system and never replaces it.

A **student** views marks, an archive, and a QR student ID card. A **teacher** enters
marks as drafts, commits them to EMIS, and reviews non-formal credential requests. As
of corrections-6 §2, a teacher does **not** hold a credential of their own — see §10bis.

Armenian first, plus English and Russian.

The single most-used action in the product is a student opening their QR at a door.
Design decisions favour that moment.

---

## 2. Constraints that override everything

Unchanged through the whole chain — nothing in any of the eight deltas touches these.

**2.1 The grade colour scale never changes.** Marks 1–10 map to fixed colours — not
re-tinted, not adjusted for a dark background, not made translucent, never derived from
the accent. Colour carries meaning here. This holds even where a widget's own hue is
now grade-derived (§11) — a grade tile's own fixed hex is never touched, only the
widget shell around it.

**2.2 Data surfaces are opaque.** Anything showing a mark, grid, table, chart or the ID
card sits on a solid background. See §14.

**2.3 Text contrast stays at 4.5:1** against what is actually behind it, including
through a translucent layer. Move or darken the gradient rather than adding a text
shadow.

**2.4 Marks remain append-only.** Corrections appear as new entries with history.

**2.5 The QR must always scan.** Solid white, never glass, never tinted, works offline.
As of v2.4 §3 / corrections-2 §5, the QR pattern is also permanently static (see §10) —
scannability no longer competes with a re-render.

**2.6 Nothing is removed to make room.** If a section feels crowded, reduce the styling,
not the content.

---

## 3. The logo and wordmark

### 3.1 The Mark

Use this SVG exactly. Correct padding, inherits colour. Unchanged since the base.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-115 -102 1212 1212" fill="currentColor" role="img" aria-label="Tessera">
  <path id="mark-glyph" d="M476.5 1000.0C449.1 994.3,430.7 964.6,427.8 921.8C424.7 874.8,424.6 863.9,427.5 840.5C429.5 824.2,429.9 804.5,428.5 799.3C426.6 793.0,424.2 792.4,410.9 794.8C362.1 803.8,350.0 747.5,380.1 651.0C391.2 615.1,393.3 607.6,398.7 583.1C400.6 574.3,403.4 561.9,405.0 555.4C415.1 512.9,410.0 486.4,387.4 465.0C369.1 447.7,349.5 448.0,309.6 466.3C302.9 469.4,293.8 473.5,289.5 475.4C285.2 477.3,273.1 483.1,262.7 488.4C208.1 515.6,162.1 529.3,125.0 529.3C76.1 529.3,51.0 479.4,80.3 440.5C109.8 401.3,205.6 354.1,280.8 341.8C331.5 333.4,352.5 333.5,402.8 342.0C439.2 348.1,447.5 348.4,456.5 343.9C467.6 338.3,470.2 324.3,463.0 309.4C460.7 304.7,459.9 303.5,447.0 284.4C427.3 255.1,421.6 232.3,419.5 173.4C417.5 116.2,422.0 90.5,440.7 53.2C466.9 0.8,507.5 -22.3,534.2 0.0C550.5 13.6,552.9 35.3,542.9 77.8C537.6 99.9,537.1 103.5,535.3 126.6C534.7 135.7,533.5 148.5,532.8 155.0C525.1 225.9,539.0 260.5,582.0 277.5C615.9 291.0,638.2 286.8,728.2 250.4C763.6 236.1,788.4 237.1,795.9 253.2C801.8 265.8,792.1 279.3,763.6 298.1C732.4 318.6,749.2 325.8,806.8 316.4C857.7 308.2,879.4 306.9,900.8 311.1C947.1 320.0,957.1 360.9,919.7 388.8C896.8 405.9,841.9 415.3,785.2 411.8C771.5 411.0,763.6 410.1,742.4 407.1C648.5 393.7,588.3 425.6,556.1 505.9C529.4 572.5,524.3 602.0,524.0 693.2C523.7 766.4,523.8 770.3,528.1 814.5C539.4 930.1,540.1 946.8,534.0 964.9C525.6 990.1,501.0 1005.1,476.5 1000.0Z"/>
  <path id="mark-spark" d="M716.6 849.5C692.7 846.7,689.6 828.8,706.8 793.0C732.2 740.4,732.8 719.2,710.0 687.1C694.2 664.9,690.3 655.7,690.2 641.0C690.1 622.2,699.0 607.2,727.8 577.5C757.3 547.0,779.8 536.2,797.0 544.2C813.8 552.1,816.2 571.6,804.2 602.5C791.1 636.0,791.0 644.6,803.4 667.2C809.6 678.6,814.6 689.2,816.4 694.8C833.5 747.0,789.7 830.4,736.3 847.3C731.8 848.7,729.8 849.1,722.7 849.8C721.6 849.9,718.9 849.8,716.6 849.5Z"/>
</svg>
```

The two paths are named `mark-glyph` and `mark-spark`, and keep those ids — the entry
animation (§13.2) and the wordmark composition below (§3.2) both animate/position them
separately.

**One reusable `Mark` component.** Never paste the paths anywhere else.

**Colour** — never hardcode a fill; it uses `currentColor`.

| Context | Colour |
|---|---|
| Dark / gradient | `#F4F2EE` |
| Light / cream | `#101112` |
| App chrome | `var(--text)` |

No purple. `#A17DFF` was a working value and appears nowhere in v2.

**Sizes** — header 28 · sidebar 26 · login 76 (mobile card) · footer 24 · splash 96 ·
ID card 64 · Iter panel 22. (The splash and the wide-login left column now show the
full integrated wordmark, not the bare Mark, at the sizes given in §3.2 — 280px and
200px respectively — the 96px/76px Mark-alone sizes remain for the collapsed sidebar,
footer, and the narrow (<900px) login card.)

**Small sizes.** `mark-spark` is part of the mark and is never cropped at 20px or
above. Below that it becomes an indistinct dot, so the favicon and app icon use
`mark-glyph` alone, scaled to fill.

### 3.2 The integrated wordmark — three forms, and where each goes

*[Introduced v2.1 §3; proportions revised across corrections-2 §1, corrections-3 §1,
corrections-4 §1, and corrections-5 §1 — the numbers below are corrections-4's exact
ratio table as amended by corrections-5. Do not use the rougher descriptions from
v2.1/corrections-2/corrections-3 for the numeric ratios; those are superseded, though
their qualitative direction (T large, e tucked, spark lowered) still describes the
intent correctly.]*

The main glyph reads as a lowercase "t". Three logo forms exist:

- **LOCKUP‑INTEGRATED** — the mark serves as the letter "t", with "essera" set
  immediately after it. Used on: the login screen, the splash, any marketing surface.
  Large only, **never below 120px wide.**
- **LOCKUP‑H** (mark + full "Tessera", horizontal) — used in: the header, the footer,
  the sidebar. Anywhere small, and anywhere someone might be seeing the brand for the
  first time — "essera" alone only reads as "Tessera" once you already know the brand,
  and at header size, to a first-time viewer, it reads as a typo.
- **MARK alone** — used in: the collapsed sidebar, favicon, app icon.

#### Proportions (LOCKUP‑INTEGRATED)

All measurements are multiples of **x**, the x-height of the typeset letters. Set the
type size first, measure its x-height, then place everything against that.

**The glyph (the "T")**
- Top edge: **1.90x** above the baseline
- Descender bottom: **1.30x** below the baseline
- Total height: **3.20x**
- Crossbar centre: **1.15x** above the baseline
- For reference, typeset cap height is about 1.40x — the glyph's top rises roughly 35%
  higher than a capital letter would. If it looks like a slightly enlarged letter, it
  is still too small.

**The "e" (tucked under the crossbar)**
- Left edge sits under the glyph's crossbar, not beside it
- Horizontal overlap with the glyph's bounding box: **0.45x**
  `[final per corrections-5 §1, superseding corrections-4 §1's 0.30x, which itself
  superseded corrections-2 §1's unitless "as close as 2px"]`
- Minimum clearance at the closest point: **0.06x** of clear space — it must never
  touch the crossbar. If 0.45x overlap would close that gap, reduce the overlap until
  exactly 0.06x of air remains, and no further.
- Vertically: on the shared baseline like every other letter. Only its horizontal
  position changes.
- Test: at a glance the word should read as one shape, not a logo followed by a gap
  followed by a word.

**The spark (the first "s", using the `mark-spark` path)**
- Height: **1.05x** — fits inside the x-height band with only a slight overshoot
  `[final per corrections-4 §1, superseding the "~1.15×" figure given in both
  corrections-2 §1 and corrections-3 §1]`
- Width: **0.42x** — narrow; it is a curl, not a round letter, and forcing typeset-"s"
  width makes it look inflated
- Bottom edge: **0.05x below** the baseline, as a round-letter overshoot
- Top edge: **1.00x** above the baseline — level with the top of the "e" beside it, and
  nowhere near the crossbar (1.15x)
- Side clearance: **0.18x** on both sides — the same as the space between any two
  typeset letters
- Diagnostic: draw a horizontal line across the top of the "e" — the spark's top must
  touch that line exactly.

**The second "s" — unresolved.** Two variants were requested and never adjudicated in
any later file; see "Unresolved or ambiguous points" at the end of this document.

**The rest — "e r a"** — normal typesetting, letter-spacing between -1% and 0, never
positive (loose tracking undoes the tucked "e" and breaks the word apart again).

**Final spelling: T · e · s · s · e · r · a. Seven letters. Both s's present.**

#### Layout / box model

*[corrections-5 §1]* The lockup must be laid out as a block with an explicit height,
not a line of text — a text line-box does not know about the descender that drops
1.30x below baseline, and content below it collides with the tail.

- Wrap the lockup in a container: `display: block`, fixed height **3.20x** (the
  glyph's full top-to-descender measure), `overflow: visible` so nothing is clipped
  while the declared height still reserves the space
- `margin-bottom: 0.9x` before whatever follows (e.g. the login heading), measured from
  the container's bottom edge — which is now the descender's bottom, not the baseline
- Verify at both 375px and 1440px; the collision may appear at only one width

#### Typeface for "essera" — unresolved

Noto Serif Armenian, as originally specified for the integrated lockup (v2.1 §3), was
later judged the wrong call — it is an interface face (neutral, engineered for small-size
legibility across scripts) paired against a hand-drawn, variable-weight, asymmetric
mark. Three replacement directions were proposed and explicitly left open (corrections-2
§2: **"Do not pick one yourself"**), and no later file in this chain records a decision:

1. A high-contrast serif (Playfair Display, or Bodoni Moda) — echoes the mark's own
   thick-to-thin variation; risks reading as fashion/editorial rather than institutional
2. A humanist serif (EB Garamond, or Spectral) — closest to a pen's feeling, warm, holds
   up in an official document; risk: quieter, the mark may dominate it
3. A geometric sans, light weight (Outfit Light, or Jost Light) — maximum contrast
   between mark and type, mark carries the personality; risk: the pairing can look
   arbitrary if weights aren't carefully matched

Whichever is chosen: weight 400 never bold, letter-spacing between -1% and 0 never
positive, lowercase throughout (no capital E), and it must have full Armenian and
Russian coverage or it is disqualified regardless of how it looks — the product is
Armenian first. See "Unresolved or ambiguous points."

(Note: this reconsideration is scoped to the "essera" text as set in the
LOCKUP‑INTEGRATED form. Nothing in the chain revisits the base's general typography
rule in §7 — Noto Serif Armenian for headings elsewhere, including the plain "Tessera"
text in LOCKUP‑H — so that continues to apply everywhere outside the integrated
lockup's own wordplay.)

---

## 4. Colour

Unchanged through the whole chain except where §9 and §11 note specific new hex values
for the QR/Iter buttons' inverse blooms and the widgets' per-widget hues — those are
additions to this palette, not replacements of it.

### 4.1 Base tokens

```
--bg-base      #05070D
--bg-raised    #0D1017
--ink          #F4F2EE
--ink-2        rgba(244,242,238,.72)
--ink-3        rgba(244,242,238,.48)
--hair         rgba(255,255,255,.11)
--hair-bright  rgba(255,255,255,.18)
--hair-top     rgba(255,255,255,.28)
```

`--bg-base` is now user-selectable (§11ter) among four options; `--bg-raised` derives
from whichever is chosen.

### 4.2 Palette Deep — the primary identity

Dark theme, login, splash, ID card, widgets (base shell), app icon.

```
deep    #0B3FC9    deep blue, largest area
mid     #1E8FE0    bright blue
bright  #25D3C4    cyan-teal, the light source
violet  #6B45E0    accent, 15% of the area at most
```

**Build it as light emerging from darkness, not colour blocking.** One `bright` core,
`mid` spreading from it, `deep` filling most of the frame, true near-black in the
corners. The eye must find the single place the light comes from.

### 4.3 Palette Aura — light theme

```
base    #F7F7F9
azure   #3A6BF0
sky     #8FC4FA
lilac   #B9A9F5
```

One or two large blooms at 22–30% opacity, heavily feathered, drifting off the frame
edge rather than centred. Everything else stays v1's cream and grey.

---

## 5. Surfaces

### 5.1 Gradient mesh

CSS only. Four to five `radial-gradient(circle at X% Y%, COLOR 0%, transparent 60%)`
blobs, 900–1400px across, overlapping, 40–55% opacity for Deep and 22–30% for Aura.
Soft edges everywhere. No hard stops, no conic gradients (the one conic gradient in the
product, the Iter thinking-ring border, is not a background mesh — see §11bis).

Appears on: login, splash, ID card, widget surfaces, Iter panel, full-bleed empty
states. **Never behind the gradebook, mosaic, tables or analytics** — flat
`--bg-base` there.

**No gradient in Tessera has a visible edge.** *[corrections-4 §2 — stated as a
universal principle after the Iter panel shipped with a flat teal rectangle that had a
hard horizontal stop]* Wherever a radial or elliptical gradient meets a surface, its
`transparent` stop must be reached well inside the boundary, so the colour has fully
faded to nothing before any edge. If you can point to where "the colour ends," push the
transparent stop further in and lower the opacity. This applies to the login/splash
mesh, the widget blooms, and the Iter panel background alike.

Motion for this surface — entry, screen-change drift, palette cross-fade — moved out of
this section into §13 (motion), where all of it was rewritten by corrections-3 to
replace the orb (see §13 and §11bis).

### 5.2 Grain — not optional

Overlay every gradient surface with an SVG `feTurbulence` layer: `baseFrequency 0.8`,
3 octaves, `opacity: .055`, `mix-blend-mode: overlay`, `pointer-events: none`.

The highest-value detail in this brief. Without it a CSS gradient reads flat and cheap;
with it, photographic. Unchanged through the whole chain — every later delta that
touches a gradient surface (the widgets, the Iter panel, the docked buttons) explicitly
re-confirms grain over it rather than removing it.

### 5.3 Layered glass — the technique

Real frosted glass is **two layers**: a solid object underneath, and a translucent
panel over **part** of it, so the object visibly softens where covered. A single
translucent rectangle is a grey box, not glass.

```
Layer 1   solid object — #0D1017 rounded rect, or a vivid gradient shape
Layer 2   frosted panel, partially overlapping:
          background: rgba(255,255,255,.10)
          backdrop-filter: blur(22px) saturate(160%)
          -webkit-backdrop-filter: blur(22px) saturate(160%)
          border: 1px solid var(--hair-bright)
Layer 3   1px inset highlight, top edge only, var(--hair-top)
```

**The panel must overlap the object partially.** The moment where the object passes
under the panel edge and goes soft is the entire effect. Full coverage kills it.

**Budget: `backdrop-filter` on 8 elements or fewer per screen.** Never inside a
scrolling list, never stacked two deep. Wrap in
`@supports (backdrop-filter: blur(1px))` with a solid `rgba(255,255,255,.07)` fallback.

The Iter button lost, then regained, its use of glass-plus-gradient — see §11bis; the
two-layer glass *technique* itself was never in dispute across any delta.

### 5.4 Soft-light surfaces — light theme

```
background: #FFFFFF;
box-shadow: 0 2px 10px rgba(16,17,18,.06), 0 10px 30px rgba(16,17,18,.05);
border: none;
```

No hard borders, no dark shadows, no inner shadows. Use for the floating nav, inputs
and pills in light theme.

### 5.5 Particle field

A dotted sphere of cyan and magenta points on black, used **sparingly** — behind the
login/splash mark at 40% opacity heavily feathered, and as a static bloom behind the
QR sheet. Decorative, no product meaning. Static except where the mesh motion in §13
overlaps it. Never behind data.

---

## 6. Radii and elevation

| Element | Radius |
|---|---|
| Sheet, large container | 34px |
| Card, panel, widget | 26px |
| App icon squircle | 24% of width |
| Input, small card | 18px |
| Chip, tag | 14px |
| Button, floating nav | 999px |

Nothing sharp, nothing below 14px. Shadows on dark: `0 8px 40px rgba(0,0,0,.35)` at
most. No glows, no neon, no borders brighter than `--hair-top`.

**The QR's white square is a documented exception to this scale**, at **24px**, up from
an initial 18px `[v2.1 §6, reconfirmed v2.2 §10.7 and corrections-2 §5]` — it is called
out on its own because a QR square is not a generic "input, small card."

---

## 7. Typography — unchanged

Noto Serif Armenian for headings, Noto Sans Armenian for body, JetBrains Mono for marks
and codes. No display face. Sizes and weights as v1. On dark: headings `--ink`, body
`--ink-2`, secondary `--ink-3`.

The one open question is the "essera" text within the LOCKUP‑INTEGRATED wordmark
specifically — see §3.2. Nothing else in typography was touched by any delta.

---

## 8. Accent — black

Add "Սև / Black" and make it the default.

```
light   --accent #101112   --accentFg #F4F3F1
dark    --accent #F1EFE9   --accentFg #101112
```

**The dark-theme inversion is mandatory.** Black on a dark surface is invisible — the
active nav item, primary button and focus ring would all disappear. Do not solve this
by lightening black to grey.

Accent appears in exactly three places: primary buttons, active navigation, focus ring.
Never on the grade scale, the logo, the widgets, or Iter's own identity colour (violet).

**Buttons.** Primary is solid `--accent` with `--accentFg` text, fully rounded, never
glass or gradient-filled. Secondary is a glass pill with a `--hair` border. (This rule
governs generic UI buttons; the QR and Iter action buttons are a separate component
family with their own fill rules — §9, §11bis.)

### Derived tint — for things that follow the accent without becoming it

```
--accent-tint   the accent's hue, forced to ~55% saturation and ~52% lightness
```

**When the accent is achromatic** — black, neutral, anything with no hue —
`--accent-tint` falls back to a neutral steel `#5A6472`. It never resolves to pure
black or pure white.

Used by: the ID card gradient, the "Ask Iter" widget, and one of the Iter panel's two
empty-state gradient blooms (§11bis). The Iter *button* itself uses a fixed violet, not
the tint — see §11bis for why that changed partway through the chain.

---

## 8bis. Login — the app starts here

**The app opens on this screen** (after a once-per-session splash — see §13). Nothing
else renders until `authed` is true — no sidebar, no bottom pill, no floating buttons,
no content behind it.

### Background
Full-bleed Palette Deep mesh with grain, plus the particle field at 40% opacity behind
the mark, heavily feathered. The most expressive screen in the product; everything
after it calms down. The mesh's arrival, drift, and hand-off from the splash are
specified in §13, not here.

### The card (narrow / mobile, below 900px)
Centred, max-width 380px, layered glass over the gradient, 34px radius.

- `Mark` (bare, not the integrated wordmark) at 76px, `#F4F2EE`
- Heading "Մուտք համակարգ", Noto Serif Armenian 24px
- Below it, 13px `--ink-3`: "Հաշիվները ստեղծում է ուսումնական հաստատությունը"
- Field "Էլ. փոստ կամ ID" — glass input, 18px radius
- Field "Գաղտնաբառ" — same, with a show/hide eye toggle
- Row: "Հիշել այս սարքը" checkbox left, "Մոռացե՞լ եք գաղտնաբառը" link right
- Primary button, full width, "Մուտք"
- Under the card, 12.5px `--ink-3`: "Աջակցություն՝ support@tessera.am"

### Rules
- **No registration link.** Accounts are created by the institution.
- Empty field on submit → inline error under that field, no toast
- Wrong credentials → one line above the button: "Սխալ տվյալներ։ Փորձեք կրկին։"
- The role comes from the account. There is no role switcher in the app. Logging out
  returns here — with no splash (§13); the splash is a first-arrival moment, not a
  transition that repeats.

### Demo row
Below the card, separated by a 1px `--hair` rule, labelled "Ցուցադրական մուտք": three
small ghost pills that fill the fields and enter immediately — "Աշակերտ՝ Անի Հ.",
"Ուսուցիչ՝ Ա. Սարգսյան", "Առաջին մուտք". Keep it visually quiet.

### Web layout — above 900px

*[Base column split and 90% of these rules are unchanged; the centring method and exact
grid technique are v2.1 §4, correcting an off-centre result the base's flex-with-margins
approach was producing.]*

Do not show a small centred card floating in a huge empty gradient. Split it.

- **Left 52%** — the full-bleed Deep gradient with grain and the particle field. The
  **LOCKUP‑INTEGRATED** wordmark at **200px wide** (not the bare Mark), and one line
  beneath in `--ink-2`: "Ակադեմիական գրառումը՝ հեռախոսում, ոչ թե դեկանատում." This whole
  group is centred **both horizontally and vertically** in the column, using
  `display: grid; place-items: center` — not flex with margins, which is what produces
  the off-centre result.
- **Right 48%** — flat `--bg-raised`, no gradient, no glass. The form is centred on both
  axes, max-width 360px, also via `display: grid; place-items: center`. Every field is
  full width of that 360px — heading, subhead, fields, button and demo row all share the
  same left edge and the same width; no ragged column.
- The Web / Mobile switch sits top-right over the right column.

Below 900px this collapses to the centred glass card described above.

**Viewport-fit.** *[v2.1 §5]* The app shell is `height: 100vh` with `overflow: hidden`;
only the content region scrolls. No screen's primary content may begin below 240px from
the top of the viewport at 900px height. Check at 1440×900 and 1280×720.

### Also build
- **Forgot password**, three steps: email → "Նամակն ուղարկված է" with a 60s resend
  countdown → new password with a live requirements checklist
- **Forced first-login password change**, shown instead of the app when
  `user.mustChangePassword` is true, not dismissable

---

## 8ter. Web / Mobile preview switch

Lets whoever is demoing choose the form factor. **This is a prototype preview control,
not a question asked of real users** — in production the device decides.

### The control
A two-option segmented switch, 999px radius, glass, active option a filled `--accent`
pill. Labels "Վեբ" and "Բջջային".

Fixed in the **top-right corner**, always visible — including on the login screen, so
the form factor can be chosen before entering. Hidden below 900px of real browser
width, where the choice is meaningless.

### Web mode
The app fills the browser window. Sidebar navigation, no bottom pill. No floating
circular buttons stack outside the pill any more (see §9, §11bis) — the QR is docked
into the pill and Iter floats independently bottom-right, in web mode too.

### Mobile mode
The whole app renders inside a phone frame on a neutral backdrop.

- Frame: 390 × 844px, 44px radius, 1px `--hair` bezel, a status bar with
  time / signal / battery, a home indicator, `overflow: hidden` so nothing spills past
  the rounded corners
- Stage around the frame: **480 × 920px**, not 1180px wide `[v2.1 §2 — the original
  1180px-wide stage made the frame float in a large empty field and read as a desktop
  page with a small phone in it]`. The frame is centred in the stage, both axes.
- The frame is `position: relative` and everything fixed inside it is `position:
  absolute` — the nav pill, the header, the Iter panel, the QR sheet, toasts. Nothing
  may escape. This is what breaks most often; check every screen in mobile mode.

Switching preserves the current screen and all state. It is not a reload.

---

## 8quater. Header and sidebar

### The logo goes home
In the header, the wordmark (LOCKUP‑H) is **one clickable target**. Clicking it returns
to the main screen — overview for students, gradebook for teachers. Cursor `pointer`,
and on hover the whole lockup lifts to `opacity: .82` over `--t-quick`. This works on
every screen including inside Iter and the QR sheet.

### Collapsible sidebar — web only
The sidebar opens and closes by user choice, not only by breakpoint. State `railOpen`.

- **Expanded** 232px: the LOCKUP‑H, icon plus label per item
- **Collapsed** 68px: `Mark` only, icons only, centred, each with a native title tooltip

**The control** is a 22px circular button sitting on the sidebar's right edge,
vertically near the top, half-overlapping the border — `--bg-raised` fill, 1px `--hair`
border, a chevron pointing left when open and right when closed. It stays reachable in
both states.

Default open at ≥1024px, collapsed at 900–1023px. The user's choice overrides the
default for the session. Animation in §13 (sidebar collapse) — the content area's left
margin animates on the same curve as the sidebar, in step, so nothing tears.

### Header contents
Left: the clickable LOCKUP‑H. Right: the Web / Mobile switch, the language control
(HY·EN·RU, §11ter), and the account block (avatar, name, role) with logout. **No Iter
button lives in the header** — a header-mounted Iter button existed briefly (v2.1 §1,
made a user setting in v2.2 §3.3) and was removed for good in v2.4 §1; see §11bis.

### General web shell layout
*[v2.1 §5]* The shell is `height: 100vh; overflow: hidden`. The header is fixed at the
shell's top, the sidebar fixed at the left, and the content region fills the remainder
with its own `overflow-y: auto`. No screen's primary content begins below 240px from
the viewport top at 900px height. The ID card screen in particular must be vertically
centred in the available content area, never pushed down by top padding.

---

## 9. Bottom navigation — floating pill, with a docked centre button

*[This section changed shape more than any other in the chain. The base's "detached QR
circle beside the pill" design was replaced entirely: v2.1 §1 moved the QR into the
pill's centre slot and moved Iter to the header; v2.4 §1–2 restructured the docked
button's DOM/CSS to stop it being clipped and rebalanced QR-vs-Iter hierarchy;
corrections-2 §4–5 restored the Iter button's gradient and reconfirmed the docked
button's sibling structure; corrections-4 §3 pinned down exact hex values and spacing;
corrections-5 §2 fixed a layout bug where the second nav item slid under the docked
button. The final state below reflects all of that; do not build from the base's
original "two floating circles" description.]*

**This replaces the full-width tab bar from even earlier briefs, and then replaced
itself again to remove the floating QR circle entirely.**

The pill floats, is not attached to the screen edges, and never moves — content scrolls
beneath it; it neither hides on scroll down nor reappears on scroll up.

### Geometry
- A pill, 999px radius, 58px tall
- 16px clear left and right, `calc(14px + env(safe-area-inset-bottom))` below
- Dark: layered glass, `blur(24px)`. Light: soft-light white.

### Layout — four items either side of a reserved centre

*[corrections-5 §2, fixing a bug in the simpler `justify-content: space-between`
structure from v2.4 §2, under which an expanding active item could push the next item
under the docked button]*

Structure the pill as a three-column grid:

```
grid-template-columns: 1fr 78px 1fr;
[ left group ]  [ centre gap, 78px ]  [ right group ]
```

- The centre column (78px — the 58px docked button plus its 5px ring on each side, plus
  clearance) holds nothing; the docked button sits over it, positioned as described
  below.
- The left group holds nav items 1 and 2; the right group holds items 3 and 4. Each
  group is `display: flex; justify-content: space-evenly`.
- **Each group's width never changes.** The active item expands only inside its own
  group, taking space from its sibling within that group, and can never push anything
  across the centre.
- If an expanded item plus its icon-only sibling can't fit (roughly under 150px per
  group): first shrink the label to 12px with 12px horizontal padding; if it still
  doesn't fit, show the active item as a filled circle, icon only, no label. Never
  truncate with an ellipsis, never wrap.
- Verify at 375px, 390px and 430px, with each of the four tabs selected in turn: all
  four icons visible, nothing under the docked button, nothing clipped by the pill's
  edge.

### The active item expands

Not just a colour change — it **grows into a filled pill** containing the icon plus its
label. Background `--accent`, icon and text `--accentFg`, 16px horizontal padding,
label 13px weight 500. Animation per §13. Inactive items are icon-only outline in
`--ink-3`. 24px icons, dropping to 22px if crowded at narrow widths rather than removing
an item.

### The docked centre button

*[Sizes, colours and glow: corrections-2 §4–5 and corrections-4 §3.1 (final). DOM
structure and clipping fix: v2.4 §2, reconfirmed corrections-2 §5.]*

It is not a normal nav item. It is a button that breaks the pill's outline, docked as
a **sibling** of the pill — not a child — so the pill's own `overflow: hidden` (needed
for its rounded corners) cannot clip it:

```html
<div class="navWrap">        <!-- position: relative; NO overflow property -->
  <div class="navPill">      <!-- overflow: hidden; border-radius: 999px; z-index: 1 -->
    ...four nav items, in the two fixed-width groups above...
  </div>
  <button class="qrDock">    <!-- position: absolute; z-index: 2 -->
  </button>
</div>
```

```css
.qrDock {
  left: 50%;
  transform: translateX(-50%);
  top: -21px;                     /* half of 58px, minus a little, so it straddles the edge */
  border: 5px solid var(--bg-base);   /* or the phone frame's own background, if they differ */
  box-sizing: content-box;        /* so 58px stays 58px of visible button */
}
```

No mask, no `clip-path` notch — both break unpredictably. Inside the phone frame, the
5px ring's colour must match the frame's own background, not the page's, if they
differ.

**For students — the QR:**
- 58px circle
- Inverse-bloom fill: `#25D3C4` concentrated in the upper-left third, falling to
  near-black `#062A8A` in the lower right `[final per corrections-4 §3.1, superseding
  corrections-2 §4's "falling into deep #0B3FC9"]` — a centred bright blob would make it
  look like a sticker; the light must come from one corner.
- White QR glyph, 26px, optically centred (about 1px above the mathematical centre —
  the glyph's visual weight sits low)
- Glow `0 6px 22px rgba(11,63,201,.45)`, and nothing else — no border highlight, no
  inner ring
- Press `scale(.90)`, `--t-press`

**For teachers — "add assessment":** *[corrections-6 §2]* Same position, same size, same
treatment, same gradient fill as the student's QR button — **but a plus glyph, not a
QR glyph.** There is no QR anywhere in the teacher role (§10bis). Tapping it opens the
current class's gradebook with a new column already inserted and focus in the first
cell.

Opening the QR (or adding an assessment) is the most frequent action for that role and
does not belong buried among nav items.

### Rules
Tab switching is instant. Every target at least 44×44px. No ripple, no background
highlight, no label on inactive items.

---

## 10. The student ID card

*[Student only, since corrections-6 §2 — see §10bis for what replaced the teacher
variant entirely. Web presence added corrections-6 §1.]*

A physical credential, not a UI panel.

- Portrait, 3:4, radius 28px, max-width 320px, centred
- A **vertical** gradient built from `--accent-tint`: near-white at the very top,
  falling through the tint, into a near-black version of it at the bottom. Light above,
  depth below.
- **The card follows the accent.** With a coloured accent it takes that hue; with the
  default black accent `--accent-tint` resolves to steel and the card reads as
  near-black — both are correct.
- `Mark` in the upper third, 64px, `#FFFFFF`, the only graphic
- Name in white, 20px, Noto Sans Armenian 500, lower third, left aligned
- Role and institution beneath, 13px, `rgba(255,255,255,.68)`
- Grain over the card
- **No glass on the card.** It is a solid object. Glass belongs to the sheet over it.
- Dark in both themes

### Where it lives

- **Mobile** — its own screen, reached from the pill nav.
- **Web** — *[corrections-6 §1]* a sidebar item "Քարտ", between "Առարկաներ" (Subjects)
  and "Հավաստագրեր" (Credentials), in the student role only. The card renders at its
  **natural size** — 320px wide, 3:4 — centred both horizontally and vertically in the
  content area. **Do not scale it to fill the width** — a credential is a physical
  object with a real size; stretched across 1200px it stops reading as one. The
  gradient mesh sits behind it as the screen background, per the usual rules.

### The QR itself

*[The single most-revised subsystem in the whole chain: the base specified a
30-second-rotating code with a progress ring; v2.2 §1 fixed a stability bug within that
30-second model without changing the model; v2.4 §3 replaced the model outright with a
permanently static code, reconfirmed corrections-2 §5. The progress ring, the 30s
countdown, and the cross-fade at each "step" described in the base and in v2.1 §6 no
longer apply to anything — there is no step boundary any more.]*

**THE CODE IS STATIC.** Seeded from the student id, never from time. No countdown, no
progress ring, no re-render, no cross-fade, ever — watched for two full minutes, nothing
moves `[final per v2.4 §3 and corrections-2 §5, superseding the base §10/§13.7 and
v2.2 §1's 30-second-rotating model entirely]`.

**Style** *[v2.1 §6 → v2.4 §3 → corrections-2 §5, cumulative — v2.4 replaces v2.1's
simple per-module rounding with merged-module rounding, and corrections-2 reconfirms
the merged result]*:

- The white square: `#FFFFFF` — white, not cream, since scanners are calibrated for
  white — 24px radius
- Modules: adjacent dark modules **merge** into continuous rounded shapes rather than
  sitting as separate squares. Check each module's four neighbours and round only the
  corners that have no neighbour, at **45%** of a module's width — not more; past that
  the decoder starts guessing. An isolated single module becomes a full circle. This is
  the difference between a code that looks generated and one that looks drawn.
- Colour: modules in `--ink`, not pure black, on the white card
- Finder patterns (the three large corner squares): outer ring a rounded square at 30%
  radius, one module thick; inner block fully round (50% radius)
- Four L-shaped corner brackets, one at each corner of the white card, outside the
  quiet zone: 3px stroke, `stroke-linecap: round`, arms about 14% of the card's width,
  in `--ink` at 100%
- Quiet zone: minimum four clear modules on every side, always — rounding must never
  eat into it. If the merged-module rendering hurts legibility in testing, reduce the
  rounding, never the quiet zone.
- The code sits in the sheet's optical centre, about 6% higher than mathematical
  centre, because the caption below adds visual weight at the bottom

*Note:* the base's caption line "Վավեր է 30 վրկ · թարմացվում է ինքնաբերաբար" ("valid for
30 seconds, refreshes automatically") describes the retired rotating model and has no
replacement text in any file in this chain — flagged in "Unresolved or ambiguous
points."

**Offline:** "Աշխատում է առանց ինտերնետի" — the QR is generated on-device and stays
fully functional with no network, which is now even truer than in the base, since there
is nothing to refresh at all. Do not grey it out.

---

## 10bis. Teachers have no credential — the "Այսօր" (Today) screen

*[corrections-6 §2, fully reversing the base §10's "Teacher variant" and v2.1 §1's
teacher-facing docked button description. In the author's own words: "I specified this
wrongly earlier. I gave teachers the same credential on the reasoning that they pass
through the same doors. That was symmetry for its own sake, not a real need: a teacher
is known by face inside their own school, holds staff status, and has no situation in
which they present a code at a door."]*

**Delete entirely, for the teacher role:**
- The teacher ID card screen
- The QR sheet in the teacher role
- The docked QR button in the teacher's nav pill (replaced — see §9, "For teachers")
- Any ID widget from the teacher widget set

There must be no QR, and no QR glyph, anywhere in the teacher role — check the widget
gallery, Settings, and every screen.

**In its place:** the teacher's "Քարտ" nav slot becomes **"Այսօր"** (Today).

- A glass panel listing today's lessons, one row each: time, class, subject, room
- The current or next lesson is emphasised with a filled left edge in `--accent`
- Above the list, the date, in Noto Serif Armenian
- Below the list, if there are unpublished drafts, one quiet line:
  "Դուք ունեք N չհրապարակված գնահատական"
- Empty state, no lessons that day: "Այսօր դասեր չկան"

The docked centre button in the teacher's nav pill is "Ավելացնել գնահատում" — see §9.

---

## 11. Widgets

*[Grew from five widgets in the base to nine in v2.2 §7 (adding Schedule and Quick
mark) to eleven in v2.2 §7 (adding Calendar and reclassifying groups as
Student/Teacher/Both) — a straightforward accretion, no conflicts there. The colour
system, however, was stated once in the base, restated more elaborately in v2.2 §6.4,
and then explicitly reversed in corrections-6 §3 ("I set a rule earlier that all
widgets use Palette Deep... too strict, and it is the reason they look flat"). The
per-widget hue system below is corrections-6's, and supersedes both the base's
Palette-Deep rule and v2.2 §6.4's accent-tint-derived rule.]*

Three techniques apply to every widget, unchanged since v2.2 §6:

**Inverse bloom** — the centre is dark; the light comes from one corner pushing inward.
A radial gradient with `transparent` at the centre and the widget's colour at 60–100%
reads as depth; a centred bright blob reads as a sticker. The bloom bleeds off at least
one tile edge — it never sits neatly inside it.

**Outer glow** — each widget casts its own colour onto the background beneath it:
`box-shadow: 0 10px 50px -8px <the widget's hue at 45% opacity>`. Subtle at 45%; it
should never form a visible halo edge. In light theme, reduced to 25%.

**Dot-matrix numerals** — large numbers (an average, a class average, a draft count)
render as a dot matrix, not solid type: each digit from 4×6 circles, 2.5px each, in the
grade-scale colour where the number is a grade-derived value. Solid type beside a soft
gradient looks pasted on; dots share the surface's language.

Construction, unchanged: solid dark base `#0D1017`, 26px radius, grain over the whole
tile. In light theme all eleven invert: base `#F2F2F5`, dark text, bloom opacity
halved, glow reduced to 25%. White text on dark, secondary text at 68% opacity.

### Colour — per widget, not per app

*[corrections-6 §3, final]* Consistency does not come from every widget sharing one
colour; it comes from every widget receiving the same *treatment* (base, inverse bloom,
grain, radius, typography) while each has its own hue, chosen for a reason:

**Student**
1. **ID card** — `#0B3FC9` deep blue, the same blue as the physical card, so the widget
   and the card are recognisably one thing
2. **Today's average** — hue taken **from the grade scale at the current value** — a
   student averaging 9 sees a cool blue tile, averaging 5 a warm one. The widget's
   colour is itself the information.
3. **Recent marks** — `#17A398` teal
4. **Requests** — `#E0862B` amber — pending things are amber everywhere in this product
5. **Schedule** — `#4A56C4` indigo

**Teacher**
6. **Drafts** — the existing `--draft` colour; it already means "unfinished" elsewhere
   and must not be reassigned here
7. **Next lesson** — `#6B45E0` violet
8. **Class average** — the grade scale again, from the class's current average
9. **Quick mark** — `#2E9E5B` green — the only widget that performs a write, and green
   is the only place green appears in the product

**Both**
10. **Ask Iter** — `--accent-tint`, matching the Iter button
11. **Calendar** — `#C4487A` rose

**Grade colours inside a widget never change hex**, in any theme, in any accent —
widgets 2 and 8 take their *tile hue* from the grade scale, which is the scale doing
its job, but any grade tile rendered inside any widget keeps its exact fixed value
(§2.1).

### The eleven widgets — content

**Student**
1. **ID card** — 2×2. Mark, name, institution, small QR glyph.
2. **Today's average** — 1×1. Dot-matrix number, trend arrow.
3. **Recent marks** — 2×2. Four most recent marks as coloured tiles with subject
   labels, newest first.
4. **Requests** — 1×1. Credential requests awaiting a decision.
5. **Schedule** — 2×4. Today's lessons as a horizontal timeline: a thin rule with a
   dot per lesson, the current lesson's dot filled and larger, time labels beneath;
   below the rule, the next lesson written out (time, subject, room).

**Teacher**
6. **Drafts** — 1×1. Uncommitted count, dot matrix.
7. **Next lesson** — 2×2. Time, class, subject, room, with a thin progress bar to its
   start.
8. **Class average** — 1×1. Dot-matrix number for the selected class.
9. **Quick mark** — 2×2. Current class name, a row of five tappable number chips 6–10;
   tapping one opens the app directly into that class's gradebook with the mark
   pre-filled. The teacher equivalent of the QR — the fastest path to the thing they do
   most.

**Both**
10. **Ask Iter** — 2×4. A full-width pill "Հարցրու Iter-ին…" styled as a real input,
    `IterMark` at its left; below it, a row of four 44px circular buttons — attach
    image, attach file, voice, open chat — each opening the app directly into Iter with
    that action already started.
11. **Calendar** — 2×2. A compact month grid, today circled in `--accent`, days with
    assessments marked by a small dot beneath the number, upcoming-item count written
    below the grid.

### Presentation

A gallery: neutral backdrop, 1×1 tiles at 150px, 2×2 at 320px, 2×4 at 320×150px,
grouped under "Աշակերտին" / "Ուսուցչին" / "Երկուսին", each with a one-line caption, in
both light and dark. Show all eleven together — seeing them as a set is the only way
to judge whether the colours work together; if two clash, that gets flagged rather than
silently adjusted. A home-screen mock is a nice-to-have, not the deliverable.

---

## 11bis. Iter — the AI chat

*[The single most contested area of the chain: Iter's entry point moved from a floating
button (base) to inside the pill's neighbourhood, then to the header (v2.1 §1), then
made an optional user setting between header and floating (v2.2 §3.3), then forced back
to floating-only with the setting deleted (v2.4 §1), losing its gradient fill on the
way — which corrections-2 §4 then explicitly restored ("Restore the gradient fill on
the Iter button. But the reason it was removed still stands"). Separately, its empty
state's animated centrepiece (the orb) was specified (v2.1 §8), reconfirmed
(corrections-2 §7), then deleted outright and replaced with a drifting gradient band
(corrections-3 §2), which was then itself debugged for a hard-edge problem
(corrections-4 §2). Build from the final state below, not from the base or from v2.1.]*

Iter is Tessera's assistant. **In this prototype it has no backend**, so it does not
answer. The full interface exists anyway — entry point, panel, message list, input,
empty state. When a backend arrives only response handling gets wired in; nothing about
the layout moves.

### Entry point — floating, both platforms, no configurable placement

*[final per v2.4 §1, reaffirmed corrections-2 §4 and corrections-4 §3.2 — supersedes
v2.1 §1's header placement and v2.2 §3.3's user-facing position setting, both retired]*

A dedicated circular button, floating, bottom-right, above all content, on **both** web
and mobile, for **both** roles. Never inside the navigation pill, never a menu item, and
— as of v2.4 §1 — never in the header and never a user setting; that setting existed
briefly (Settings → ՏԵՍՔ → "Iter-ի կոճակը") and was removed. It never overlaps the pill
or the docked QR/plus button — verified at 375px.

**Size and position:**
- Mobile: **44px**, bottom-right, 16px from the right edge
- Web: **48px**, bottom-right, 16px from the right edge
- On both, its bottom edge sits **at least 20px above the nav pill's top edge**,
  measured from the pill, not the screen bottom, and it never touches the docked
  button's 5px ring

**Fill — has a gradient again:**
- Inverse-bloom fill: `#6B45E0` concentrated in the upper-left, falling to a deep plum
  `#2A1B52` in the lower right `[final per corrections-4 §3.2, adding the exact plum
  hex to corrections-2 §4's restoration of the gradient after v2.4 §1 had removed it
  entirely in favour of flat glass]`
- `IterMark` in white, 20px, optically centred
- Glow `0 5px 18px rgba(107,69,224,.4)`

**Why this fill, and why this size, and why this is the whole story on hierarchy:** the
QR (58px, blue-green, saturated) and Iter (44px, violet, one size class down) must never
read as a matched pair — the 14px size gap plus the opposite-side-of-the-wheel hue is
what separates them, and if they are ever the same size again no colour choice will fix
it.

Both the QR's and Iter's blooms use the same inverse-bloom technique: light concentrated
in one corner, the opposite corner near-black — a centred bright blob reads as a
sticker on a circle exactly as it does on a widget tile.

### IterMark — the mark

*[Requested as three "open loop" concept variations, v2.1 §7; installed as an actual
component with named paths in v2.2 §3.4. The path data itself lives in an external
`iter-mark.svg` not included in this document chain — see "Unresolved or ambiguous
points."]*

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-45 -240 1621 1621" fill="currentColor" role="img" aria-label="Iter">
  <!-- two paths, ids `iter-stroke` and `iter-dot`, sourced from iter-mark.svg -->
</svg>
```

Single colour, `currentColor`. Minimum size 20px — below that the detached dot merges
into the stroke and the mark loses its character. Used in: the floating button, the
panel header, the empty state, and the Ask Iter widget.

### The panel

**Desktop** — a right-side sheet, 420px wide, full height, layered glass. The app stays
visible and usable beside it. No backdrop dimming.

**Mobile** — a sheet rising to 92% height, 34px top radius, a 36×5px grab handle
centred at the top, swipe down to dismiss, backdrop `rgba(0,0,0,.45)`.

**Header** — 56px. `Mark`... no — `Iter` heading with `IterMark` at 22px, "Iter" in
Noto Serif Armenian 17px, below it in 11.5px `--ink-3` "Tessera-ի օգնական". Close button
right.

### Empty state — the greeting and the gradient band (no orb)

*[Greeting: corrections-2 §6. Gradient band replacing the orb: corrections-3 §2.4,
debugged corrections-4 §2. The orb described in v2.1 §8 and reconfirmed in
corrections-2 §7 no longer exists anywhere in the product — deleted outright, "not
scaled down, not hidden. Gone."]*

**The background** — two overlapping radial blooms sitting on the panel's normal glass
background (which continues underneath, unchanged):

```
radial-gradient(ellipse 120% 80% at 30% 15%, var(--accent-tint) 0%, transparent 62%)   /* 55% opacity */
radial-gradient(ellipse 100% 70% at 75% 5%,  #25D3C4 0%, transparent 58%)               /* 40% opacity */
```

The `transparent` stop on each must be reached well before any panel edge — no line
anywhere where "the colour ends" (§5.1's no-visible-edge rule, discovered from exactly
this bug). Grain over the whole panel. The two blooms drift independently, 18s and 26s
loops, linear, alternating, travelling no more than 8% of the panel width — almost
imperceptible. When the panel opens, the band sweeps up from the bottom of its area to
its resting position over 700ms `--ease-out`, arriving just before the greeting fades
in.

**What sits on it, in white:** the `IterMark`, then the greeting:

```
Բարև, {name}            ← 20px, Noto Serif Armenian, weight 600
Ի՞նչ նայենք այսօր        ← 14px
```

First name only, taken from the account — never the full name, which reads as
administrative rather than friendly. Translated in the `T` dictionary: "Բարև, {name}" ·
"Hi, {name}" · "Привет, {name}", with the second line alongside it.

Timing: the greeting fades in 200ms after the panel finishes opening; the suggestion
chips stagger in 60ms apart behind it. On reopening within the same session, the
greeting stays but its entrance animation does not replay. If a conversation already
has messages, there is no greeting — the message list replaces the empty state
entirely.

**Suggestion chips** sit on the plain glass panel, outside the bloom's reach — the
transition from coloured to plain happens through the fade, never through a visible
edge. Three chips, 18px radius, glass, stacked in a column:

Student:
- "Ո՞ր առարկայից եմ ամենաշատը հետ մնում"
- "Ցույց տուր այս կիսամյակի միտումը"
- "Ի՞նչ է պետք ատեստատի համար"

Teacher:
- "Ո՞ր աշակերտներն են բաց թողել գնահատում"
- "Ամփոփիր 11-Բ-ի կիսամյակը"
- "Ո՞ր հայտերն են սպասում որոշման"

Tapping a chip fills the input; it does not send.

### Messages

User right-aligned, `--accent` background, `--accentFg` text, 18px radius with the
bottom-right corner at 6px. Assistant left-aligned on glass, 18px radius with the
bottom-left at 6px. 14px body, 1.55 line height, 10px between messages, 20px between
speakers. Text is selectable.

### Input — richer, with attachments

*[v2.2 §4, expanding the base's plain pill]*

A rounded container, 26px radius, glass, pinned to the panel bottom, never scrolling
with the messages:

- **Row 1** — the text field, transparent, no border, placeholder "Գրիր հարցդ", growing
  from one line to four before scrolling internally
- **Row 2** — four 36px circular ghost buttons on the left (attach image, attach file,
  voice, screenshot this screen), each `rgba(255,255,255,.06)` with a `--hair` border
  and an `--ink-3` glyph; the send button on the right, `--accent`, disabled at 40%
  opacity while empty

**Attachments**, fully interactive despite no backend:
- Clicking attach opens the native file picker
- Selected images: 56×56 rounded thumbnails in a row above the text field, each with a
  small × in its top-right corner
- Non-image files: a chip — file glyph, filename truncated to 20 characters, size, ×
- Maximum four attachments; the attach buttons disable at four
- Attachments send with the message and appear in the user's bubble as a thumbnail row
  above the text
- Drag-and-drop onto the panel works too, with the panel showing a dashed
  `--accent-tint` outline while a file is dragged over it
- "Screenshot this screen" attaches a placeholder thumbnail labelled with the current
  screen's name — so a student can ask "why is this mark red" without describing where
  they are

On mobile the input sits above `env(safe-area-inset-bottom)`.

### What happens on send

The message posts, the input clears, attachments clear. Then:

1. A **thinking indicator** appears for **1400ms**
2. It is replaced by the honest system line, centred, 12.5px `--ink-3`:
   > Iter-ը դեռ միացված չէ։ Հաղորդագրությունը պահվել է։

**Do not fake a response.** No typing indicator beyond the thinking pill, no canned
answer, no simulated reasoning text. An input that swallows text reads as broken; a
fabricated answer reads as dishonest.

**The thinking indicator** *[v2.2 §5, confirmed corrections-2 §7 — the one place a
rotating conic-gradient border exists in the whole product, and it stays even after
the orb elsewhere is deleted, since "it is a ring around a pill, not an orb, and it
belongs to a specific moment" — corrections-3 §2]*:
- A pill, left-aligned like an assistant message, roughly 90px wide, 40px tall
- Its border is the animated element: 2px, conic-gradient in `--accent-tint`,
  `#25D3C4`, `#1E8FE0`, `#6B45E0`, back to the start, rotating 360° over 2s linear
  infinite `[the four-stop sequence including #6B45E0 is v2.2 §5's, confirmed
  corrections-2 §7; v2.1 §9's original three-stop sequence without #6B45E0 is
  superseded]`
- Built with a `::before` carrying the conic gradient and the pill's own background
  masking the centre, so only the ring shows
- Three 5px dots inside, `--ink-3`, each pulsing opacity .3 → 1 → .3 over 1.2s,
  staggered 200ms apart
- Fades in over 180ms, out over 140ms

This rotating border appears here and nowhere else — not on buttons, cards, or inputs.
Under `prefers-reduced-motion`: static border, no pulsing, same 1400ms timing.

The message list persists while the panel is open, so a demo can stack several
messages.

### Rules
- Iter appears on every screen, both roles, both themes, all three languages, and both
  web and mobile — it was briefly absent from web mode (v2.2 §3.1) and that gap is
  closed
- The button never overlaps the floating nav pill — check at 375px
- Iter never takes the app's accent colour; it keeps its own violet identity
  (`#6B45E0` / `--accent-tint` in the empty-state band), regardless of what accent the
  user has chosen elsewhere

### Note for the backend stage
When Iter is connected it will read the academic records of minors, which makes where
the model runs a legal question rather than a design one. It changes nothing in this
document — the interface is identical either way — but it should be settled before the
first real response is generated.

---

## 11ter. Settings

Restructure Settings into a full screen with groups. On ≥900px a 180px sticky sub-nav
on the left and content on the right; below that, the sub-nav becomes a horizontal
scrolling row of chips.

Each group is a glass card, 26px radius. Section titles in Noto Serif Armenian 15px
weight 600.

**1. ՀԱՇԻՎ**
- Read-only rows: name, role, institution, class, EMIS ID, email
- "Փոխել գաղտնաբառը" → an inline form, not a modal: current password, new password,
  repeat, with a live strength hint
- "Ակտիվ սեսիաներ" → devices with last-seen times, each with "Դուրս գալ", and one
  "Դուրս գալ բոլոր սարքերից" at the bottom

**2. ՏԵՍՔ**
- Theme, and the existing note that the grade scale does not change with the accent
- Accent (black default)
- **Background ("Ֆոն")** *[v2.2 §9]* — four options, each setting `--bg-base`
  (`--bg-raised` derives by lightening 4% on dark backgrounds, darkening 3% on light
  ones):

  | Label | Hex | Character |
  |---|---|---|
  | Խորը | `#05070D` | default, dark |
  | Ածխային | `#101114` | neutral dark, no blue cast |
  | Սերուցք | `#F4F2EE` | light |
  | Մոխրագույն | `#E8E8EC` | neutral light |

  Choosing a light background switches the theme's text tokens automatically — never
  let someone select a light background and keep light text. The gradient mesh, glass
  tints, and widget glows all read from `--bg-base` and follow automatically; check the
  login screen and ID card under all four.
- **No "Iter-ի կոճակը" row.** This setting (a choice between a floating Iter button and
  a header-mounted one) existed in v2.2 §3.3 and was removed in v2.4 §1 along with the
  header placement it controlled — it must not be built.

**3. ԼԵԶՈՒ**
*[Compact codes: v2.2 §8; active-state styling, letter-spacing, and the caption
treatment: corrections-2 §3, which supersedes v2.2 §8's styling specifics]*

- The full names, Հայերեն / English / Русский, working, not a toast — this remains the
  one place full names are shown
- The control itself is the same **HY · EN · RU** compact pill used everywhere else
  (below), and beneath it, only in Settings, a small caption showing the full name of
  the active language, changing as the selection changes:

  ```
  [ HY ][ EN ][ RU ]
  Русский
  ```

  12px, `--ink-3`. That way the codes stay compact and the full name is still
  confirmed, without three long words fighting for width.

**4. ԾԱՆՈՒՑՈՒՄՆԵՐ** — toggle rows for new mark, request status change, weekly summary.
Label left, 38×22px switch right, one line of helper text under each label.

**5. ԱՋԱԿՑՈՒԹՅՈՒՆ** — the only route a user has when something is wrong.
- "Գրել աջակցությանը" → inline form: subject, message, an auto-attached read-only line
  (app version, role, institution). Submitting shows a confirmation, no backend.
- "Հաղորդել խնդրի մասին" → same form, pre-filled subject, plus a checkbox "Կցել
  ընթացիկ էկրանի տվյալները"
- "Կարծիք թողնել" → a 1–5 scale as five tappable pills, and a free text field
- "Հաճախակի հարցեր" → an accordion with five entries
- At the bottom, quiet 12px `--ink-3`: version number, links to terms and privacy

**6. ՎԻՋԵԹՆԵՐ** — the widget gallery from §11, browsable, with the note that widgets
require the native app

### The language control, everywhere it appears

*[corrections-2 §3, final — supersedes v2.2 §8's spec]*

Header, footer, login, Settings: **HY · EN · RU**, uppercase, 12px JetBrains Mono,
letter-spacing **.6px** — a segmented pill, 999px radius, **32px tall**, three
equal-width segments. Active: a filled pill, `rgba(255,255,255,.14)` on dark, `--ink`
text. Inactive: `--ink-3`, hover to `--ink-2`. The filled pill **slides** between
positions over 200ms `--ease-out`, never jumps. The control still does not appear in
the app header's... — it does appear in the header (see §8quater), just not as a
language *switcher in the sidebar/nav*; per PRD §12 L-7 it stays confined to the
header and Settings and nowhere else (unchanged since the base).

---

## 12. App icon

Unaffected by any of the eight deltas.

Squircle, radius 24% of width, in the current iOS style: **a glowing bloom inside a
dark rounded tile with a soft rim light**, not a flat gradient fill.

- Base near-black `#05070D`
- A `bright` core bloom in the upper-left third falling through `mid` into `deep`
  toward the lower right, heavily feathered
- A 1.5px rim light inside the squircle edge, `rgba(120,190,255,.35)`, strongest
  top-left, fading to nothing bottom-right
- `mark-glyph` in white, centred, about 58% of the width
- Grain over the whole thing
- No glass. Icons are solid objects.

Produce at 1024, 180, 120, 64px, plus a 32px favicon using the glyph alone on solid
`deep`.

---

## 13. Motion — the full system

*[The base's §13 largely stands, with two structural changes: (1) the orb — the
splash/Iter-empty-state animated circle from v2.1 §8, reconfirmed corrections-2 §7 — was
deleted outright in corrections-3 §2 and replaced with six gradient-mesh-based motions,
further extended by a full splash-then-login choreography in corrections-5 §3; (2) the
base's claim that the login's ambient drift is "the only looping animation in the
product" is no longer true now that the Iter panel's empty-state band also loops
continuously (corrections-3 §2.4) — that absolute claim is dropped below rather than
carried forward as false.]*

Motion in Tessera is quiet and purposeful. Nothing decorates; every animation either
tells you where something came from, confirms a touch, or covers a state change.

### 13.1 Tokens

```
--ease-out     cubic-bezier(.2,.8,.2,1)      entering, default
--ease-in      cubic-bezier(.4,0,1,1)        exiting
--ease-spring  cubic-bezier(.34,1.4,.64,1)   press release, the mark's spark
--ease-linear  linear                        progress rings only

--t-press      120ms    press states
--t-quick      160ms    hover, small state changes
--t-base       220ms    most UI transitions
--t-panel      280ms    sheets, panels, drawers
--t-entry      420ms    the mark on login
```

Never animate `width`, `height`, `top` or `left` where `transform` will do. Never
animate more than three properties on one element.

### 13.2 The identity moment — splash, then login

*[The base's simple two-part glyph/spark entry animation is now the *first* beat inside
a longer, choreographed splash-to-login sequence introduced by corrections-3 §2.1 and
made exact by corrections-5 §3. Read this as one continuous sequence, not two competing
specs: the glyph-then-spark stagger below governs how the lockup's two paths assemble;
the splash/transition timeline in the rest of this subsection governs everything around
that assembly.]*

**The glyph/spark stagger** (unchanged since the base) — runs once, on the splash, never
loops, never replays on re-render:

1. `mark-glyph` — `opacity 0 → 1`, `transform: scale(.88) → scale(1)`, `--t-entry` with
   `--ease-out`
2. `mark-spark` — starts 180ms after the glyph, `opacity 0 → 1`,
   `transform: scale(.4) rotate(-14deg) → scale(1) rotate(0)`, 340ms with `--ease-spring`

The glyph settles, then the spark springs in a beat later — that delay reads as the
mark completing itself, not appearing all at once.

**Step 1 — splash (0 to 1100ms)** *[corrections-5 §3]*
- Full screen, Palette Deep mesh with grain, nothing else on it
- The complete LOCKUP‑INTEGRATED — glyph, spark and all letters — centred, at **280px
  wide**
- The mesh's four blobs expand outward from the centre over 1400ms (the entry bloom,
  §13.17), and the lockup itself fades and scales in from `scale(.94)` over 500ms
  starting at 200ms — this is the wrapper for the glyph/spark stagger above, not a
  replacement of it
- Hold the finished state for 400ms — without the hold, the sequence feels like a
  glitch rather than a moment

**Step 2 — the transition (1100 to 1900ms)** *[corrections-5 §3]* — the splash does not
fade out; it becomes the login screen:
- The lockup travels from the centre of the screen to its login position — up and
  smaller — over 700ms `cubic-bezier(.2,.8,.2,1)`, scaling from 280px down to its login
  size (200px in the web left column; the mobile/narrow login shows the bare Mark at
  76px instead — see §8bis). It is the same element moving, not one fading out and
  another fading in.
- The mesh stays exactly where it is — it does not re-animate, does not fade. It was
  already the login background; the splash was the login screen before the form
  arrived.
- Starting at 1400ms, the login card fades in and rises 16px over 400ms
- The demo row fades in last, at 1700ms, opacity only
- **The glyph/spark stagger does not replay here.** It already ran once, in Step 1; the
  lockup that travels in Step 2 is already fully assembled. One assembly animation per
  element, per session.

Total: 1900ms to a usable screen. If that feels long, shorten the Step 1 hold first,
then the transition — never the login card's own arrival, which is what tells someone
they can start typing.

**Rules:**
- Once per session only. Logging out returns to the login screen directly, with no
  splash.
- Under `prefers-reduced-motion`: no splash at all — the login screen renders
  immediately, complete, and the glyph/spark stagger shows both paths at full opacity
  and scale at once.

### 13.3 Login card

Enters 120ms after the mark begins (superseded in timing specifics by the full
sequence in §13.2 above, which places the card's fade-in at 1400ms into the sequence
and its rise at 16px/400ms): `opacity 0 → 1`, `transform: translateY(14px) → 0`,
`--t-panel` `--ease-out`. The demo row fades in last, opacity only.

### 13.4 Screen transitions

**Instant.** Switching screens does not animate. Content appears immediately. The one
exception is mobile, where the incoming screen fades `opacity 0 → 1` over 100ms — just
enough to avoid a hard flash. Separately, the gradient mesh itself shifts slightly on
every screen change — see §13.17.

### 13.5 The nav pill active item

- Width animates 240ms `--ease-out`, constrained within its fixed-width group (§9) so
  it can never cross into the reserved centre column or the other group
- The label fades in over the final 120ms, so it never reflows mid-animation
- The outgoing item's label fades out over the first 80ms, then its width collapses
- The icon cross-fades between outline and filled over 160ms

Keep the pill's children absolutely positioned so nothing else on the row shifts while
width animates.

### 13.6 Press states

| Element | Press |
|---|---|
| Buttons, chips, nav items | `scale(.94)`, `--t-press` `--ease-out` |
| Docked QR/add-assessment button, floating Iter button | `scale(.90)`, `--t-press` |
| Cards and list rows | `scale(.985)` plus background lightening 4% |
| Release | back to `scale(1)` with `--ease-spring` |

No ripple. No lingering hover state on touch.

### 13.7 The QR sheet

- Slides up: `transform: translateY(100%) → 0`, `--t-panel` `--ease-out`
- The card behind it scales to `.97` over the same duration, and its own gradient
  **brightens by 12%** over that 280ms, then holds `[final per corrections-3 §2.5,
  reversing the base's "dims 12%" — it now reads as the card catching light from the
  sheet passing over it, not receding beneath it]`
- Dismiss: reverse with `--ease-in`, 240ms; the card's brightness returns over 240ms
- **There is no step boundary any more** (§10) — the base's "QR cross-fades over 180ms
  at the step boundary" and the progress ring's `--ease-linear` 30-second drain no
  longer apply to anything, since the code is now permanently static

### 13.8 The Iter panel

- Desktop: `transform: translateX(100%) → 0`, `--t-panel` `--ease-out`. The app behind
  it does not move or dim.
- Mobile: `translateY(100%) → 0`, same timing, backdrop fading `0 → .45`
- Close: reverse with `--ease-in`, 240ms
- The empty-state gradient band sweeps up over 700ms on open (§11bis)
- Suggestion chips stagger in: 60ms apart, each `opacity 0 → 1` and
  `translateY(8px) → 0` over 200ms
- A sent message enters `opacity 0 → 1`, `transform: scale(.96) translateY(6px) → 0`,
  180ms `--ease-out`, and the list scrolls to the bottom over 240ms
- The thinking indicator, then the "not connected" line, follow the sequence in §11bis

### 13.9 The mosaic

On **first load of a screen only**, grade tiles stagger in — 18ms apart, left to right,
top to bottom, each `opacity 0 → 1` and `scale(.86) → 1` over 180ms. Cap the total at
600ms — on a large grid, stagger by row rather than by tile. Never on re-render, never
on filter or class change.

### 13.10 Skeletons and progress

Skeleton blocks shimmer: a 1.4s linear gradient sweeping left to right, infinite,
`--ease-linear`. Never show a skeleton for less than 200ms. Progress rings and bars are
always linear — easing a progress indicator makes it lie. (The QR's own progress ring
is retired along with the countdown model — §10, §13.7 — but this rule still governs
any other progress indicator in the product, e.g. the "next lesson" widget's progress
bar.)

### 13.11 Everything else

| Element | Motion |
|---|---|
| Modal | backdrop fades `0 → .45` over 200ms; the dialog `scale(.96) → 1` and `opacity 0 → 1` over `--t-base` `--ease-out` |
| Toast | slides up `translateY(16px) → 0` with opacity, `--t-base`; auto-dismisses after 4s with `--ease-in`. Swipe behaviour in §13.14 |
| Accordion | height animates `--t-base` `--ease-out`; chevron rotates 180° over 200ms |
| Web/Mobile switch | the filled pill slides between positions over `--t-base` `--ease-out`; labels do not fade |
| Theme change (text/background tokens) | `background-color` and `color` transition over 200ms on the root only | 
| Palette change (the gradient mesh itself) | see §13.18 — the mesh cross-fades over 600ms, separately from the 200ms token transition above |
| Widget home screen | tiles stagger in 50ms apart on first view, `scale(.94) → 1` |
| Drafts committing | the draft count decrements with a 200ms cross-fade; the row's draft colour transitions to committed over 300ms; a successful commit also fires the sweep in §13.19 |
| Focus ring | appears instantly, no transition |

### 13.14 Notifications — swipe to dismiss

Toasts and in-app notifications are dismissable by swipe, not only by waiting.

- Drag horizontally: the toast follows the finger **1:1**, no easing, no resistance
- Opacity falls with distance: `1 - (distance / width) * 0.7`
- Past **40% of its width**, releasing commits the dismissal — flies off in the
  direction of travel over 180ms `--ease-in`
- Under 40%, releasing springs it back over 220ms `--ease-spring`
- Vertical movement is never captured; the page must still scroll under the finger
- When one dismisses, toasts beneath it slide up into place over 200ms
- The auto-dismiss timer pauses while a finger is down, resumes on release
- On desktop the same gesture works with a mouse drag, with a small × on hover

### 13.15 Sidebar collapse

Width animates 200ms `--ease-out`. Labels fade with opacity over the final 100ms. The
chevron rotates 180° over 200ms. The content area's left margin animates in step, on
the same curve, so nothing tears.

### 13.16 Iter's own motion

- **The button idles.** A very slow breath — `scale(1) → scale(1.035) → scale(1)` over
  4s, `--ease-linear`, infinite. Stops permanently once the panel has been opened for
  the first time in a session.
- **The `IterMark` in the empty state** rotates 12° and back over 6s, `--ease-linear`,
  alternating. Only in the empty state, only until the first message is sent.

Both stop entirely under reduced motion.

### 13.17 Entry bloom (splash and login mesh arrival)

*[corrections-3 §2.1, folded into the exact splash timeline of §13.2]*

- The mesh's four blobs each start at `scale(0.2)`, centred, opacity 0
- They expand outward to their final positions and sizes over 1400ms
  `cubic-bezier(.16,1,.3,1)`, staggered 120ms apart, brightest blob first
- Opacity rises 0 → full over the first 700ms
- Grain fades in last, over 400ms starting at 900ms — texture arrives after colour
- Runs once, on first load only. Never on navigation.

### 13.17b Screen change — the light shifts

*[corrections-3 §2.2]* Screens still swap instantly (§13.4), but on every screen
change, one mesh blob — a different one each time, cycling — moves to a new position
over 900ms `--ease-out`, travelling no more than 18% of the viewport. Nothing else
moves; no fade, no wipe. It should be noticed only in peripheral vision, never watched
directly.

### 13.18 Palette cross-fade

*[corrections-3 §2.3]* Changing theme, background or accent must not snap on the
gradient mesh (the text/background token transition in §13.11 handles the flat UI
colours separately, at 200ms):

- Render two mesh layers, outgoing and incoming palette, stacked
- The incoming fades 0 → 1 over 600ms `--ease-out` while the outgoing fades out over the
  same duration
- The blobs do not move during the change — only colour crosses over; movement plus
  colour change together reads as a glitch
- The grain layer stays constant throughout; it never fades

### 13.19 Commit to EMIS

*[corrections-3 §2.6]* The one moment in the product worth marking, since it is
irreversible:

- A horizontal gradient band sweeps across the top edge of the content area, left to
  right, 900ms `--ease-out`
- 3px tall, transparent → `#25D3C4` → transparent — a pulse of light travelling, not a
  loading bar filling
- Fires once per successful commit and disappears. No toast alongside it — the light is
  the confirmation.

### 13.20 What is not animated

No spinners. No rotating shapes anywhere in the product **except** the Iter
thinking-ring border (§11bis) — that is a ring around a pill for a specific moment, not
a decorative spinner. No pulsing dots outside that same thinking pill. No animated
gradients on buttons, cards, inputs or widgets otherwise. No shimmer except on
skeletons.

### 13.21 Reduced motion

Inside `@media (prefers-reduced-motion: reduce)`:

- No splash; the login screen renders immediately, complete (§13.2)
- The glyph/spark stagger, where it does run, shows both paths at full opacity and
  scale at once
- Panels, sheets and modals appear and disappear instantly
- All staggers become simultaneous
- The entry bloom renders in its final state instantly; blobs never move on screen
  change; the palette cross-fade still fades, but over 200ms
- The Iter empty-state band renders static, no drift
- The commit-to-EMIS sweep becomes a 300ms opacity flash of the same band, no travel
- The skeleton shimmer stops; skeletons show as static blocks
- Press states keep their opacity change but lose the scale
- Progress rings/bars still animate — they convey real information
- The Iter button's idle breath and the empty-state `IterMark`'s rotation both stop
  entirely
- The Iter thinking-ring border shows static, no rotation, no dot pulsing; the 1400ms
  timing sequence still runs

---

## 14. Where glass goes, and where it does not

**Chrome is glass. Data is opaque.** Unchanged through the whole chain.

| Glass | Opaque |
|---|---|
| Header | The grade mosaic |
| Sidebar | Gradebook grid, all tables |
| Floating bottom pill | Analytics charts |
| Sheets, modals, Iter panel | The student ID card |
| Settings group cards | The QR code itself |
| Empty-state cards | Archive rows |
| Accordion shells | Anything showing a grade colour |

**Why.** A mark's colour is the product's core signal. On a translucent surface the
gradient behind shifts every tile's perceived hue, and two identical marks in different
parts of the screen read as different colours. That destroys the one thing the mosaic
exists to do.

The outer shell of a card may be glass, but the grid inside sits on a solid `--bg-base`
inner panel with its own radius. **Glass frames data; it never sits underneath it.**

---

## 15. Everything from v1 that must survive

Unchanged.

- All screens: overview, subjects, subject detail, archive, credentials, ID, gradebook,
  analytics, credential queue, settings, login
- Iter reachable from every one of them
- Multiple classes per teacher, with per-class drafts
- Draft → commit → EMIS queue, with full change history, now with the light-sweep
  confirmation on a successful commit (§13.19)
- Three languages, all strings in the `T` dictionary, nothing newly hardcoded
- Light and dark themes, now with four selectable background values (§11ter)
- All empty, loading, error and offline states

### New behaviour, beyond restyling

Two changes in this chain go past pure visual restyling and into interaction/behaviour,
flagged per §0/§18's own rule ("if a visual change would require altering behaviour,
stop and say so"):

- **Keyboard grade entry in the gradebook** *[v2.4 §4]* — every cell is focusable
  (`tabindex="0"`), a focused cell shows a 2px `--accent` inset ring, typing a digit
  fills the cell and advances (with "1" waiting 400ms for a possible trailing "0" to
  make 10), and a full set of navigation keys (Enter/↓, Shift+Enter/↑, Tab/→,
  Shift+Tab/←, Home/End, Escape) moves focus without touching the mouse. This is
  additive to the existing tap picker, which remains the primary method on mobile and
  must not be removed. `inputmode: numeric` on mobile. The focused cell always scrolls
  into view with `block: 'nearest'`, never centred. Column header and student-name
  column stay pinned while the grid scrolls. A quiet hint line, web only, 12px
  `--ink-3`: "Մուտքագրիր թիվը · Enter՝ ներքև · Tab՝ աջ".
- **The gradebook's "+" column** *[v2.2 §2]* moved from a floating button into the
  column header row itself (far right, 44px dashed-border header cell), and clicking it
  now inserts a live column immediately (today's date, header in edit mode, focus to
  the first student's cell, draft state from creation) rather than opening a dialog.
  Escape while still in header-edit-mode and with no marks entered removes the column
  again; once a mark exists it must go through the normal discard-drafts flow.
- **The QR's validity model changed from time-based to identity-based** (§10) — this is
  a behavioural change (an offline, unscannable-when-stale code became a permanently
  valid one), not merely a style change, and is called out here for visibility even
  though every delta in the chain treated it as settled.

---

## 16. Order of work

The base's staged build sequence (logo → accent → tokens → login → preview switch →
glass → nav/QR → ID card → widgets → Iter → Settings → app icon → motion → radius audit
→ full audit) has already been executed and re-executed across nine documents' worth of
corrections. It is retained here only as a historical note, not as a remaining task
list — every stage it names is covered by a section above, in its final form.

---

## 17. Final audit — verification checklist

*[Rebuilt from the base's §17 audit plus every delta's own "Verify" list, with items
retired where the thing they verify no longer exists (the QR's 30-second behaviour, the
teacher credential, the Iter position setting), and new items added where a delta
introduced a check that has no earlier equivalent.]*

**Foundational**
- [ ] Every grade colour is the same fixed hex everywhere; no grade cell is translucent;
      any grade tile inside a widget keeps that same fixed hex
- [ ] Mosaic, gradebook, tables, charts and the (student-only) ID card all sit on opaque
      surfaces
- [ ] Every glass element uses two layers with partial overlap
- [ ] No gradient anywhere in the product has a visible edge — check the Iter panel and
      every widget bloom specifically, since that is where the bug was found
- [ ] `backdrop-filter` on 8 elements or fewer per screen
- [ ] All text passes 4.5:1 against what is actually behind it
- [ ] Every v1 screen still exists and works; all three languages render everywhere

**Login / splash**
- [ ] The app opens on a once-per-session splash that becomes the login screen; logging
      out returns directly to login with no splash
- [ ] The lockup travels from its splash position/size (280px) to its login
      position/size without re-running its glyph/spark assembly a second time
- [ ] The web login is a two-column split above 900px, each column centred via
      `grid; place-items: center`, not a small centred card
- [ ] No screen's primary content begins below 240px from the viewport top at 900px
      height

**Navigation and the docked button**
- [ ] The bottom pill floats clear of all three edges and does not move on scroll
- [ ] The docked centre button is a complete, unclipped circle at 375/390/430px, with an
      even background-coloured ring all the way round
- [ ] Selecting each of the four tabs in turn, at three widths, never sends another item
      under the docked button and never clips an icon (12 combinations)
- [ ] For students the docked button is a QR glyph; for teachers it is a plus glyph that
      opens a new gradebook column — same size, fill and glow either way
- [ ] The floating Iter button and the docked QR/plus button differ by exactly 14px in
      size (44 vs 58, or 48 vs 58 on web) and sit on opposite sides of the colour wheel;
      neither overlaps the other's ring at 375px

**The QR**
- [ ] The QR code is static — seeded from the student id, never from time; watched for
      two full minutes, nothing moves; no countdown, no progress ring, no re-render, no
      cross-fade anywhere near it
- [ ] The QR sits on solid white, works offline, and its modules/finder patterns/corner
      brackets follow the merged-rounding rules without ever reducing the four-module
      quiet zone

**Iter**
- [ ] Iter exists on every screen, both roles, both themes, all three languages, on both
      web and mobile
- [ ] No Iter position setting exists anywhere in Settings
- [ ] Sending a message shows the thinking ring for 1400ms, then the honest
      "not connected" line — no fake reply
- [ ] The empty state shows no orb — a drifting two-bloom gradient band instead — and
      greets the signed-in user by first name once per session
- [ ] `--accent-tint` never resolves to pure black or white; Iter keeps its own violet
      identity regardless of the app's chosen accent

**Widgets**
- [ ] All eleven widgets render, each with its own hue per §11's assignment table, not a
      single shared Palette-Deep treatment
- [ ] Widgets 2 and 8 visibly change hue as the underlying average changes
- [ ] All eleven shown together in one gallery, both themes

**Teacher role**
- [ ] No ID card, no QR, and no QR glyph anywhere in the teacher role — nav, docked
      button, widgets, Settings
- [ ] The teacher's fourth nav slot is "Այսօր" with today's lessons, not a credential

**Motion**
- [ ] `prefers-reduced-motion` is handled for every item in §13.21
- [ ] The mosaic stagger caps at 600ms even on the largest grid
- [ ] Toasts dismiss by swipe, follow the finger 1:1, commit past 40%, spring back below
      it
- [ ] The sidebar collapses and expands, and the content margin animates with it
- [ ] A successful EMIS commit fires the light-sweep once and does not repeat
- [ ] Nothing rotates anywhere in the product except the Iter thinking-ring border

---

## 18. Say this out loud if it happens

Unchanged. If the glass, gradient or motion treatment makes any screen harder to read
or slower to use than v1 was, say so directly rather than shipping it.

Tessera is used under time pressure — a teacher entering forty marks at the end of
term, a student holding up a phone at a door with people waiting behind them.
Legibility and speed outrank style every time. Flagging the conflict is more useful
than a screen that photographs well and fails in a classroom.

---

## Unresolved or ambiguous points

These are points the nine-file chain leaves genuinely open — either two files disagree
with no later-wins signal, or a fix references something the earlier state of the
design doesn't actually contain, or a decision was explicitly deferred and never
revisited. None of these were silently guessed at above; they are flagged here instead.

1. **The second "s" in the integrated wordmark.** corrections-2 §1 explicitly asked for
   two variants to be built and shown side by side — Variant A (a typeset "s") and
   Variant B (`mark-spark` mirrored, at 0.92× the first spark's size) — noting "Variant
   B is the more interesting one and might be the answer, but it risks looking like a
   stutter." No later file (corrections-3 through corrections-6) records which was
   chosen, or even revisits the second "s" at all — every later correction to the
   lockup's proportions (corrections-3 §1, corrections-4 §1, corrections-5 §1) addresses
   only the glyph, the "e", and the first spark. **This document does not pick one.**

2. **The typeface for "essera."** corrections-2 §2 rejected Noto Serif Armenian for the
   integrated lockup's typeset portion and proposed three replacement directions (a
   high-contrast serif, a humanist serif, or a light geometric sans — each with two
   named candidate faces), explicitly instructing "do not pick one yourself." No later
   file records a decision among the three, or a specific chosen typeface. **This
   document leaves it open**, per §3.2.

3. **The QR sheet's caption text.** The base's caption under the QR — "Վավեր է 30 վրկ ·
   թարմացվում է ինքնաբերաբար" ("valid for 30 seconds, refreshes automatically") —
   describes the time-based rotation model that v2.4 §3 and corrections-2 §5 retired in
   favour of a permanently static code. No file in the chain supplies replacement copy
   for a static code's caption (or confirms the line should simply be deleted). This
   needs new copy, or an explicit decision to drop the line, before implementation.

4. **The IterMark's actual path data.** v2.2 §3.4 installs `IterMark` by reference —
   "paste the two paths from `iter-mark.svg` here, keeping the ids `iter-stroke` and
   `iter-dot`" — but that SVG file is not one of the nine documents in this chain and
   was not available to consult. The viewBox (`-45 -240 1621 1621`) and the ids are
   known; the actual drawn shape is not verifiable from the design-brief chain alone and
   must be sourced from that external asset.

5. **The Iter widget's "attach image / attach file / voice / open chat" buttons and
   corrections-6's removal of "the ID widget from the teacher widget set."**
   Corrections-6 §2 instructs deleting "the ID widget from the teacher widget set," but
   no widget list in this chain (v2.2 §7's nine, or the final eleven in §11 above) shows
   a teacher-specific ID widget distinct from the student's — the teacher section has
   always been Drafts / Next lesson / Class average / Quick mark. Either an ID widget
   existed in the actual build outside what these nine documents describe, or this
   instruction is redundant. Flagged rather than silently reconciled; the final widget
   list in §11 has nothing to remove on this point.

6. **Exact arithmetic in the nav pill's reserved centre column.** corrections-5 §2
   states the centre grid column is "a fixed 78px — the 58px button plus its 5px ring on
   each side, plus 5px of clearance," but 58 + 5 + 5 + 5 = 73, not 78 (it only reaches 78
   if the clearance is also doubled to 5px per side, which the text doesn't say
   explicitly). The value is preserved verbatim above (78px) per the instruction to
   never approximate a stated number, but the stated arithmetic behind it does not
   independently check out — worth confirming with whoever wrote the correction before
   treating 78px as load-bearing to the pixel.
