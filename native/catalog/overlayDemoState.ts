/** What `OverlayDemo` shows for a given open state. Kept free of runtime imports for `node --test`. */
export function overlayTrigger(
  open: boolean,
  options: { triggerLabel: string | ((open: boolean) => string); keepTrigger?: boolean },
): { visible: boolean; label: string } {
  const label = typeof options.triggerLabel === 'function' ? options.triggerLabel(open) : options.triggerLabel;
  return { visible: !open || Boolean(options.keepTrigger), label };
}
