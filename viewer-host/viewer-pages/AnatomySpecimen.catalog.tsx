import React from 'react';
import { Text, View } from 'react-native';
import { AnatomyPin, AnatomySpecimen, CATALOG_COLOR, CATALOG_TEXT, defineCatalogPage } from '@krapwoo/ds-viewer';

const chipFor = (label: string) => (
  <View style={{ width: 72, height: 30, borderRadius: 15, backgroundColor: CATALOG_COLOR.border, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={CATALOG_TEXT.body}>{label}</Text>
  </View>
);

export default defineCatalogPage({
  component: 'AnatomySpecimen',
  title: 'Anatomy specimen',
  group: 'Components',
  source: '../native/catalog/Anatomy.tsx',
  specimenSize: 'regular',
  hide: { props: true },
  composedOf: [{ component: 'SpecimenContent', role: 'Draws the specimen the way a variant cell does.', relationship: 'built-in' }],
  description: "Draws an anatomy picture's specimen like a variant cell does, with its pins in a column on the specimen's right edge.",
  whenToUse: "Wrap the specimen of an `anatomy.picture` in it: at the page's preview width it centres the specimen the way the variant cells do, and its `pins` sit right beside the specimen. Outside an anatomy it adds no width.",
  a11y: 'Adds no roles or names of its own; each pin keeps its own accessible name.',
  variants: {
    items: [
      {
        key: 'beside',
        name: 'A small specimen with its pin beside it',
        node: (
          <AnatomySpecimen pins={<View style={{ position: 'absolute', right: 0, top: 4 }}><AnatomyPin other="ExampleChip" /></View>}>
            <View style={{ width: 72, height: 30, borderRadius: 15, backgroundColor: CATALOG_COLOR.border }} />
          </AnatomySpecimen>
        ),
      },
      { key: 'start', name: 'align="start": no pins, just the specimen', props: { align: 'start' }, node: <AnatomySpecimen align="start">{chipFor('start')}</AnatomySpecimen> },
      { key: 'center', name: 'align="center": no pins, just the specimen', props: { align: 'center' }, node: <AnatomySpecimen align="center">{chipFor('center')}</AnatomySpecimen> },
      { key: 'end', name: 'align="end": no pins, just the specimen', props: { align: 'end' }, node: <AnatomySpecimen align="end">{chipFor('end')}</AnatomySpecimen> },
    ],
  },
});
