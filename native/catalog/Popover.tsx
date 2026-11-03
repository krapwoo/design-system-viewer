import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
// @ts-ignore -- react-dom is a peer dependency of this package, but a consumer's project may not have its types installed
import { createPortal } from 'react-dom';
import { Platform, StyleSheet, View } from 'react-native';
import { POPOVER_EDGE, POPOVER_MAX_WIDTH, popoverPosition } from './popoverModel';
import { CATALOG_COLOR, CATALOG_RADIUS, CATALOG_SPACE } from './tokens';

const FADE_MS = 120;
/** The popover's shadow: the viewer has no elevation token, and this is the same light neutral its side-panel scrim uses. */
const POPOVER_SHADOW = '0 6px 20px rgba(20,20,20,.16)';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A small floating panel anchored to the control that opened it, for a short explanation that
 * should not take the reader off the page (a side panel is for more than that). Mount it while it
 * is open and unmount it to close; the control keeps the `open` state and toggles it, which is also
 * how a second tap on the control closes it.
 *
 * - Opens below the anchor, left edges aligned; flips above when below would run past the window and
 *   above fits, and shifts sideways to stay `POPOVER_EDGE` inside it. At most `POPOVER_MAX_WIDTH`
 *   wide, and never wider than the window less the edge each side.
 * - `role="dialog"` named by `label`, not modal: nothing behind it is inert. Focus moves into it on
 *   open and returns to the anchor on close, unless the reader moved it to something else.
 * - Tab or Shift+Tab closes it and continues from the anchor. On a window too short for it, it scrolls inside
 *   (at most the window less the edge each side tall).
 * - `placeRef`, if given, is what it is placed against (a smaller target inside the anchor); the anchor still
 *   takes the toggle and the focus.
 * - Drawn in a portal on the body, over everything, whatever the control sits in.
 * - `onClose` is called for Escape, a press outside it (the anchor excepted, which toggles), focus
 *   leaving it, scrolling anything and resizing the window. Only one popover is open at a time:
 *   opening one moves focus into it, and focus leaving the other closes that one.
 * - An opacity fade of 120ms, none under `prefers-reduced-motion`. Web only (the viewer is); on
 *   other platforms it is drawn in place, unpositioned.
 *
 * ```tsx
 * {open ? <Popover anchorRef={buttonRef} label="About styles" onClose={() => setOpen(false)}>…</Popover> : null}
 * ```
 */
export function Popover({ anchorRef, placeRef, label, onClose, children }: { anchorRef: React.RefObject<View | null>; placeRef?: React.RefObject<View | null>; label: string; onClose: () => void; children: React.ReactNode }): React.ReactElement {
  const panelRef = useRef<View>(null);
  const [placed, setPlaced] = useState<{ left: number; top: number } | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  // Latest `onClose`, so a parent that passes a new inline function each render does not re-run the
  // open/focus effect (which would move focus again and re-announce the dialog).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const reduced = useRef(false);

  const place = useCallback(() => {
    const anchor = (placeRef ?? anchorRef).current as unknown as HTMLElement | null;
    const panel = panelRef.current as unknown as HTMLElement | null;
    if (!anchor || !panel || typeof window === 'undefined') return;
    const position = popoverPosition(anchor.getBoundingClientRect(), { width: panel.offsetWidth, height: panel.offsetHeight }, { width: window.innerWidth, height: window.innerHeight });
    setPlaced((prev) => (prev && prev.left === position.left && prev.top === position.top ? prev : { left: position.left, top: position.top }));
  }, [anchorRef, placeRef]);

  // Measured and placed before paint, so it never flashes at the wrong spot; the fade starts after.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    place();
  }, [place, children]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    reduced.current = prefersReducedMotion();
    const panel = panelRef.current as unknown as HTMLElement | null;
    const anchor = anchorRef.current as unknown as HTMLElement | null;
    setVisible(true);
    panel?.focus({ preventScroll: true });
    const inside = (target: EventTarget | null) => target instanceof Node && Boolean(panel?.contains(target));
    const onAnchor = (target: EventTarget | null) => target instanceof Node && Boolean(anchor?.contains(target));
    const close = () => onCloseRef.current();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      // The panel is portalled to the end of the body, so Tab from it would start from the page's end. Put
      // focus back on the anchor first (no preventDefault) and the browser's own Tab carries on from there.
      else if (event.key === 'Tab') { close(); anchor?.focus?.({ preventScroll: true }); }
    };
    const onPointer = (event: Event) => { if (!inside(event.target) && !onAnchor(event.target)) close(); };
    const onFocus = (event: FocusEvent) => { if (!inside(event.target) && !onAnchor(event.target)) close(); };
    // Capture, so a scroll of any pane (the shell scrolls its own, not the window) closes it.
    const onScroll = (event: Event) => { if (!inside(event.target)) close(); };
    const onResize = () => close();
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      // Back to the anchor, unless the reader already moved focus somewhere else.
      const active = document.activeElement;
      if (!active || active === document.body || panel?.contains(active)) anchor?.focus?.({ preventScroll: true });
    };
  }, [anchorRef]);

  const web = Platform.OS === 'web';
  const fixed = web ? ({ position: 'fixed', left: placed?.left ?? 0, top: placed?.top ?? 0, maxWidth: `calc(100vw - ${2 * POPOVER_EDGE}px)`, maxHeight: `calc(100vh - ${2 * POPOVER_EDGE}px)`, overflowY: 'auto' } as object) : null;
  const fade = web ? ({ opacity: visible && placed ? 1 : 0, transitionProperty: 'opacity', transitionDuration: reduced.current ? '0ms' : `${FADE_MS}ms` } as object) : null;
  const panel = (
    <View
      ref={panelRef}
      role="dialog"
      tabIndex={-1}
      {...({ 'aria-label': label } as Record<string, unknown>)}
      style={[styles.panel, fixed, fade]}
    >
      {children}
    </View>
  );
  // On the page, in a portal at the end of the body: drawn over everything, whatever stacking context
  // or transform the control sits in (the shell's panes are transformed, which would also move a
  // `position: fixed` panel's origin).
  return web && typeof document !== 'undefined' ? createPortal(panel, document.body) : panel;
}

const styles = StyleSheet.create({
  panel: {
    width: POPOVER_MAX_WIDTH,
    zIndex: 50,
    gap: CATALOG_SPACE.md,
    padding: CATALOG_SPACE.lg,
    backgroundColor: CATALOG_COLOR.surface,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    borderRadius: CATALOG_RADIUS.md,
    boxShadow: POPOVER_SHADOW,
    // The panel takes focus itself (it is text), and a ring on a whole panel only distracts.
    outlineStyle: 'none',
  } as object,
});
