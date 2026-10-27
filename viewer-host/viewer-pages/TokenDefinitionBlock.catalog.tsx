import React from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import type { TokenDefinition } from '@krapwoo/ds-viewer';
import { TokenDefinitionBlock } from '../../native/catalog/StructuredTokenPage';

// Fixture values only — illustrative, never a real design system's actual tokens.
const TWO_CATEGORIES: TokenDefinition = {
  kind: 'colors',
  sections: [
    {
      id: 'brand',
      title: 'Brand (fixture)',
      entries: [
        { id: 'primary', name: 'Primary', kind: 'colors', value: { provenance: 'named', resolution: { status: 'resolved', value: { color: '#174dc6' } } } },
        { id: 'surfaceLight', name: 'Surface', kind: 'colors', appearance: 'light', value: { provenance: 'named', resolution: { status: 'resolved', value: { color: '#ffffff' } } } },
        { id: 'surfaceDark', name: 'Surface', kind: 'colors', appearance: 'dark', value: { provenance: 'named', resolution: { status: 'resolved', value: { color: '#1c1c1e' } } } },
      ],
      groups: [{
        id: 'avatar', title: 'Avatar palette (fixture)',
        entries: [
          { id: 'red', name: 'red', kind: 'colors', value: { provenance: 'named', resolution: { status: 'resolved', value: { color: '#ef4444' } } } },
          { id: 'teal', name: 'teal', kind: 'colors', value: { provenance: 'named', resolution: { status: 'resolved', value: { color: '#14b8a6' } } } },
        ],
      }],
    },
    {
      id: 'inline',
      title: 'Inline values (fixture)',
      entries: [
        { id: 'codeBg', name: 'Code background', kind: 'colors', source: 'CodeView.swift:12', value: { provenance: 'inline', resolution: { status: 'resolved', value: { color: '#14171f' } } } },
      ],
    },
  ],
};

export default defineCatalogPage({
  component: 'TokenDefinitionBlock',
  group: 'Components',
  source: '../native/catalog/StructuredTokenPage.tsx',
  description:
    "How a page's `tokenDefinition` renders inside the catalog: a jump row with one chip per category (shown only when there is more than one), then each category as a titled card. A chip scrolls to its category; a section alias does the same on arrival.",
  whenToUse: 'Never directly — SectionBlock renders it for any page that sets `tokenDefinition`. Documented here so its jump row and category cards can be seen on their own.',
  a11y: 'Each chip is a button named with its category and count (for example "Brand (fixture), 5 values"), reachable by keyboard.',
  internalProps: {
    columns: "The page's tokenColumns, passed by SectionBlock.",
    label: "The page id, passed by SectionBlock for specimen addresses.",
    focusSectionId: 'Set by the shell when a section alias was opened.',
    focusNonce: 'Re-triggers the scroll when the same section alias is opened again.',
  },
  composedOf: [
    { component: 'TokenSections', role: 'Lays out each category as a titled card.', relationship: 'built-in' },
    { component: 'JumpRow', role: 'The category jump row above the first section.', relationship: 'built-in' },
  ],
  states: {
    items: [
      { key: 'two-categories', name: 'Two categories, with a group and a light/dark pair', fill: true, node: <TokenDefinitionBlock definition={TWO_CATEGORIES} columns={1} /> },
    ],
  },
});
