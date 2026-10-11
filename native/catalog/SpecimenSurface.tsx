import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { CATALOG_COLOR } from './tokens';
import {
  DEFAULT_SPECIMEN_SURFACE, SPECIMEN_SURFACE_WIDTH_STYLE, overflowsCell, paintedExtent, shouldCenterFilledContent, specimenContentAlignItems,
  specimenContentBoundedStyle, visibleBoxes, type LayoutBox,
} from './specimenSurfaceStyle';
import { useSpecimenAddress } from './SpecimenAddress';
import { blendsIntoCell, measurePaintedBoxes } from './specimenFill';
import type { SpecimenAlign, SpecimenSurfaceKind } from './types';

type Browser = {
  getComputedStyle?: (element: unknown) => never;
  Element?: new () => unknown;
  requestAnimationFrame?: (callback: () => void) => number;
};

/**
 * An example's whole cell area — shared by `ComparisonList`, `ComparisonGroups`,
 * `ComparisonGrid`, and `SectionBlock`'s preview frames, so a page's `specimenSurface` fills every
 * example cell the same way. With `'auto'` (the default) the cell measures its example after it
 * draws and turns gray only when the example would vanish against white (a white card, sheet or
 * neutral banner; see `specimenFill.ts`). Explicit kinds fill the cell without measuring. Adds no
 * padding or border of its own: pass the cell's own layout in `style`. Measuring needs the
 * browser's DOM; elsewhere `'auto'` leaves the cell white. Extra props (e.g. `role`) go to the View.
 */
export function SpecimenSurface({
  surface = DEFAULT_SPECIMEN_SURFACE,
  style,
  children,
  ...viewProps
}: {
  surface?: SpecimenSurfaceKind;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  [prop: string]: unknown;
}) {
  const ref = useRef<View>(null);
  const [blends, setBlends] = useState(false);

  const measure = useCallback(() => {
    if (surface !== 'auto') return;
    const browser = globalThis as unknown as Browser;
    const node = ref.current as unknown;
    if (!browser.getComputedStyle || !browser.Element || !(node instanceof browser.Element)) return;
    const { boxes, cellArea } = measurePaintedBoxes(node as Parameters<typeof measurePaintedBoxes>[0], (element) => browser.getComputedStyle!(element));
    setBlends(blendsIntoCell(boxes, cellArea));
  }, [surface]);

  useEffect(() => {
    const raf = (globalThis as unknown as Browser).requestAnimationFrame;
    if (surface !== 'auto' || !raf) return;
    // Two frames, so the example's own styles and fonts have applied before measuring.
    let cancelled = false;
    raf(() => raf(() => {
      if (!cancelled) measure();
    }));
    return () => {
      cancelled = true;
    };
  }, [surface, measure]);

  const fill = surface === 'auto' ? (blends ? FILL.neutral : undefined) : FILL[surface];
  return (
    <View ref={ref} onLayout={surface === 'auto' ? measure : undefined} style={[style, fill]} {...viewProps}>
      {children}
    </View>
  );
}

/** Wraps one example inside its cell: full cell width (so a percentage-width example resolves
 *  against the cell). `fill` changes whether the example itself also stretches to that width
 *  (default) or keeps its own content size — a non-`fill` specimen centers by default; a `fill`
 *  one stretches by default instead, preserving an auto-sized full-width child (see
 *  `specimenContentAlignItems`). `align` always overrides that default explicitly.
 *
 *  A non-`fill` specimen uses a row main axis (`specimenContentBoundedStyle`) so `justifyContent`
 *  positions it horizontally — a column + `alignItems` left the specimen's own root `alignSelf`
 *  (e.g. Badge's `alignSelf: 'flex-start'`) free to override that positioning outright, since
 *  `alignItems` only sets a child's *default* `alignSelf`. `fill` keeps the existing column +
 *  `alignItems` stretch behavior, unchanged. */
type MeasurableNode = {
  getBoundingClientRect: () => { left: number; right: number; width: number };
  children: ArrayLike<MeasurableNode>;
  childElementCount: number;
  tagName: string;
};

/** The example's element tree as `LayoutBox`es (up to 400 elements), so `visibleBoxes` can skip
 *  what scrolling or clipping containers hide. */
function readTree(root: MeasurableNode, browser: Browser): LayoutBox {
  let budget = 400;
  const read = (el: MeasurableNode): LayoutBox => {
    const rect = el.getBoundingClientRect();
    const style = browser.getComputedStyle!(el) as unknown as { backgroundColor: string; borderTopWidth: string; visibility: string; overflowX: string };
    const kids: LayoutBox[] = [];
    const children = el.children;
    for (let i = 0; i < children.length && budget > 0; i++) {
      budget -= 1;
      const child = children[i];
      if (child.getBoundingClientRect().width < 1) continue;
      kids.push(read(child));
    }
    return {
      left: rect.left,
      right: rect.right,
      painted:
        style.visibility !== 'hidden' &&
        (el.childElementCount === 0 || el.tagName === 'svg' || el.tagName === 'IFRAME' ||
          style.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(style.borderTopWidth) > 0),
      clips: style.overflowX === 'hidden' || style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflowX === 'clip',
      children: kids,
    };
  };
  return read(root);
}

export function SpecimenContent({ fill, align, children }: { fill?: boolean; align?: SpecimenAlign; children: React.ReactNode }) {
  // After layout (browser only): a `fill` example whose visible content is narrower than the cell
  // (a fixed-width skeleton, a tooltip around a small trigger) is centred instead of sitting
  // against the leading edge; an explicit `align` always wins. And in development, an example
  // wider than its cell logs a warning naming a wider `specimenSize`.
  const address = useSpecimenAddress();
  const ref = useRef<View>(null);
  const [centerNarrow, setCenterNarrow] = useState(false);
  const warned = useRef(false);
  const measure = useCallback(() => {
    const browser = globalThis as unknown as Browser;
    const node = ref.current as unknown as MeasurableNode | null;
    if (!browser.Element || !browser.getComputedStyle || !node?.getBoundingClientRect) return;
    const wrapperWidth = node.getBoundingClientRect().width;
    const visible = paintedExtent(visibleBoxes(readTree(node, browser)));
    if (fill && align === undefined && !centerNarrow && shouldCenterFilledContent(visible, wrapperWidth)) setCenterNarrow(true);
    if ((globalThis as { __DEV__?: boolean }).__DEV__ && !warned.current && overflowsCell(visible, wrapperWidth)) {
      warned.current = true;
      console.warn(
        `[Catalog] ${address ? `${address.pageId} (${address.itemKey})` : 'An example'} is ${Math.round(visible)}px wide in a ${Math.round(wrapperWidth)}px cell, so it's cut off. Give the page a wider specimenSize ('regular' or 'wide').`,
      );
    }
  }, [fill, align, centerNarrow, address]);
  if (fill) {
    const alignItems = centerNarrow ? 'center' : specimenContentAlignItems(fill, align);
    return <View ref={ref} onLayout={measure} style={[SPECIMEN_SURFACE_WIDTH_STYLE, { alignItems }]}>{children}</View>;
  }
  return <View ref={ref} onLayout={measure} style={specimenContentBoundedStyle(align)}>{children}</View>;
}

// 'dark' reuses CATALOG_COLOR.text (the catalog's own darkest token); there is no dark-surface token.
const FILL = StyleSheet.create({
  neutral: { backgroundColor: CATALOG_COLOR.specimenStage },
  white: { backgroundColor: CATALOG_COLOR.surface },
  dark: { backgroundColor: CATALOG_COLOR.text },
  transparent: {},
});
