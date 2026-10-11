import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, OverlayDemo, CatalogButton, CATALOG_COLOR, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TYPE } from '@krapwoo/ds-viewer';

// A plain sheet drawn with the catalog's own tokens, standing in for an app's BottomSheet.
const demo = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: CATALOG_COLOR.surface, borderTopLeftRadius: CATALOG_RADIUS.card, borderTopRightRadius: CATALOG_RADIUS.card, padding: CATALOG_SPACE.xl, gap: CATALOG_SPACE.md },
  title: { fontSize: CATALOG_TYPE.lg, fontWeight: '800', color: CATALOG_COLOR.text },
  body: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.textMuted },
});

function SheetDemo() {
  return (
    <OverlayDemo triggerLabel="Open sheet">
      {({ open, close }) =>
        open ? (
          <View style={demo.scrim}>
            <View style={demo.sheet}>
              <Text style={demo.title}>Trip details</Text>
              <Text style={demo.body}>The overlay fills the phone, above the trigger. Close returns focus to the trigger.</Text>
              <CatalogButton label="Close" variant="secondary" onPress={close} />
            </View>
          </View>
        ) : null
      }
    </OverlayDemo>
  );
}

export default defineCatalogPage({
  group: 'Components',
  source: '../native/catalog/OverlayDemo.tsx',
  description: "A phone with a catalog button that opens an overlay: a sheet, a dialog, a toast. Children get `{ open, close }`; keep an app's overlay mounted and drive its own `visible` from `open`, so its animations play. `keepTrigger` makes the button a toggle, `triggerLabel` can follow the state, and `initiallyOpen` starts it open.",
  whenToUse: "A component page whose example opens something over the screen. For a whole screen that's always visible, use PhoneScreen inside PhoneFrame instead.",
  a11y: 'The trigger is a CatalogButton. It hides while the overlay is open (unless keepTrigger) and gets focus back when the overlay closes.',
  composedOf: [
    { component: 'PhoneFrame', role: 'The device the demo runs in.', relationship: 'built-in' },
    { component: 'CatalogButton', role: 'The trigger that opens the overlay.', relationship: 'built-in' },
  ],
  render: () => <SheetDemo />,
});
