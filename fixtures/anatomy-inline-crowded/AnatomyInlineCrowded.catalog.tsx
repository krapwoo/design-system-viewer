import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnatomyPin, AnatomySpecimen, defineCatalogPage } from '@krapwoo/ds-viewer';

// FLAGGED ON PURPOSE (not in `viewer-host`, so `check:catalog` stays clean): the picture places its pins by
// hand, inline, and crowds them: three pins stacked on top of each other (the hand-placed `stray`
// ones overlap each other and the row pins) and one on the bracket and the text. `doctor --render` must
// report `anatomy-pin-crowded` for it. To see it, copy this file into `viewer-host/viewer-pages/`, run
// `node dist/cli/main.js doctor --render` there, and delete the copy. Its well-spaced twin is
// `viewer-host/viewer-pages/AnatomyInlinePins.catalog.tsx`.

const styles = StyleSheet.create({
  card: { width: 280, borderWidth: 1, borderColor: '#ccc', borderRadius: 12, backgroundColor: '#fff', padding: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, fontSize: 12, color: '#444' },
  bracket: { position: 'absolute', right: 40, width: 4, borderWidth: 1, borderColor: '#999', borderRightWidth: 0 },
  stray: { position: 'absolute' },
});

const picture = (
  <AnatomySpecimen>
    <View style={styles.card}>
      <View style={styles.row}><Text style={styles.text}>Conversation transcript</Text><AnatomyPin other="Header" /></View>
      <View style={styles.row}><Text style={styles.text}>Reply composer</Text><AnatomyPin other="Body" /></View>
      <View style={styles.row}><Text style={styles.text}>Send and attach controls</Text><AnatomyPin other="Footer" /></View>
      <View style={[styles.bracket, { top: 12, height: 40 }]} />
      <View style={[styles.stray, { top: 20, right: 12 }]}><AnatomyPin other="Header" /></View>
      <View style={[styles.stray, { top: 30, right: 12 }]}><AnatomyPin other="Body" /></View>
      <View style={[styles.stray, { top: 40, right: 44 }]}><AnatomyPin other="Footer" /></View>
    </View>
  </AnatomySpecimen>
);

export default defineCatalogPage({
  id: 'AnatomyInlineCrowded',
  title: 'Anatomy with crowded hand-placed pins',
  group: 'Components',
  source: 'fixtures/anatomy-inline-crowded/AnatomyInlineCrowded.catalog.tsx',
  description: 'A fixture: pins placed inline, crowded: overlapping each other, the bracket and the text.',
  previewWidths: [320],
  whole: 'AnatomyInlineCrowded',
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
    id: 'AnatomyInlineCrowded',
    source: 'fixtures/anatomy-inline-crowded/AnatomyInlineCrowded.catalog.tsx',
    fidelity: 'documentation-only',
    relationship: 'Main pattern',
    description: 'Rows of text with a pin beside each.',
    states: { items: [{ key: 'box', name: 'The box', node: <View style={styles.card}><Text style={styles.text}>Rows</Text></View> }] },
  }],
});
