import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HEAT_OPACITIES,
  OVERVIEW_OTHER,
  blend,
  buildOverviewPages,
  chipAreas,
  contrastRatio,
  filterPages,
  groupByHome,
  heatOpacity,
  heatStyle,
  homeLine,
  orderAreas,
  qualifiesForOverview,
  sortByUses,
  thumbnailScale,
  tableAreas,
  thumbnailSource,
  tokenGroupIds,
  usageLine,
  usageRows,
  type OverviewPage,
} from '../overviewModel.ts';
import { OVERVIEW_PAGE_ID, overviewHash, overviewTabFromFragment, resolveRoute } from '../catalogNavigation.ts';
import { countUsesByArea, findUsage, usageByArea } from '../usage.ts';
import { CATALOG_COLOR } from '../tokens.ts';
import type { SectionDef } from '../types.ts';
import type { UsageData, UsageUse } from '../usage.ts';

const HELPERS = { find: findUsage, countByArea: countUsesByArea };
const NODE = 'specimen';
const item = (key: string) => ({ key, name: key, node: NODE });
const page = (id: string, extra: Partial<SectionDef> = {}): SectionDef => ({ id, description: '', path: `${id}.tsx`, ...extra });
const usesIn = (area: string, count: number): UsageUse[] => Array.from({ length: count }, (_, i) => ({ area, file: `${area}${i}.swift` }));

const SECTIONS: SectionDef[] = [
  page('Chip', { variants: { items: [item('a')] } }),
  page('Banner', { states: { items: [item('s')] } }),
  page('Grid', { comparison: { rowLabel: 'r', columnLabel: 'c', rows: [], columns: [], cells: [{ rowKey: 'a', columnKey: 'b', node: NODE }] } }),
  page('Gallery', { render: () => NODE }),
  page('Colors', { tokenGallery: true, render: () => NODE }),
  page('Sizes', { tokenSections: [{ title: 'Sizes', render: () => NODE }], variants: { items: [item('a')] } }),
  page('Empty'),
  page('NoCells', { comparison: { rowLabel: 'r', columnLabel: 'c', rows: [], columns: [], cells: [{ rowKey: 'a', columnKey: 'b', unavailableReason: 'none' }] } }),
  page('Card', {
    family: {
      whole: 'Card', outline: new Map(), sections: [],
      members: [
        { id: 'Card', source: 'c:1', path: 'c:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'w' },
        { id: 'CardHeader', source: 'c:2', path: 'c:2', fidelity: 'replicated', relationship: 'Part', description: 'h', variants: { items: [item('h')] } },
      ],
    },
  }),
];

test('qualification: a specimen of any kind qualifies, token pages and empty pages do not', () => {
  const byId = new Map(SECTIONS.map((def) => [def.id, qualifiesForOverview(def)]));
  assert.deepEqual([...byId].filter(([, ok]) => ok).map(([id]) => id), ['Chip', 'Banner', 'Grid', 'Gallery', 'Colors', 'Card']);
  assert.equal(byId.get('Colors'), true, 'a tokenGallery page outside the Tokens group is only a layout choice');
  assert.equal(byId.get('Sizes'), false, 'a token page even with a variants list');
  assert.equal(byId.get('Empty'), false, 'nothing to show');
  assert.equal(byId.get('NoCells'), false, 'a comparison whose cells are all unavailable');
});

test('a tokenGallery page is a token page only in the Tokens group; tokenSections/tokenDefinition always are', () => {
  const colors = SECTIONS.find((def) => def.id === 'Colors')!;
  const screen = page('Screen', { tokenGallery: true, render: () => NODE });
  const groups = [{ label: 'Components', ids: ['Chip', 'Screen'] }, { label: ' Tokens ', ids: ['Colors'] }];
  const tokenIds = tokenGroupIds(groups);
  assert.deepEqual([...tokenIds], ['Colors']);
  assert.equal(qualifiesForOverview(colors, { inTokenGroup: tokenIds.has('Colors') }), false);
  assert.equal(qualifiesForOverview(screen, { inTokenGroup: tokenIds.has('Screen') }), true, 'a full-width pattern screen keeps its card');
  assert.equal(qualifiesForOverview(page('Defined', { tokenDefinition: {} as never, variants: { items: [item('a')] } })), false);
  const built = buildOverviewPages([colors, screen], { version: 1, components: {} }, HELPERS, { tokenIds });
  assert.deepEqual(built.map((entry) => entry.id), ['Screen']);
});

test('the thumbnail lays out at the page\'s first preview width and on its surface; plain pages carry neither', () => {
  const sized = page('Wide', { previewWidths: [768, 402], specimenSurface: 'dark' as never, variants: { items: [item('a')] } });
  assert.deepEqual(thumbnailSource(sized), { node: NODE, width: 768, surface: 'dark' });
  assert.deepEqual(thumbnailSource(page('Full', { previewWidths: 'full', variants: { items: [item('a')] } })), { node: NODE, width: 720 });
  assert.deepEqual(thumbnailSource(page('Dflt', { variants: { items: [item('a')] } }), { defaultPreviewWidths: [320] }), { node: NODE, width: 320 });
  assert.deepEqual(thumbnailSource(page('Plain', { variants: { items: [item('a')] } })), { node: NODE });
  const own = page('Own', { specimenSurface: 'dark' as never, variants: { items: [{ ...item('a'), surface: 'light' as never }] } });
  assert.deepEqual(thumbnailSource(own), { node: NODE, surface: 'light' }, 'the specimen\'s own surface wins');
  const family = page('Fam', {
    previewWidths: [500],
    family: { whole: 'Fam', outline: new Map(), sections: [], members: [{ id: 'FamPart', source: 'c', path: 'c', fidelity: 'replicated', relationship: 'Part', description: 'p', previewWidths: [900], variants: { items: [item('a')] } }] },
  });
  assert.deepEqual(thumbnailSource(family), { node: NODE, width: 900 }, 'the member\'s width beats the page\'s');
});

test('a real area named "Other" keeps its own group, apart from the home-less one', () => {
  const sections = [page('A', { variants: { items: [item('a')] } }), page('B', { variants: { items: [item('a')] } })];
  const data: UsageData = { version: 1, components: { A: { area: 'Other', uses: usesIn('Other', 2) } } };
  const pages = buildOverviewPages(sections, data, HELPERS);
  const order = orderAreas(undefined, pages);
  assert.deepEqual(order, ['Other'], 'the real area stays in the order');
  assert.deepEqual(chipAreas(pages, order), ['Other']);
  assert.deepEqual(tableAreas(usageRows(pages, 'shared'), order), ['Other']);
  const groups = groupByHome(pages, order);
  assert.deepEqual(groups.map((g) => [g.area, g.fallback ?? false, g.pages.map((p) => p.id)]), [['Other', false, ['A']], [OVERVIEW_OTHER, true, ['B']]]);
});

test('tied areas are ordered the same way in an Overview card and in the Appears-in block', () => {
  const uses = [...usesIn('émile', 2), ...usesIn('Zeta', 2), ...usesIn('alpha', 2), ...usesIn('Zebra', 2)];
  const pages = buildOverviewPages([page('T', { variants: { items: [item('a')] } })], { version: 1, components: { T: { area: 'x', uses } } }, HELPERS);
  assert.deepEqual(pages[0].byArea, usageByArea({ uses }), 'one comparator for both');
});

test('the thumbnail is the first variant, else first state, else first cell, else render(); a family uses its first member with a specimen', () => {
  const both = page('Both', { variants: { items: [{ key: 'v', name: 'v', node: 'variant' }] }, states: { items: [{ key: 's', name: 's', node: 'state' }] } });
  assert.deepEqual(thumbnailSource(both), { node: 'variant' });
  assert.deepEqual(thumbnailSource(page('S', { states: { items: [{ key: 's', name: 's', node: 'state' }] } })), { node: 'state' });
  const render = () => 'r';
  assert.deepEqual(thumbnailSource(page('R', { render })), { render });
  assert.deepEqual(thumbnailSource(SECTIONS.find((def) => def.id === 'Card')!), { node: NODE }, 'skips the whole, which has none');
});

const DATA: UsageData = {
  version: 1,
  areas: ['Chat', 'Bots', 'Settings'],
  components: {
    Chip: { area: 'Chat', uses: [...usesIn('Chat', 3), ...usesIn('Bots', 2)] },
    Banner: { area: 'Bots', uses: usesIn('Bots', 4) },
    Grid: { area: 'Zeta', uses: usesIn('Chat', 1) },
    CardHeader: { area: 'Settings', uses: usesIn('Settings', 9) },
    Colors: { area: 'Chat', uses: usesIn('Chat', 50) },
  },
};

function build(): OverviewPage[] {
  return buildOverviewPages(SECTIONS, DATA, HELPERS, { tokenIds: new Set(['Colors']) });
}

test('pages carry home area, counts by area and the shared flag', () => {
  const pages = new Map(build().map((entry) => [entry.id, entry]));
  assert.deepEqual([...pages.keys()], ['Chip', 'Banner', 'Grid', 'Gallery', 'Card']);
  const chip = pages.get('Chip')!;
  assert.equal(chip.home, 'Chat');
  assert.equal(chip.uses, 5);
  assert.deepEqual(chip.byArea, [{ area: 'Chat', count: 3 }, { area: 'Bots', count: 2 }]);
  assert.equal(chip.shared, true);
  assert.equal(pages.get('Banner')!.shared, false, 'used only in its home area');
  assert.equal(pages.get('Grid')!.shared, true, 'a home area of its own, used elsewhere');
  const card = pages.get('Card')!;
  assert.equal(card.home, 'Settings', 'a family takes usage from its members');
  assert.equal(card.uses, 9);
  const gallery = pages.get('Gallery')!;
  assert.equal(gallery.hasUsage, false);
  assert.equal(gallery.home, undefined);
  assert.equal(gallery.shared, false);
});

test('a page matches usage by its component name, and a key shared by page and member counts once', () => {
  const sections = [page('ChipPage', { component: 'Chip', variants: { items: [item('a')] } })];
  assert.equal(buildOverviewPages(sections, DATA, HELPERS)[0].uses, 5);
  const entry = { area: 'A', uses: usesIn('A', 2) };
  const family = page('F', { component: 'F', family: { whole: 'F', outline: new Map(), sections: [], members: [{ id: 'F', component: 'F', source: 's', path: 's', fidelity: 'replicated', relationship: 'Whole', description: 'd', variants: { items: [item('a')] } }] } });
  assert.equal(buildOverviewPages([family], { version: 1, components: { F: entry } }, HELPERS)[0].uses, 2);
});

test('browsable drops pages the sidebar does not list', () => {
  assert.deepEqual(buildOverviewPages(SECTIONS, DATA, HELPERS, { browsable: new Set(['Chip', 'Banner']) }).map((p) => p.id), ['Chip', 'Banner']);
});

test('areas: declared order, then any other area alphabetically', () => {
  assert.deepEqual(orderAreas(DATA.areas, build()), ['Chat', 'Bots', 'Settings', 'Zeta']);
  assert.deepEqual(orderAreas(undefined, build()), ['Bots', 'Chat', 'Settings', 'Zeta']);
});

test('grouping: areas in order, alphabetical within, pages without a home in a final "Other"', () => {
  const pages = build();
  const groups = groupByHome(pages, orderAreas(DATA.areas, pages));
  assert.deepEqual(groups.map((g) => [g.area, g.pages.map((p) => p.id)]), [
    ['Chat', ['Chip']],
    ['Bots', ['Banner']],
    ['Settings', ['Card']],
    ['Zeta', ['Grid']],
    [OVERVIEW_OTHER, ['Gallery']],
  ]);
  const same = groupByHome([...pages].reverse(), ['Chat']);
  assert.equal(same.at(-1)!.area, OVERVIEW_OTHER);
  const crowded = buildOverviewPages(
    [page('Zed', { variants: { items: [item('a')] } }), page('alpha', { variants: { items: [item('a')] } })],
    { version: 1, components: { Zed: { area: 'A', uses: [] }, alpha: { area: 'A', uses: [] } } },
    HELPERS,
  );
  assert.deepEqual(groupByHome(crowded, ['A'])[0].pages.map((p) => p.id), ['alpha', 'Zed'], 'case-insensitive title order');
});

test('filters: all, one home area, and shared across areas; chips list only areas that are a home', () => {
  const pages = build();
  assert.equal(filterPages(pages, { kind: 'all' }).length, 5);
  assert.deepEqual(filterPages(pages, { kind: 'area', area: 'Chat' }).map((p) => p.id), ['Chip']);
  assert.deepEqual(filterPages(pages, { kind: 'shared' }).map((p) => p.id), ['Chip', 'Grid']);
  assert.deepEqual(chipAreas(pages, ['Chat', 'Bots', 'Unused', 'Settings', 'Zeta']), ['Chat', 'Bots', 'Settings', 'Zeta']);
});

test('sorts: most used is flat and descending; the table sorts by areas or by uses', () => {
  const pages = build();
  assert.deepEqual(sortByUses(pages).map((p) => p.id), ['Card', 'Chip', 'Banner', 'Grid', 'Gallery']);
  assert.deepEqual(usageRows(pages, 'shared').map((p) => p.id), ['Chip', 'Card', 'Banner', 'Grid'], 'two areas first, then by uses; no uses, no row');
  assert.deepEqual(usageRows(pages, 'used').map((p) => p.id), ['Card', 'Chip', 'Banner', 'Grid']);
  assert.deepEqual(tableAreas(usageRows(pages, 'used'), ['Chat', 'Bots', 'Settings', 'Zeta', 'Nobody']), ['Chat', 'Bots', 'Settings']);
});

test('copy: usage line and home line', () => {
  assert.equal(usageLine({ hasUsage: true, uses: 17, byArea: Array.from({ length: 7 }, (_, i) => ({ area: `A${i}`, count: 1 })) }), '17 uses · 7 areas');
  assert.equal(usageLine({ hasUsage: true, uses: 52, byArea: [{ area: 'Settings', count: 52 }] }), '52 uses · Settings only');
  assert.equal(usageLine({ hasUsage: true, uses: 1, byArea: [{ area: 'Chat', count: 1 }] }), '1 use · Chat only');
  assert.equal(usageLine({ hasUsage: true, uses: 0, byArea: [] }), 'No uses yet');
  assert.equal(usageLine({ hasUsage: false, uses: 0, byArea: [] }), 'No usage recorded');
  assert.equal(homeLine({ uses: 52, home: 'Chat' }), '52 uses · home: Chat');
  assert.equal(homeLine({ uses: 1, home: undefined }), '1 use');
});

test('heat: the biggest count is the darkest step, steps never decrease, zero has none', () => {
  assert.equal(heatOpacity(0, 10), 0);
  assert.equal(heatOpacity(10, 10), HEAT_OPACITIES.at(-1));
  assert.equal(heatOpacity(1, 100), HEAT_OPACITIES[0]);
  let last = 0;
  for (let count = 1; count <= 40; count += 1) {
    const opacity = heatOpacity(count, 40);
    assert.ok(opacity >= last, `non-decreasing at ${count}`);
    last = opacity;
  }
});

test('heat: a hovered row (surfacePressed) behind the cell still leaves every step at 4.5:1', () => {
  // The chip's background is the accent at an opacity, so on a hovered row it blends over
  // `surfacePressed` rather than white; the text colour is still picked against white, so check it.
  const hovered = { ...CATALOG_COLOR, surface: CATALOG_COLOR.surfacePressed };
  for (const opacity of HEAT_OPACITIES) {
    const style = heatStyle(Math.round(opacity * 1000), 1000, hovered);
    assert.ok(style.contrast >= 4.5, `opacity ${opacity} over surfacePressed: ${style.contrast.toFixed(2)}:1`);
  }
});

test('heat: every step keeps its text at 4.5:1 or better', () => {
  for (const opacity of HEAT_OPACITIES) {
    const count = Math.round(opacity * 1000);
    const style = heatStyle(count, 1000, CATALOG_COLOR);
    assert.equal(style.opacity, opacity);
    assert.ok(style.contrast >= 4.5, `opacity ${opacity}: ${style.contrast.toFixed(2)}:1`);
  }
  for (const max of [1, 2, 3, 7, 40, 500]) {
    for (let count = 1; count <= max; count += 1) assert.ok(heatStyle(count, max, CATALOG_COLOR).contrast >= 4.5, `${count}/${max}`);
  }
  // The contrast number really is the text on the blended background, not a constant.
  const style = heatStyle(1, 1, CATALOG_COLOR);
  const textRgb = style.color === '#ffffff' ? [255, 255, 255] as const : [24, 24, 24] as const;
  assert.ok(Math.abs(contrastRatio(textRgb, blend([23, 77, 198], style.opacity, [255, 255, 255])) - style.contrast) < 1e-9);
  assert.equal(heatStyle(1, 1000, CATALOG_COLOR).color, '#181818', 'light cells take dark text');
  assert.equal(heatStyle(1000, 1000, CATALOG_COLOR).color, '#ffffff', 'the darkest cell takes white text');
});

test('addresses: the two tabs, and the route only resolves with usage data', () => {
  assert.equal(overviewHash('components'), `#${OVERVIEW_PAGE_ID}`);
  assert.equal(overviewHash('usage'), `#${OVERVIEW_PAGE_ID}/usage`);
  assert.equal(overviewTabFromFragment('ds-viewer-overview'), 'components');
  assert.equal(overviewTabFromFragment('ds-viewer-overview/usage'), 'usage');
  assert.equal(overviewTabFromFragment('ds-viewer-overview/other'), undefined);
  const none = new Map();
  assert.deepEqual(resolveRoute('#ds-viewer-overview/usage', ['A'], none, true), { kind: 'overview', tab: 'usage' });
  assert.deepEqual(resolveRoute('#ds-viewer-overview%2Fusage', ['A'], none, true), { kind: 'overview', tab: 'usage' });
  assert.deepEqual(resolveRoute('#ds-viewer-overview', ['A'], none, true), { kind: 'overview', tab: 'components' });
  assert.deepEqual(resolveRoute('#ds-viewer-overview', ['A'], none), { kind: 'notFound', raw: 'ds-viewer-overview' });
  assert.deepEqual(resolveRoute('#ds-viewer-overview/usage', ['A'], none, false), { kind: 'notFound', raw: 'ds-viewer-overview/usage' });
});

test('thumbnailScale shrinks to fit and never enlarges', () => {
  assert.equal(thumbnailScale({ width: 400, height: 100 }, { width: 216, height: 132 }, 8), 200 / 400);
  assert.equal(thumbnailScale({ width: 100, height: 400 }, { width: 300, height: 132 }, 8), 116 / 400);
  assert.equal(thumbnailScale({ width: 50, height: 20 }, { width: 300, height: 132 }, 8), 1);
  assert.equal(thumbnailScale({ width: 0, height: 0 }, { width: 300, height: 132 }, 8), 1, 'not measured yet');
});
