import React from 'react';
import { Text } from 'react-native';
import { CATALOG_COLOR, CATALOG_TEXT, Overview, defineCatalogPage } from '@krapwoo/ds-viewer';
import type { SectionDef, UsageData, UsageUse } from '@krapwoo/ds-viewer';

// Fixture pages and usage, invented for this page: not read from any project's usage file.
const chip = (label: string) => <Text style={{ ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.accent }}>{label}</Text>;
// Built by hand (not `defineCatalogPage`, which only runs for an authored page in a real catalog).
const fixturePage = (id: string, title?: string): SectionDef => ({
  id, ...(title && { title }), description: `${id} (fixture).`, path: `fixture/${id}.tsx`,
  variants: { items: [{ key: 'a', name: 'Default', node: chip(id) }] },
});
const SECTIONS = [fixturePage('Chip'), fixturePage('Banner', 'Notification banner with an action and a dismiss button'), fixturePage('Toggle'), fixturePage('Avatar'), fixturePage('Divider')];

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
  description: 'A map of the catalog for designers: every page with something to show as a card with a live, scaled-down thumbnail of its first specimen, grouped by the area it lives in, with area filter chips and a "By area" / "Most used" sort. A card opens the page like a sidebar link. Every card is the same height: a title takes up to two lines (Banner\'s does) and the room for the "Shared across areas" tag is always kept. The pages, areas and numbers here are fixture data; "Divider" has no usage, so it sits in the final "Other" group.',
  a11y: 'The chips report whether they are pressed; each card has one tab stop, its title link, and the full title stays the link\'s name when it is cut to two lines; thumbnails are hidden from assistive technology and cannot be focused or clicked.',
  variants: {
    itemsFill: true,
    items: [
      { key: 'components', name: 'Components (fixture data)', node: <Overview sections={SECTIONS} usage={USAGE} /> },
    ],
  },
});
