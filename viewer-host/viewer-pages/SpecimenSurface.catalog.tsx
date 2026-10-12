import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, SpecimenSurface, CATALOG_COLOR, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TYPE } from '@krapwoo/ds-viewer';

const styles = StyleSheet.create({
  // Each example passes the cell's own layout in `style`, because SpecimenSurface adds none.
  cell: { minHeight: 104, padding: CATALOG_SPACE.md, alignItems: 'center', justifyContent: 'center', borderRadius: CATALOG_RADIUS.md },
  // A white card: against a white cell this would vanish, which is exactly what `auto` looks for.
  whiteCard: { width: 116, paddingVertical: CATALOG_SPACE.md, paddingHorizontal: CATALOG_SPACE.md, backgroundColor: '#ffffff', borderRadius: CATALOG_RADIUS.sm },
  accentCard: { width: 116, paddingVertical: CATALOG_SPACE.md, paddingHorizontal: CATALOG_SPACE.md, backgroundColor: CATALOG_COLOR.accent, borderRadius: CATALOG_RADIUS.sm },
  cardLabel: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.text, textAlign: 'center' },
  onAccent: { fontSize: CATALOG_TYPE.sm, color: '#ffffff', textAlign: 'center' },
});

const white = <View style={styles.whiteCard}><Text style={styles.cardLabel}>A white card</Text></View>;
const accent = <View style={styles.accentCard}><Text style={styles.onAccent}>An accent card</Text></View>;

export default defineCatalogPage({
  component: 'SpecimenSurface',
  group: 'Components',
  whenToUse: "The backing for one example's cell, shared by the three comparison layouts and SectionBlock's preview frames so every cell on a page fills the same way. A page sets this once as `specimenSurface`; reach for the component directly only when building your own specimen layout.",
  description: "An example's whole cell area. With 'auto' (the default) the cell measures the example after it draws and turns neutral only when the example would otherwise vanish against white; the explicit kinds fill the cell without measuring. It adds no padding or border of its own — the cell's own layout goes in `style`.",
  a11y: 'A plain backing View with no semantics of its own: it neither groups nor labels the example inside it, so a cell adds nothing to the reading order.',
  composedOf: [
    { component: 'SpecimenContent', role: "Wraps the example inside the surface — the phone-width cap, the centring of a narrow filled example, and the dev warning when an example overflows its cell.", relationship: 'built-in' },
  ],
  // Every cell is written out rather than generated, so the whole grid stays a literal `doctor`
  // can read; a flatMap here made the page "not statically checkable" and the geometry unreadable.
  // Each cell sets surface: 'transparent' so the page's own backing stays out of the way of the
  // component's `surface` prop, which is what the grid is about.
  comparison: {
    rowLabel: 'Surface',
    columnLabel: 'Example',
    // Read the `auto` row across: a white card gets a neutral cell so its edges stay visible, while
    // an accent card on the same `auto` keeps a white one, because it was never at risk of
    // disappearing. Every row below ignores the example entirely.
    rows: { prop: 'surface', items: [
      { key: 'auto', label: 'auto' },
      { key: 'neutral', label: 'neutral' },
      { key: 'white', label: 'white' },
      { key: 'dark', label: 'dark' },
      { key: 'transparent', label: 'transparent' },
    ] },
    columns: [
      { key: 'white', label: 'A white card' },
      { key: 'accent', label: 'An accent card' },
    ],
    cells: [
      { rowKey: 'auto', columnKey: 'white', surface: 'transparent', node: <SpecimenSurface surface="auto" style={styles.cell}>{white}</SpecimenSurface> },
      { rowKey: 'auto', columnKey: 'accent', surface: 'transparent', node: <SpecimenSurface surface="auto" style={styles.cell}>{accent}</SpecimenSurface> },
      { rowKey: 'neutral', columnKey: 'white', surface: 'transparent', node: <SpecimenSurface surface="neutral" style={styles.cell}>{white}</SpecimenSurface> },
      { rowKey: 'neutral', columnKey: 'accent', surface: 'transparent', node: <SpecimenSurface surface="neutral" style={styles.cell}>{accent}</SpecimenSurface> },
      { rowKey: 'white', columnKey: 'white', surface: 'transparent', node: <SpecimenSurface surface="white" style={styles.cell}>{white}</SpecimenSurface> },
      { rowKey: 'white', columnKey: 'accent', surface: 'transparent', node: <SpecimenSurface surface="white" style={styles.cell}>{accent}</SpecimenSurface> },
      { rowKey: 'dark', columnKey: 'white', surface: 'transparent', node: <SpecimenSurface surface="dark" style={styles.cell}>{white}</SpecimenSurface> },
      { rowKey: 'dark', columnKey: 'accent', surface: 'transparent', node: <SpecimenSurface surface="dark" style={styles.cell}>{accent}</SpecimenSurface> },
      { rowKey: 'transparent', columnKey: 'white', surface: 'transparent', node: <SpecimenSurface surface="transparent" style={styles.cell}>{white}</SpecimenSurface> },
      { rowKey: 'transparent', columnKey: 'accent', surface: 'transparent', node: <SpecimenSurface surface="transparent" style={styles.cell}>{accent}</SpecimenSurface> },
    ],
  },
});
