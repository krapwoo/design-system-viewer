import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { defineCatalogPage, CatalogShell, CATALOG_COLOR, CATALOG_TYPE, type NavGroup, type SectionDef, type UpdateNotice, type VersionStatus } from '@krapwoo/ds-viewer';

// A small sample catalog for the live, embedded shells below.
type Id = 'Colors' | 'Button' | 'Card';
const sample = StyleSheet.create({ text: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.textMuted } });
const SECTIONS: SectionDef<Id>[] = [
  { id: 'Colors', title: 'Colour palette', path: 'src/tokens.ts', description: 'Colour tokens.', tokenGallery: true, previewWidths: 'full', render: () => <Text style={sample.text}>Swatches…</Text> },
  { id: 'Button', title: 'Primary action', path: 'src/Button.tsx', description: 'The primary tap target.', variants: { items: [{ key: 'primary', name: 'Primary', node: <Text style={sample.text}>Continue</Text> }] } },
  { id: 'Card', title: 'Content card', path: 'src/Card.tsx', description: 'A surface for grouped content.', variants: { items: [{ key: 'plain', name: 'Plain', node: <Text style={sample.text}>Card</Text> }] } },
];
const GROUPS: NavGroup<Id>[] = [
  { label: 'Tokens', ids: ['Colors'] },
  { label: 'Components', ids: ['Button', 'Card'] },
];
const version = (current: string, update: UpdateNotice | null): VersionStatus => ({
  current, autoCheck: { enabled: true, source: 'default' }, lastOutcome: 'ok', lastCheckedAt: new Date().toISOString(), update,
});
const MINOR: UpdateNotice = { current: '0.4.9', latest: '0.5.0', breaking: false, summary: [] };
const MAJOR: UpdateNotice = { current: '0.5.0', latest: '1.0.0', breaking: true, summary: [] };

const frame = StyleSheet.create({ box: { height: 460, alignSelf: 'stretch', borderWidth: 1, borderColor: CATALOG_COLOR.border, overflow: 'hidden' } });
const shell = (update: UpdateNotice | null, current: string) => (
  <View style={frame.box}>
    <CatalogShell embedded initialPage="Button" appName="Rider App" title="Component Catalog" groups={GROUPS} sections={SECTIONS} update={update} versionStatus={version(current, update)} />
  </View>
);

export default defineCatalogPage({
  component: 'CatalogShell',
  group: 'Components',
  whenToUse: 'The whole catalog in one component: the persistent sidebar plus the single selected page. Use it to mount the catalog, or to embed it inside a host app\'s own screen. For the navigation list alone, use CatalogSidebar.',
  source: '../native/catalog/CatalogShell.tsx',
  specimenSize: 'page',
  composedOf: [
    { component: 'CatalogSidebar', role: 'The navigation column.', relationship: 'built-in' },
    { component: 'SectionBlock', role: 'Each catalog page without members.', relationship: 'built-in' },
    { component: 'FamilyPage', role: 'Each catalog page with members.', relationship: 'built-in' },
    { component: 'UpdatePanel', role: 'The update page, opened from the sidebar footer.', relationship: 'built-in' },
    { component: 'SpecimenAddressProvider', role: "Wraps the selected page so a PhoneFrame in it knows which example it is.", relationship: 'built-in' },
  ],
  hide: { props: true },
  description: "The whole catalog: a searchable sidebar plus one selected page. On web the page lives in the URL fragment (#Button), so refresh, deep links and back/forward work. These examples are live shells with `embedded`, which keeps the selected page in its own state instead of the URL. You're also reading a live CatalogShell right now.",
  a11y: 'Selecting a page moves focus to its heading. The sidebar is a navigation landmark of links under plain-text group labels.',
  variants: {
    // A whole catalog is laptop-sized: one per row.
    maxColumns: 1,
    items: [
      { key: 'current', name: 'Up to date', node: shell(null, '0.5.0') },
      { key: 'update', name: 'Update available', node: shell(MINOR, '0.4.9') },
      { key: 'major', name: 'Major update (banner)', node: shell(MAJOR, '0.5.0') },
    ],
  },
});
