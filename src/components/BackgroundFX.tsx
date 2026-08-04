/**
 * Fixed, pointer-transparent FX layers.
 * Below the content (z-0): grid raster, vignette, noise, sweep bar.
 * Above the content (z-40): scanlines — that is what sells the CRT look.
 * Everything animated uses transform/opacity only.
 */
export default function BackgroundFX() {
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="fx-grid absolute inset-0" />
        <div className="fx-vignette absolute inset-0" />
        <div className="fx-noise absolute inset-0" />
        <div className="fx-sweep" />
      </div>
      <div aria-hidden className="fx-scanlines pointer-events-none fixed inset-0 z-40" />
    </>
  );
}
