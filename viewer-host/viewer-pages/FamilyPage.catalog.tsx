import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { defineCatalogPage, FamilyPage, AnatomyPin, AnatomySpecimen, CATALOG_COLOR, CATALOG_SPACE, CATALOG_TEXT, type SectionDef, type SectionPager } from '@krapwoo/ds-viewer';

const demo = StyleSheet.create({
  frame: { borderWidth: 1, borderColor: CATALOG_COLOR.border, backgroundColor: CATALOG_COLOR.pageBackground, padding: CATALOG_SPACE.xl, alignSelf: 'stretch', width: '100%' },
  mockText: { ...CATALOG_TEXT.body, color: CATALOG_COLOR.textMuted, fontStyle: 'italic' },
  anatomyRow: { flexDirection: 'row', alignItems: 'center', gap: CATALOG_SPACE.sm, marginTop: CATALOG_SPACE.sm },
});

// A tiny, made-up family — just enough structure to exercise a whole, a two-level parent chain
// (ExamplePart -> ExampleSubpart), a folded list section, and the previous/next pager row
// (SectionPagerRow/PagerButton) — without pulling in a real app's own components. Built by hand
// (bypassing `defineCatalogPage`/`buildCatalogSections`, which only run for an authored page in a
// real catalog) so `FamilyPage` can be demonstrated as a live, self-contained instance, the same
// way CatalogShell's own catalog page embeds live CatalogShell instances.
type ExampleId = 'Example';

// Slice D1 item 11: a tiny, real `AnatomyPin` usage inside the anatomy picture — the pin's number
// (`1`) comes from `exampleFamily`'s own outline below, through `FamilyAnatomyContext`, never
// hardcoded here.
const examplePicture = (
  <View style={demo.anatomyRow}>
    <AnatomyPin member="ExamplePart" />
    <Text style={demo.mockText}>The example part, pinned in its own picture.</Text>
  </View>
);

const exampleFamily: SectionDef<ExampleId> = {
  id: 'Example',
  title: 'Example',
  path: 'your/components/Example.tsx',
  description: "A made-up family, just to show the page shape — swap for your own members/whole/sections.",
  family: {
    whole: 'ExampleWhole',
    anatomy: {
      picture: examplePicture,
      groups: [{ label: 'In this picture', items: [{ member: 'ExamplePart', description: 'A part of the whole, pinned above.' }] }],
    },
    sections: [
      { label: 'Parts', kind: 'blocks', inWhole: true, members: ['ExamplePart', 'ExampleSubpart'] },
      { label: 'Helpers', kind: 'list', inWhole: true, members: ['ExampleHelper'] },
    ],
    // Slice D1 item 2: `numberFor`'s own rule, not the old `outlineFor`'s — `ExamplePart` and
    // `ExampleHelper` are both top-level parts of an `inWhole` section (`1`, `2`), `ExampleSubpart`
    // nests under `ExamplePart` (`1.1`).
    outline: new Map([
      ['ExamplePart', { number: '1', level: 2 }],
      ['ExampleSubpart', { number: '1.1', level: 3 }],
      ['ExampleHelper', { number: '2', level: 2 }],
    ]),
    members: [
      {
        id: 'ExampleWhole', path: 'Example.tsx', source: 'Example.tsx:1', fidelity: 'documentation-only',
        relationship: 'Whole', description: 'The whole made-up pattern.',
      },
      {
        id: 'ExamplePart', path: 'Example.tsx', source: 'Example.tsx:10', fidelity: 'documentation-only',
        parent: 'ExampleWhole', relationship: 'Part', description: 'A part of the whole.',
      },
      {
        id: 'ExampleSubpart', path: 'Example.tsx', source: 'Example.tsx:20', fidelity: 'documentation-only',
        parent: 'ExamplePart', relationship: 'Part', description: 'A part of a part — the two-level chain.',
      },
      {
        id: 'ExampleHelper', path: 'Example.tsx', source: 'Example.tsx:30', fidelity: 'documentation-only',
        relationship: 'Helper', description: 'An unrelated helper, folded by default.', notes: ['Folded rows never show specimens.'],
      },
    ],
  },
};

const examplePager: SectionPager<ExampleId> = { previousId: null, nextId: null, onNavigate: () => {}, labelOf: () => 'Example' };

// One shared instance: FamilyPage's own page head renders SectionPagerRow, which renders
// PagerButton — so this single live example is a faithful specimen of all three.
const familyDemo = (
  <View style={demo.frame}>
    <FamilyPage def={exampleFamily} pager={examplePager} />
  </View>
);

// Slice D1 item 11: this page's own anatomy picture — a schematic of the page head's pager row,
// the anatomy box itself, and a member's own specimen card, each pinned with a real `AnatomyPin`.
//
// The pins stay inline, beside the row each one labels, instead of in `AnatomySpecimen`'s `pins`
// prop: this is a schematic whose rows are made of their pin plus a caption, so the pin is part of
// what is drawn. `AnatomySpecimen` is here for the phone-width, centred frame; the render check
// measures every `anatomy-pin` in the stage, so inline pins are still checked.
const pagePicture = (
  <AnatomySpecimen>
    <View style={demo.frame}>
      <View style={demo.anatomyRow}>
        <AnatomyPin member="SectionPagerRow" />
        <AnatomyPin member="PagerButton" />
        <Text style={demo.mockText}>‹ Previous page   Next page ›</Text>
      </View>
      <View style={demo.anatomyRow}>
        <AnatomyPin member="AnatomyPin" />
        <Text style={demo.mockText}>Anatomy box: pins the page's own numbered parts</Text>
      </View>
      <View style={demo.anatomyRow}>
        <AnatomyPin member="Blocks" />
        <Text style={demo.mockText}>A member's own specimen card</Text>
      </View>
    </View>
  </AnatomySpecimen>
);

export default defineCatalogPage({
  id: 'FamilyPage',
  group: 'Components',
  title: 'FamilyPage',
  description: "Documents a family of related declarations — a whole and its members — on one page, with an anatomy box, a disclosure per member, and an address and search entry for each one. Used by this very page: you're reading a live FamilyPage right now.",
  source: '../native/catalog/FamilyPage.tsx',
  whole: 'FamilyPage',
  // Slice D1 item 11: more than six items (8 now, across the three groups below) so this page's
  // own anatomy box shows the below-the-picture, multi-column legend.
  anatomy: {
    picture: pagePicture,
    groups: [
      {
        label: 'In this picture',
        items: [
          { member: 'SectionPagerRow', description: "The previous/next row the page head renders." },
          { member: 'PagerButton', description: "One button of SectionPagerRow's own pair." },
          { member: 'AnatomyPin', description: "A pin inside a picture, looked up by member id." },
          { member: 'Blocks', description: "The shared placement logic behind a member's own specimen card." },
        ],
      },
      {
        label: 'No number of their own',
        items: [
          // `relatedPages` defect fix: `FamilyPageDisclosure` sits in a non-`inWhole` section, so
          // `numberFor` gives it no number and this legend row renders with no pin. It is here so
          // the "no pin, no gutter" case (APPROVED.md "Related members have no number and no
          // gutter") is exercised on a real page, not only in a unit test — this page's other two
          // groups are all numbered or ↗ rows, which keep their gutter because they do show a mark.
          { member: 'FamilyPageDisclosure', description: "The collapsed panel under each member's specimens — documented here, numbered nowhere." },
        ],
      },
      {
        label: 'From other pages',
        items: [
          { other: 'SectionBlock', description: "The normal, single-component page layout a page without `members` still renders through." },
          { other: 'CatalogShell', description: "Renders FamilyPage in place of SectionBlock when a page's `family` is set." },
          { other: 'PropsTable', description: "Renders a member's own generated props inside its disclosure." },
        ],
      },
    ],
  },
  sections: [
    {
      label: 'Rendering pieces', kind: 'blocks', inWhole: true,
      members: ['SectionPagerRow', 'PagerButton', 'AnatomyPin', 'AnatomySpecimen', 'Pin', 'FamilyPageHead', 'MemberPanelHost', 'FamilyPart', 'PartTreeBranch', 'AnatomyBox', 'PartOfLine'],
    },
    // N6: Blocks has real specimens — a `list` section only ever renders folded rows, which never
    // show specimens, so Blocks belongs in a `blocks` section.
    { label: 'Specimen layout', kind: 'blocks', inWhole: true, members: ['Blocks'] },
    // Deprecated, kept to exercise `doctor`'s own `deprecated-related-section` warning on this
    // very page — `relatedPages` below is the field a real page should use instead.
    { label: 'Related', kind: 'list', inWhole: false, members: ['FamilyPageDisclosure'] },
  ],
  // `relatedPages` field spec item 6: one entry that resolves (a real page id, with a note) and
  // one with no note, exercised on the viewer's own sample page as acceptance requires.
  relatedPages: [
    { page: 'ComparisonList', note: 'A different side-by-side layout for two-axis specimens.' },
    { page: 'PropsTable' },
  ],
  members: [
    {
      id: 'FamilyPage',
      component: 'FamilyPage',
      source: '../native/catalog/FamilyPage.tsx:862',
      fidelity: 'replicated',
      relationship: 'Main component',
      description: "The whole family page: the anatomy box (if set), the whole's own specimens with no header of its own, then Parts and Related.",
      whenToUse: 'Use a family page (`members`, `whole`, `sections`) when several related declarations are better read at one address than scattered across separate catalog pages — a view and its internal parts, or a documented pattern and the pieces it\'s built from. A page without `members` renders through SectionBlock exactly as it always has.',
      a11y: "Parts and Related are the only two section labels, both headings at the outline's own aria-level; a Part's own name sits inside its heading, with its pin and fidelity badge kept outside it (the pin is aria-hidden) so assistive tech announces only the name at the right level. The \"Notes and API\" link and a folded row's own toggle both expose aria-expanded.",
      variants: { items: [{ key: 'demo', name: 'Example family', node: familyDemo }] },
      // V2d: FamilyPage's own disclosure line ("Uses …") exercised on itself — FamilyPageDisclosure
      // is a sibling member (not a standalone component or page), so this also exercises a member
      // id resolving to a link, not just a plain component/page name.
      composedOf: [{ component: 'FamilyPageDisclosure', role: 'Member disclosure', relationship: 'built-in' }],
    },
    {
      id: 'MemberPanelHost',
      component: 'MemberPanelHost',
      parent: 'FamilyPage',
      source: '../native/catalog/FamilyPage.tsx:422',
      fidelity: 'replicated',
      // Declared a Helper, so it stays a note here rather than a page of its own: it draws nothing itself
      // (it is a context provider that holds the one shared SidePanel), so there is no view to show alone.
      relationship: 'Helper',
      description: "Owns the one shared side panel on a family or group page: every member's \"Notes and API\" link inside it opens that member's notes, guidance and API in a right-hand dialog, and opening another member swaps its content.",
      whenToUse: "Reach for MemberPanelHost only when building a third page shape that renders FamilyPart members; FamilyPage and GroupPage already wrap their content in it. A member rendered outside one still gets a working panel.",
      a11y: "The panel is a modal dialog named by its member, 440px wide (full width at 768px and narrower) over a light scrim, with no animation. Focus moves into it on open, Tab stays inside, and Esc, the Close button or a scrim press close it and return focus to the link that opened it.",
      variants: { items: [{ key: 'demo', name: 'Under each member of the page above', node: familyDemo }] },
    },
    {
      id: 'FamilyPageDisclosure',
      source: '../native/catalog/FamilyPage.tsx:207',
      fidelity: 'documentation-only',
      relationship: 'Related',
      related: "Shows Props through the existing PropsTable rather than a second table implementation.",
      description: "The side panel a member's \"Notes and API\" link opens: notes, guidance, accessibility, generated props, and a reference excerpt, in that order.",
      aliases: ['FamilyPageDetails'],
    },
  ],
});
