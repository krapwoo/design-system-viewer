import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, CATALOG_COLOR, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TYPE } from '@krapwoo/ds-viewer';
// Imported from the source tree, not from the package: SpecimenContent lives inside
// SpecimenSurface.tsx and is deliberately not exported from `native/catalog/index.ts`. It is
// documented here because this catalog documents the viewer's own internals.
import { SpecimenContent } from '../../native/catalog/SpecimenSurface';

const styles = StyleSheet.create({
  // A visible frame around the wrapper, so where the content sits inside its cell is observable.
  frame: { alignSelf: 'stretch', borderWidth: 1, borderStyle: 'dashed', borderColor: CATALOG_COLOR.border, borderRadius: CATALOG_RADIUS.sm, padding: CATALOG_SPACE.sm },
  wide: { height: 44, backgroundColor: CATALOG_COLOR.accentSubtle, borderWidth: 1, borderColor: CATALOG_COLOR.accent, borderRadius: CATALOG_RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  narrow: { width: 96, height: 44, backgroundColor: CATALOG_COLOR.accentSubtle, borderWidth: 1, borderColor: CATALOG_COLOR.accent, borderRadius: CATALOG_RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.text },
});

// `fill` content stretches to the wrapper's width, which is what the cap then limits.
const filling = <View style={[styles.wide, { alignSelf: 'stretch' }]}><Text style={styles.label}>fill</Text></View>;
const narrow = <View style={styles.narrow}><Text style={styles.label}>96px</Text></View>;

export default defineCatalogPage({
  component: 'SpecimenContent',
  group: 'Components',
  whenToUse: "Framework plumbing, not part of the package's public API: SpecimenSurface already wraps every example in one. It is what caps a filled example at phone width, centres a filled example whose real content is narrower than its cell, and warns in development when an example overflows the cell it was given.",
  description: "The wrapper immediately around an example. A `fill` example is capped at phone width unless `capped` is false (page-size cells pass false, because their whole point is to be wider). After layout it measures what actually painted: a filled example whose visible content is narrower than the cell is centred rather than left against the leading edge, and an explicit `align` always wins over that.",
  a11y: 'A plain layout wrapper with no semantics: it neither groups nor labels the example, so it adds nothing to the reading order.',
  internalProps: {
    // Declared here rather than left to look like an omission: these two are set by the catalog's
    // own renderers from the page's `specimenSize`, never by a page author.
    capped: "Set by the renderer from the cell's specimen size — page-size cells pass false.",
    fill: "Set by the renderer from the example's own `fill` presentation.",
  },
  specimenSize: 'page',
  variants: {
    maxColumns: 1,
    items: [
      // Capped: the default for every cell narrower than page size.
      { key: 'capped', name: 'A filled example, capped at phone width', node: <View style={styles.frame}><SpecimenContent fill>{filling}</SpecimenContent></View> },
      { key: 'uncapped', name: 'capped={false}, as a page-size cell passes', node: <View style={styles.frame}><SpecimenContent fill capped={false}>{filling}</SpecimenContent></View> },
      // Narrow painted content inside a filled example: centred, not left-aligned.
      { key: 'narrow', name: 'A filled example whose content is narrower', node: <View style={styles.frame}><SpecimenContent fill>{narrow}</SpecimenContent></View> },
    ],
  },
  states: {
    maxColumns: 1,
    // All three aligns, because an explicit one overrides the measured centring and the only way to
    // tell them apart is to see the same narrow content placed three ways.
    items: [
      { key: 'start', name: "align=\u2018start\u2019", props: { align: 'start' }, node: <View style={styles.frame}><SpecimenContent fill align="start">{narrow}</SpecimenContent></View> },
      { key: 'center', name: "align=\u2018center\u2019", props: { align: 'center' }, node: <View style={styles.frame}><SpecimenContent fill align="center">{narrow}</SpecimenContent></View> },
      { key: 'end', name: "align=\u2018end\u2019", props: { align: 'end' }, node: <View style={styles.frame}><SpecimenContent fill align="end">{narrow}</SpecimenContent></View> },
    ],
  },
});
