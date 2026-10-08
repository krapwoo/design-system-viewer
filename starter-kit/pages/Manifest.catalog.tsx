import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { components, tokens } from '@krapwoo/ds-viewer/generated';

const styles = StyleSheet.create({
  box: { maxHeight: 480, overflow: 'hidden' },
  text: { fontSize: 12, fontFamily: 'Menlo', color: '#181818' },
});

function ManifestView() {
  return (
    <ScrollView style={styles.box}>
      <Text selectable style={styles.text}>{JSON.stringify({ components, tokens }, null, 2)}</Text>
    </ScrollView>
  );
}

export default defineCatalogPage({
  group: 'Reference',
  description: 'Every component\'s generated props, and every token module\'s generated values, as plain JSON — built live by `sync` from source, so it can\'t drift out of sync. Meant for tooling, not humans: feed it to an LLM (or a lint script) as ground truth for a component\'s real prop interface, instead of it guessing from source. Does not include per-page variants/states — those live in each page\'s own file; see the page\'s own Source link instead.',
  tokenGallery: true,
  render: () => <ManifestView />,
});
