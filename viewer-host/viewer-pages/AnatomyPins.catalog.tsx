import React from 'react';
import { Text, View } from 'react-native';
import { AnatomyPin, CATALOG_COLOR, CATALOG_SPACE, CATALOG_TEXT, defineCatalogPage } from '@krapwoo/ds-viewer';
import { AnatomyBox, Pin } from '../../native/catalog/Anatomy';

// A tiny, made-up anatomy: one numbered part and one with no area of its own (documentation-only,
// so its pin is dashed). `AnatomyBox` supplies the context `AnatomyPin member=` reads its number from,
// so the pins below are looked up, never hardcoded.
const byId = new Map([['Example', { fidelity: 'replicated' as const }], ['ExampleNote', { fidelity: 'documentation-only' as const }]]);
const outline = new Map([['Example', { number: '1', level: 2 }], ['ExampleNote', { number: '2', level: 2 }]]);
const row = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: CATALOG_SPACE.sm, marginTop: CATALOG_SPACE.sm };
const caption = { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted, fontStyle: 'italic' as const };

const picture = (
  <View>
    <View style={row}><AnatomyPin member="Example" /><Text style={caption}>A numbered part</Text></View>
    <View style={row}><AnatomyPin member="ExampleNote" /><Text style={caption}>A part with no area of its own: dashed</Text></View>
    <View style={row}><AnatomyPin other="Elsewhere" /><Text style={caption}>A component documented on another page</Text></View>
  </View>
);

const anatomyDemo = (
  <AnatomyBox
    anatomy={{ picture, groups: [{ label: 'In this picture', items: [{ member: 'Example', description: 'Pinned above.' }, { member: 'ExampleNote', description: 'Pinned above, dashed.' }] }] }}
    byId={byId}
    outline={outline}
    resolvesAddress={() => false}
  />
);

// A group page: a Pin and an AnatomyPin are two forms of one numbered mark, so they are read side by side.
export default defineCatalogPage({
  id: 'AnatomyPins',
  group: 'Components',
  title: 'Anatomy pins',
  description: 'The numbered mark that ties a picture, a legend row, a Part header and a Parts card together. Pin is the badge itself; AnatomyPin is the form a catalog page places inside an `anatomy.picture`.',
  members: [
    {
      id: 'Pin',
      component: 'Pin',
      parent: 'FamilyPage',
      source: '../native/catalog/Anatomy.tsx:49',
      fidelity: 'replicated',
      relationship: 'Rendering piece',
      description: 'The numbered badge itself, shared by anatomy pins, legend rows, Part headers and Parts cards; a component from another page adds a small ↗.',
      whenToUse: 'Internal to the viewer: AnatomyPin, the anatomy legend, Part headers and Parts cards draw it. Catalog pages use AnatomyPin instead.',
      a11y: 'Takes an accessible label only where it stands alone ("Part 3, opens X"); the ↗ glyph is hidden from assistive technology.',
      variants: {
        items: [
          { key: 'number', name: 'Numbered', node: <Pin number="1" /> },
          { key: 'dashed', name: 'Dashed: no area of its own', node: <Pin number="2" dashed /> },
          { key: 'opens', name: 'Opens another page', node: <Pin number="3" opens label="Part 3, opens Button" /> },
        ],
      },
    },
    {
      id: 'AnatomyPin',
      component: 'AnatomyPin',
      parent: 'FamilyPage',
      source: '../native/catalog/Anatomy.tsx:254',
      fidelity: 'replicated',
      relationship: 'Rendering piece',
      description: "A numbered (or dashed, or ↗) pin for one member, used inside a family page's own anatomy.picture.",
      whenToUse: "Reach for AnatomyPin only inside a family page's own `anatomy.picture`: it looks up its member's number and dashed/↗ style through context, so the picture's own markup never hardcodes a number.",
      a11y: "Decorative and hidden from accessibility (aria-hidden): the member's own name, not its pin, is what a screen reader announces, the same as every pin in the anatomy legend or a Part's own header.",
      specimenSize: 'page',
      variants: { items: [{ key: 'picture', name: 'Three kinds of pin in an anatomy picture', node: anatomyDemo }] },
    },
  ],
});
