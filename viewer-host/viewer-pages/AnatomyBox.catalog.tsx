import React from 'react';
import { Text, View } from 'react-native';
import { AnatomyPin, CATALOG_COLOR, CATALOG_SPACE, CATALOG_TEXT, defineCatalogPage } from '@krapwoo/ds-viewer';
import { AnatomyBox } from '../../native/catalog/Anatomy';

// A made-up anatomy: the pins are looked up from `outline`, never hardcoded.
const byId = new Map([['Example', { fidelity: 'replicated' as const }]]);
const outline = new Map([['Example', { number: '1', level: 2 }]]);
const picture = (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: CATALOG_SPACE.sm }}>
    <AnatomyPin member="Example" />
    <Text style={{ ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted, fontStyle: 'italic' }}>The example part, pinned in the picture.</Text>
  </View>
);
const groups = [
  { label: 'In this picture', items: [{ member: 'Example', description: 'A part of the whole, pinned above.' }] },
  { label: 'From other pages', items: [{ other: 'SectionBlock', description: 'The single-component layout a page without `members` renders through.' }] },
];

export default defineCatalogPage({
  component: 'AnatomyBox',
  title: 'Anatomy box',
  group: 'Components',
  source: '../native/catalog/Anatomy.tsx',
  specimenSize: 'page',
  hide: { props: true },
  composedOf: [{ component: 'AnatomyPin', role: 'The pins in the picture and the legend.', relationship: 'built-in' }],
  description: 'A picture with numbered pins and its legend. FamilyPage renders one for its `anatomy`; GroupPage renders one per top-level member that has its own `anatomy`.',
  whenToUse: "Reach for AnatomyBox only from FamilyPage's or GroupPage's own rendering, never directly from a catalog page; set `anatomy` (page-level) or a member's own `anatomy` instead.",
  a11y: "The picture's pins are aria-hidden; the legend's rows are real, focusable links or text.",
  variants: {
    items: [
      { key: 'box', name: 'A picture with a legend', node: <AnatomyBox anatomy={{ picture, groups }} byId={byId} outline={outline} resolvesAddress={() => false} /> },
    ],
  },
});
