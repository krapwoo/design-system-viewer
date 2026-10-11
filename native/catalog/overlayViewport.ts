/**
 * Pure logic behind `BoundedOverlayViewport.tsx` — no React/React Native imports, so it runs
 * under Node's test runner the same way `catalogNavigation.ts` does for `CatalogShell`. Addresses
 * one specific authored specimen, decides whether an instance should frame itself in a bounded
 * child document or render inline, and (for `CatalogShell`'s own chromeless selected-document
 * render) resolves an address back to the `node` it names.
 */
import type React from 'react';
import type { SectionDef } from './types.ts';

/** Which block on a page an addressed specimen's `node` lives in — see `findOverlayNode`. */
export type OverlaySlot = 'variants' | 'states' | 'comparison' | 'preview';

/** Identifies exactly one authored specimen: a page id (`SectionDef.id`), which block it lives
 *  in, and that item's own key — `VariantExample.key` for `'variants'`/`'states'`, or this
 *  module's own `comparisonCellItemKey(rowKey, columnKey)` for a `'comparison'` cell (NOT an ad
 *  hoc `"<rowKey>:<columnKey>"` join — a plain colon join is ambiguous whenever a row or column
 *  key contains a colon itself). Always an existing author-assigned identifier, never inferred
 *  from pixels, source strings, or a DOM selector. */
export interface OverlayAddress {
  pageId: string;
  slot: OverlaySlot;
  itemKey: string;
}

const OVERLAY_SLOTS: readonly OverlaySlot[] = ['variants', 'states', 'comparison', 'preview'];

/** `encodeURIComponent` leaves `.` untouched (it's an unreserved character), which would let a
 *  literal `.` inside a segment collide with the `.`-joined encoding below; escape it too so
 *  splitting on `.` is always safe. `decodeURIComponent` already reverses `%2E` with no special
 *  casing needed. */
function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/\./g, '%2E');
}

/** The query param a `BoundedOverlayViewport`'s child document is opened with — distinct from
 *  `CatalogShell`'s own page-routing hash (`#PageId`), which the child document's URL also keeps
 *  (see `overlayViewportHrefSuffix`) so the SAME app entry still resolves the right page/providers
 *  before the viewport component itself ever runs. */
export const OVERLAY_ADDRESS_PARAM = 'ds-viewer-overlay';

/** `pageId.slot.itemKey`, each segment percent-encoded — one URL-safe token for a query value. */
export function encodeOverlayAddress(address: OverlayAddress): string {
  return [address.pageId, address.slot, address.itemKey].map(encodeSegment).join('.');
}

/** The inverse of `encodeOverlayAddress` — `undefined` for anything that isn't exactly three
 *  non-empty segments with a recognized slot: the same "malformed means absent" recovery
 *  `catalogNavigation.ts`'s `idFromHash` uses for an unknown page fragment, rather than guessing
 *  at a partial or corrupted address. */
export function decodeOverlayAddress(value: string): OverlayAddress | undefined {
  const parts = value.split('.');
  if (parts.length !== 3) return undefined;
  let decoded: string[];
  try {
    decoded = parts.map((part) => decodeURIComponent(part));
  } catch {
    return undefined;
  }
  const [pageId, slot, itemKey] = decoded;
  if (!pageId || !itemKey) return undefined;
  if (!OVERLAY_SLOTS.includes(slot as OverlaySlot)) return undefined;
  return { pageId, slot: slot as OverlaySlot, itemKey };
}

/** Reads `OVERLAY_ADDRESS_PARAM` out of a URL search string (e.g. `window.location.search`);
 *  `undefined` when the param is absent or its value doesn't decode. A trailing `#fragment` is
 *  dropped first — `URLSearchParams` has no notion of a URL fragment, so without this a caller
 *  that (like `overlayViewportHrefSuffix`'s own combined query+hash string) passes one along
 *  would see it swallowed into the last param's value instead of ignored. */
export function overlayAddressFromSearch(search: string): OverlayAddress | undefined {
  const raw = new URLSearchParams(search.split('#')[0]).get(OVERLAY_ADDRESS_PARAM);
  return raw ? decodeOverlayAddress(raw) : undefined;
}

export function overlayAddressesEqual(a: OverlayAddress, b: OverlayAddress): boolean {
  return a.pageId === b.pageId && a.slot === b.slot && a.itemKey === b.itemKey;
}

/** The query + hash suffix that boots the SAME app entry directly into this address's
 *  selected-document mode: the overlay param (so the `BoundedOverlayViewport` instance that
 *  matches this address renders its children inline instead of framing itself again) plus the
 *  page's own routing hash (so `CatalogShell`'s existing hash-based routing still resolves the
 *  right `SectionDef`/providers before `findOverlayNode` narrows further). */
export function overlayViewportHrefSuffix(address: OverlayAddress): string {
  return `?${OVERLAY_ADDRESS_PARAM}=${encodeURIComponent(encodeOverlayAddress(address))}#${encodeURIComponent(address.pageId)}`;
}

/** `'inline'`: render the wrapped demo directly, no frame — either this isn't a web runtime (no
 *  same-origin child-document mechanism to offer; see `BoundedOverlayViewport`'s own doc comment)
 *  or `currentSearch` already names this exact address, meaning this instance IS the selected
 *  child document's own addressed specimen and must not frame itself again (recursion guard).
 *  `'frame'`: open `href` — the current pathname plus this address's query+hash — in a bounded
 *  child document. */
export type OverlayViewportDecision = { mode: 'inline' } | { mode: 'frame'; href: string };

export function resolveOverlayViewport(args: {
  address: OverlayAddress;
  isWeb: boolean;
  /** The hosting document's current `location.search` (e.g. `window.location.search`). */
  currentSearch: string;
  /** The hosting document's current `location.pathname` — same pathname the child document loads,
   *  since this viewer is a single-page app whose page lives in the hash, not the path. */
  pathname: string;
}): OverlayViewportDecision {
  if (!args.isWeb) return { mode: 'inline' };
  const current = overlayAddressFromSearch(args.currentSearch);
  if (current && overlayAddressesEqual(current, args.address)) return { mode: 'inline' };
  return { mode: 'frame', href: `${args.pathname}${overlayViewportHrefSuffix(args.address)}` };
}

/** The authored `node` an `OverlayAddress` points at, or `undefined` for a stale/unknown address
 *  (a removed example, a renamed key, a typo) — `CatalogShell`'s chromeless selected-document
 *  render shows an honest "unavailable" recovery rather than rendering nothing silently. */
export function findOverlayNode(sections: readonly SectionDef<string>[], address: OverlayAddress): React.ReactNode | undefined {
  const def = sections.find((section) => section.id === address.pageId);
  if (!def) return undefined;
  if (address.slot === 'variants') return def.variants?.items.find((item) => item.key === address.itemKey)?.node;
  if (address.slot === 'states') return def.states?.items.find((item) => item.key === address.itemKey)?.node;
  // A `render()` page's preview (one per page; `itemKey` is always 'preview').
  if (address.slot === 'preview') return def.render?.();
  // Matched by recomputing each cell's own canonical key, never by splitting `address.itemKey` —
  // a row/column key may itself contain any delimiter this module could pick.
  return def.comparison?.cells.find((cell) => comparisonCellItemKey(cell.rowKey, cell.columnKey) === address.itemKey)?.node;
}

/** The canonical, unambiguous `itemKey` for one comparison cell's row+column — this module's own
 *  counterpart to `comparison.ts`'s `cellKey` (not imported from there: a VALUE import between two
 *  pure `.ts` logic modules here can't carry the `.ts` extension that both Node's direct test run
 *  and `kit-host`'s bundler-mode typechecker require/reject at once — `import type` is exempt
 *  since it is fully erased, which is why `./types.ts` above is fine). Exported so a `.tsx` call
 *  site building a `'comparison'` `OverlayAddress` constructs the exact same key this module looks
 *  it up by — a plain `"${rowKey}:${columnKey}"` join is ambiguous whenever a row or column key
 *  contains a colon itself. */
export function comparisonCellItemKey(rowKey: string, columnKey: string): string {
  return `${rowKey} ${columnKey}`;
}

/** Usable CSS pixel dimensions for a bounded overlay viewport: finite and strictly positive.
 *  `NaN`/`Infinity`/zero/negative (a measurement that hasn't settled yet, a miscomputed layout
 *  value, an author typo) must never reach `BoundedOverlayViewport`'s iframe — an iframe sized to
 *  a meaningless bound is worse than no iframe, since it still renders (and can still mount the
 *  wrapped demo's overlay) at some browser-decided fallback size instead of honestly reporting
 *  unavailable. */
export function isFiniteOverlaySize(width: number, height: number): boolean {
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
}

/** The framed stage's own box dimensions. `height` is exact — the production overlay's full
 *  usable height is never renegotiated by its owner. `width` is only a MAXIMUM: `'100%'` lets the
 *  stage fill and shrink to whatever its real owning specimen cell actually gives it, capped at
 *  `width` when the owner has at least that much room. A fixed pixel width here previously let the
 *  stage overflow a narrower owner (e.g. a 240px comparison cell at a narrow browser width) while
 *  that owner's own `overflow: hidden` silently clipped the excess — a passing-looking but false
 *  containment, not the honest unavailable/shrink this design requires. */
export function overlayStageDimensions(width: number, height: number): { width: '100%'; maxWidth: number; height: number } {
  return { width: '100%', maxWidth: width, height };
}
