import React, { useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TYPE } from './tokens';
import { sectionColumns, tileGeometry, TOKEN_LAYOUT_GAP } from './tokenLayout';
import type { TokenSection } from './types';

/** Measures its own width; renders nothing inside until the width is known. */
function useWidth(): [number, (event: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  return [width, (event) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  }];
}

/**
 * A token page's sections (`SectionDef.tokenSections`): one titled card per kind of token, flowing
 * in up to `columns` columns. A `wide` section takes a full row; the page drops to fewer columns
 * rather than squeeze a section under its minimum width.
 */
export function TokenSections({ sections, columns }: { sections: TokenSection[]; columns: 1 | 2 | 3 }) {
  const [width, onLayout] = useWidth();
  const perRow = sectionColumns(width, columns);
  const columnWidth = perRow === 1 ? width : (width - TOKEN_LAYOUT_GAP * (perRow - 1)) / perRow;
  return (
    <View onLayout={onLayout} style={styles.sections}>
      {width > 0 && sections.map((section) => (
        <View key={section.title} style={{ width: section.wide || perRow === 1 ? width : columnWidth }}>
          <Text style={styles.sectionLabel}>{section.title}</Text>
          {section.desc ? <Text style={styles.sectionDesc}>{section.desc}</Text> : null}
          <View style={styles.card}>{section.render()}</View>
        </View>
      ))}
    </View>
  );
}

/**
 * Tokens as tiles in columns — for tokens whose preview is small and self-contained (radius,
 * shadow, colour, control height). As many equal tiles per row as keep `minTileWidth`.
 */
export function TokenGrid({ children, minTileWidth = 140, maxColumns }: { children: React.ReactNode; minTileWidth?: number; maxColumns?: number }) {
  const [width, onLayout] = useWidth();
  const { tileWidth } = tileGeometry(width, minTileWidth, maxColumns);
  return (
    <View onLayout={onLayout} style={styles.grid}>
      {width > 0 && React.Children.map(children, (child) => (child ? <View style={{ width: tileWidth }}>{child}</View> : null))}
    </View>
  );
}

/**
 * One token in a `TokenGrid`: its preview, then its name and value, then its role. `note` says
 * where or why the token is used (from its comments or real usages) — omit it when there is none.
 */
export function TokenTile({ name, value, note, children }: { name: string; value?: string; note?: string; children: React.ReactNode }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tilePreview}>{children}</View>
      <Text style={styles.tileName}>{name}</Text>
      {value ? <Text style={styles.tileValue}>{value}</Text> : null}
      {note ? <Text style={styles.tileNote}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sections: { flexDirection: 'row', flexWrap: 'wrap', gap: TOKEN_LAYOUT_GAP, rowGap: CATALOG_LAYOUT.blockGap, alignItems: 'flex-start' },
  sectionLabel: {
    fontSize: CATALOG_TYPE.sm,
    fontWeight: '700',
    letterSpacing: 0.72,
    textTransform: 'uppercase',
    color: CATALOG_COLOR.text,
  },
  sectionDesc: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted, marginTop: CATALOG_SPACE.xs },
  card: {
    marginTop: CATALOG_LAYOUT.blockLabelGap,
    backgroundColor: CATALOG_COLOR.surface,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    borderRadius: CATALOG_RADIUS.card,
    padding: CATALOG_SPACE.xl,
    gap: CATALOG_SPACE.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: TOKEN_LAYOUT_GAP },
  tile: { gap: CATALOG_SPACE.xs },
  tilePreview: { minHeight: 56, justifyContent: 'center', marginBottom: CATALOG_SPACE.xs },
  tileName: { fontSize: CATALOG_TYPE.sm, fontWeight: '700', color: CATALOG_COLOR.text },
  tileValue: { fontSize: CATALOG_TYPE.xs, color: CATALOG_COLOR.textMuted },
  tileNote: { fontSize: CATALOG_TYPE.xs, color: CATALOG_COLOR.textMuted, lineHeight: 16 },
});
