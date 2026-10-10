import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { CATALOG_COLOR, CATALOG_RADIUS, CATALOG_TYPE } from './tokens';
import { COLUMN_MIN_WIDTH, MATRIX_LAYOUT, axisItems, cellKey, gridWidthBounds, indexCells, validateComparison } from './comparison';
import { SpecimenContent, SpecimenSurface } from './SpecimenSurface';
import { DEFAULT_SPECIMEN_SURFACE } from './specimenSurfaceStyle';
import type { ComparisonDef, SpecimenSize, SpecimenSurfaceKind } from './types';

/**
 * A grid of two props that combine freely, rendered as an accessible table inside one card.
 * Columns grow with the window up to 402px and never shrink below the specimen size's minimum;
 * a grid wider than its container scrolls horizontally inside the card, never the page. `surface`
 * is the page's `specimenSurface` behind each cell's example.
 */
export function ComparisonGrid({
  def,
  size,
  sectionId,
  surface = DEFAULT_SPECIMEN_SURFACE,
}: {
  def: ComparisonDef;
  size: SpecimenSize;
  sectionId: string;
  surface?: SpecimenSurfaceKind;
}) {
  if (__DEV__) {
    for (const issue of validateComparison({ ...def, size })) console.warn(`[Catalog] ${sectionId}: ${issue}`);
  }
  const cells = indexCells(def);
  const rows = axisItems(def.rows);
  const columns = axisItems(def.columns);
  const bounds = gridWidthBounds(columns.length, size);
  const column = {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: COLUMN_MIN_WIDTH[size],
    minWidth: COLUMN_MIN_WIDTH[size],
    maxWidth: MATRIX_LAYOUT.columnMaxWidth,
  };
  const lastColumn = columns.length - 1;

  return (
    <ScrollView horizontal style={styles.scroller} contentContainerStyle={styles.scrollContent}>
      <View
        role="table"
        aria-label={`${sectionId}: ${def.rowLabel} by ${def.columnLabel}`}
        style={[styles.card, { minWidth: bounds.minWidth, maxWidth: bounds.maxWidth }]}
      >
        <View role="row" style={styles.row}>
          <View role="columnheader" style={[styles.cell, styles.rowHeader, styles.headerCell]}>
            <Text style={styles.headerText}>{def.rowLabel}</Text>
          </View>
          {columns.map((c, ci) => (
            <View key={c.key} role="columnheader" style={[styles.cell, column, styles.headerCell, ci === lastColumn && styles.lastColumn]}>
              <Text style={styles.headerText}>{c.label}</Text>
            </View>
          ))}
        </View>
        {rows.map((row, ri) => (
          <View key={row.key} role="row" style={[styles.row, ri === rows.length - 1 && styles.lastRow]}>
            <View role="rowheader" style={[styles.cell, styles.rowHeader, styles.bodyRow]}>
              <Text style={styles.rowHeaderText}>{row.label}</Text>
            </View>
            {columns.map((c, ci) => {
              const cell = cells.get(cellKey(row.key, c.key));
              return (
                cell?.node !== undefined ? (
                  <SpecimenSurface key={c.key} role="cell" surface={surface} style={[styles.cell, column, styles.bodyRow, styles.specimenCell, ci === lastColumn && styles.lastColumn]}>
                    <SpecimenContent fill={cell.fill}>{cell.node}</SpecimenContent>
                  </SpecimenSurface>
                ) : (
                  <View key={c.key} role="cell" style={[styles.cell, column, styles.bodyRow, styles.specimenCell, ci === lastColumn && styles.lastColumn]}>
                    <Text style={styles.unavailable}>
                      {cell?.unavailableReason ? `Not supported — ${cell.unavailableReason}` : 'Missing example'}
                    </Text>
                  </View>
                )
              );
            })}
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
  cell: { padding: MATRIX_LAYOUT.cellPadding, borderRightWidth: 1, borderRightColor: CATALOG_COLOR.border },
  lastColumn: { borderRightWidth: 0 },
  rowHeader: { width: MATRIX_LAYOUT.rowHeaderWidth, flexShrink: 0, justifyContent: 'center', backgroundColor: CATALOG_COLOR.surfaceMuted },
  headerCell: { backgroundColor: CATALOG_COLOR.surfaceMuted, justifyContent: 'center' },
  bodyRow: { minHeight: MATRIX_LAYOUT.rowMinHeight },
  specimenCell: { alignItems: 'center', justifyContent: 'center' },
  headerText: { fontSize: CATALOG_TYPE.tableHeader, fontWeight: '800', letterSpacing: 0.44, color: CATALOG_COLOR.text },
  rowHeaderText: { fontSize: CATALOG_TYPE.md, fontWeight: '700', color: CATALOG_COLOR.text },
  unavailable: { fontSize: CATALOG_TYPE.sm, fontStyle: 'italic', textAlign: 'center', color: CATALOG_COLOR.textMuted },
});
