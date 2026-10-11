import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { defineCatalogPage, SectionBlock, type SectionDef } from '@krapwoo/ds-viewer';
import { DS_SEMANTIC, DS_TYPOGRAPHY } from '../../starter-kit/tokens';

const demo = StyleSheet.create({
  mockText: { ...DS_TYPOGRAPHY.bodySm, color: DS_SEMANTIC.text.muted, fontStyle: 'italic' },
});

const mockSectionDef: SectionDef<'Example'> = {
  id: 'Example',
  path: 'your/components/Example',
  description: 'A stand-in component, just to show how SectionBlock lays out a real one — swap for your own SectionDef.',
  a11y: 'Whatever is actually true about the real component\'s accessibility goes here, grounded in its source.',
  props: [
    { name: 'label', type: 'string', required: true, desc: 'What it says.' },
    { name: 'variant', type: "'a' | 'b'", default: 'a', desc: 'Which flavor.' },
  ],
  variants: {
    items: [
      { key: 'a', name: 'A (default)', node: <Text style={demo.mockText}>Variant A</Text> },
      { key: 'b', name: 'B', node: <Text style={demo.mockText}>Variant B</Text> },
    ],
  },
  states: {
    items: [
      { key: 'default', name: 'Default', node: <Text style={demo.mockText}>(the component's live example goes here)</Text> },
      { key: 'disabled', name: 'Disabled', node: <Text style={demo.mockText}>(a disabled instance)</Text> },
    ],
  },
  comparison: {
    rowLabel: 'Variant',
    columnLabel: 'State',
    rows: [{ key: 'a', label: 'A (default)' }, { key: 'b', label: 'B' }],
    columns: [{ key: 'default', label: 'Default' }, { key: 'disabled', label: 'Disabled' }],
    cells: [
      { rowKey: 'a', columnKey: 'default', node: <Text style={demo.mockText}>A</Text> },
      { rowKey: 'a', columnKey: 'disabled', node: <Text style={demo.mockText}>A, disabled</Text> },
      { rowKey: 'b', columnKey: 'default', node: <Text style={demo.mockText}>B</Text> },
      { rowKey: 'b', columnKey: 'disabled', unavailableReason: 'B has no disabled look' },
    ],
  },
};

function SectionBlockDemo() {
  return <SectionBlock def={mockSectionDef} headingLevel={2} />;
}

export default defineCatalogPage({
  group: 'Viewer',
  previewWidths: 'full',
  hide: { states: true, props: true, accessibility: true },
  description: 'One catalog page: breadcrumb, title, description, previous/next, then the specimens in one of three layouts — a grid (two props that combine freely, from `comparison`), a list (one axis, in one shared card), or a full-width preview (`render()` and token galleries) — then always-visible Guidance, Quick reference, and Props. Columns and cells are at most 402px wide with 16px padding. The demo below is a standalone SectionBlock with a mock grid, including one genuinely unsupported cell.',
  render: () => <SectionBlockDemo />,
});
