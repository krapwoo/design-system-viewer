import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, PhoneFrame, PhoneScreen, CatalogButton, CATALOG_COLOR, CATALOG_SPACE, CATALOG_TYPE } from '@krapwoo/ds-viewer';

const demo = StyleSheet.create({
  header: { padding: CATALOG_SPACE.lg, borderBottomWidth: 1, borderBottomColor: CATALOG_COLOR.border, backgroundColor: CATALOG_COLOR.surface },
  footer: { padding: CATALOG_SPACE.lg, borderTopWidth: 1, borderTopColor: CATALOG_COLOR.border, backgroundColor: CATALOG_COLOR.surface },
  headerText: { fontSize: CATALOG_TYPE.lg, fontWeight: '800', color: CATALOG_COLOR.text, textAlign: 'center' },
  body: { padding: CATALOG_SPACE.lg, gap: CATALOG_SPACE.md },
  row: { padding: CATALOG_SPACE.lg, borderRadius: 12, backgroundColor: CATALOG_COLOR.surface, borderWidth: 1, borderColor: CATALOG_COLOR.border },
  rowText: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.text },
});

export default defineCatalogPage({
  group: 'Components',
  source: '../native/catalog/PhoneScreen.tsx',
  description: "A whole app screen inside a PhoneFrame: `header` stays at the top, `footer` at the phone's bottom, and the children scroll between them instead of pushing the footer off the screen. `floating` is a layer over the top for toasts (position its content yourself); `bodyWrapper` puts the app's own surface around the scrolling body.",
  whenToUse: 'Pattern pages that show a full screen, such as a list with a bottom action bar. Scroll the body here to see the footer stay put.',
  a11y: 'Adds no semantics of its own; the header, body and footer keep theirs.',
  composedOf: [{ component: 'PhoneFrame', role: 'Goes inside a PhoneFrame, which gives it the device size.', relationship: 'related' }],
  render: () => (
    <PhoneFrame>
      <PhoneScreen
        header={<View style={demo.header}><Text style={demo.headerText}>Saved trips</Text></View>}
        footer={<View style={demo.footer}><CatalogButton label="Plan a trip" onPress={() => {}} /></View>}
        contentContainerStyle={demo.body}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <View key={i} style={demo.row}><Text style={demo.rowText}>{`Trip ${i + 1}`}</Text></View>
        ))}
      </PhoneScreen>
    </PhoneFrame>
  ),
});
