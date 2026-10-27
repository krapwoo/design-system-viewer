import React, { memo, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { CATALOG_COLOR, CATALOG_RADIUS, CATALOG_SPACE } from './tokens';
import { thumbnailScale, type ThumbnailSource } from './overviewModel';
import { ScrollRootContext } from './scrollRootContext';
import { SpecimenSurface } from './SpecimenSurface';

/** The width a specimen is laid out at before it is scaled down when its page names none: a phone
 *  width, the catalog's own default preview width. A page that names a wider preview width uses it,
 *  so a thumbnail looks like the specimen does on its page. */
const DEFAULT_NATURAL_WIDTH = 402;
/** Mount a little before the card scrolls into view, so it is drawn by the time it arrives. */
const LOOKAHEAD = '200px';

const ARIA_HIDDEN = { 'aria-hidden': true } as Record<string, unknown>;

function canObserve(): boolean {
  return Platform.OS === 'web' && typeof IntersectionObserver !== 'undefined';
}

interface Content {
  /** The painted content's size, unscaled. */
  width: number;
  height: number;
  /** Its centre's offset from the cell's centre, unscaled. */
  dx: number;
  dy: number;
  /** The cell's own height. */
  cellHeight: number;
}

/** The box the specimen actually paints inside its cell (web only; `undefined` where there is no
 *  DOM to measure, or nothing has a size yet). The cell is as wide as the page's preview, so a
 *  small specimen sits in a lot of empty cell; scaling the cell would shrink it to nothing, so the
 *  thumbnail scales this box instead. `scale` is the transform currently on the stage. */
function paintedContent(cell: Element | null, scale: number, cellHeight: number): Content | undefined {
  const surface = cell?.firstElementChild;
  if (!cell || !surface || !(scale > 0)) return undefined;
  const origin = cell.getBoundingClientRect();
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const el of surface.querySelectorAll('*')) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    left = Math.min(left, rect.left);
    right = Math.max(right, rect.right);
    top = Math.min(top, rect.top);
    bottom = Math.max(bottom, rect.bottom);
  }
  if (!Number.isFinite(left)) return undefined;
  return {
    width: (right - left) / scale,
    height: (bottom - top) / scale,
    dx: ((left + right) / 2 - (origin.left + origin.width / 2)) / scale,
    dy: ((top + bottom) / 2 - (origin.top + origin.height / 2)) / scale,
    cellHeight,
  };
}

/** A specimen that throws must not take the whole Overview down with it. */
class ThumbnailBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Called inside a component so a `render()` that uses hooks runs them here, as it does in `Preview`. */
function RenderedSource({ source }: { source: ThumbnailSource }) {
  return <>{'render' in source ? source.render() : source.node}</>;
}

/**
 * A live, scaled-down copy of a page's first specimen inside a fixed frame. It is decoration for the
 * card around it: hidden from assistive technology, never focusable or clickable (`inert` and
 * `pointerEvents: 'none'`), and — on web, where `IntersectionObserver` exists — mounted only once
 * the frame is near the viewport (or, inside the shell, near its scrolling column). Anywhere else it
 * mounts immediately. The specimen is centred in a cell of its page's first preview width, on the
 * same `SpecimenSurface` its page gives it, measured, and shrunk with `transform: scale` to fit. Memoized:
 * a hovered or focused card re-renders without re-rendering (and re-running) the live specimen.
 */
export const OverviewThumbnail = memo(function OverviewThumbnail({ source, height, width }: { source: ThumbnailSource; height: number; width?: number }) {
  const naturalWidth = source.width ?? DEFAULT_NATURAL_WIDTH;
  const getScrollRoot = useContext(ScrollRootContext);
  const frameRef = useRef<View>(null);
  const [near, setNear] = useState(() => !canObserve());
  const [frame, setFrame] = useState({ width: width ?? 0, height });
  const cellRef = useRef<View>(null);
  const scaleRef = useRef(1);
  const [natural, setNatural] = useState<Content>({ width: 0, height: 0, dx: 0, dy: 0, cellHeight: 0 });

  // Inert is not a React Native prop; it removes the subtree from focus and clicks in one step.
  const attachFrame = useCallback((node: View | null) => {
    (frameRef as React.MutableRefObject<View | null>).current = node;
    if (Platform.OS === 'web' && node) (node as unknown as Element).setAttribute('inert', '');
  }, []);

  useEffect(() => {
    if (near) return;
    const node = frameRef.current as unknown as Element | null;
    if (!node) return;
    const root = getScrollRoot?.() ?? null;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNear(true);
        observer.disconnect();
      }
    }, { rootMargin: LOOKAHEAD, ...(root && { root }) });
    observer.observe(node);
    return () => observer.disconnect();
  }, [near, getScrollRoot]);

  const onFrameLayout = useCallback((event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setFrame((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
  }, []);
  const onNaturalLayout = useCallback((event: LayoutChangeEvent) => {
    const { height: cellHeight } = event.nativeEvent.layout;
    const next = (Platform.OS === 'web' && paintedContent(cellRef.current as unknown as Element | null, scaleRef.current, cellHeight))
      || { width: naturalWidth, height: cellHeight, dx: 0, dy: 0, cellHeight };
    const same = (a: Content, b: Content) => a.width === b.width && a.height === b.height && a.dx === b.dx && a.dy === b.dy && a.cellHeight === b.cellHeight;
    setNatural((prev) => (same(prev, next) ? prev : next));
  }, [naturalWidth]);

  const measured = natural.width > 0 && natural.height > 0 && frame.width > 0;
  const scale = thumbnailScale(natural, frame, CATALOG_SPACE.sm);
  scaleRef.current = scale;
  // The stage scales about the cell's centre, so this shift lands the painted content's centre (the
  // cell's centre, moved by the content's own offset) on the frame's centre.
  const translateX = frame.width / 2 - naturalWidth / 2 - scale * natural.dx;
  const translateY = frame.height / 2 - natural.cellHeight / 2 - scale * natural.dy;

  return (
    <View
      ref={attachFrame}
      {...ARIA_HIDDEN}
      onLayout={onFrameLayout}
      style={[styles.frame, { height }, width !== undefined && { width }, { pointerEvents: 'none' } as object]}
    >
      {near && (
        <View
          style={[
            styles.stage,
            { width: naturalWidth, opacity: measured ? 1 : 0, transform: [{ translateX }, { translateY }, { scale }] },
          ]}
        >
          {/* A cell of the page's own width, like the one its preview sits in: a specimen sized
              against its container (a PhoneFrame is `width: '100%'`) needs a definite width, or it
              collapses to nothing and scales itself away. Its painted content, not the whole cell,
              is what gets measured and scaled. */}
          <View ref={cellRef} onLayout={onNaturalLayout} style={{ width: naturalWidth }}>
            <SpecimenSurface surface={source.surface} style={styles.cell}>
              <ThumbnailBoundary>
                <RenderedSource source={source} />
              </ThumbnailBoundary>
            </SpecimenSurface>
          </View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderRadius: CATALOG_RADIUS.sm,
    backgroundColor: CATALOG_COLOR.specimenStage,
  },
  stage: { position: 'absolute', left: 0, top: 0, alignItems: 'flex-start' },
  cell: { width: '100%', alignItems: 'center' },
});
