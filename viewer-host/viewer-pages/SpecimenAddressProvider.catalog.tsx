import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, CATALOG_COLOR, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TYPE } from '@krapwoo/ds-viewer';
// Imported from the source tree, not from the package: SpecimenAddressProvider is framework
// plumbing and deliberately not exported from `native/catalog/index.ts`. It is documented here
// because this catalog documents the viewer's own internals for whoever maintains them — not
// because a host app should reach for it.
import { SpecimenAddressProvider, useSpecimenAddress } from '../../native/catalog/SpecimenAddress';

const styles = StyleSheet.create({
  box: { minWidth: 220, padding: CATALOG_SPACE.lg, borderRadius: CATALOG_RADIUS.sm, borderWidth: 1, borderColor: CATALOG_COLOR.border, gap: CATALOG_SPACE.xs },
  line: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.text },
  none: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted },
});

/** Reads the address out of context and prints it — the provider renders nothing itself, so the
 *  only honest way to show what it does is to show what a descendant receives. */
function WhereAmI() {
  const address = useSpecimenAddress();
  if (!address) return <View style={styles.box}><Text style={styles.none}>No address in context.</Text></View>;
  return (
    <View style={styles.box}>
      <Text style={styles.line}>pageId: {address.pageId}</Text>
      <Text style={styles.line}>slot: {address.slot}</Text>
      <Text style={styles.line}>itemKey: {address.itemKey}</Text>
    </View>
  );
}

export default defineCatalogPage({
  component: 'SpecimenAddressProvider',
  group: 'Components',
  whenToUse: "Framework plumbing, not part of the package's public API: the catalog's own list, grid and preview renderers wrap each example in one so a PhoneFrame inside it can reopen that single example in its own device-sized document. A page author never writes one.",
  description: "Tells the example rendered inside it which catalog example it is — page, slot and item key. It renders no UI of its own: it is a context provider, so the only thing to see is what a descendant reads back out via useSpecimenAddress().",
  a11y: 'Renders no element at all, so it adds nothing to the accessibility tree and changes nothing about how the example inside it is read.',
  // There is no visual variation to show, because the component has no visual output. What varies
  // is what a descendant receives, so each example prints exactly that.
  variants: {
    items: [
      {
        key: 'inside',
        name: 'Inside a provider',
        node: (
          <SpecimenAddressProvider address={{ pageId: 'Button', slot: 'variants', itemKey: 'primary' }}>
            <WhereAmI />
          </SpecimenAddressProvider>
        ),
      },
      {
        // Outside one — or inside one given `undefined`, which is the same thing to a descendant —
        // a PhoneFrame has no example to reopen and falls back to rendering in place.
        key: 'outside',
        name: 'With no provider above it',
        node: <WhereAmI />,
      },
    ],
  },
});
