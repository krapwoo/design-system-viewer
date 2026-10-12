import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, BoundedOverlayViewport, CATALOG_COLOR, CATALOG_SPACE, CATALOG_TYPE } from '@krapwoo/ds-viewer';

const demo = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: CATALOG_SPACE.sm, padding: CATALOG_SPACE.lg },
  title: { fontSize: CATALOG_TYPE.lg, fontWeight: '800', color: CATALOG_COLOR.text },
  body: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.textMuted, textAlign: 'center' },
});

export default defineCatalogPage({
  component: 'BoundedOverlayViewport',
  internalProps: { slot: 'Part of the specimen address the catalog builds; never chosen by hand.' },
  group: 'Components',
  source: '../native/catalog/BoundedOverlayViewport.tsx',
  specimenSize: 'regular',
  description: "An opt-in bounded browsing context of a given size (`width` is a maximum, `height` is exact) for an example whose overlay would otherwise cover the whole catalog. It opens that one example in its own child document. Addressed by the example's page, slot and key. PhoneFrame uses the same mechanism at a fixed device size, and is usually what a page wants.",
  whenToUse: 'An overlay example that needs a specific, non-phone size. Otherwise use PhoneFrame or OverlayDemo.',
  a11y: 'The child document has a title naming the page and example.',
  composedOf: [{ component: 'PhoneFrame', role: 'Uses the same child-document mechanism at a fixed device size.', relationship: 'related' }],
  variants: {
    items: [
      {
        key: 'bounded',
        name: '320 × 200',
        node: (
          <BoundedOverlayViewport pageId="BoundedOverlayViewport" slot="variants" itemKey="bounded" width={320} height={200}>
            <View style={demo.content}>
              <Text style={demo.title}>Own document</Text>
              <Text style={demo.body}>An overlay opened here stays inside this box.</Text>
            </View>
          </BoundedOverlayViewport>
        ),
      },
    ],
  },
});
