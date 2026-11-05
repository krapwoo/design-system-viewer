import React from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { MemberPanelHost, PartTreeBranch, type FamilyMember } from '../../native/catalog/FamilyPage';

const member = (id: string, parent: string, description: string): FamilyMember => ({
  id, path: 'Example.tsx', source: 'Example.tsx:1', fidelity: 'documentation-only', relationship: 'Part', parent, description,
});
const byId = new Map<string, FamilyMember>([
  ['ExamplePart', member('ExamplePart', 'ExampleWhole', 'A part of the whole.')],
  ['ExampleSubpart', member('ExampleSubpart', 'ExamplePart', 'A part of a part.')],
]);
const outline = new Map([['ExamplePart', { number: '1', level: 2 }], ['ExampleSubpart', { number: '1.1', level: 3 }]]);
const props = {
  byId, outline, allMemberIds: ['ExamplePart', 'ExampleSubpart'], apiLabel: 'API', resolvesAddress: () => false,
  registerNode: () => {}, pinNodesRef: { current: new Map() },
};

export default defineCatalogPage({
  component: 'PartTreeBranch',
  title: 'Part tree branch',
  group: 'Components',
  source: '../native/catalog/FamilyPage.tsx',
  specimenSize: 'page',
  hide: { props: true },
  composedOf: [{ component: 'FamilyPart', role: 'The part itself, once per node.', relationship: 'built-in' }],
  description: "One Part in its tree position, wrapped in a tree-line branch only when it has children. GroupPage reuses it to nest a top-level member's own parts underneath it.",
  whenToUse: "Reach for PartTreeBranch only from FamilyPage's or GroupPage's own Parts tree, never directly.",
  a11y: 'The tree line is a decorative, aria-hidden overlay; only the Parts it connects carry real semantics.',
  variants: {
    items: [
      { key: 'leaf', name: 'A leaf: no tree line', node: <MemberPanelHost><PartTreeBranch node={{ id: 'ExampleSubpart', children: [] }} {...props} /></MemberPanelHost> },
      { key: 'nested', name: 'A part with a child nested under it', node: <MemberPanelHost><PartTreeBranch node={{ id: 'ExamplePart', children: [{ id: 'ExampleSubpart', children: [] }] }} {...props} /></MemberPanelHost> },
    ],
  },
});
