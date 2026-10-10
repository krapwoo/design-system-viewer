import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CATALOG_TYPE, CATALOG_COLOR, CATALOG_SPACE } from './tokens';

/**
 * Wraps one token's rendered example with a grounded "when to use this" note beneath it — the
 * shared shape behind every token-gallery row (Spacing, Type Scale, …) in both the starter kit's
 * own token pages and the catalog framework's own `kit-host/viewer-pages/` pages. The row's own
 * content (a spacing bar, a type sample, …) is
 * freeform `children`; only the value-plus-use-note stacking is standardized here.
 *
 * Draws a 1px `CATALOG_COLOR.border` bottom divider by default (the same divider PropsTable's rows use) so a stack of TokenRows
 * reads as a list, not a loose pile of paragraphs. Pass `last` on the final row in a stack to drop
 * the divider, matching PropsTable's own `rowLast` convention. Balanced `CATALOG_SPACE.md` padding
 * sits above and below both the content and its use-note, so a stack of rows breathes evenly
 * instead of only the divider-adjacent gap existing.
 */
export function TokenRow({
  children,
  use,
  last = false,
  notePlacement = 'below',
  sampleWidth = 280,
}: {
  children: React.ReactNode;
  use: string;
  last?: boolean;
  /** `'right'` puts the note beside a narrow sample (icon sizes, spacing, control heights) so each
   *  token is one line; the sample keeps `sampleWidth` and the note takes the rest. */
  notePlacement?: 'below' | 'right';
  sampleWidth?: number;
}) {
  if (notePlacement === 'right') {
    return (
      <View style={[styles.itemRight, !last && styles.itemDivider]}>
        <View style={{ width: sampleWidth, flexShrink: 0 }}>{children}</View>
        {use ? <Text style={[styles.use, styles.useRight]}>{use}</Text> : null}
      </View>
    );
  }
  return (
    <View style={[styles.item, !last && styles.itemDivider]}>
      {children}
      {use ? <Text style={styles.use}>{use}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { gap: CATALOG_SPACE.xs, paddingVertical: CATALOG_SPACE.md },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: CATALOG_SPACE.xl, paddingVertical: CATALOG_SPACE.md },
  useRight: { flex: 1 },
  itemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: CATALOG_COLOR.border,
  },
  use: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted },
});
