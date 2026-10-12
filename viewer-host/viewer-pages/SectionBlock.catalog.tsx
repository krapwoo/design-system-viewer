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

// Each variant is the same mock component laid out a different way.
const listDef: SectionDef<'Example'> = { ...mockSectionDef, comparison: undefined };
const gridDef: SectionDef<'Example'> = { ...mockSectionDef, states: undefined, variants: undefined };
const previewDef: SectionDef<'Example'> = { ...mockSectionDef, comparison: undefined, variants: undefined, states: undefined, previewWidths: 'full', render: () => <Text style={demo.mockText}>A free-form render() preview</Text> };
const block = (def: SectionDef<'Example'>) => <SectionBlock def={def} headingLevel={2} />;

export default defineCatalogPage({
  component: 'SectionBlock',
  group: 'Components',
  whenToUse: 'A whole catalog page — heading, specimen blocks, and reference details. CatalogShell renders one for the selected page, so use it standalone only to embed a single page inside a host screen, as this catalog\'s own SectionBlock page does.',
  source: '../native/catalog/SectionBlock.tsx',
  composedOf: [
    { component: 'ComparisonGrid', role: "A two-prop grid of examples.", relationship: 'built-in' },
    { component: 'ComparisonList', role: "A one-axis list of examples.", relationship: 'built-in' },
    { component: 'ComparisonGroups', role: "Grouped rows of examples.", relationship: 'built-in' },
    { component: 'TokenSections', role: "A token page's titled cards.", relationship: 'built-in' },
    { component: 'ReferenceDetails', role: "The reference cards below the examples.", relationship: 'built-in' },
  ],
  specimenSize: 'page',
  hide: { props: true },
  description: 'One catalog page: breadcrumb, title, description, previous/next, then the specimens in one of three layouts — a grid (two props that combine freely, from `comparison`), a list (one axis, in one shared card), or a full-width preview (`render()` and token galleries) — then always-visible Guidance, Quick reference, and Props. Every card fills the column it is given and its columns or cells share that width equally; phone width (402px) caps the specimen inside a cell, not the cell. Each example is a live SectionBlock showing the same mock component in a different layout.',
  a11y: 'The page title is a heading; grids are tables with row and column headers; lists are labelled lists.',
  variants: {
    // A whole page: one per row, so a grid has room for every column.
    maxColumns: 1,
    items: [
      { key: 'list', name: 'List (variants and states)', node: block(listDef) },
      { key: 'grid', name: 'Grid (comparison, one unsupported cell)', node: block(gridDef) },
      { key: 'preview', name: 'Free-form preview', node: block(previewDef) },
    ],
  },
});
