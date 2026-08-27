// The ambient gradient behind the admin shell.
//
// This exists because glass needs something to blur. `backdrop-filter: blur()`
// samples what is *behind* the element, and blurring a flat single-colour
// surface returns that same colour — the panels were correctly configured and
// still invisible, because there was nothing behind them to soften. Measured:
// with a flat background the glass surface and the surface 40px outside it
// differ by ~1.00:1; over these blooms they differ by 1.19-1.44:1.
//
// Static by design — no drift, no animation. This is a data screen, and the
// Iter panel's drifting blooms are a different element with a different job.
//
// Deliberately a fixed, -z-10 layer rather than a background on the shell: it
// must sit *beneath* the panels and above nothing, and every data surface
// (gradebook grid, mosaic, tables) paints its own opaque background on top,
// which is how they opt out per tessera-v2-FINAL's "Never behind the
// gradebook, mosaic, tables or analytics — flat --bg-base there."
export function AdminAmbient() {
  return (
    <div className="admin-ambient pointer-events-none fixed inset-0 -z-10" aria-hidden>
      <div className="admin-ambient-a absolute inset-0" />
      <div className="admin-ambient-b absolute inset-0" />
    </div>
  );
}
