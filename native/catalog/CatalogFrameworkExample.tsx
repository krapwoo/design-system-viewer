/**
 * CatalogFrameworkExample — "Design System DS Catalog": documents the catalog FRAMEWORK's own
 * pieces (CatalogShell, CatalogSidebar, CatalogSearchInput, SectionBlock, PropsTable, VariantGroup,
 * TokenRow, DividedStack, Swatch, SpacingScaleGallery, TypeScaleGallery), the same way
 * CatalogExample.tsx documents the actual DS components. Meta by design — this page is itself built
 * with the very framework it documents.
 *
 * Two of the eleven (CatalogShell, CatalogSidebar) are whole-screen chrome — the shell fills its
 * host and owns the URL fragment and history — so embedding a live instance inside a preview card
 * would fight the real catalog around it, not demonstrate the component. Those two render a small static
 * diagram of their structure instead, with a note pointing at where they're actually running live
 * (this very page, and the Native App DS Template catalog). The other nine are ordinary content
 * components with no viewport-relative sizing, so they render live, with real interactive state.
 */
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { DS_SEMANTIC, DS_SPACING, DS_TYPOGRAPHY, DS_RADIUS } from '../../tokens';

import { CatalogShell } from './CatalogShell';
import { CatalogSearchInput } from './CatalogSearchInput';
import { SectionBlock } from './SectionBlock';
import { PropsTable } from './PropsTable';
import { VariantGroup } from './VariantGroup';
import { TokenRow } from './TokenRow';
import { DividedStack } from './DividedStack';
import { Swatch } from './Swatch';
import { SpacingScaleGallery } from './SpacingScaleGallery';
import { TypeScaleGallery } from './TypeScaleGallery';
import { CATALOG_TYPE, CATALOG_TYPE_USE, CATALOG_SPACE, CATALOG_SPACE_USE, CATALOG_COLOR } from './tokens';
import type { NavGroup, SectionDef } from './types';

// Layout chrome for the live examples. Defined up top (not near its call sites further down) because
// `mockSectionDef`'s `variants`/`states` arrays are plain data, evaluated eagerly at module load —
// unlike a `render: () => ...` closure, a `demo.xyz` reference inside a `variants`/`states` entry runs
// before a `const demo` declared later in the file would exist yet (a real TDZ crash, not just style;
// see the identical note in CatalogExample.tsx, where this was first worked out).
const demo = StyleSheet.create({
  mockText: { ...DS_TYPOGRAPHY.bodySm, color: DS_SEMANTIC.text.muted, fontStyle: 'italic' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: DS_SPACING[600] },
  stack: { gap: DS_SPACING[600] },
  // Used by TokenRowDemo's own hand-built rows (TokenRow's SectionDef demo, kept as raw markup to
  // show TokenRow's API directly rather than going through SpacingScaleGallery). Wider gap than
  // `stack` — one row's use-note shouldn't crowd the next row's label.
  tokenStack: { gap: DS_SPACING[800] },
  spacingRow: { flexDirection: 'row', alignItems: 'center', gap: DS_SPACING[600] },
  spacingLabel: { width: 48, ...DS_TYPOGRAPHY.labelXs, color: DS_SEMANTIC.text.regular },
  spacingBar: { height: 12, borderRadius: DS_RADIUS.xs, backgroundColor: DS_SEMANTIC.emphasis.info },
  spacingValue: { fontSize: DS_TYPOGRAPHY.bodyXs.fontSize, color: DS_SEMANTIC.text.muted },
  // Used by ColorsGallery's trailing "code —" note; Spacing/Type Scale rows use TokenRow's own style.
  tokenUse: { ...DS_TYPOGRAPHY.bodyXs, color: DS_SEMANTIC.text.muted },
  // Shell / sidebar structure diagrams — plain boxes, not live viewport-sized instances.
  diagramFrame: {
    flexDirection: 'row',
    height: 180,
    borderWidth: 1,
    borderColor: DS_SEMANTIC.border.subtle,
    borderRadius: 8,
    overflow: 'hidden',
  },
  diagramSidebarFrame: {
    height: 180,
    width: 140,
    borderWidth: 1,
    borderColor: DS_SEMANTIC.border.subtle,
    borderRadius: 8,
    overflow: 'hidden',
  },
  diagramSidebarCol: {
    width: 110,
    backgroundColor: DS_SEMANTIC.surface.white,
    borderRightWidth: 1,
    borderRightColor: DS_SEMANTIC.border.subtle,
    padding: DS_SPACING[400],
    gap: DS_SPACING[200],
  },
  diagramMainCol: {
    flex: 1,
    backgroundColor: DS_SEMANTIC.surface.main,
    padding: DS_SPACING[400],
    gap: DS_SPACING[200],
  },
  diagramLogo: { fontSize: 9, fontWeight: '700', color: DS_SEMANTIC.text.regular },
  diagramCaption: { fontSize: 7, color: DS_SEMANTIC.text.muted, marginBottom: DS_SPACING[200] },
  diagramSearch: {
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: DS_SEMANTIC.border.subtle,
    backgroundColor: DS_SEMANTIC.surface.main,
  },
  diagramGroupLabel: { fontSize: 6, fontWeight: '700', color: DS_SEMANTIC.text.muted, letterSpacing: 0.4, marginTop: DS_SPACING[200] },
  diagramNavItem: { fontSize: 7, color: DS_SEMANTIC.text.muted },
  diagramNavActive: { color: DS_SEMANTIC.text.regular, fontWeight: '700' },
  diagramPageTitle: { fontSize: 9, fontWeight: '700', color: DS_SEMANTIC.text.regular },
  diagramBlock: {
    height: 40,
    borderRadius: 4,
    backgroundColor: DS_SEMANTIC.surface.white,
    borderWidth: 1,
    borderColor: DS_SEMANTIC.border.subtle,
  },
});

// ─── Section-id union ─────────────────────────────────────────────────────────
type SectionId =
  | 'CatalogShell'
  | 'CatalogSidebar'
  | 'CatalogSearchInput'
  | 'SectionBlock'
  | 'PropsTable'
  | 'VariantGroup'
  | 'TokenRow'
  | 'DividedStack'
  | 'Swatch'
  | 'SpacingScaleGallery'
  | 'TypeScaleGallery'
  | 'Colors'
  | 'Spacing'
  | 'Type Scale';

// ─── Structure diagrams (CatalogShell / CatalogSidebar) ────────────────────────
// Plain boxes standing in for the real, viewport-sized components — see the file header for why.

function SidebarSwatch() {
  return (
    <View style={demo.diagramSidebarCol}>
      <Text style={demo.diagramLogo}>Design System</Text>
      <Text style={demo.diagramCaption}>Component Catalog</Text>
      <View style={demo.diagramSearch} />
      <Text style={demo.diagramGroupLabel}>ACTIONS</Text>
      <Text style={demo.diagramNavItem}>Button</Text>
      <Text style={[demo.diagramNavItem, demo.diagramNavActive]}>Pill</Text>
    </View>
  );
}

function ShellDiagram() {
  return (
    <View style={demo.diagramFrame}>
      <SidebarSwatch />
      <View style={demo.diagramMainCol}>
        <Text style={demo.diagramPageTitle}>Pill</Text>
        <View style={demo.diagramBlock} />
        <View style={demo.diagramBlock} />
      </View>
    </View>
  );
}

function SidebarDiagram() {
  return (
    <View style={demo.diagramSidebarFrame}>
      <SidebarSwatch />
    </View>
  );
}

// ─── Live demos ─────────────────────────────────────────────────────────────────

function CatalogSearchInputDemo() {
  const [value, setValue] = useState('');
  return <CatalogSearchInput value={value} onChangeText={setValue} placeholder="Filter components…" />;
}

const mockSectionDef: SectionDef<'Example'> = {
  id: 'Example',
  path: 'your/components/Example',
  description: 'A stand-in component, just to show how SectionBlock lays out a real one — swap for your own SectionDef.',
  a11y: 'Whatever is actually true about the real component\'s accessibility goes here, grounded in its source.',
  props: [
    { name: 'label', type: 'string', required: true, desc: 'What it says.' },
    { name: 'variant', type: "'a' | 'b'", default: 'a', desc: 'Which flavor.' },
  ],
  // Each value of `variant` gets its own instance, including the default — the same convention every
  // real SectionDef in both catalogs follows (e.g. Button's Variants column starts with "Primary").
  variants: {
    items: [
      { key: 'a', name: 'A (default)', node: <Text style={demo.mockText}>Variant A</Text> },
      { key: 'b', name: 'B', node: <Text style={demo.mockText}>Variant B</Text> },
    ],
  },
  // Both state keys match grid columns below, so the page shows them in the grid and does not
  // repeat them as a States list. They stay here as data for the manifest and completeness check.
  states: {
    items: [
      { key: 'default', name: 'Default', node: <Text style={demo.mockText}>(the component's live example goes here)</Text> },
      { key: 'disabled', name: 'Disabled', node: <Text style={demo.mockText}>(a disabled instance)</Text> },
    ],
  },
  // Two props that combine freely become a grid. Every cell is authored; B genuinely has no
  // disabled look, so that cell says so instead of faking one.
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

function PropsTableDemo() {
  return (
    <PropsTable
      props={[
        { name: 'label', type: 'string', desc: 'Button text.' },
        { name: 'variant', type: "'primary' | 'secondary'", default: 'primary', desc: 'Visual weight.' },
        { name: 'onPress', type: '() => void', required: true, desc: 'Tap handler.' },
      ]}
    />
  );
}

// ─── Token galleries ───────────────────────────────────────────────────────────
// The framework's OWN tokens (CATALOG_*) — deliberately separate from the host app's DS tokens
// shown on the "Native App DS Template" catalog's Tokens page. See native/catalog/tokens.ts.
// Swatch/SpacingScaleGallery/TypeScaleGallery are framework building blocks (`./Swatch`,
// `./SpacingScaleGallery`, `./TypeScaleGallery`) — this file only supplies the token data they render.

function ColorsGallery() {
  // `code` is a font-family name, not a color — shown separately below instead of as a broken swatch.
  const colorEntries = Object.entries(CATALOG_COLOR).filter(([key]) => key !== 'code');
  return (
    <View style={demo.stack}>
      <View style={demo.row}>
        {colorEntries.map(([name, value]) => (
          // Wider than Swatch's own 84px default — this gallery's longest name (`borderHairline`)
          // needs the extra room to stay on one line.
          <Swatch key={name} name={name} value={value} width={116} />
        ))}
      </View>
      <Text style={demo.tokenUse}>
        code — {CATALOG_COLOR.code} (the monospace font for prop names/types/file-path chips).
      </Text>
    </View>
  );
}

function DividedStackDemo() {
  return (
    <DividedStack gap={CATALOG_SPACE.lg}>
      <Text style={demo.mockText}>First item</Text>
      <Text style={demo.mockText}>Second item — has a divider above it, not below</Text>
      <Text style={demo.mockText}>Third item — the last one, no trailing divider</Text>
    </DividedStack>
  );
}

function TokenRowDemo() {
  // Two rows, stacked in a real tokenStack — shows both the divider (drawn by default, between
  // rows) and its absence on `last` (the second row here).
  return (
    <View style={demo.tokenStack}>
      <TokenRow use="This is the grounded 'when to use this' note, rendered below the value.">
        <View style={demo.spacingRow}>
          <Text style={demo.spacingLabel}>800</Text>
          <View style={[demo.spacingBar, { width: 16 }]} />
          <Text style={demo.spacingValue}>16px</Text>
        </View>
      </TokenRow>
      <TokenRow use="This row has last — no divider beneath it, since nothing follows." last>
        <View style={demo.spacingRow}>
          <Text style={demo.spacingLabel}>1200</Text>
          <View style={[demo.spacingBar, { width: 24 }]} />
          <Text style={demo.spacingValue}>24px</Text>
        </View>
      </TokenRow>
    </View>
  );
}

// ─── Sections ──────────────────────────────────────────────────────────────────
const sections: SectionDef<SectionId>[] = [
  {
    id: 'CatalogShell',
    path: 'native/catalog/CatalogShell.tsx',
    description: 'The whole catalog — a persistent, searchable sidebar plus one selected page. Selecting a page replaces the main content; on web the page is kept in the URL fragment (#Button) so refresh, deep links, and back/forward work. Desktop and laptop screens only. You\'re reading a live CatalogShell right now.',
    hide: { states: true, props: true, accessibility: true },
    render: () => <ShellDiagram />,
  },
  {
    id: 'CatalogSidebar',
    path: 'native/catalog/CatalogSidebar.tsx',
    description: 'Catalog navigation: app name, caption, a filter box, and grouped links, one per page. Selecting a link opens that page; the filter narrows this list only and never changes the open page. Used internally by CatalogShell.',
    hide: { states: true, props: true, accessibility: true },
    render: () => <SidebarDiagram />,
  },
  {
    id: 'CatalogSearchInput',
    path: 'native/catalog/CatalogSearchInput.tsx',
    description: 'A plain filter input, deliberately built from bare RN primitives rather than the host app\'s own search field — the catalog\'s own chrome shouldn\'t depend on (or break alongside) the thing it\'s documenting.',
    hide: { states: true, props: true, accessibility: true },
    render: () => <CatalogSearchInputDemo />,
  },
  {
    id: 'SectionBlock',
    path: 'native/catalog/SectionBlock.tsx',
    description: 'One catalog page: breadcrumb, title, description, previous/next, then the specimens in one of three layouts — a grid (two props that combine freely, from `comparison`), a list (one axis, in one shared card), or a full-width preview (`render()` and token galleries) — then always-visible Guidance, Quick reference, and Props. Columns and cells are at most 402px wide with 16px padding. The demo below is a standalone SectionBlock with a mock grid, including one genuinely unsupported cell.',
    hide: { states: true, props: true, accessibility: true },
    render: () => <SectionBlockDemo />,
  },
  {
    id: 'PropsTable',
    path: 'native/catalog/PropsTable.tsx',
    description: 'Renders a component\'s real prop interface as a table: each row stacks name + type above its description (and default, if any) — top-to-bottom, not side by side, so a long description reads at the card\'s full width instead of being squeezed into a narrow leftover column.',
    hide: { states: true, props: true, accessibility: true },
    render: () => <PropsTableDemo />,
  },
  {
    id: 'VariantGroup',
    path: 'native/catalog/VariantGroup.tsx',
    description: 'Labels one example (or small cluster of examples) inside a freeform `render()` — a bold uppercase name plus a one-line description, sitting above whatever demo content is passed as children. SectionBlock itself doesn\'t use this for `variants` clusters (those get their own card, titled directly); reach for it inside a `render()` that needs an inline sub-heading, e.g. the Colors gallery below.',
    hide: { states: true, props: true, accessibility: true },
    render: () => (
      <VariantGroup name="Usage" desc="wraps a row or stack of live examples">
        <Text style={demo.mockText}>(e.g. a row of Button variants)</Text>
      </VariantGroup>
    ),
  },
  {
    id: 'TokenRow',
    path: 'native/catalog/TokenRow.tsx',
    description: 'Wraps one token\'s rendered example with a grounded "when to use this" note beneath it, and a bottom divider so a stack of rows reads as a list — the shared shape behind every row in the Spacing and Type Scale galleries below, in both this catalog and the Native App DS Template catalog. The row\'s own content is freeform children; pass `last` on the final row in a stack to drop its divider.',
    hide: { states: true, props: true, accessibility: true },
    render: () => <TokenRowDemo />,
  },
  {
    id: 'DividedStack',
    path: 'native/catalog/DividedStack.tsx',
    description: 'Stacks children vertically with a hairline divider automatically inserted between each consecutive pair — never after the last. Unlike TokenRow\'s divider (which each row draws itself, needing a manually-computed `last` prop), this one is guaranteed by construction: wrap any list of items and the dividers place themselves. Used inside the Colors gallery below (and the Native App DS Template catalog\'s own) to separate its two VariantGroups within one freeform `render()` card.',
    hide: { states: true, props: true, accessibility: true },
    render: () => <DividedStackDemo />,
  },
  {
    id: 'Swatch',
    path: 'native/catalog/Swatch.tsx',
    description: 'One token swatch inside a Colors gallery: a rendered colour chip plus its name/value as data. The shared shape behind every Colors gallery — this catalog\'s own (below) and the Native App DS Template catalog\'s.',
    hide: { states: true, props: true, accessibility: true },
    render: () => <Swatch name="accent" value={CATALOG_COLOR.accent} />,
  },
  {
    id: 'SpacingScaleGallery',
    path: 'native/catalog/SpacingScaleGallery.tsx',
    description: 'Renders a spacing scale as a stack of TokenRows — a step\'s name, a bar sized to its real pixel value, and the value itself. Generic over the step-name type, so this catalog\'s own Spacing page (below) and the Native App DS Template catalog\'s share one implementation instead of two near-identical copies.',
    hide: { states: true, props: true, accessibility: true },
    render: () => (
      <SpacingScaleGallery
        steps={['sm', 'lg'] as const}
        values={{ sm: CATALOG_SPACE.sm, lg: CATALOG_SPACE.lg }}
        useNotes={{ sm: CATALOG_SPACE_USE.sm, lg: CATALOG_SPACE_USE.lg }}
      />
    ),
  },
  {
    id: 'TypeScaleGallery',
    path: 'native/catalog/TypeScaleGallery.tsx',
    description: 'Renders a type scale as a stack of TokenRows — each step\'s name rendered at its own real style, plus a short meta caption. `sampleStyle`/`meta` are per-step accessor functions rather than plain maps, so the same component works for a full typography token with a weight worth calling out (the Native App DS Template catalog\'s "16/600") or a bare size-only scale like this framework\'s own Type Scale below ("16px").',
    hide: { states: true, props: true, accessibility: true },
    render: () => (
      <TypeScaleGallery
        steps={['sm', 'lg'] as const}
        sampleStyle={(step) => ({ fontSize: CATALOG_TYPE[step] })}
        meta={(step) => `${CATALOG_TYPE[step]}px`}
        useNotes={{ sm: CATALOG_TYPE_USE.sm, lg: CATALOG_TYPE_USE.lg }}
      />
    ),
  },
  {
    id: 'Colors',
    path: 'native/catalog/tokens.ts',
    description: 'The catalog chrome\'s own color set — a neutral greyscale plus one accent, used only for the catalog\'s own UI (sidebar, headings, prop tables, cards). Deliberately independent of the host app\'s DS palette.',
    tokenGallery: true,
    render: () => <ColorsGallery />,
  },
  {
    id: 'Spacing',
    path: 'native/catalog/tokens.ts',
    description: 'The catalog chrome\'s own spacing scale, each step with a grounded "when to use this" note from CATALOG_SPACE_USE, based on how the framework\'s own files actually use them.',
    tokenGallery: true,
    render: () => (
      <SpacingScaleGallery
        steps={Object.keys(CATALOG_SPACE) as (keyof typeof CATALOG_SPACE)[]}
        values={CATALOG_SPACE}
        useNotes={CATALOG_SPACE_USE}
      />
    ),
  },
  {
    id: 'Type Scale',
    path: 'native/catalog/tokens.ts',
    description: 'The catalog chrome\'s own font-size scale (sizes only — no weights/line-heights, unlike the host app\'s DS_TYPOGRAPHY). Every chrome font size in this framework — headings, labels, prop tables, nav, notes — draws from this scale.',
    tokenGallery: true,
    render: () => (
      <TypeScaleGallery
        steps={Object.keys(CATALOG_TYPE) as (keyof typeof CATALOG_TYPE)[]}
        sampleStyle={(step) => ({ fontSize: CATALOG_TYPE[step] })}
        meta={(step) => `${CATALOG_TYPE[step]}px`}
        useNotes={CATALOG_TYPE_USE}
      />
    ),
  },
];

// ─── Sidebar grouping ──────────────────────────────────────────────────────────
const nav: NavGroup<SectionId>[] = [
  { label: 'Layout', ids: ['CatalogShell', 'CatalogSidebar'] },
  { label: 'Building blocks', ids: ['CatalogSearchInput', 'SectionBlock', 'PropsTable', 'VariantGroup', 'TokenRow', 'DividedStack', 'Swatch', 'SpacingScaleGallery', 'TypeScaleGallery'] },
  { label: 'Tokens', ids: ['Colors', 'Spacing', 'Type Scale'] },
];

/**
 * The catalog-of-the-catalog: documents the eleven pieces that make up the reusable catalog
 * framework itself, ready to drop into an Expo app the same way CatalogExample is.
 */
export function CatalogFrameworkExample() {
  return (
    <CatalogShell
      appName="Design System DS Catalog"
      title="Catalog Framework"
      groups={nav}
      sections={sections}
      // These previews document catalog chrome, not phone components, so they keep full width.
      defaultPreviewWidths="full"
    />
  );
}
