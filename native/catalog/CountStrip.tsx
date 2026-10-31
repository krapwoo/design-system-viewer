import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CATALOG_COLOR, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';

/** One stat in a `CountStrip`. */
export interface CountStripItem {
  /** What is counted, shown small and uppercase above the value ("Variants"). */
  label: string;
  /** The number (or short text) itself, shown large. */
  value: string | number;
  /** An optional caption under the value, muted ("of 14 pages"). */
  sub?: string;
}

/** Fewest and most stats a strip is designed for. */
export const COUNT_STRIP_MIN = 2;
export const COUNT_STRIP_MAX = 6;

/**
 * A row of 2–6 stats for a category overview page: each in a cell of equal width that sits beside
 * the others and wraps onto the next row when the page is narrow (a cell is at least 150px wide).
 * Drawn in the viewer's own tokens: the label in the micro-label style, the value large, the
 * caption muted. A hairline separates neighbouring cells, across and down.
 *
 * ```tsx
 * <CountStrip items={[
 *   { label: 'Pages', value: 14 },
 *   { label: 'Variants', value: 62, sub: 'across all buttons' },
 * ]} />
 * ```
 *
 * Fewer than 2 or more than 6 stats still render, with a development warning: one stat is a
 * sentence, and more than six stops reading as a strip.
 */
export function CountStrip({ items }: { items: readonly CountStripItem[] }) {
  if ((globalThis as { __DEV__?: boolean }).__DEV__ && (items.length < COUNT_STRIP_MIN || items.length > COUNT_STRIP_MAX)) {
    console.warn(`[Catalog] CountStrip is designed for ${COUNT_STRIP_MIN}–${COUNT_STRIP_MAX} stats, got ${items.length}.`);
  }
  return (
    <View role="list" style={styles.strip}>
      {items.map((item, index) => (
        <View key={`${item.label}-${index}`} role="listitem" style={styles.cell}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.value}>{item.value}</Text>
          {item.sub ? <Text style={styles.sub}>{item.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // The strip's own background shows through the 1px gap between cells as the hairline dividers, so
  // they stay correct however many cells land on a row.
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    borderRadius: CATALOG_RADIUS.md,
    backgroundColor: CATALOG_COLOR.border,
  },
  cell: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 150,
    gap: 2,
    paddingVertical: CATALOG_SPACE.md,
    paddingHorizontal: CATALOG_SPACE.lg,
    backgroundColor: CATALOG_COLOR.surfaceMuted,
  },
  label: { ...CATALOG_TEXT.microLabel, color: CATALOG_COLOR.textMuted },
  value: { ...CATALOG_TEXT.pageTitle, color: CATALOG_COLOR.text },
  sub: { ...CATALOG_TEXT.micro, color: CATALOG_COLOR.textMuted },
});
