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
