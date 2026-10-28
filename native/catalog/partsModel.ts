/** The Parts block's data: which `composedOf` entries a page shows as its parts. Node-safe and
 *  React-free, so it runs under Node's test runner. */
import type { CatalogAnatomy, ComposedOfEntry } from './types.ts';

/** One entry the block lists. `sourceMemberId` names the family member that declared it (a whole's
 *  entry), so activating it records that member as the origin; a page's own entry has none. */
export interface PartEntry {
  entry: ComposedOfEntry;
  sourceMemberId?: string;
}

/** The entries a page shows as parts: those with a `built-in` or `slot` relationship (not
 *  `related`), the page's own first and then the whole member's, in declared order. The first
 *  entry for a name wins, and a name `exclude` claims (a member of this very page) is left out. */
export function partEntries(
  sources: ReadonlyArray<{ composedOf: readonly ComposedOfEntry[] | undefined; sourceMemberId?: string }>,
  exclude: (name: string) => boolean = () => false,
): PartEntry[] {
  const seen = new Set<string>();
  const parts: PartEntry[] = [];
  for (const { composedOf, sourceMemberId } of sources) {
    for (const entry of composedOf ?? []) {
      if (entry.relationship !== 'built-in' && entry.relationship !== 'slot') continue;
      if (seen.has(entry.component) || exclude(entry.component)) continue;
      seen.add(entry.component);
      parts.push({ entry, sourceMemberId });
    }
  }
  return parts;
}

/** The number after a page's own top-level parts: one more than the highest top-level number in
 *  `outline` (`'3'` and `'3.1'` both count as top-level 3), or 1 for a page with none. `ids`, when
 *  given, limits the count to those members (a group member's own descendants). */
export function nextTopLevelNumber(outline: ReadonlyMap<string, { number: string }>, ids?: readonly string[]): number {
  let highest = 0;
  for (const [id, { number }] of outline) {
    if (ids && !ids.includes(id)) continue;
    const top = Number.parseInt(number, 10);
    if (Number.isFinite(top) && top > highest) highest = top;
  }
  return highest + 1;
}

/** A used component's number on a page: shared by its anatomy pin, its legend row and its Parts card. */
export interface PartNumbering {
  /** The number for `name`, or `undefined` for a name this page did not number. */
  numberOf(name: string): string | undefined;
  /** Whether `name` opens a page of its own (its pin and card say so). */
  opens(name: string): boolean;
  /** The destination page's title for `name`, when it resolves to one: what a pin announces instead
   *  of the authored token (an alias or an internal id). */
  titleOf(name: string): string | undefined;
}

/** Numbers the components a page uses, continuing its own top-level parts at `first`: first the
 *  anatomy `other` items in the order they first appear across the legend groups, then the Parts
 *  block's `partNames` in block order. `keyOf` names a component's identity, so two names that
 *  resolve to the same page (id, component, member id or alias) share one number; the default is
 *  the name itself. The page's own parts are never renumbered — this only hands out numbers after
 *  them. */
export function partNumbering({ first, anatomies, partNames, keyOf = (name) => name, opens = () => false, titleOf = () => undefined, counts = () => true }: {
  first: number;
  anatomies: ReadonlyArray<CatalogAnatomy | undefined>;
  partNames: readonly string[];
  keyOf?: (name: string) => string;
  opens?: (name: string) => boolean;
  titleOf?: (name: string) => string | undefined;
  /** Whether `name` counts as a part at all; one that does not is never numbered, wherever it
   *  appears. Default: every name counts. */
  counts?: (name: string) => boolean;
}): PartNumbering {
  const numbers = new Map<string, string>();
  const assign = (name: string) => {
    if (!counts(name)) return;
    const key = keyOf(name);
    if (!numbers.has(key)) numbers.set(key, String(first + numbers.size));
  };
  for (const anatomy of anatomies) {
    for (const group of anatomy?.groups ?? []) for (const item of group.items) if ('other' in item) assign(item.other);
  }
  for (const name of partNames) assign(name);
  return { numberOf: (name) => numbers.get(keyOf(name)), opens, titleOf };
}
