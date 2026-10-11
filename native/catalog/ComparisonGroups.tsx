import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { CATALOG_COLOR, CATALOG_RADIUS, CATALOG_TYPE } from './tokens';
import { COLUMN_MIN_WIDTH, MATRIX_LAYOUT, type ListGroup } from './comparison';
import { SpecimenContent, SpecimenSurface } from './SpecimenSurface';
import { DEFAULT_SPECIMEN_SURFACE } from './specimenSurfaceStyle';
import type { SpecimenSize, SpecimenSurfaceKind } from './types';

/**
 * Grouped rows: one row per variant, headed by the variant's name, holding that variant's own
 * configurations. Each cell keeps its own caption because the rows do not share column meanings
 * (a circle's size is not a bar's thickness). Each row is its own labeled list. Shorter rows end
 * in blank cells; a card wider than its container scrolls horizontally inside itself. `surface` is
 * the page's `specimenSurface` behind each item.
 */
export function ComparisonGroups({
  groups,
  size,
  label,
  surface = DEFAULT_SPECIMEN_SURFACE,
}: {
  groups: ListGroup[];
  size: SpecimenSize;
  label: string;
  surface?: SpecimenSurfaceKind;
}) {
  const columns = Math.max(1, ...groups.map((g) => g.items.length));
  const min = COLUMN_MIN_WIDTH[size];
  const minWidth = MATRIX_LAYOUT.rowHeaderWidth + columns * min + 2;
  return (
    <ScrollView horizontal style={styles.scroller} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.card, { minWidth }]}>
        {groups.map((group, gi) => (
          <View key={group.key} style={[styles.row, gi === groups.length - 1 && styles.lastRow]}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowHeaderText}>{group.label}</Text>
            </View>
            <View role="list" aria-label={`${label}: ${group.label}`} style={styles.cells}>
              {Array.from({ length: columns }, (_, ci) => {
                const item = group.items[ci];
                const last = ci === columns - 1;
                if (!item) {
                  return <View key={`blank-${ci}`} aria-hidden style={[styles.cell, { minWidth: min }, last && styles.lastColumn]} />;
                }
                return (
                  <View key={item.key} role="listitem" style={[styles.cell, { minWidth: min }, last && styles.lastColumn]}>
                    <View style={styles.caption}>
                      <Text style={styles.captionText}>{item.label}</Text>
                    </View>
                    <SpecimenSurface surface={item.surface ?? surface} style={styles.specimen}>
                      <SpecimenContent fill={item.fill} align={item.align}>{item.node as React.ReactNode}</SpecimenContent>
                    </SpecimenSurface>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
  scrollContent: { flexGrow: 1 },
  card: {
    width: '100%',
    backgroundColor: CATALOG_COLOR.surface,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    borderRadius: CATALOG_RADIUS.card,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: CATALOG_COLOR.border },
  lastRow: { borderBottomWidth: 0 },
  rowHeader: {
    width: MATRIX_LAYOUT.rowHeaderWidth,
    flexShrink: 0,
    justifyContent: 'center',
    padding: MATRIX_LAYOUT.cellPadding,
    backgroundColor: CATALOG_COLOR.surfaceMuted,
    borderRightWidth: 1,
    borderRightColor: CATALOG_COLOR.border,
  },
  rowHeaderText: { fontSize: CATALOG_TYPE.md, fontWeight: '700', color: CATALOG_COLOR.text },
  cells: { flex: 1, flexDirection: 'row' },
  cell: { flex: 1, maxWidth: MATRIX_LAYOUT.columnMaxWidth, borderRightWidth: 1, borderRightColor: CATALOG_COLOR.border },
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
