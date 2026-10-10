import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { CATALOG_COLOR } from './tokens';
import { DEFAULT_SPECIMEN_SURFACE, SPECIMEN_SURFACE_WIDTH_STYLE } from './specimenSurfaceStyle';
import { blendsIntoCell, measurePaintedBoxes } from './specimenFill';
import type { SpecimenSurfaceKind } from './types';

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
 *  against the cell), centered unless the example fills the cell. */
export function SpecimenContent({ fill, children }: { fill?: boolean; children: React.ReactNode }) {
  return <View style={fill ? styles.fill : styles.center}>{children}</View>;
}

// 'dark' reuses CATALOG_COLOR.text (the catalog's own darkest token); there is no dark-surface token.
const FILL = StyleSheet.create({
  neutral: { backgroundColor: CATALOG_COLOR.specimenStage },
  white: { backgroundColor: CATALOG_COLOR.surface },
  dark: { backgroundColor: CATALOG_COLOR.text },
  transparent: {},
});

const styles = StyleSheet.create({
  center: { ...SPECIMEN_SURFACE_WIDTH_STYLE, alignItems: 'center' },
  fill: { ...SPECIMEN_SURFACE_WIDTH_STYLE },
});
