import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { defineCatalogPage, SectionBlock, FamilyPage, AnatomyPin, CATALOG_COLOR, CATALOG_SPACE, CATALOG_TEXT, type SectionDef, type SectionPager } from '@krapwoo/ds-viewer';

const demo = StyleSheet.create({
  frame: { borderWidth: 1, borderColor: CATALOG_COLOR.border, backgroundColor: CATALOG_COLOR.pageBackground, padding: CATALOG_SPACE.xl, alignSelf: 'stretch' },
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

// Blocks only ever renders inside SectionBlock or FamilyPage's own member blocks — a live
// SectionBlock with two comparable specimen blocks (Variants + States) is a faithful specimen of
// its own stacked/side-by-side placement decision.
const blocksDemoDef: SectionDef<'Example'> = {
  id: 'Example',
  path: 'your/components/Example.tsx',
  description: "Blocks decides stacked vs. side by side from each block's own measured height.",
  variants: { items: [{ key: 'a', name: 'A', node: <Text style={demo.mockText}>Variant A</Text> }] },
  states: { items: [{ key: 'default', name: 'Default', node: <Text style={demo.mockText}>A state</Text> }] },
};
const blocksDemo = (
  <View style={demo.frame}>
    <SectionBlock def={blocksDemoDef} headingLevel={2} />
  </View>
);

// Slice D1 item 11: this page's own anatomy picture — a schematic of the page head's pager row,
// the anatomy box itself, and a member's own specimen card, each pinned with a real `AnatomyPin`.
const pagePicture = (
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
);

export default defineCatalogPage({
  id: 'FamilyPage',
  group: 'Components',
  title: 'FamilyPage',
  description: "Documents a family of related declarations — a whole and its members — on one page, with an anatomy box, a disclosure per member, and an address and search entry for each one. Used by this very page: you're reading a live FamilyPage right now.",
  source: '../native/catalog/FamilyPage.tsx',
  whole: 'FamilyPage',
  // Slice D1 item 11: more than six items (4 members here plus 3 "from other pages" entries)
  // so this page's own anatomy box shows the below-the-picture, multi-column legend.
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
    { label: 'Rendering pieces', kind: 'blocks', inWhole: true, members: ['SectionPagerRow', 'PagerButton', 'AnatomyPin'] },
    // N6: Blocks has a real specimen (the stacked-blocks demo below) — a `list` section only ever
    // renders folded rows, which never show specimens, so Blocks belongs in a `blocks` section.
    { label: 'Specimen layout', kind: 'blocks', inWhole: true, members: ['Blocks'] },
    { label: 'Related', kind: 'list', inWhole: false, members: ['FamilyPageDisclosure'] },
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
      a11y: "Parts and Related are the only two section labels, both headings at the outline's own aria-level; a Part's own name sits inside its heading, with its pin and fidelity badge kept outside it (the pin is aria-hidden) so assistive tech announces only the name at the right level. The disclosure toggle and a folded row's own toggle both expose aria-expanded.",
      variants: { items: [{ key: 'demo', name: 'Example family', node: familyDemo }] },
      // V2d: FamilyPage's own disclosure line ("Uses …") exercised on itself — FamilyPageDisclosure
      // is a sibling member (not a standalone component or page), so this also exercises a member
      // id resolving to a link, not just a plain component/page name.
      composedOf: [{ component: 'FamilyPageDisclosure', role: 'Member disclosure', relationship: 'built-in' }],
    },
    {
      id: 'SectionPagerRow',
      component: 'SectionPagerRow',
      parent: 'FamilyPage',
      source: '../native/catalog/SectionBlock.tsx:214',
      fidelity: 'replicated',
      relationship: 'Rendering piece',
      description: "The previous/next row FamilyPage's own page head renders, shared with SectionBlock so a host page never builds its own pair of pager buttons.",
      whenToUse: "Reuse SectionPagerRow for the previous/next row at the top of any whole-page layout that has a `pager` — pass the same `SectionPager` shape FamilyPage and SectionBlock already take.",
      a11y: "Adds no wrapping semantics of its own; each button's own accessible name (from PagerButton) already states the direction and the neighboring page's title.",
      variants: { items: [{ key: 'demo', name: 'In the page head', node: familyDemo }] },
    },
    {
      id: 'PagerButton',
      component: 'PagerButton',
      parent: 'SectionPagerRow',
      source: '../native/catalog/SectionBlock.tsx:56',
      fidelity: 'replicated',
      relationship: 'Rendering piece',
      description: 'The individual previous/next button SectionPagerRow renders one of.',
      whenToUse: 'Reach for PagerButton directly only when building a different pager layout that still wants the same disabled/hover/focus behavior as SectionPagerRow\'s own pair.',
      a11y: 'Exposes `accessibilityRole="button"`, a direction- and destination-aware `accessibilityLabel` (e.g. "Previous: Button"), and `accessibilityState={{ disabled }}` when there is no neighboring page; shows the catalog\'s own focus ring on keyboard focus.',
      variants: { items: [{ key: 'demo', name: 'In the page head', node: familyDemo }] },
    },
    {
      id: 'AnatomyPin',
      component: 'AnatomyPin',
      parent: 'FamilyPage',
      source: '../native/catalog/FamilyPage.tsx:731',
      fidelity: 'replicated',
      relationship: 'Rendering piece',
      description: "A numbered (or dashed, or ↗) pin for one member, used inside a family page's own anatomy.picture.",
      whenToUse: "Reach for AnatomyPin only inside a family page's own `anatomy.picture` — it looks up its member's number and dashed/↗ style through context, so the picture's own markup never hardcodes a number.",
      a11y: "Decorative and hidden from accessibility (aria-hidden) — the member's own name, not its pin, is what a screen reader announces, the same as every pin in the anatomy legend or a Part's own header.",
      variants: { items: [{ key: 'demo', name: 'In the anatomy picture above', node: familyDemo }] },
    },
    {
      id: 'Blocks',
      component: 'Blocks',
      parent: 'FamilyPage',
      source: '../native/catalog/SectionBlock.tsx:226',
      fidelity: 'replicated',
      relationship: 'Specimen layout',
      // N6: now that Blocks renders its own demo (moved out of a list section, which never shows
      // specimens), its own SectionBlock-in-a-member demo is wide enough to need the page size.
      specimenSize: 'page',
      description: "The shared placement logic behind a member's own specimen card: stacked by default, side by side only when two blocks' own measured heights say it saves real height.",
      whenToUse: "SectionBlock and FamilyPage's own member blocks both render through Blocks so the stacked/side-by-side decision is never duplicated — there's no reason to call it directly outside those two.",
      a11y: 'Purely a layout container; each block\'s own content (a grid, a list, grouped rows, or a preview) carries its own accessibility semantics.',
      states: { items: [{ key: 'demo', name: 'Stacked blocks', node: blocksDemo }] },
    },
    {
      id: 'FamilyPageDisclosure',
      source: '../native/catalog/FamilyPage.tsx:207',
      fidelity: 'documentation-only',
      relationship: 'Related',
      related: "Shows Props through the existing PropsTable rather than a second table implementation.",
      description: "The collapsed panel under each member's specimens: notes, guidance, accessibility, generated props, and a reference excerpt, in that order.",
      aliases: ['FamilyPageDetails'],
    },
  ],
});
