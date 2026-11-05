import React from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { FamilyPart, MemberPanelHost, type FamilyMember } from '../../native/catalog/FamilyPage';

const part: FamilyMember = {
  id: 'ExamplePart', path: 'Example.tsx', source: 'Example.tsx:10', fidelity: 'replicated', relationship: 'Part',
  description: 'A part of a made-up whole.', parent: 'ExampleWhole', notes: ['A note, shown in the "Notes and API" panel.'],
  variants: { items: [{ key: 'a', name: 'A', node: null }] },
};
const plain: FamilyMember = { ...part, id: 'ExampleRelated', description: 'A member with no number, as in a Related section.', notes: undefined, variants: undefined };

const common = { allMemberIds: ['ExamplePart', 'ExampleRelated'], apiLabel: 'API', resolvesAddress: () => false, registerNode: () => {} };

export default defineCatalogPage({
  component: 'FamilyPart',
  title: 'Family part',
  group: 'Components',
  source: '../native/catalog/FamilyPage.tsx',
  specimenSize: 'page',
  hide: { props: true },
  composedOf: [
    { component: 'Pin', role: "The number beside a Part's name.", relationship: 'built-in' },
    { component: 'Blocks', role: "The member's own specimens.", relationship: 'built-in' },
    { component: 'AppearsIn', role: 'Where else the member is used.', relationship: 'built-in' },
  ],
  description: "One member's name row, specimens, below-specimens line and disclosure: numbered (a family Part) or not (a family Related member, or a group's top-level member).",
  whenToUse: "Reach for FamilyPart only from FamilyPage's or GroupPage's own tree-building code, never directly from a catalog page.",
  a11y: "The member's name sits inside a real heading at the outline's aria-level; its pin (when numbered) is aria-hidden. \"Notes and API\" is a link-style trigger that exposes aria-expanded.",
  variants: {
    items: [
      { key: 'numbered', name: 'Numbered: a family Part', node: <MemberPanelHost><FamilyPart member={part} number="1" level={2} {...common} /></MemberPanelHost> },
      { key: 'unnumbered', name: 'Unnumbered: a Related member', node: <MemberPanelHost><FamilyPart member={plain} level={2} {...common} /></MemberPanelHost> },
    ],
  },
});
