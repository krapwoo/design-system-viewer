/**
 * Pure helpers for `InventoryGroup` / `InventoryTile` — no React or React Native runtime imports, so
 * they are unit tested directly (`__tests__/inventoryModel.test.ts`).
 */

/** The surface an inventory tile's stage uses. Every tile in a grid sits on the same grey specimen stage,
 *  so `'auto'` — which elsewhere leaves a cell white unless its example blends with white — means that
 *  stage here; an explicit surface (`'dark'`, `'white'`, `'transparent'`) is kept. */
export function inventoryStageSurface<S extends string>(surface: S | 'auto'): S | 'neutral' {
  return surface === 'auto' ? 'neutral' : surface;
}

/** Most tiles an inventory group lays out across. */
export const INVENTORY_MAX_COLUMNS = 4;
/** Narrowest an inventory tile gets before the group drops a column. */
export const INVENTORY_MIN_TILE_WIDTH = 260;

/** How many columns an inventory group of `count` tiles may use, at most: `maxColumns`, except that
 *  three or five tiles lay out three across (a row of three, or three and two) rather than leaving
 *  one tile alone on the last row (a fifth after four). A narrow page still drops below this. */
export function inventoryMaxColumns(count: number, maxColumns: number = INVENTORY_MAX_COLUMNS): number {
  return count === 3 || count === 5 ? Math.min(3, maxColumns) : maxColumns;
}

/** The address a tile's `target` names, without a leading `#`: `'#Button'` and `'Button'` are the same. */
export function inventoryTargetId(target: string): string {
  return target.startsWith('#') ? target.slice(1) : target;
}

/** A name for something that has no title: its id with camel case split into words, in sentence case
 *  (`ChatTactileButtonStyle` → `Chat tactile button style`). An acronym keeps its capitals
 *  (`HTTPClientView` → `HTTP client view`); `_` and `-` separate words too. */
export function readableName(id: string): string {
  const words = id
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean);
  return words
    .map((word, index) => {
      if (/^[A-Z]{2,}$/.test(word)) return word;
      const lower = word.toLowerCase();
      return index === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}
