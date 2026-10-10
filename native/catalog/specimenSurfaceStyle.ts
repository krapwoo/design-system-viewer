/**
 * `SpecimenSurface`'s width policy, kept free of any `react-native` import so `node --test` can
 * assert on it directly (see `native/catalog/__tests__/specimenSurfaceStyle.test.ts`).
 *
 * The surface always stretches to the full cross-axis width of whatever wraps it (a comparison
 * cell, typically centered) rather than shrink-wrapping to its own content — `alignSelf: 'stretch'`
 * overrides a centered parent's `alignItems` for this one child. A compact specimen (e.g. Button)
 * still reads as centered, via `SpecimenSurface`'s own `alignItems`/`justifyContent: 'center'` on
 * the now-full-width surface. Before this, a percentage-width child (Divider's `width: '100%'`, a
 * phone mockup's percentage-width content) resolved against the surface's own shrink-wrapped,
 * intrinsic width inside a centered comparison cell, and rendered at 0px.
 */
export const SPECIMEN_SURFACE_WIDTH_STYLE = {
  alignSelf: 'stretch',
} as const;
