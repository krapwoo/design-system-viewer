/**
 * The device every `PhoneFrame` shows: a real phone's viewport, in points, at the small end of
 * current phones (iPhone SE, 3rd generation). Examples lay out at exactly these dimensions; a cell
 * narrower than the device scales the whole viewport down instead of squeezing its layout. Kept
 * free of runtime imports so `node --test` can check it.
 */
export const DEVICE_FRAME = { name: 'iPhone SE', width: 375, height: 667 } as const;

/** How much to scale the device so it fits `availableWidth` (never enlarged). An unmeasured cell
 *  (0) renders at full size rather than collapsing. */
export function deviceFrameScale(availableWidth: number): number {
  if (!(availableWidth > 0)) return 1;
  return Math.min(1, availableWidth / DEVICE_FRAME.width);
}

/** Below this, a device is scaled enough that its own text is no longer the size a reader sees it
 *  at, and the page should declare a wider specimen instead.
 *
 *  Not exactly 1. A regular cell leaves 370px for a 375px device — a 1.3% reduction nobody can
 *  see, and warning about it would train authors to ignore the warning. The cases worth a page's
 *  attention are the ones that shrink a phone by a tenth or more: a 283px cell renders the device
 *  at 75%, which is the difference between readable body text and not. */
export const DEVICE_SCALE_WARN_BELOW = 0.95;
