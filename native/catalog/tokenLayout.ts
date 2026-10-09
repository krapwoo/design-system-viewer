/**
 * Pure layout maths for token pages — no React or React Native runtime imports, so it is unit
 * tested directly (`__tests__/tokenLayout.test.ts`).
 *
 * Token pages lay out in two levels:
 *  - sections (one titled card per kind of token, e.g. "Semantic" vs "Palette") flow in up to
 *    `tokenColumns` columns, dropping to fewer rather than squeezing a section under its minimum;
 *  - inside a section, `TokenGrid` tiles as many equal tiles per row as keep their minimum width.
 */

/** Narrowest a side-by-side token section may get before the page drops a column. */
export const TOKEN_SECTION_MIN_WIDTH = 280;
/** Gap between side-by-side sections and between tiles. */
export const TOKEN_LAYOUT_GAP = 20;

/** How many section columns fit in `available` px, at most `requested`, never below 1. */
export function sectionColumns(available: number, requested: number): number {
  const fit = Math.floor((available + TOKEN_LAYOUT_GAP) / (TOKEN_SECTION_MIN_WIDTH + TOKEN_LAYOUT_GAP));
  return Math.max(1, Math.min(requested, fit));
}

/** Equal tiles per row for a `TokenGrid`: as many as keep `minTileWidth` (capped by `maxColumns`),
 *  sized so the row is filled exactly. */
export function tileGeometry(available: number, minTileWidth: number, maxColumns = Infinity): { columns: number; tileWidth: number } {
  const fit = Math.floor((available + TOKEN_LAYOUT_GAP) / (minTileWidth + TOKEN_LAYOUT_GAP));
  const columns = Math.max(1, Math.min(maxColumns, fit));
  const tileWidth = columns === 1 ? available : (available - TOKEN_LAYOUT_GAP * (columns - 1)) / columns;
  return { columns, tileWidth };
}
