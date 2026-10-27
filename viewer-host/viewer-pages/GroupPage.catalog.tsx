import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { defineCatalogPage, GroupPage, AnatomyPin, CATALOG_COLOR, CATALOG_SPACE, CATALOG_TEXT, type SectionDef } from '@krapwoo/ds-viewer';

const demo = StyleSheet.create({
  frame: { borderWidth: 1, borderColor: CATALOG_COLOR.border, backgroundColor: CATALOG_COLOR.pageBackground, padding: CATALOG_SPACE.xl, alignSelf: 'stretch' },
  mockText: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted, fontStyle: 'italic' },
  anatomyRow: { flexDirection: 'row', alignItems: 'center', gap: CATALOG_SPACE.sm, marginTop: CATALOG_SPACE.sm },
});

// A tiny, made-up group — just enough structure to exercise a plain top-level member and an
// embedded family (its own anatomy and one nested part), without pulling in a real app's own
// components. Built by hand (bypassing `defineCatalogPage`/`buildCatalogSections`, which only run
// for an authored page in a real catalog), the same way `FamilyPage.catalog.tsx`'s own
// `exampleFamily` demonstrates `FamilyPage` as a live, self-contained instance.
type ExampleId = 'ExampleGroup';

// #63 R2: a real `AnatomyPin` usage inside the embedded family's own picture — its number (`1`)
// comes from `exampleGroup`'s own outline below, through `FamilyAnatomyContext`, never hardcoded.
const examplePicture = (
  <View style={demo.anatomyRow}>
    <AnatomyPin member="ExampleEmbeddedPart" />
    <Text style={demo.mockText}>The embedded family's own part, pinned in its own picture.</Text>
  </View>
);

// This page's own `EmbeddedFamilyMember` carries a real `anatomy` too: a labeled fixture picture
// (not a screenshot of a real component) with a live `AnatomyPin` for its one nested part.
const fixturePicture = (
  <View style={demo.anatomyRow}>
    <AnatomyPin member="EmbeddedFamilyPart" />
    <Text style={demo.mockText}>Fixture picture: the nested part, pinned in its member's own anatomy.</Text>
  </View>
);

const exampleGroup: SectionDef<ExampleId> = {
  id: 'ExampleGroup',
  title: 'Example group',
  path: 'your/components/ExampleGroup.tsx',
  description: 'A made-up group, just to show the page shape — swap for your own members.',
  family: {
    kind: 'group',
    whole: undefined,
    sections: [],
    outline: new Map([['ExampleEmbeddedPart', { number: '1', level: 2 }]]),
    members: [
      {
        id: 'ExamplePlainMember', path: 'ExampleGroup.tsx', source: 'ExampleGroup.tsx:1', fidelity: 'documentation-only',
        relationship: 'Top-level', description: 'A plain member — no parts, no partOf, so its jump chip shows no qualifier.',
      },
      {
        id: 'ExampleEmbeddedMember', path: 'ExampleGroup.tsx', source: 'ExampleGroup.tsx:10', fidelity: 'documentation-only',
        relationship: 'Top-level', description: 'A top-level member with its own anatomy and one nested part.',
        anatomy: { picture: examplePicture, groups: [{ label: 'In this picture', items: [{ member: 'ExampleEmbeddedPart', description: "The embedded family's own part." }] }] },
      },
      {
        id: 'ExampleEmbeddedPart', path: 'ExampleGroup.tsx', source: 'ExampleGroup.tsx:20', fidelity: 'documentation-only',
        parent: 'ExampleEmbeddedMember', relationship: 'Part', description: "The embedded family's own nested part.",
      },
    ],
  },
};

// One shared instance: GroupPage's own page head, jump row, and two top-level member sections
// (one plain, one an embedded family with its own anatomy) are all a faithful specimen of it.
const groupDemo = (
  <View style={demo.frame}>
    <GroupPage def={exampleGroup} />
  </View>
);

export default defineCatalogPage({
  id: 'GroupPage',
  group: 'Components',
  title: 'Group pages',
  description:
    "Documents several unrelated-but-adjacent components on one page, with no shared whole — layout B: the page head, a jump row, then each top-level member's own section in authored order, no Compare block. Used by this very page: you're reading a live group page right now.",
  source: '../native/catalog/GroupPage.tsx',
  members: [
    {
      id: 'GroupPageComponent',
      component: 'GroupPage',
      source: '../native/catalog/GroupPage.tsx:99',
      fidelity: 'replicated',
      relationship: 'Main component',
      description: "The whole group page: the shared page head (FamilyPageHead), a jump row (one chip per top-level member), then each top-level member's own section in authored order.",
      whenToUse: 'Use a group page (`members` with no `whole`/`sections`) when the members are independently meaningful and would otherwise each get their own tiny page with nothing to compare — see the README\'s "Group pages" section for the group-vs-family distinction. A family page (`whole` + `sections`) is for members that genuinely compose one thing.',
      a11y: "The jump row is a list whose items are button/link chips; each top-level member's own name row is a real heading at the outline's own aria-level, the same as a family member's.",
      variants: { items: [{ key: 'demo', name: 'Example group', node: groupDemo }] },
    },
    {
      id: 'PlainMember',
      source: 'your/components/GroupPageDemo.tsx:1',
      fidelity: 'documentation-only',
      relationship: 'Top-level',
      description: 'A plain top-level member — no parts, no partOf, so its own jump chip shows no qualifier at all. See "ExamplePlainMember" in the example group above.',
    },
    {
      id: 'EmbeddedFamilyMember',
      source: 'your/components/GroupPageDemo.tsx:10',
      fidelity: 'documentation-only',
      relationship: 'Top-level',
      description: 'A top-level member with its own anatomy and one nested part (`CatalogMember.anatomy`) — the embedded-family case. Its own jump chip shows "+1 part". See "ExampleEmbeddedMember" above.',
      anatomy: {
        picture: fixturePicture,
        groups: [{ label: 'In this picture (fixture)', items: [{ member: 'EmbeddedFamilyPart', description: "The embedded family's own nested part, pinned in the fixture picture." }] }],
      },
    },
    {
      id: 'EmbeddedFamilyPart',
      source: 'your/components/GroupPageDemo.tsx:20',
      parent: 'EmbeddedFamilyMember',
      fidelity: 'documentation-only',
      relationship: 'Part',
      description: "The embedded family's own nested part, numbered independently of every other top-level member's own parts. See \"ExampleEmbeddedPart\" above.",
    },
    {
      id: 'FixtureExternalPart',
      source: 'your/components/GroupPageDemo.tsx:30',
      parent: 'GroupPageFixtureFamily',
      fidelity: 'documentation-only',
      relationship: 'Top-level',
      description: 'Owned here (its own description and source live on this page), but its `parent` is GroupPageFixtureFamily\'s own whole — an external part: GroupPageFixtureFamily\'s own part list shows its number and a "Details on" link back here, and this section shows "Part N of GroupPageFixtureFamily", linking there.',
    },
  ],
});
