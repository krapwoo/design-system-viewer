import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { CATALOG_TEXT, CATALOG_COLOR, CATALOG_SPACE } from './tokens';

type Lane = { width: number; report: (width: number) => void };

const LaneContext = createContext<Lane | undefined>(undefined);

/**
 * Gives a stack of `notePlacement="right"` rows one shared sample column, measured from the widest
 * sample actually in the stack.
 *
 * A fixed column has to be wide enough for the biggest sample a page might hold, which strands
 * every smaller one: a `normal 400` weight sample is ~110px, and in a column sized for an 88px
 * display sample its note sat 700px away from it. Measuring instead means the Font page's column
 * is as wide as a font weight, and the Type scale's is as wide as `display` — each page tight to
 * its own content, with the notes still aligned in a single column to read down.
 *
 * The width only ever grows, so it settles after the first layout: once the column is the widest
 * natural sample, no sample can report wider than it and nothing re-measures. Rows sit at their
 * natural width for that first frame.
 */
export function TokenRowGroup({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(0);
  const report = useCallback((next: number) => {
    setWidth((current) => (next > current ? next : current));
  }, []);
  const value = useMemo(() => ({ width, report }), [width, report]);
  return <LaneContext.Provider value={value}>{children}</LaneContext.Provider>;
}

/**
 * Wraps one token's rendered example with a grounded "when to use this" note — the shared shape
 * behind every token-gallery row (Spacing, Type Scale, …) in both the starter kit's own token pages
 * and the catalog framework's own `viewer-pages/` pages. The row's own content (a spacing bar, a
 * type sample, …) is freeform `children`; only the value-plus-use-note arrangement is standardized
 * here.
 *
 * Draws a 1px `CATALOG_COLOR.border` bottom divider by default (the same divider PropsTable's rows
 * use) so a stack of TokenRows reads as a list, not a loose pile of paragraphs. Pass `last` on the
 * final row in a stack to drop the divider, matching PropsTable's own `rowLast` convention.
 * Balanced `CATALOG_SPACE.md` padding sits above and below, so a stack of rows breathes evenly
 * instead of only the divider-adjacent gap existing.
 */
export function TokenRow({
  children,
  use,
  last = false,
  notePlacement = 'below',
  sampleWidth = 280,
  action,
}: {
  children: React.ReactNode;
  use: string;
  /** A control after the note, e.g. a `TokenDetails` link. */
  action?: React.ReactNode;
  last?: boolean;
  /** `'right'` puts the note beside the sample (font weights, spacing, type sizes) so each token is
   *  one line. Inside a `TokenRowGroup` the sample column is measured from the widest sample in the
   *  stack; a `TokenRowGroup`'s measured column wins when there is one, and `sampleWidth`
   *  (default 280) is the fallback for a row standing on its own. Keeping the default matters for
   *  rows outside a group: without it every row sizes to its own sample and the notes stop lining
   *  up in a column, which is the thing `notePlacement="right"` exists to do. */
  notePlacement?: 'below' | 'right';
  sampleWidth?: number;
}) {
  const lane = useContext(LaneContext);

  if (notePlacement === 'right') {
    const measured = lane && lane.width > 0 ? lane.width : undefined;
    // Inside a group the lane governs, and only the lane: falling back to `sampleWidth` on the
    // first frame would pin the sample to 280 before anything is measured, and the measurement
    // taken through that constraint can never report wider than 280 — capping a lane that exists
    // precisely to grow to the widest sample (a type scale's `display` needs ~470).
    // `sampleWidth` is for a row standing on its own, where there is nothing to measure against.
    const column = lane ? measured : sampleWidth;
    const onLayout = lane
      ? (event: LayoutChangeEvent) => lane.report(Math.ceil(event.nativeEvent.layout.width))
      : undefined;
    return (
      <View style={[styles.itemRight, !last && styles.itemDivider]}>
        {/* While measuring, the inner view sits at its natural width so it reports what the sample
            actually takes. Standing alone there is nothing to report, so it stretches to the column
            instead — otherwise a sample sized as a percentage would collapse to nothing. */}
        <View style={[styles.sample, column !== undefined && { width: column }]}>
          <View style={onLayout ? styles.natural : undefined} onLayout={onLayout}>{children}</View>
        </View>
        {use ? <Text style={[styles.use, styles.useRight]}>{use}</Text> : null}
        {action}
      </View>
    );
  }
  return (
    <View style={[styles.item, !last && styles.itemDivider]}>
      {children}
      {use ? <Text style={styles.use}>{use}</Text> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { gap: CATALOG_SPACE.xs, paddingVertical: CATALOG_SPACE.md },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: CATALOG_SPACE.xl, paddingVertical: CATALOG_SPACE.md },
  sample: { flexShrink: 0 },
  natural: { alignSelf: 'flex-start' },
  useRight: { flex: 1 },
  itemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: CATALOG_COLOR.border,
  },
  use: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted },
});
