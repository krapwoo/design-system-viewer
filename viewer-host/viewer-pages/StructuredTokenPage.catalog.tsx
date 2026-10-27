import React from 'react';
import { defineCatalogPage, StructuredTokenPage } from '@krapwoo/ds-viewer';
import type { TokenDefinition } from '@krapwoo/ds-viewer';

// Fixture values only — illustrative, never a real design system's actual tokens (README's own
// "Token pages" section documents the real authoring shape with its own real-value guidance).
const FIXTURE: TokenDefinition = {
  kind: 'colors',
  sections: [
    {
      id: 'semantic',
      title: 'Semantic (fixture)',
      desc: 'A named token, and a named token whose own value is platform-provided.',
      entries: [
        { id: 'brand', name: 'Brand', kind: 'colors', value: { provenance: 'named', resolution: { status: 'resolved', value: { color: '#174dc6' } } } },
        {
          id: 'background', name: 'Background', kind: 'colors', role: 'Screen background',
          value: { provenance: 'platform', named: true, resolution: { status: 'unresolved', reason: 'Provided by the platform at runtime.', expression: 'UIColor.systemBackground' } },
        },
      ],
    },
    {
      id: 'unresolved',
      title: 'Unresolved (fixture)',
      desc: 'An unresolved centralization finding with a real drawable literal, and a truly undefined value.',
      entries: [
        {
          id: 'liveActivityTint', name: 'Live Activity tint', kind: 'colors', source: 'AgentRunLiveActivityWidget.swift:42',
          value: { provenance: 'unresolved-finding', resolution: { status: 'resolved', value: { color: '#f2994a' } } },
        },
        {
          id: 'accentColorAsset', name: 'AccentColor', kind: 'colors',
          value: { provenance: 'unresolved-finding', resolution: { status: 'unresolved', reason: 'AccentColor.colorset has no defined value.', expression: 'AccentColor' } },
        },
      ],
    },
  ],
};

// Further fixtures: one representative definition per further value shape shown here, so these renderers are
// visible here. All values are illustrative only.
const TYPOGRAPHY_FIXTURE: TokenDefinition = {
  kind: 'typography',
  sections: [{
    id: 'text', title: 'Text styles (fixture)',
    entries: [
      { id: 'title', name: 'Title', kind: 'typography', role: 'Screen titles', value: { provenance: 'named', resolution: { status: 'resolved', value: { fontSize: 22, fontSizeUnit: 'pt', fontWeight: 600 } } } },
      { id: 'body', name: 'Body', kind: 'typography', value: { provenance: 'platform', named: true, resolution: { status: 'unresolved', reason: 'Dynamic Type size is chosen by the platform at runtime.', expression: 'Font.body' } } },
    ],
  }],
};

const SPACING_FIXTURE: TokenDefinition = {
  kind: 'spacing',
  sections: [{
    id: 'scale', title: 'Spacing scale (fixture)',
    entries: [
      { id: 'sm', name: 'Small', kind: 'spacing', value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 8, unit: 'pt' } } } },
      { id: 'lg', name: 'Large', kind: 'spacing', value: { provenance: 'named', resolution: { status: 'resolved', value: { amount: 24, unit: 'pt' } } } },
      { id: 'inset', name: 'Card inset', kind: 'spacing', source: 'CardView.swift:18', value: { provenance: 'inline', resolution: { status: 'resolved', value: { amount: 14, unit: 'pt' } } } },
    ],
  }],
};

const SHADOW_FIXTURE: TokenDefinition = {
  kind: 'shadows',
  sections: [{
    id: 'elevation', title: 'Elevation (fixture)',
    entries: [
      { id: 'card', name: 'Card', kind: 'shadows', value: { provenance: 'named', resolution: { status: 'resolved', value: { color: '#000000', opacity: 0.12, radius: 8, x: 0, y: 2 } } } },
    ],
  }],
};

const MOTION_FIXTURE: TokenDefinition = {
  kind: 'motion',
  sections: [{
    id: 'transitions', title: 'Transitions (fixture)',
    entries: [
      { id: 'fade', name: 'Fade', kind: 'motion', value: { provenance: 'inline', resolution: { status: 'resolved', value: { kind: 'timing', durationMs: 250, sourceValue: 0.25, sourceUnit: 's' } } } },
      { id: 'sheet', name: 'Sheet spring', kind: 'motion', value: { provenance: 'inline', resolution: { status: 'resolved', value: { kind: 'native-expression', expression: '.spring(response: 0.35, dampingFraction: 0.85)' } } } },
    ],
  }],
};

export default defineCatalogPage({
  component: 'StructuredTokenPage',
  group: 'Components',
  source: '../native/catalog/StructuredTokenPage.tsx',
  specimenSize: 'page',
  hide: { props: true },
  description:
    'A whole opted-in tokenDefinition\'s real entries, every section stacked — the real rendering path is SectionBlock\'s own "tokenSections" block case (StructuredTokenPage.tsx\'s own exported `tokenDefinitionSections`); this component is a direct, standalone preview of the same data. Every value shown here is a fixture, not a real design system\'s tokens.',
  whenToUse: 'A page opting into tokenDefinition never renders this directly — SectionBlock renders it automatically. Use it only for a direct preview outside that path.',
  a11y: 'Carries no accessibility behavior of its own beyond the primitives it composes (Swatch, TokenGrid, TokenTile, TokenRow, MotionSpecimen).',
  variants: {
    maxColumns: 1,
    items: [
      { key: 'fixture', name: 'Fixture colors definition', fill: true, node: <StructuredTokenPage definition={FIXTURE} /> },
      { key: 'typography', name: 'Fixture typography definition', fill: true, node: <StructuredTokenPage definition={TYPOGRAPHY_FIXTURE} /> },
      { key: 'spacing', name: 'Fixture spacing definition', fill: true, node: <StructuredTokenPage definition={SPACING_FIXTURE} /> },
      { key: 'shadows', name: 'Fixture shadows definition', fill: true, node: <StructuredTokenPage definition={SHADOW_FIXTURE} /> },
      { key: 'motion', name: 'Fixture motion definition', fill: true, node: <StructuredTokenPage definition={MOTION_FIXTURE} /> },
    ],
  },
});
