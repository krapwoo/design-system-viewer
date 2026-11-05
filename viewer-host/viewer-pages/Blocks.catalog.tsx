import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { CATALOG_COLOR, CATALOG_TEXT, defineCatalogPage, type SectionDef } from '@krapwoo/ds-viewer';
import { Blocks } from '../../native/catalog/SectionBlock';
import { presentationBlocks } from '../../native/catalog/comparison';
import { DEFAULT_SPECIMEN_SURFACE } from '../../native/catalog/specimenSurfaceStyle';

const demo = StyleSheet.create({ mockText: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted, fontStyle: 'italic' } });

const def: SectionDef<'Example'> = {
  id: 'Example',
  path: 'your/components/Example.tsx',
  description: 'A made-up component with two comparable specimen blocks.',
  variants: { items: [{ key: 'a', name: 'A', node: <Text style={demo.mockText}>Variant A</Text> }] },
  states: { items: [{ key: 'default', name: 'Default', node: <Text style={demo.mockText}>A state</Text> }] },
};
const oneBlock: SectionDef<'Example'> = { ...def, states: undefined };
// Each surface labels its own specimen, so the five stay distinguishable even where two surfaces draw the same fill.
const labelled = (surface: string): SectionDef<'Example'> => ({ ...oneBlock, variants: { items: [{ key: 'a', name: 'A', node: <Text style={demo.mockText}>{surface}</Text> }] } });

export default defineCatalogPage({
  component: 'Blocks',
  title: 'Blocks',
  group: 'Components',
  source: '../native/catalog/SectionBlock.tsx',
  specimenSize: 'page',
  hide: { props: true },
  description: "The shared placement logic behind a page's and a family member's specimen cards: stacked by default, side by side only when two blocks' own measured heights say it saves real height.",
  whenToUse: "SectionBlock and FamilyPage's own member blocks both render through Blocks so the stacked/side-by-side decision is never duplicated; there is no reason to call it directly outside those two.",
  a11y: "Purely a layout container; each block's own content (a grid, a list, grouped rows, or a preview) carries its own accessibility semantics.",
  variants: {
    items: [
      { key: 'two', name: 'Two blocks: Variants and States, placed by their measured heights', node: <Blocks blocks={presentationBlocks(def)} def={def} surface={DEFAULT_SPECIMEN_SURFACE} /> },
      { key: 'one', name: 'One block, with no uppercase label (as inside a family member)', node: <Blocks blocks={presentationBlocks(oneBlock)} def={oneBlock} surface={DEFAULT_SPECIMEN_SURFACE} showLabels={false} /> },
    ],
  },
  states: {
    items: [
      { key: 'auto', name: 'surface="auto"', props: { surface: 'auto' }, node: <Blocks blocks={presentationBlocks(labelled('auto'))} def={labelled('auto')} surface="auto" showLabels={false} /> },
      { key: 'neutral', name: 'surface="neutral"', props: { surface: 'neutral' }, node: <Blocks blocks={presentationBlocks(labelled('neutral'))} def={labelled('neutral')} surface="neutral" showLabels={false} /> },
      { key: 'white', name: 'surface="white"', props: { surface: 'white' }, node: <Blocks blocks={presentationBlocks(labelled('white'))} def={labelled('white')} surface="white" showLabels={false} /> },
      { key: 'dark', name: 'surface="dark"', props: { surface: 'dark' }, node: <Blocks blocks={presentationBlocks(labelled('dark'))} def={labelled('dark')} surface="dark" showLabels={false} /> },
      { key: 'transparent', name: 'surface="transparent"', props: { surface: 'transparent' }, node: <Blocks blocks={presentationBlocks(labelled('transparent'))} def={labelled('transparent')} surface="transparent" showLabels={false} /> },
    ],
  },
});
