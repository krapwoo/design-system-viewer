import type { SpecimenAlign, SpecimenSurfaceKind } from './types.ts';

/**
 * The example wrapper's width policy inside a cell, kept free of any `react-native` import so
 * `node --test` can assert on it directly (see `__tests__/specimenSurfaceStyle.test.ts`).
 *
 * The wrapper always stretches to the full cross-axis width of whatever wraps it (a comparison
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

/**
 * Centers a non-`fill` specimen horizontally inside its (now full-width) wrapper — unchanged,
 * bounded (non-`fill`) specimens stay centered by default. See `SpecimenSurface.tsx`'s
 * `SpecimenContent`, the one place every presentation shape (list/grouped/grid) wraps a specimen
 * before handing it to its cell.
 */
export const SPECIMEN_CONTENT_CENTER_STYLE = {
  ...SPECIMEN_SURFACE_WIDTH_STYLE,
  alignItems: 'center',
} as const;

/**
 * A `fill` specimen's content stretches instead of centering: `alignItems: 'center'` on this
 * wrapper previously applied to `fill` specimens too, which collapses an auto-sized, already
 * full-width child (e.g. NextTrainInfo's row) down to its own intrinsic content width instead of
 * leaving it at the wrapper's full width — `alignItems: 'center'` resolves a child with no definite
 * cross-axis size to its content size, the opposite of what `fill` promises. A `fill` specimen
 * whose own size is capped below the wrapper's width (e.g. a phone-frame preview's `maxWidth`) is
 * expected to center itself (`alignSelf: 'center'`, see `PhoneFrame.tsx`) rather than lean on this
 * wrapper's `alignItems` — the same way `alignItems: 'stretch'` already behaves like `flex-start`,
 * not an actual stretch, for any child with a definite cross-axis size (a set width/maxWidth) per
 * the flexbox spec. An explicit `align` (see `specimenContentAlignItems`) still overrides this.
 */
export const SPECIMEN_CONTENT_FILL_STYLE = {
  ...SPECIMEN_SURFACE_WIDTH_STYLE,
  alignItems: 'stretch',
} as const;

const ALIGN_ITEMS_BY_SPECIMEN_ALIGN: Record<SpecimenAlign, 'flex-start' | 'center' | 'flex-end'> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
};

/** The `SpecimenContent` wrapper's `alignItems`: an explicit `align` (`SpecimenPresentation.align`)
 *  always wins over `fill`. Omitted, `fill` decides the established default — `'stretch'` (preserve
 *  a full-width auto-sized child) when true, `'center'` (unchanged) otherwise. */
export function specimenContentAlignItems(fill: boolean | undefined, align: SpecimenAlign | undefined): 'flex-start' | 'center' | 'flex-end' | 'stretch' {
  if (align !== undefined) return ALIGN_ITEMS_BY_SPECIMEN_ALIGN[align];
  return fill ? 'stretch' : 'center';
}

/** A non-fill specimen's horizontal position, as `justifyContent` on `SpecimenContent`'s own row
 *  main axis rather than `alignItems` on a column: `alignItems` only sets a child's *default*
 *  `alignSelf`, which the specimen's own root can — and does, e.g. Badge's `alignSelf:
 *  'flex-start'` — override outright, leaning the whole grid left regardless of the wrapper's
 *  intent. `justifyContent` positions along the main axis directly and cannot be overridden by a
 *  child's `alignSelf`, which only ever targets the cross axis (vertical, on a row). Reuses
 *  `ALIGN_ITEMS_BY_SPECIMEN_ALIGN`'s mapping — `flex-start`/`center`/`flex-end` are valid values
 *  for both `alignItems` and `justifyContent`. */
export function specimenContentJustifyContent(align: SpecimenAlign | undefined): 'flex-start' | 'center' | 'flex-end' {
  return align !== undefined ? ALIGN_ITEMS_BY_SPECIMEN_ALIGN[align] : 'center';
}

/** The non-fill `SpecimenContent` wrapper's own style: still full-width (`SPECIMEN_SURFACE_WIDTH_STYLE`,
 *  so a percentage-width child keeps resolving against it), but a row main axis so
 *  `justifyContent` — not `alignItems` — decides horizontal placement (see
 *  `specimenContentJustifyContent`). Vertical cross-axis stays centered, as it already did. Only
 *  for non-`fill` specimens; `fill` keeps the existing column + `alignItems` stretch behavior
 *  (`specimenContentAlignItems`), unchanged. */
export function specimenContentBoundedStyle(align: SpecimenAlign | undefined) {
  return {
    ...SPECIMEN_SURFACE_WIDTH_STYLE,
    flexDirection: 'row' as const,
    justifyContent: specimenContentJustifyContent(align),
    alignItems: 'center' as const,
  };
}

/** Each example's cell turns gray only when its example would vanish against white (see
 *  `specimenFill.ts`). A page can force a fill with `specimenSurface`. */
export const DEFAULT_SPECIMEN_SURFACE: SpecimenSurfaceKind = 'auto';

/** A `fill` example stretches to its cell, but one with its own fixed width (a 160-point skeleton
 *  bar) stays that width; it should then sit in the middle of the cell, not against its leading
 *  edge. True when the measured example is narrower than its wrapper (by more than rounding). */
export function shouldCenterFilledContent(contentWidth: number, wrapperWidth: number): boolean {
  if (!(contentWidth > 0) || !(wrapperWidth > 0)) return false;
  return contentWidth < wrapperWidth - 1;
}
