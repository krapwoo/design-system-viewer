import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, OverlayDemo, CatalogButton, CATALOG_COLOR, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TYPE } from '@krapwoo/ds-viewer';

// Plain overlays drawn with the catalog's own tokens, standing in for an app's own sheet,
// dialog and toast — this page is about OverlayDemo's trigger, not about their looks.
const demo = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  bottom: { justifyContent: 'flex-end' },
  centre: { alignItems: 'center', justifyContent: 'center', padding: CATALOG_SPACE.xl },
  sheet: { backgroundColor: CATALOG_COLOR.surface, borderTopLeftRadius: CATALOG_RADIUS.card, borderTopRightRadius: CATALOG_RADIUS.card, padding: CATALOG_SPACE.xl, gap: CATALOG_SPACE.md },
  dialog: { backgroundColor: CATALOG_COLOR.surface, borderRadius: CATALOG_RADIUS.card, padding: CATALOG_SPACE.xl, gap: CATALOG_SPACE.md, alignSelf: 'stretch' },
  toastLayer: { position: 'absolute', left: 0, right: 0, bottom: 32, alignItems: 'center' },
  toast: { paddingVertical: CATALOG_SPACE.md, paddingHorizontal: CATALOG_SPACE.lg, borderRadius: 999, backgroundColor: CATALOG_COLOR.text },
  toastText: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.surface },
  title: { fontSize: CATALOG_TYPE.lg, fontWeight: '800', color: CATALOG_COLOR.text },
  body: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.textMuted },
});

function SheetDemo() {
  return (
    <OverlayDemo triggerLabel="Open sheet">
      {({ open, close }) =>
        open ? (
          <View style={[demo.scrim, demo.bottom]}>
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

function DialogDemo() {
  return (
    <OverlayDemo triggerLabel="Delete trip">
      {({ open, close }) =>
        open ? (
          <View style={[demo.scrim, demo.centre]}>
            <View style={demo.dialog}>
              <Text style={demo.title}>Delete this trip?</Text>
              <Text style={demo.body}>A centred overlay works the same way; only the scrim's layout differs.</Text>
              <CatalogButton label="Keep it" variant="secondary" onPress={close} />
            </View>
          </View>
        ) : null
      }
    </OverlayDemo>
  );
}

function ToastDemo() {
  // A toast has nothing to dismiss, so the trigger stays as a toggle and names its own state.
  return (
    <OverlayDemo keepTrigger triggerLabel={(open) => (open ? 'Hide toast' : 'Save trip')}>
      {({ open }) =>
        open ? (
          <View style={demo.toastLayer}>
            <View style={demo.toast}><Text style={demo.toastText}>Trip saved</Text></View>
          </View>
        ) : null
      }
    </OverlayDemo>
  );
}

export default defineCatalogPage({
  component: 'OverlayDemo',
  group: 'Components',
  source: '../native/catalog/OverlayDemo.tsx',
  hide: { props: true },
  description: "A phone with a catalog button that opens an overlay: a sheet, a dialog, a toast. Children get `{ open, close }`; keep an app's overlay mounted and drive its own `visible` from `open`, so its animations play. `keepTrigger` makes the button a toggle rather than hiding it, `triggerLabel` can be a function of the open state, and `initiallyOpen` starts the example open.",
  whenToUse: "A component page whose example opens something over the screen. For a whole screen that's always visible, use PhoneScreen inside PhoneFrame instead.",
  a11y: 'The trigger is a CatalogButton. It hides while the overlay is open (unless keepTrigger) and gets focus back when the overlay closes, so a keyboard reader never lands on nothing.',
  composedOf: [
    { component: 'PhoneFrame', role: 'The device the demo runs in.', relationship: 'built-in' },
    { component: 'CatalogButton', role: 'The trigger that opens the overlay.', relationship: 'built-in' },
  ],
  variants: {
    items: [
      { key: 'sheet', name: 'A sheet, with the trigger hidden', node: <SheetDemo /> },
      { key: 'dialog', name: 'A centred dialog', node: <DialogDemo /> },
      { key: 'toast', name: 'keepTrigger — a toggle with a label per state', node: <ToastDemo /> },
    ],
  },
  states: {
    items: [
      { key: 'open', name: 'initiallyOpen', node: (
        <OverlayDemo initiallyOpen triggerLabel="Open sheet">
          {({ open, close }) =>
            open ? (
              <View style={[demo.scrim, demo.bottom]}>
                <View style={demo.sheet}>
                  <Text style={demo.title}>Starts open</Text>
                  <Text style={demo.body}>For a page where the overlay is the thing being documented.</Text>
                  <CatalogButton label="Close" variant="secondary" onPress={close} />
                </View>
              </View>
            ) : null
          }
        </OverlayDemo>
      ) },
    ],
  },
});
