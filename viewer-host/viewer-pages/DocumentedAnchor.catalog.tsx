import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, DocumentedAnchor, CATALOG_COLOR, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TEXT } from '@krapwoo/ds-viewer';
// Imported from the source tree: the focus context is plumbing `SectionBlock` provides, deliberately
// not exported from `native/catalog/index.ts`. It is used here only to show the anchor as the shell
// leaves it once a component's address has been opened.
import { DocumentedFocusContext } from '../../native/catalog/documentedFocusContext';

const styles = StyleSheet.create({
  glyph: { width: 40, height: 40, borderRadius: CATALOG_RADIUS.sm, backgroundColor: CATALOG_COLOR.accent },
  tile: { gap: CATALOG_SPACE.xs },
  name: { ...CATALOG_TEXT.captionStrong, color: CATALOG_COLOR.text },
});

const tile = (name: string) => (
  <View style={styles.tile}>
    <View style={styles.glyph} />
    <Text style={styles.name}>{name}</Text>
  </View>
);

export default defineCatalogPage({
  component: 'DocumentedAnchor',
  group: 'Components',
  source: '../native/catalog/DocumentedAnchor.tsx',
  specimenSize: 'compact',
  standalone: 'Not only a part of TokenTile: it is exported for custom tiles that are not a TokenTile.',
  description: 'Binds a tile on a token page to a component that page documents (`documents: [{ component, title }]`), so opening that component\'s address — from a link, an anatomy pin, search or the URL — lands on the tile: it scrolls to the top and is outlined until the reader goes elsewhere.',
  whenToUse: 'Around a custom tile (anything that is not a TokenTile). A TokenTile takes the same binding as its `documents` prop, so it needs no wrapper.',
  a11y: 'The wrapper is focusable by script only (tabIndex -1): arriving at the component moves focus to the tile without adding a tab stop.',
  variants: {
    items: [
      { key: 'idle', name: 'Not opened', node: <DocumentedAnchor component="HeaderLogo">{tile('Header logo')}</DocumentedAnchor> },
      {
        key: 'opened',
        name: 'Opened (outlined)',
        node: (
          <DocumentedFocusContext.Provider value={{ memberId: 'HeaderLogo', nonce: 1 }}>
            <DocumentedAnchor component="HeaderLogo">{tile('Header logo')}</DocumentedAnchor>
          </DocumentedFocusContext.Provider>
        ),
      },
    ],
  },
});
