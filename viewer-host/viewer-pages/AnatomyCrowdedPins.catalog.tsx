import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnatomyPin, AnatomySpecimen, defineCatalogPage } from '@krapwoo/ds-viewer';

// A made-up family page whose anatomy points at six parts within 36px of each other, so `check:catalog`,
// `doctor --render` and the viewer's own browser measurements cover the pin lane under crowding: the
// pins must clear each other and the specimen, with leader lines to the rows they point at, and a
// bracket (`testID="anatomy-bracket"`) at the lane's left edge must clear every pin.
const ROWS = ['Header', 'Body', 'Footer', 'Meta', 'Reply', 'Spacer'];
const TARGETS = [0, 10, 22, 30, 36, 100];

const styles = StyleSheet.create({
  specimen: { width: 240, height: 130, borderWidth: 1, borderColor: '#ccc', borderRadius: 12, backgroundColor: '#fff', padding: 8 },
  row: { fontSize: 12, color: '#444' },
  pin: { position: 'absolute', right: 0 },
  bracket: { position: 'absolute', left: 0, top: 0, height: 58, width: 4, borderWidth: 1, borderColor: '#999', borderLeftWidth: 0 },
});

const picture = (
  <AnatomySpecimen
    pins={(
      <>
        <View testID="anatomy-bracket" style={styles.bracket} />
        {['Swatch', 'TokenGrid', 'JumpRow', 'CountStrip', 'Inventory', 'PartsBlock'].map((name, i) => (
          <View key={name} style={[styles.pin, { top: TARGETS[i] }]}><AnatomyPin other={name} /></View>
        ))}
      </>
    )}
  >
    <View style={styles.specimen}>
      {ROWS.map((row) => <Text key={row} style={styles.row}>{row}</Text>)}
    </View>
  </AnatomySpecimen>
);

export default defineCatalogPage({
  id: 'AnatomyCrowdedPins',
  title: 'Anatomy with crowded pins',
  group: 'Components',
  source: 'viewer-pages/AnatomyCrowdedPins.catalog.tsx',
  description: 'A fixture: six pins whose targets sit within 36px of each other. Shows the pin lane keeping a gap to the specimen and a bracket, and spreading the pins with leader lines to what each points at.',
  previewWidths: [300],
  whole: 'AnatomyCrowdedPins',
  anatomy: {
    picture,
    groups: [{
      label: 'Components it uses',
      items: [
        { other: 'Swatch', description: 'The first part.' },
        { other: 'TokenGrid', description: 'The second part, 10px below.' },
        { other: 'JumpRow', description: 'The third part.' },
        { other: 'CountStrip', description: 'The fourth part.' },
        { other: 'Inventory', description: 'The fifth part.' },
        { other: 'PartsBlock', description: 'The last part, well apart.' },
      ],
    }],
  },
  sections: [],
  members: [{
    id: 'AnatomyCrowdedPins',
    source: 'viewer-pages/AnatomyCrowdedPins.catalog.tsx',
    fidelity: 'documentation-only',
    relationship: 'Main pattern',
    description: 'Rows of text in a bordered box.',
    states: { items: [{ key: 'box', name: 'The box', node: <View style={styles.specimen}><Text style={styles.row}>Rows</Text></View> }] },
  }],
});
