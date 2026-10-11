import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, PhoneFrame, CATALOG_COLOR, CATALOG_SPACE, CATALOG_TYPE } from '@krapwoo/ds-viewer';

const demo = StyleSheet.create({
  content: { alignItems: 'center', gap: CATALOG_SPACE.sm, padding: CATALOG_SPACE.xl },
  title: { fontSize: CATALOG_TYPE.lg, fontWeight: '800', color: CATALOG_COLOR.text },
  body: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.textMuted, textAlign: 'center' },
});

export default defineCatalogPage({
  component: 'PhoneFrame',
  group: 'Components',
  source: '../native/catalog/PhoneFrame.tsx',
  description: 'A real phone screen for a live demo: an iPhone SE viewport (375 × 667 points), scaled down only when its cell is narrower. In the browser viewer it opens its example in its own device-sized document, so overlays that portal to the page (React Native\'s `Modal`) open inside the phone, not over the catalog.',
  whenToUse: "Any example that is a whole screen or opens an overlay. Inside it, use PhoneScreen for a screen's layout, or OverlayDemo for a trigger plus overlay.",
  a11y: 'The device document has a title naming the page and device. Its content keeps its own semantics.',
  render: () => (
    <PhoneFrame>
      <View style={demo.content}>
        <Text style={demo.title}>375 × 667</Text>
        <Text style={demo.body}>Anything inside lays out at the device's real size.</Text>
      </View>
    </PhoneFrame>
  ),
});
