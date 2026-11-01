/**
 * Pure checks for the order and uniqueness of a `TokenGrid`'s tiles — no React or React Native
 * runtime imports, so it is unit tested directly (`__tests__/tokenGridOrder.test.ts`).
 *
 * A token page that draws one tile per written form, in file order (`6pt` twice, `17pt` before
 * `4pt`), reads as a scale with mistakes in it. Two things are checked: no two tiles share a name,
 * and tiles whose names start with a number run smallest to largest, comparing only tiles that share
 * a unit. A tile whose name does not start with a number (`Pill`, `Card`, `16:9`) is ignored for ordering.
 */

/** Prefix of every message `TokenGrid` logs about its tiles. `doctor --render` recognises it and
 *  reports the finding as `token-grid-order`. */
export const TOKEN_GRID_ORDER_PREFIX = 'TokenGrid order: ';

/** The number a tile name starts with and its unit: the token right after it (`pt`, `ms`, `s`, `×`), or `''`. */
export interface LeadingQuantity { value: number; unit: string }

/** The first number a tile name starts with, with the token right after it as its unit (`4pt · xs`
 *  → `pt`, `22 × 22` → `×`), or `undefined` when it does not start with one. Only that token counts,
 *  so a suffix or a second number never gives each tile a unit of its own. Reads a thousands group (`1,000ms` → 1000) and a
 *  Unicode minus (`−4pt` → -4). A ratio (`16:9`, `3/2`) is no number: it is not a size on a scale. */
export function leadingQuantity(name: string): LeadingQuantity | undefined {
  const match = /^\s*([+\-\u2212]?)(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)/.exec(name);
  if (!match) return undefined;
  const rest = name.slice(match[0].length);
  if (/^\s*[:/]\s*[\d.]/.test(rest)) return undefined;
  const value = Number(match[2].replace(/,/g, ''));
  const unit = /^\s*([^\d\s.,:/·()]*)/.exec(rest)?.[1] ?? '';
  return { value: match[1] === '-' || match[1] === '\u2212' ? -value : value, unit };
}

/** The first number a tile name starts with (`4pt` → 4, `0.25s` → 0.25, `22 × 22` → 22, `-8pt` → -8,
 *  `1,000ms` → 1000), or `undefined` when it does not start with one. */
export function leadingNumber(name: string): number | undefined {
  return leadingQuantity(name)?.value;
}

/** What is wrong with these tile names, as plain sentences — one per distinct duplicated name, then
 *  (unless `ordered` is false, for `order="authored"`) one for the first numbered tile that is
 *  smaller than the one before it. Empty when there is nothing to say. */
export function tokenGridOrderProblems(names: readonly string[], options: { ordered?: boolean } = {}): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const reported = new Set<string>();
  for (const name of names) {
    if (seen.has(name) && !reported.has(name)) {
      reported.add(name);
      problems.push(`${TOKEN_GRID_ORDER_PREFIX}two tiles are named "${name}". Keep one tile per value and put other spellings and call sites in Details.`);
    }
    seen.add(name);
  }
  if (options.ordered === false) return problems;
  // A tile is compared only with the numbered tile before it, and only when they share a unit
  // (`250ms`, `500ms`, `1s` is a scale; so is `1:1`, `4:3`, `16:9`, which has no number at all).
  let previous: { name: string; value: number; unit: string } | undefined;
  for (const name of names) {
    const quantity = leadingQuantity(name);
    if (quantity === undefined) continue;
    const { value, unit } = quantity;
    if (previous && previous.unit === unit && value < previous.value) {
      problems.push(`${TOKEN_GRID_ORDER_PREFIX}"${name}" comes after "${previous.name}". Order tiles smallest to largest, or set order="authored" on the TokenGrid if this order is deliberate.`);
      break;
    }
    previous = { name, value, unit };
  }
  return problems;
}
