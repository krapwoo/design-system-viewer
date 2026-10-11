import React, { useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { CATALOG_COLOR, CATALOG_RADIUS, CATALOG_TYPE } from './tokens';
import { MATRIX_LAYOUT, listGeometry, type ListItem } from './comparison';
import { SpecimenContent, SpecimenSurface } from './SpecimenSurface';
import { SpecimenAddressProvider } from './SpecimenAddress';
import { DEFAULT_SPECIMEN_SURFACE } from './specimenSurfaceStyle';
import type { SpecimenSize, SpecimenSurfaceKind } from './types';

/**
 * One-axis examples inside ONE shared card. Cells wrap into balanced rows (listGeometry); each cell
 * has its own caption strip so labels stay attached when rows wrap. Blank cells complete an uneven
 * last row. Wide specimens use fixed 402px cells and the card hugs its columns. `maxColumns` caps
 * how many columns a row ever wraps into (from `VariantSlot.maxColumns`); `surface` is the page's
 * `specimenSurface` behind each item.
 */
export function ComparisonList({
  items,
  size,
  label,
  maxColumns,
  surface = DEFAULT_SPECIMEN_SURFACE,
  pageId,
}: {
  items: ListItem[];
  size: SpecimenSize;
  label: string;
  /** The page these examples belong to, so a device frame inside one can address it. */
  pageId?: string;
  maxColumns?: 1 | 2 | 3 | 4 | 5;
  surface?: SpecimenSurfaceKind;
}) {
  const [available, setAvailable] = useState<number>(MATRIX_LAYOUT.laptopContentWidth);
  const geometry = listGeometry(items.length, available, size, maxColumns);
  const onLayout = (event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    if (width > 0 && width !== available) setAvailable(width);
  };

  const slots: (ListItem | null)[] = [...items, ...Array.from({ length: geometry.fillers }, () => null)];
  const rows: (ListItem | null)[][] = [];
  for (let r = 0; r < geometry.rows; r += 1) rows.push(slots.slice(r * geometry.columns, (r + 1) * geometry.columns));

  return (
    <View onLayout={onLayout}>
      <View role="list" aria-label={label} style={[styles.card, { width: geometry.containerWidth }]}>
        {rows.map((row, ri) => (
          <View key={ri} role="none" style={[styles.row, ri === rows.length - 1 && styles.lastRow]}>
            {row.map((item, ci) => {
              const last = ci === row.length - 1;
              // border-box: a non-last cell's 1px right divider sits inside its width.
              const width = geometry.cellWidth;
              if (!item) {
                return (
                  <View key={`blank-${ci}`} aria-hidden style={[styles.cell, { width }, last && styles.lastColumn]}>
                    <View style={styles.caption}>
                      <Text style={styles.captionText}> </Text>
                    </View>
                    <View style={styles.specimen} />
                  </View>
                );
              }
              return (
                <View key={item.key} role="listitem" style={[styles.cell, { width }, last && styles.lastColumn]}>
                  <View style={styles.caption}>
                    <Text style={styles.captionText}>{item.label}</Text>
                  </View>
                  <SpecimenSurface surface={item.surface ?? surface} style={styles.specimen}>
                    <SpecimenAddressProvider address={pageId && item.slot ? { pageId, slot: item.slot, itemKey: item.key } : undefined}>
                      <SpecimenContent fill={item.fill} align={item.align}>{item.node as React.ReactNode}</SpecimenContent>
                    </SpecimenAddressProvider>
                  </SpecimenSurface>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CATALOG_COLOR.surface,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    borderRadius: CATALOG_RADIUS.card,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: CATALOG_COLOR.border },
  lastRow: { borderBottomWidth: 0 },
  cell: { borderRightWidth: 1, borderRightColor: CATALOG_COLOR.border },
  lastColumn: { borderRightWidth: 0 },
  caption: {
    padding: MATRIX_LAYOUT.cellPadding,
    backgroundColor: CATALOG_COLOR.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: CATALOG_COLOR.border,
  },
  captionText: { fontSize: CATALOG_TYPE.tableHeader, fontWeight: '800', letterSpacing: 0.44, color: CATALOG_COLOR.text },
  specimen: {
    flexGrow: 1,
    minHeight: MATRIX_LAYOUT.rowMinHeight,
    padding: MATRIX_LAYOUT.cellPadding,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
