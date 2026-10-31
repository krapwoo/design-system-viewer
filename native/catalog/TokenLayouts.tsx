import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from './tokens';
import { sectionColumns, tileGeometry, TOKEN_LAYOUT_GAP, TOKEN_SECTION_MIN_WIDTH } from './tokenLayout';
import { DocumentedAnchor } from './DocumentedAnchor';
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
export function TokenSections({
  sections, columns, label, onSectionNode,
}: {
  sections: TokenSection[];
  columns: 1 | 2 | 3;
  label?: string;
  /** #64 B2/B5: called with each section's own outer node (web: the real DOM node) as it mounts,
   *  and `undefined` as it unmounts — keyed by the same id/title React already keys the section
   *  by. Lets a caller (the jump row, or a section-alias arrival) scroll a given section into view.
   *  Omitted (every existing caller) leaves every section's own rendering untouched. */
  onSectionNode?: (key: string, node: unknown) => void;
}) {
  const [width, onLayout] = useWidth();
  const perRow = sectionColumns(width, columns);
  // Degrading quietly is how a page ends up claiming a column count it never renders: the author
  // reads `columns={3}`, the reader sees one column, and nothing says the space was the reason.
  // Once per transition, not once per render: a resize re-renders continuously.
  const warned = useRef('');
  if (width > 0 && perRow < columns && (globalThis as { __DEV__?: boolean }).__DEV__) {
    const key = `${columns}:${perRow}`;
    if (warned.current !== key) {
      warned.current = key;
      console.warn(`[Catalog] ${label ?? 'TokenSections'}: asked for ${columns} columns but only ${perRow} fit in ${width}px; sections never go below ${TOKEN_SECTION_MIN_WIDTH}px.`);
    }
  }
  const columnWidth = perRow === 1 ? width : (width - TOKEN_LAYOUT_GAP * (perRow - 1)) / perRow;
  return (
    <View onLayout={onLayout} style={styles.sections}>
      {width > 0 && sections.map((section) => {
        // #61: `section.id` when the author set one (two sections may legitimately share a human
        // `title`, e.g. two scoped "Palette" cards — `TokenSection.id`'s own doc comment) — omitted
        // keeps the prior `title`-keyed behavior exactly as it was.
        const key = section.id ?? section.title;
        return (
          <View
            key={key}
            ref={onSectionNode ? (node: unknown) => onSectionNode(key, node) : undefined}
            style={{ width: section.wide || perRow === 1 ? width : columnWidth }}
          >
            <Text style={styles.sectionLabel}>{section.title}</Text>
            {section.desc ? <Text style={styles.sectionDesc}>{section.desc}</Text> : null}
            <View style={styles.card}>{section.render()}</View>
          </View>
        );
      })}
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
 * `documents` binds the tile to a component its page documents (`documents: [{ component, title }]`),
 * so an address for that component lands on this tile; a custom tile does the same with
 * `DocumentedAnchor`.
 */
export function TokenTile({ name, value, note, action, documents, children }: { name: string; value?: string; note?: React.ReactNode; action?: React.ReactNode; documents?: string; children: React.ReactNode }) {
  const tile = (
    <View style={styles.tile}>
      <View style={styles.tilePreview}>{children}</View>
      <Text style={styles.tileName}>{name}</Text>
      {value ? <Text style={styles.tileValue}>{value}</Text> : null}
      {note ? <Text style={styles.tileNote}>{note}</Text> : null}
      {action}
    </View>
  );
  return documents === undefined ? tile : <DocumentedAnchor component={documents}>{tile}</DocumentedAnchor>;
}

const styles = StyleSheet.create({
  sections: { flexDirection: 'row', flexWrap: 'wrap', gap: TOKEN_LAYOUT_GAP, rowGap: CATALOG_LAYOUT.blockGap, alignItems: 'flex-start' },
  sectionLabel: {
    ...CATALOG_TEXT.label,
    color: CATALOG_COLOR.text,
  },
  sectionDesc: { ...CATALOG_TEXT.caption, color: CATALOG_COLOR.textMuted, marginTop: CATALOG_SPACE.xs },
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
  tileName: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text },
  tileValue: { ...CATALOG_TEXT.micro, color: CATALOG_COLOR.textMuted },
  tileNote: { ...CATALOG_TEXT.micro, color: CATALOG_COLOR.textMuted },
});
