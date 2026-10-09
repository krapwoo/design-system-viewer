import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogSections, defineCatalogPage } from '../pageApi.ts';

const components = [
  {
    name: 'Button',
    file: 'src/components/Button/index.ts',
    props: [{ name: 'label', type: 'string', required: false, default: "'Button'", desc: 'Button label.' }],
    inheritedFrom: [],
  },
  {
    name: 'Badge',
    file: 'src/components/Badge/index.ts',
    props: [{ name: 'label', type: 'string', required: true, desc: "The badge's text." }],
    inheritedFrom: [],
  },
];

test('defineCatalogPage returns its input tagged as a page', () => {
  const page = defineCatalogPage({ id: 'Button', group: 'Components', description: 'Press it.' });
  assert.equal(page.id, 'Button');
  assert.equal(page.__dsViewerPage, true);
});

test('buildCatalogSections attaches generated props to a documented component', () => {
  const pages = [defineCatalogPage({ id: 'Button', group: 'Components', description: 'Press it.' })];
  const { sections, groups } = buildCatalogSections(pages, [components[0]]);
  const button = sections.find((s) => s.id === 'Button');
  assert.equal(button?.path, 'src/components/Button/index.ts');
  assert.deepEqual(button?.props, [{ name: 'label', type: 'string', required: false, default: "'Button'", desc: 'Button label.' }]);
  assert.deepEqual(groups, [{ label: 'Components', ids: ['Button'] }]);
});

test('buildCatalogSections merges propNotes into a prop\'s description', () => {
  const pages = [defineCatalogPage({ id: 'Button', group: 'Components', description: 'Press it.', propNotes: { label: 'Keep it short.' } })];
  const { sections } = buildCatalogSections(pages, [components[0]]);
  assert.equal(sections[0].props?.[0].desc, 'Button label. Keep it short.');
});

test('buildCatalogSections adds an undocumented component under "Components" with no page', () => {
  const { sections, groups } = buildCatalogSections([], components);
  const badge = sections.find((s) => s.id === 'Badge');
  assert.equal(badge?.description, 'No examples documented.');
  assert.equal(badge?.path, 'src/components/Badge/index.ts');
  assert.deepEqual(groups, [{ label: 'Components', ids: ['Badge', 'Button'] }]);
});

test('buildCatalogSections honors a page\'s own component name and groupOrder', () => {
  const pages = [defineCatalogPage({ id: 'ButtonOverview', component: 'Button', group: 'Guides', description: 'Overview.' })];
  const { groups } = buildCatalogSections(pages, components, ['Guides', 'Components']);
  assert.deepEqual(groups, [{ label: 'Guides', ids: ['ButtonOverview'] }, { label: 'Components', ids: ['Badge'] }]);
});

test('buildCatalogSections hides the Props box and uses the page file as the Source for a standalone page', () => {
  const pages = [{ ...defineCatalogPage({ id: 'Overview', group: 'Guides', description: 'Welcome.' }), file: 'src/pages/Overview.catalog.tsx' }];
  const { sections } = buildCatalogSections(pages, components);
  const overview = sections.find((s) => s.id === 'Overview');
  assert.equal(overview?.path, 'src/pages/Overview.catalog.tsx');
  assert.equal(overview?.hide?.props, true);
  assert.equal(overview?.props, undefined);
});

test('buildCatalogSections summarises props inherited from node_modules as one row per source (design §3)', () => {
  const searchField = {
    name: 'SearchField',
    file: 'src/components/SearchField/index.ts',
    props: [{ name: 'iconName', type: 'IconName', required: false, desc: 'Leading icon.' }],
    inheritedFrom: ['TextInput'],
  };
  const pages = [defineCatalogPage({ id: 'SearchField', group: 'Inputs', description: 'Search.' })];
  const { sections } = buildCatalogSections(pages, [searchField]);
  assert.deepEqual(sections[0].props?.map((p) => p.name), ['iconName', 'TextInput props']);
  assert.deepEqual(sections[0].props?.[1], {
    name: 'TextInput props',
    type: 'inherited',
    required: true,
    desc: 'Plus all TextInput props, not listed individually.',
  });
  const undocumented = buildCatalogSections([], [searchField]).sections[0];
  assert.equal(undocumented.props?.at(-1)?.name, 'TextInput props');
});

test('buildCatalogSections warns in development when two pages resolve to the same id', () => {
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message: string) => warnings.push(message);
  try {
    const pageA = { ...defineCatalogPage({ id: 'Same', group: 'Components', description: 'A' }), file: 'a.catalog.tsx' };
    const pageB = { ...defineCatalogPage({ id: 'Same', group: 'Components', description: 'B' }), file: 'b.catalog.tsx' };
    buildCatalogSections([pageA, pageB], []);
    assert.ok(warnings.some((w) => w.includes('Page id "Same"')));
  } finally {
    console.warn = originalWarn;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
});

test('buildCatalogSections carries a display title, a source override, and the OS-component marker', () => {
  const pages = [
    { ...defineCatalogPage({ id: 'ControlHeights', title: 'Control heights', source: 'src/tokens.ts', group: 'Tokens', description: 'x', tokenGallery: true }), file: 'pages/ControlHeights.catalog.tsx' },
    { ...defineCatalogPage({ id: 'Button', group: 'Components', description: 'x', osComponent: 'partial' }), file: 'pages/Button.catalog.tsx' },
  ];
  const { sections } = buildCatalogSections(pages, [components[0]]);
  const heights = sections.find((s) => s.id === 'ControlHeights')!;
  assert.equal(heights.title, 'Control heights');
  assert.equal(heights.path, 'src/tokens.ts');
  const button = sections.find((s) => s.id === 'Button')!;
  assert.equal(button.osComponent, 'partial');
  assert.equal(button.title, undefined);
  // A component's own file stays its Source; `source` only overrides it when the page sets one.
  assert.equal(button.path, components[0].file);
});
