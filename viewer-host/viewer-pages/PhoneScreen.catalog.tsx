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
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: CATALOG_SPACE.xl, gap: CATALOG_SPACE.sm },
  emptyText: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.textMuted, textAlign: 'center' },
  // The floating layer is positioned by its own content, not by PhoneScreen.
  toastLayer: { position: 'absolute', left: 0, right: 0, bottom: 96, alignItems: 'center' },
  toast: { paddingVertical: CATALOG_SPACE.md, paddingHorizontal: CATALOG_SPACE.lg, borderRadius: 999, backgroundColor: CATALOG_COLOR.text },
  toastText: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.surface },
});

const header = <View style={demo.header}><Text style={demo.headerText}>Saved trips</Text></View>;
const footer = <View style={demo.footer}><CatalogButton label="Plan a trip" onPress={() => {}} /></View>;
const rows = Array.from({ length: 12 }, (_, i) => (
  <View key={i} style={demo.row}><Text style={demo.rowText}>{`Trip ${i + 1}`}</Text></View>
));

export default defineCatalogPage({
  component: 'PhoneScreen',
  group: 'Components',
  source: '../native/catalog/PhoneScreen.tsx',
  hide: { props: true },
  description: "A whole app screen inside a PhoneFrame: `header` stays at the top, `footer` at the phone's bottom, and the children scroll between them instead of pushing the footer off the screen. `scroll: false` lays the body out to fit instead, for a screen with nothing to scroll. `floating` is a layer over the top for toasts (position its content yourself); `bodyWrapper` puts the app's own surface around the scrolling body.",
  whenToUse: 'Pattern pages that show a full screen, such as a list with a bottom action bar. Scroll the body here to see the footer stay put.',
  a11y: 'Adds no semantics of its own: the header, body and footer keep theirs, and the floating layer sits after the body in reading order.',
  composedOf: [{ component: 'PhoneFrame', role: 'Goes inside a PhoneFrame, which gives it the device size.', relationship: 'related' }],
  variants: {
    items: [
      {
        key: 'scrolling',
        name: 'Header, footer, scrolling body',
        node: (
          <PhoneFrame>
            <PhoneScreen header={header} footer={footer} contentContainerStyle={demo.body}>{rows}</PhoneScreen>
          </PhoneFrame>
        ),
      },
      {
        key: 'fit',
        name: 'scroll: false — the body fits',
        node: (
          <PhoneFrame>
            <PhoneScreen header={header} footer={footer} scroll={false}>
              <View style={demo.empty}>
                <Text style={demo.rowText}>No trips yet</Text>
                <Text style={demo.emptyText}>An empty state centres in the space between the header and the footer.</Text>
              </View>
            </PhoneScreen>
          </PhoneFrame>
        ),
      },
      {
        key: 'floating',
        name: 'With a floating toast',
        node: (
          <PhoneFrame>
            <PhoneScreen
              header={header}
              footer={footer}
              contentContainerStyle={demo.body}
              floating={<View style={demo.toastLayer}><View style={demo.toast}><Text style={demo.toastText}>Trip saved</Text></View></View>}
            >
              {rows}
            </PhoneScreen>
          </PhoneFrame>
        ),
      },
    ],
  },
});
