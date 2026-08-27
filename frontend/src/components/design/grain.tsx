// Grain overlay for gradient surfaces (brief §5.2 — "not optional. The
// highest-value detail in this brief"). Same noise as before: feTurbulence,
// fractalNoise, baseFrequency 0.8, 3 octaves, opacity .055, overlay blend,
// no pointer events.
//
// What changed is how it is painted, and it was the single most expensive
// thing in the app. This used to be one <svg> whose <rect> filled its
// parent — on the login screen, a 1440x900 rect — with the feTurbulence
// filter applied to the whole thing. feTurbulence is *procedural noise
// evaluated per pixel*, so that is 1,296,000 pixels of CPU noise generation
// with three octaves each, re-evaluated on paint. Measured on a production
// build, login page load with motion off, median of four runs: painting
// 891ms as-is, 301ms with the grain element hidden. Nothing else on the page
// came close — hiding all four gradient blobs saved 28ms, and disabling
// every backdrop-filter on the page saved 1ms. After this change the same
// measurement is 597ms as-is (-294ms), and with the mesh entry animation
// running 1267ms -> 855ms (-412ms), because the animation's real cost was
// forcing this filter to be re-evaluated on every frame.
//
// So the noise is now generated once into a 180x180 tile and repeated by the
// compositor as an ordinary background image: 32,400 pixels of filter work
// instead of 1,296,000, a factor of 40, and it is rasterised once and cached
// rather than recomputed.
//
// TILE = 180 is not arbitrary. `stitchTiles="stitch"` was already specified
// here and was doing nothing, because nothing tiled; it exists to make the
// noise join seamlessly at the tile edge. Stitching works by nudging the
// frequency to the nearest value that completes a whole number of cycles
// across the tile, and 0.8 x 180 = 144 exactly — so the tile is seamless
// with the frequency completely unchanged, and the grain is the same grain.
// Verified by measuring it rather than by looking: the standard deviation of
// neighbouring-pixel luminance differences over a 256x128 patch of the login
// mesh is 1.104 before and 1.119 after — 1.4% apart — and a horizontal
// autocorrelation of a scanline shows no peak at the 180px tile period, so
// the repeat is not visible either. See docs/decisions.md.
//
// The explicit filter region (x/y/width/height = 0 0 100% 100%) matters: the
// default is -10%/120%, which would let the filter bleed past the tile and
// break the seam.
const TILE = 180;

const NOISE_TILE =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}">` +
  `<filter id="g" x="0" y="0" width="100%" height="100%">` +
  `<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/>` +
  `</filter>` +
  `<rect width="${TILE}" height="${TILE}" filter="url(#g)"/>` +
  `</svg>`;

// encodeURIComponent, not a hand-escaped string: the markup contains
// quotes and angle brackets, and one missed character silently yields an
// undecodable data URI and no grain at all.
const NOISE_URL = `url("data:image/svg+xml,${encodeURIComponent(NOISE_TILE)}")`;

export function Grain({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity: 0.055,
        mixBlendMode: "overlay",
        backgroundImage: NOISE_URL,
        backgroundRepeat: "repeat",
        backgroundSize: `${TILE}px ${TILE}px`,
      }}
    />
  );
}
