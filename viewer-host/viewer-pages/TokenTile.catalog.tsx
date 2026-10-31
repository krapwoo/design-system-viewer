import React from 'react';
import { View, StyleSheet } from 'react-native';
import { defineCatalogPage, TokenTile, CATALOG_COLOR, CATALOG_RADIUS, CATALOG_SPACE } from '@krapwoo/ds-viewer';

const styles = StyleSheet.create({
  swatch: { width: 56, height: 56, borderRadius: CATALOG_RADIUS.sm, backgroundColor: CATALOG_COLOR.accent },
  bar: { height: 12, width: CATALOG_SPACE.xl, borderRadius: 2, backgroundColor: CATALOG_COLOR.text },
  radius: { width: 56, height: 56, borderRadius: CATALOG_RADIUS.card, borderWidth: 1, borderColor: CATALOG_COLOR.border },
});

export default defineCatalogPage({
  component: 'TokenTile',
  group: 'Components',
  whenToUse: "One token inside a TokenGrid — the preview you pass as children, then the name, value and role beneath it. TokenGrid lays these out; reach for a tile directly only when building your own token layout. For a labelled row with the preview beside the text instead of above it, use TokenRow.",
  description: 'One token in a TokenGrid: the preview passed as children, then its name, then its value, then its role note. Value and note are both optional, so a tile stays as short as the token deserves.',
  composedOf: [
    { component: 'DocumentedAnchor', role: 'Wraps the tile when `documents` binds it to a component its page documents.', relationship: 'built-in' },
  ],
  a11y: 'No handling of its own beyond the defaults: the preview is decorative, and the name, value and note are all real text, so a token is never identified by its swatch alone.',
  variants: {
    items: [
      // Name only: the shortest a tile goes, for a token whose preview is self-explanatory.
      { key: 'name', name: 'Name only', node: <TokenTile name="accent"><View style={styles.swatch} /></TokenTile> },
      { key: 'value', name: 'Name and value', node: <TokenTile name="accent" value="#174dc6"><View style={styles.swatch} /></TokenTile> },
      {
        key: 'note',
        name: 'Name, value and a role note',
        node: (
          <TokenTile name="accent" value="#174dc6" note="The catalog's own accents.">
            <View style={styles.swatch} />
          </TokenTile>
        ),
      },
    ],
  },
  states: {
    items: [
      // The preview is whatever you pass, so the same tile shape serves every kind of token.
      { key: 'spacing', name: 'A spacing token', node: <TokenTile name="xl" value="24px" note="Preview-card padding; gap between preview frames."><View style={styles.bar} /></TokenTile> },
      // `documents` binds the tile to a component its token page lists in `documents`.
      { key: 'documents', name: 'A documented component', node: <TokenTile name="Header logo" value="HeaderLogo" documents="HeaderLogo"><View style={styles.swatch} /></TokenTile> },
      { key: 'radius', name: 'A radius token', node: <TokenTile name="card" value="14px" note="Specimen and reference cards."><View style={styles.radius} /></TokenTile> },
    ],
  },
});
