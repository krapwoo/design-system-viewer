import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnatomyPin, AnatomySpecimen, defineCatalogPage } from '@krapwoo/ds-viewer';

// A made-up page whose anatomy picture places its pins by hand, inline in its own layout (a row of
// [text][pin] with a hand-drawn bracket), not in the `pins` lane. Well spaced, so `doctor --render`
// (`anatomy-pin-crowded`) reports nothing: pins 4px+ apart, 8px+ from text and from the bracket.

const styles = StyleSheet.create({
  card: { width: 280, borderWidth: 1, borderColor: '#ccc', borderRadius: 12, backgroundColor: '#fff', padding: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, fontSize: 12, color: '#444' },
  bracket: { position: 'absolute', right: 42, width: 4, borderWidth: 1, borderColor: '#999', borderRightWidth: 0 },
  tall: { marginTop: 4 },
});

const picture = (
  <AnatomySpecimen>
    <View style={styles.card}>
      <View style={styles.row}><Text style={styles.text}>Conversation transcript</Text><AnatomyPin other="Header" /></View>
      <View style={styles.row}><Text style={styles.text}>Reply composer</Text><AnatomyPin other="Body" /></View>
      <View style={[styles.row, styles.tall]}><Text style={styles.text}>Send and attach controls</Text><AnatomyPin other="Footer" /></View>
      <View style={[styles.bracket, { top: 12, height: 40 }]} />
    </View>
  </AnatomySpecimen>
);

export default defineCatalogPage({
  id: 'AnatomyInlinePins',
  title: 'Anatomy with pins placed by hand',
  group: 'Components',
  source: 'viewer-pages/AnatomyInlinePins.catalog.tsx',
  description: 'A fixture: pins placed inline in the picture\'s own layout, each in a reserved gutter beside its text, clear of each other and of a bracket.',
  previewWidths: [320],
  whole: 'AnatomyInlinePins',
  anatomy: {
    picture,
    groups: [{
      label: 'Parts',
      items: [
        { other: 'Header', description: 'The first part.' },
        { other: 'Body', description: 'The second part.' },
        { other: 'Footer', description: 'The third part.' },
      ],
    }],
  },
  sections: [],
  members: [{
    id: 'AnatomyInlinePins',
    source: 'viewer-pages/AnatomyInlinePins.catalog.tsx',
    fidelity: 'documentation-only',
    relationship: 'Main pattern',
    description: 'Rows of text with a pin beside each.',
    states: { items: [{ key: 'box', name: 'The box', node: <View style={styles.card}><Text style={styles.text}>Rows</Text></View> }] },
  }],
});
