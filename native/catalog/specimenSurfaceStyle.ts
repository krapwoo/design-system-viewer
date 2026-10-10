import type { SpecimenSurfaceKind } from './types.ts';

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

/** No backdrop unless a page asks for one: most examples already read clearly on the white cell.
 *  Set `specimenSurface: 'neutral'` on a page whose component is itself white or near-white (a
 *  white card, sheet or neutral banner) so its edges show. */
export const DEFAULT_SPECIMEN_SURFACE: SpecimenSurfaceKind = 'transparent';

/** Whether the stage gets its own padding and rounded corners. A transparent surface gets none, so
 *  an example sits exactly where it did before surfaces existed (the comparison cell already pads
 *  it); a coloured stage needs them so the example doesn't touch its edges. */
export function specimenSurfaceHasInset(surface: SpecimenSurfaceKind): boolean {
  return surface !== 'transparent';
}
