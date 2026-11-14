import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { OverlayPortal, useOverlayHost } from '../OverlayHost';
import { DS_SEMANTIC, DS_SPACING, DS_RADIUS, DS_SHADOW, DS_TYPOGRAPHY } from '../../tokens';

export interface TooltipProps {
  /** Whether the bubble is shown. Fully controlled — drive this from the wrapped trigger's own
   *  onLongPress/onPressIn, since mobile has no hover. */
  visible: boolean;
  /** The tooltip text. */
  label: string;
  /** Which side of the trigger the bubble appears on. @default 'top' */
  placement?: 'top' | 'bottom';
  /** Which edge of the trigger the bubble prefers to anchor to horizontally: `'center'` (default)
   *  centers the bubble on the trigger; `'left'`/`'right'` aligns the bubble's respective edge with
   *  the trigger's — useful when the trigger sits near a screen edge and a centered bubble would
   *  extend past it. This is only a *preference*: the bubble is always clamped to stay fully within
   *  the screen regardless, and the arrow is always computed to point at the trigger's true center,
   *  never a decorative fixed corner offset. */
  align?: 'left' | 'center' | 'right';
  /** The trigger content the bubble is anchored to. */
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

const GAP = DS_SPACING[200];
const MIN_WIDTH = 60;
const MAX_WIDTH_RATIO = 0.8;
const ARROW_SIZE = 6;
// How close the bubble (and the arrow within it) may come to the screen's own edge.
const EDGE_MARGIN = DS_SPACING[400];
// For align='left'/'right': how far the bubble extends *past* the trigger's own edge, instead of
// aligning flush with it. This gives the arrow (still always computed from the trigger's true
// center — see below) breathing room from the bubble's rounded corner by shifting the bubble
// itself, never by clamping the arrow away from accuracy the way a min-inset-on-the-arrow approach
// would (that approach was tried and reverted: it silently mis-pointed the arrow for any trigger
// narrower than the inset).
const EDGE_OVERHANG = DS_SPACING[400];
// Same colour as the bubble's own background, referenced directly (not via a resolved variable)
// since — unlike Toast — Tooltip has only the one dark surface, no variant/light-background mode.
// surface.inverse, not text.regular — it's a dark PANEL fill, not ink (same reasoning as Toast).
const BUBBLE_COLOR = DS_SEMANTIC.surface.inverse;

export interface TooltipPositionInput {
  /** The trigger's rect in window coordinates (`measureInWindow`). */
  trigger: { x: number; y: number; width: number; height: number };
  /** The bubble's own rendered size. */
  bubble: { width: number; height: number };
  windowWidth: number;
  placement: 'top' | 'bottom';
  align: 'left' | 'center' | 'right';
  /** The coordinate space's top-left corner in window coordinates: the OverlayHost's origin, or
   *  `{ x: 0, y: 0 }` for window coordinates. */
  origin: { x: number; y: number };
}

/**
 * Where the bubble goes, in the host's coordinate space (window coordinates minus `origin`).
 * `left`/`top` are the bubble's top-left corner; `arrowLeft` is the arrow's centre, measured from the
 * bubble's own left edge. Pure, so every positioning rule is testable without rendering.
 */
export function computeTooltipPosition({ trigger, bubble, windowWidth, placement, align, origin }: TooltipPositionInput) {
  const triggerCenterAbs = trigger.x + trigger.width / 2;
  const idealLeftAbs =
    align === 'left'
      ? trigger.x - EDGE_OVERHANG
      : align === 'right'
        ? trigger.x + trigger.width + EDGE_OVERHANG - bubble.width
        : triggerCenterAbs - bubble.width / 2;
  const minLeftAbs = EDGE_MARGIN;
  const maxLeftAbs = windowWidth - bubble.width - EDGE_MARGIN;
  // maxLeftAbs can be < minLeftAbs for a bubble wider than the screen minus margins — clamp the
  // clamp range itself so a too-wide bubble still lands at minLeftAbs instead of NaN/garbage.
  const clampedLeftAbs = Math.min(Math.max(idealLeftAbs, minLeftAbs), Math.max(maxLeftAbs, minLeftAbs));
  // Always derived from the trigger's real position — never clamped/overridden — so the arrow is
  // guaranteed accurate regardless of how far the bubble above just shifted for `align` or screen
  // clamping. EDGE_OVERHANG (baked into idealLeftAbs) is what gives it breathing room from the
  // bubble's corner; this line doesn't need its own inset logic on top of that.
  const arrowLeft = Math.min(Math.max(triggerCenterAbs - clampedLeftAbs, 0), bubble.width);
  const topAbs = placement === 'top' ? trigger.y - GAP - bubble.height : trigger.y + trigger.height + GAP;
  return { left: clampedLeftAbs - origin.x, top: topAbs - origin.y, arrowLeft };
}

let warnedNoHost = false;

/**
 * A small floating label anchored above or below its wrapped trigger, with a small triangular arrow
 * pointing back at it. Measures the trigger's real position (`measureInWindow`, since a plain
 * onLayout only gives a position relative to the trigger's own parent, not the screen) and the
 * bubble's own rendered width (onLayout), then computes the bubble's horizontal offset itself
 * instead of just flexbox-centering it — this is what makes it possible to (a) clamp the bubble so
 * it never runs past the screen's left/right edge and (b) always place the arrow at the trigger's
 * true horizontal center, even when the bubble itself had to shift away from `align`'s preferred
 * position to stay on screen. No `numberOfLines` cap on the label — it wraps to however many lines
 * it needs rather than truncating; `maxWidth` (80% of the screen width, via `useWindowDimensions` so
 * it tracks rotation/resize) is what keeps a long label from ever running edge-to-edge. The arrow is
 * the classic CSS border-triangle trick (a zero-size box with one transparent-adjacent border side
 * coloured in) — RN's View supports per-side border colours, so this needs no SVG.
 *
 * Where there is an `OverlayHost` above it, the bubble is rendered into the host's overlay layer at
 * the trigger's window position (minus the host's own origin), so no ancestor's `overflow: hidden`
 * can clip it. Without one it is drawn in place beside the trigger as before, and warns once in
 * development. It is re-measured when it becomes visible or the window resizes, not while a visible
 * tooltip's trigger scrolls.
 */
export function Tooltip({ visible, label, placement = 'top', align = 'center', children, style }: TooltipProps) {
  const { width: windowWidth } = useWindowDimensions();
  const maxWidth = Math.round(windowWidth * MAX_WIDTH_RATIO);
  const host = useOverlayHost();
  const hostOrigin = host?.origin;

  const wrapRef = useRef<View>(null);
  const [trigger, setTrigger] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [bubbleSize, setBubbleSize] = useState({ width: 0, height: 0 });

  // Re-measures whenever the bubble becomes visible or the window is resized — the trigger's own
  // on-screen position can only be read once it (and any layout change causing it) has settled.
  useEffect(() => {
    if (!visible) {
      // Through a host the bubble is placed absolutely, so a position left over from the last show
      // would flash in the wrong place; in place, the old fallback behaviour is kept as it was.
      if (host) setTrigger(null);
      return undefined;
    }
    const raf = requestAnimationFrame(() => {
      wrapRef.current?.measureInWindow((x, y, width, height) => setTrigger({ x, y, width, height }));
    });
    return () => cancelAnimationFrame(raf);
  }, [visible, windowWidth, !!host]);

  useEffect(() => {
    if (visible && !host && typeof __DEV__ !== 'undefined' && __DEV__ && !warnedNoHost) {
      warnedNoHost = true;
      console.warn('Tooltip: no OverlayHost found, so the bubble is drawn in place and an ancestor with overflow: hidden (a ScrollView, a rounded Card) can clip it. Mount an <OverlayHost> near the app root.');
    }
  }, [visible, !!host]);

  const measured = trigger != null && bubbleSize.width > 0;
  const position = measured ? computeTooltipPosition({ trigger, bubble: bubbleSize, windowWidth, placement, align, origin: hostOrigin ?? { x: 0, y: 0 } }) : null;

  const bubbleNode = (
    <>
      <View
        style={[styles.bubble, { maxWidth }, style]}
        onLayout={(e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          setBubbleSize((s) => (s.width === width && s.height === height ? s : { width, height }));
        }}
        // Announce the hint when it appears — without this, a screen-reader user gets no
        // signal the tooltip exists unless they stumble onto it by swiping.
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.label}>{label}</Text>
      </View>
      <View
        style={[
          styles.arrow,
          placement === 'top' ? styles.arrowTop : styles.arrowBottom,
          position ? { left: position.arrowLeft, marginLeft: -ARROW_SIZE } : styles.arrowCenter,
        ]}
      />
    </>
  );

  if (host) {
    // Drawn in the host's layer, at the trigger's window position minus the host's own origin. The
    // slot is a fixed `maxWidth` wide so the bubble inside it never gets squeezed by the room left
    // to the right of `left` (which would change its measured width and move it again); until both
    // are measured it is invisible rather than drawn at 0,0.
    return (
      <View style={styles.wrap} ref={wrapRef}>
        {children}
        <OverlayPortal>
          {visible && (
            <View pointerEvents="none" style={[styles.slot, { width: maxWidth }, position ? { left: position.left, top: position.top } : styles.slotHidden]}>
              <View style={styles.bubbleWrapHosted}>{bubbleNode}</View>
            </View>
          )}
        </OverlayPortal>
      </View>
    );
  }

  const bubbleOffsetStyle: ViewStyle = position ? { alignSelf: 'flex-start', marginLeft: position.left - trigger!.x } : styles.bubbleWrapCentered;

  return (
    <View style={styles.wrap} ref={wrapRef}>
      {children}
      {visible && (
        <View pointerEvents="none" style={[styles.overlay, placement === 'top' ? styles.overlayTop : styles.overlayBottom]}>
          <View style={[styles.bubbleWrap, bubbleOffsetStyle]}>{bubbleNode}</View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Shrinks to the trigger's own content width, so the overlay below (left:0/right:0) matches it —
  // without this, a Tooltip inside a wider flex row would stretch and mis-centre the bubble.
  wrap: { alignSelf: 'flex-start' },
  overlay: { position: 'absolute', left: 0, right: 0, zIndex: 10 },
  // Hosted: positioned in the OverlayHost's layer by `computeTooltipPosition`'s left/top.
  slot: { position: 'absolute' },
  slotHidden: { left: 0, top: 0, opacity: 0 },
  bubbleWrapHosted: { alignSelf: 'flex-start' },
  overlayTop: { bottom: '100%', marginBottom: GAP },
  overlayBottom: { top: '100%', marginTop: GAP },
  // Shrink-wraps to `bubble`'s own real width (the only in-flow child; `arrow` is absolutely
  // positioned so it doesn't affect this) — the shared positioning context the computed
  // `marginLeft`/arrow offsets above are both relative to.
  bubbleWrap: { alignItems: 'center' },
  // Pre-measurement fallback only — matches the old always-centered look.
  bubbleWrapCentered: { alignSelf: 'center' },
  bubble: {
    // Flexbox's implicit `min-width: auto` would otherwise let this shrink down to its longest
    // single word (collapsing "Tap to add a stop" into a tall, narrow, multi-line sliver) since it's
    // a flex child of `overlay`, a column container whose own width matches the (often much
    // narrower) trigger — `flexShrink: 0` alone doesn't stop that on web; `width: 'max-content'`
    // (a web-only CSS value, harmlessly ignored by RN's own layout engine on native, where this
    // shrink-to-longest-word quirk doesn't occur) forces the natural single-line width instead.
    flexShrink: 0,
    width: 'max-content' as unknown as number,
    minWidth: MIN_WIDTH,
    backgroundColor: BUBBLE_COLOR,
    borderRadius: DS_RADIUS.small,
    paddingHorizontal: DS_SPACING[400],
    paddingVertical: DS_SPACING[200],
    ...DS_SHADOW.card,
  },
  label: {
    ...DS_TYPOGRAPHY.bodyXs,
    color: DS_SEMANTIC.text.inverse,
    textAlign: 'center',
    // The actual node that was collapsing to its min-content (longest word) width — `flexShrink: 0`
    // on `bubble` alone wasn't enough, since this Text is itself a shrinkable flex child one level in.
    flexShrink: 0,
  },
  // A zero-size box with only one border side coloured in draws as a triangle — the classic CSS
  // trick, which RN's per-side border-color/width props support natively too. Horizontal position
  // is applied separately above (a computed `left`, or `arrowCenter` before the first measurement).
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_SIZE,
    borderRightWidth: ARROW_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowCenter: { left: '50%', marginLeft: -ARROW_SIZE },
  // Bubble sits above the trigger (placement="top") — the arrow hangs off the bubble's bottom edge,
  // pointing down at the trigger below it. `bottom: 0` on the overlay-relative arrow lines its own
  // top edge up with the bubble's bottom edge exactly, since the bubble itself sits flush at the
  // overlay's bottom (overlayTop's `marginBottom: GAP` already reserves the gap between the two).
  arrowTop: {
    bottom: -ARROW_SIZE,
    borderTopWidth: ARROW_SIZE,
    borderTopColor: BUBBLE_COLOR,
  },
  // Mirror of the above — bubble sits below the trigger, arrow hangs off its top edge pointing up.
  arrowBottom: {
    top: -ARROW_SIZE,
    borderBottomWidth: ARROW_SIZE,
    borderBottomColor: BUBBLE_COLOR,
  },
});
