/**
 * Pure placement rule for `Popover` — no React or React Native runtime imports, so it is unit tested
 * directly (`__tests__/popoverModel.test.ts`).
 */
/** The widest a popover gets; on a narrower window it takes the window less `POPOVER_EDGE` each side. */
export const POPOVER_MAX_WIDTH = 320;
/** The least space kept between a popover and the window's edge. */
export const POPOVER_EDGE = 12; // CATALOG_SPACE.md (this file takes no imports; the test asserts they agree)
/** The space between the anchor and the popover. */
export const POPOVER_GAP = 4; // CATALOG_SPACE.xs

/** Where a popover of `size` goes for an `anchor` in a `viewport`: below the anchor, left edges
 *  aligned; above it when below would run past the window and above fits; shifted sideways to stay
 *  `edge` inside the window, and up from the bottom edge when neither side fits. Pure, so the rule is testable without a layout engine. */
export function popoverPosition(
  anchor: { left: number; top: number; right: number; bottom: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  options: { edge?: number; gap?: number } = {},
): { left: number; top: number; placement: 'below' | 'above' } {
  const edge = options.edge ?? POPOVER_EDGE;
  const gap = options.gap ?? POPOVER_GAP;
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - size.height;
  const placement = below + size.height > viewport.height - edge && above >= edge ? 'above' : 'below';
  const left = Math.max(edge, Math.min(anchor.left, viewport.width - edge - size.width));
  // Neither side fits (a short window): keep it wholly in view, over the anchor if it must; the panel
  // scrolls inside once it is as tall as the window less the edge each side.
  const top = Math.max(edge, Math.min(placement === 'below' ? below : above, viewport.height - edge - size.height));
  return { left, top, placement };
}
