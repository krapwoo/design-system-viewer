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

/** What an inventory is showing: everything, one group, or the tiles carrying one tag. */
export type InventoryFilter =
  | { kind: 'all' }
  | { kind: 'group'; title: string }
  | { kind: 'tag'; tag: string };

export const INVENTORY_ALL: InventoryFilter = { kind: 'all' };

/** The shape of an inventory the filters are derived from: its groups' titles and each tile's tags. */
export interface InventoryShape {
  title: string;
  tiles: readonly { tags?: readonly string[] }[];
}

/** One filter chip: its label, how many tiles it shows, and the filter it selects. */
export interface InventoryChip {
  key: string;
  label: string;
  count: number;
  filter: InventoryFilter;
}

/** `all`, then one chip per group that has tiles, then one per tag any tile declares (in order of
 *  first appearance), each counted from the same tiles the groups draw, so a chip's number is
 *  exactly how many tiles it leaves showing. A group with no tiles has no chip, as it draws nothing;
 *  groups with the same title share one chip; a tag named like a group is labelled `<tag> (tag)`. */
export function inventoryChips(groups: readonly InventoryShape[]): InventoryChip[] {
  const total = groups.reduce((sum, group) => sum + group.tiles.length, 0);
  const chips: InventoryChip[] = [{ key: 'all', label: 'All', count: total, filter: INVENTORY_ALL }];
  // Groups that share a title are one chip, as the filter shows all of them: a second chip with the
  // same name, key and accessible name would be indistinguishable.
  const byTitle = new Map<string, number>();
  for (const group of groups) {
    if (group.tiles.length > 0) byTitle.set(group.title, (byTitle.get(group.title) ?? 0) + group.tiles.length);
  }
  for (const [title, count] of byTitle) chips.push({ key: `group:${title}`, label: title, count, filter: { kind: 'group', title } });
  const tags = new Map<string, number>();
  for (const group of groups) {
    for (const tile of group.tiles) {
      for (const tag of new Set(tile.tags ?? [])) tags.set(tag, (tags.get(tag) ?? 0) + 1);
    }
  }
  // A tag named like a group says it is a tag, so the two chips have different names.
  for (const [tag, count] of tags) chips.push({ key: `tag:${tag}`, label: byTitle.has(tag) ? `${tag} (tag)` : tag, count, filter: { kind: 'tag', tag } });
  return chips;
}

/** Whether a tile in group `groupTitle` with `tags` is shown under `filter`. */
export function inventoryTileShown(filter: InventoryFilter, groupTitle: string, tags: readonly string[] | undefined): boolean {
  if (filter.kind === 'group') return filter.title === groupTitle;
  if (filter.kind === 'tag') return (tags ?? []).includes(filter.tag);
  return true;
}

export function sameInventoryFilter(a: InventoryFilter, b: InventoryFilter): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'group') return a.title === (b as typeof a).title;
  if (a.kind === 'tag') return a.tag === (b as typeof a).tag;
  return true;
}

/** Whether the "Showing N of M" line is drawn: only while a filter narrows the list. It stays
 *  mounted (visually hidden) under All, so the next change is still announced. */
export function inventoryStatusVisible(active: InventoryFilter): boolean {
  return !sameInventoryFilter(active, INVENTORY_ALL);
}

/** How many tiles `filter` shows across `groups`. */
export function inventoryShownCount(filter: InventoryFilter, groups: readonly InventoryShape[]): number {
  return groups.reduce((sum, group) => sum + group.tiles.filter((tile) => inventoryTileShown(filter, group.title, tile.tags)).length, 0);
}

/** The group title with its count: `Shared styles · 12`, or `Shared styles · 3 of 12` while a filter
 *  hides some of its tiles. */
export function inventoryGroupName(title: string, shown: number, total: number): string {
  return shown === total ? `${title} · ${total}` : `${title} · ${shown} of ${total}`;
}
