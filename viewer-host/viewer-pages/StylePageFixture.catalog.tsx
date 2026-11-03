import React from 'react';
import { Text, View } from 'react-native';
import { defineCatalogPage } from '@krapwoo/ds-viewer';

// A page that sets `pageKind: 'style'`, so `check:catalog` (and the narrow-viewport head check) covers a
// style page's head: the "Style" badge beside the title and the sentence under it. The title is long on
// purpose: at a narrow window it has to wrap inside its column instead of running past it.
export default defineCatalogPage({
  id: 'StylePageFixture',
  title: 'Chat tactile button style with a deliberately long title',
  group: 'Components',
  pageKind: 'style',
  source: 'viewer-pages/StylePageFixture.catalog.tsx',
  standalone: 'A fixture for the page head of a style page: it documents no component of its own.',
  description: "A made-up style page. Set `pageKind: 'style'` on your own page for a SwiftUI `ButtonStyle`, `ViewModifier` or shared background; this one only exists to give the viewer's browser checks a style head, with a long title, to measure.",
  render: () => (
    <View style={{ padding: 16, borderWidth: 1, borderColor: '#ccc', borderRadius: 12 }}>
      <Text>A style is applied to a view; it is not a view you place on its own.</Text>
    </View>
  ),
});
