/**
 * Pure value-domain model for `MotionSpecimen`'s spring kind, kept free of any `react-native`
 * import so `node --test` can assert on it directly (see
 * `native/catalog/__tests__/motionValueDomain.test.ts`).
 *
 * A spring's `restDisplacementThreshold`/`restSpeedThreshold` are in the units of the value being
 * animated — a config built for pixel-space points (e.g. a bottom sheet's snap-point spring) stops
 * within a fraction of a pixel of its target, which is invisible; the same thresholds applied to a
 * normalized 0-to-1 progress would end the animation before it ever emits a frame. `MotionSpecimen` must animate the domain the config was
 * actually tuned for, rather than always normalizing to 0–1, or it misrepresents any spring whose
 * production value is pixel-space.
 *
 * 'distance': the `Animated.Value` IS the pixel distance (0 → `distance`); `translateX` reads it
 * directly, with no interpolation. 'unit': the value is a normalized 0-to-1 progress; `translateX`
 * interpolates it to the pixel distance. Timing specimens always use 'distance' because their
 * easing and duration are independent of the animated value's units.
 */
export type MotionValueRange = 'distance' | 'unit';

/** The Replay button's accessible name. A motion page shows many specimens, so each name must say
 *  which one it replays: the specimen's visible label, else its duration (timing) or "spring". */
export function motionReplayLabel(specimen: { kind: 'timing' | 'spring'; duration?: number; label?: string }): string {
  if (specimen.label) return `Replay ${specimen.label}`;
  return specimen.kind === 'timing' ? `Replay ${specimen.duration}ms timing` : 'Replay spring';
}

/** The `Animated.Value` target to animate toward — and the value a reduced-motion replay jumps to
 *  instantly — for a given domain and pixel distance. */
export function motionValueTarget(valueRange: MotionValueRange, distance: number): number {
  return valueRange === 'distance' ? distance : 1;
}

/** Whether `translateX` reads the animated value directly (true, 'distance') or must interpolate
 *  it from a 0-to-1 progress to the pixel distance (false, 'unit'). */
export function motionTranslatesDirectly(valueRange: MotionValueRange): boolean {
  return valueRange === 'distance';
}
