import React from 'react';
import { Text } from 'react-native';
import { CATALOG_COLOR, CATALOG_TEXT, Overview, defineCatalogPage } from '@krapwoo/ds-viewer';
import type { SectionDef, UsageData, UsageUse } from '@krapwoo/ds-viewer';

// Fixture pages and usage, invented for this page: not read from any project's usage file.
const chip = (label: string) => <Text style={{ ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.accent }}>{label}</Text>;
// Built by hand (not `defineCatalogPage`, which only runs for an authored page in a real catalog).
const fixturePage = (id: string): SectionDef => ({
  id, description: `${id} (fixture).`, path: `fixture/${id}.tsx`,
  variants: { items: [{ key: 'a', name: 'Default', node: chip(id) }] },
});
const SECTIONS = ['Chip', 'Banner', 'Toggle', 'Avatar', 'Divider'].map(fixturePage);

const uses = (area: string, count: number): UsageUse[] => Array.from({ length: count }, (_, i) => ({ area, file: `${area}Screen${i + 1}.swift`, line: 10 + i }));
const USAGE: UsageData = {
  version: 1,
  areas: ['Chat', 'Bots', 'Settings'],
  components: {
    Chip: { area: 'Chat', uses: [...uses('Chat', 6), ...uses('Bots', 3), ...uses('Settings', 1)] },
    Banner: { area: 'Settings', uses: uses('Settings', 4) },
    Toggle: { area: 'Settings', uses: [...uses('Settings', 8), ...uses('Chat', 1)] },
    Avatar: { area: 'Chat', uses: [...uses('Chat', 12), ...uses('Bots', 7)] },
  },
};

export default defineCatalogPage({
  component: 'Overview',
  group: 'Components',
  standalone: 'CatalogShell shows it as a page of its own when the catalog has usage data; this is the page itself.',
  whenToUse: 'CatalogShell shows the Overview itself whenever the project has usage data (its sidebar entry is first). Use it directly only to compose your own catalog shell.',
  source: '../native/catalog/Overview.tsx',
  specimenSize: 'page',
  hide: { props: true },
  description: 'A map of the catalog for designers. Components: every page with something to show as a card with a live, scaled-down thumbnail of its first specimen, grouped by the area it lives in, with area filter chips and a "By area" / "Most used" sort. Usage: a table of components by area with each count shaded by how large it is. Both open the page like a sidebar link. The pages, areas and numbers here are fixture data; "Divider" has no usage, so it sits in the final "Other" group.',
  a11y: 'The two tabs are a tablist; the chips report whether they are pressed; the table has real table, row and header roles with a link in each row; thumbnails are hidden from assistive technology and cannot be focused or clicked. Heat-cell text keeps at least 4.5:1 contrast on its shading.',
  variants: {
    itemsFill: true,
    items: [
      { key: 'components', name: 'Components tab (fixture data)', props: { tab: 'components' }, node: <Overview sections={SECTIONS} usage={USAGE} tab="components" /> },
      { key: 'usage', name: 'Usage tab (fixture data)', props: { tab: 'usage' }, node: <Overview sections={SECTIONS} usage={USAGE} tab="usage" /> },
    ],
  },
});
