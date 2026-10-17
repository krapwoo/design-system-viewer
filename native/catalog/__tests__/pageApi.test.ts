import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogSections, defineCatalogPage, validateComposedOf } from '../pageApi.ts';

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

test('validateComposedOf reports unknown component names deterministically, in declaration order', () => {
  const known = new Set(['Button', 'Icon']);
  assert.deepEqual(validateComposedOf(undefined, known), []);
  assert.deepEqual(validateComposedOf([{ component: 'Button', role: 'r', relationship: 'built-in' }], known), []);
  assert.deepEqual(
    validateComposedOf(
      [
        { component: 'Ghost', role: 'r1', relationship: 'slot' },
        { component: 'Icon', role: 'r2', relationship: 'built-in' },
        { component: 'Ghost2', role: 'r3', relationship: 'related' },
      ],
      known,
    ),
    ['composedOf references unknown component "Ghost".', 'composedOf references unknown component "Ghost2".'],
  );
});

test('buildCatalogSections carries composedOf metadata through to the section', () => {
  const composedOf = [{ component: 'Button', role: 'Primary action', relationship: 'built-in' as const }];
  const pages = [defineCatalogPage({ id: 'Toast', group: 'Components', description: 'x', composedOf })];
  const { sections } = buildCatalogSections(pages, [components[0]]);
  assert.deepEqual(sections.find((s) => s.id === 'Toast')?.composedOf, composedOf);
  assert.equal(sections.find((s) => s.id === 'Button')?.composedOf, undefined);
});

test('buildCatalogSections warns in development about an unknown composedOf name, not a known one', () => {
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message: string) => warnings.push(message);
  try {
    const composedOf = [
      { component: 'Button', role: 'Primary action', relationship: 'built-in' as const },
      { component: 'NoSuchThing', role: 'Ghost slot', relationship: 'related' as const },
    ];
    const pages = [defineCatalogPage({ id: 'Toast', group: 'Components', description: 'x', composedOf })];
    buildCatalogSections(pages, [components[0]]);
    assert.ok(warnings.some((w) => w.includes('composedOf') && w.includes('"NoSuchThing"')));
    assert.ok(!warnings.some((w) => w.includes('"Button"')));
  } finally {
    console.warn = originalWarn;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
});

test('buildCatalogSections carries intentionalStaticPreview through to the section (guided intelligence design §3)', () => {
  const pages = [defineCatalogPage({
    id: 'PillRow', group: 'Components', description: 'x',
    intentionalStaticPreview: { reason: 'Selection is already demonstrated by SegmentedToggle\'s working preview.' },
  })];
  const { sections } = buildCatalogSections(pages, []);
  assert.deepEqual(sections.find((s) => s.id === 'PillRow')?.intentionalStaticPreview, {
    reason: 'Selection is already demonstrated by SegmentedToggle\'s working preview.',
  });
  const undeclared = buildCatalogSections([defineCatalogPage({ id: 'Other', group: 'Components', description: 'x' })], []).sections[0];
  assert.equal(undeclared.intentionalStaticPreview, undefined);
});

test('buildCatalogSections carries previewLayout through to the section, omitted by default', () => {
  const pages = [
    defineCatalogPage({ id: 'Collapsible', group: 'Components', description: 'x', previewLayout: 'table' }),
    defineCatalogPage({ id: 'Button', group: 'Components', description: 'x' }),
  ];
  const { sections } = buildCatalogSections(pages, [components[0]]);
  assert.equal(sections.find((s) => s.id === 'Collapsible')?.previewLayout, 'table');
  assert.equal(sections.find((s) => s.id === 'Button')?.previewLayout, undefined);
});

const familyComponents = [
  {
    name: 'BotAnimatedFaceView',
    file: 'src/components/Bots/BotAnimatedFaceView.tsx',
    props: [{ name: 'expression', type: 'string', required: false, desc: 'Face expression.' }],
    inheritedFrom: [],
  },
];

function familyPage() {
  return defineCatalogPage({
    id: 'BotAvatarView',
    group: 'Components',
    description: 'A bot\'s avatar.',
    whole: 'BotAvatarView',
    sections: [
      { label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['BotAnimatedFaceView'] },
    ],
    members: [
      { id: 'BotAvatarView', source: 'BotAvatarView.swift:1', fidelity: 'approximated' as const, relationship: 'Main component', description: 'The whole.' },
      {
        id: 'BotAnimatedFaceView', component: 'BotAnimatedFaceView', source: 'BotFaceMotion.swift:1',
        fidelity: 'documentation-only' as const, relationship: 'Anatomy', parent: 'BotAvatarView', description: 'The face.',
      },
    ],
  });
}

test('buildCatalogSections: a page with members never looks up page.component ?? page.id for page-level props, even when a component happens to share the page id', () => {
  const coincidental = { name: 'BotAvatarView', file: 'src/components/BotAvatarView.tsx', props: [{ name: 'x', type: 'string', required: false, desc: 'x' }], inheritedFrom: [] };
  const { sections } = buildCatalogSections([familyPage()], [...familyComponents, coincidental]);
  assert.equal(sections[0].id, 'BotAvatarView');
  assert.equal(sections[0].props, undefined);
});

// V2c item 7: a detected component whose name collides with an authored page's own id (with no
// member naming it as `component`) must not silently win the id in `sections`/`groups` — skip the
// stub, and warn in development.
test('buildCatalogSections skips an undocumented-component stub whose id already belongs to an authored page, warning in development', () => {
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message: string) => warnings.push(message);
  try {
    // A family page never falls back to `page.component ?? page.id` for its own documented-ness
    // (spec §5.1) — so a detected component whose name coincidentally equals the family page's own
    // id, with no member naming it as `component`, would otherwise push a second, stub section
    // under the same id.
    const coincidental = { name: 'BotAvatarView', file: 'src/components/BotAvatarView.tsx', props: [], inheritedFrom: [] };
    const pages = [familyPage()];
    const { sections, groups } = buildCatalogSections(pages, [...familyComponents, coincidental]);
    assert.equal(sections.filter((s) => s.id === 'BotAvatarView').length, 1);
    assert.equal(sections.find((s) => s.id === 'BotAvatarView')?.description, 'A bot\'s avatar.');
    assert.deepEqual(groups, [{ label: 'Components', ids: ['BotAvatarView'] }]);
    assert.ok(warnings.some((w) => w.includes('BotAvatarView')));
  } finally {
    console.warn = originalWarn;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
});

// N2: the V2c item 7 stub-skip must work in production too — `seenIds` is consulted outside
// `__DEV__` (`:288` in the old code), so it must also be populated outside it, not only when
// `__DEV__` happens to be on.
test('buildCatalogSections skips an undocumented-component stub whose id belongs to an authored page, even with __DEV__ unset', () => {
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  delete (globalThis as { __DEV__?: boolean }).__DEV__;
  try {
    const coincidental = { name: 'BotAvatarView', file: 'src/components/BotAvatarView.tsx', props: [], inheritedFrom: [] };
    const pages = [familyPage()];
    const { sections, groups } = buildCatalogSections(pages, [...familyComponents, coincidental]);
    assert.equal(sections.filter((s) => s.id === 'BotAvatarView').length, 1);
    assert.equal(sections.find((s) => s.id === 'BotAvatarView')?.description, 'A bot\'s avatar.');
    assert.deepEqual(groups, [{ label: 'Components', ids: ['BotAvatarView'] }]);
  } finally {
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
});

// The runtime computes `hasSpecimens` itself, so the list-section rule reaches the development
// console as well as doctor.
test('buildCatalogSections reports a list-section member with specimens in development', () => {
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => errors.push(message);
  try {
    const page = defineCatalogPage({
      id: 'BotAvatarView',
      group: 'Components',
      description: 'A bot\'s avatar.',
      whole: 'BotAvatarView',
      sections: [{ label: 'Helpers', kind: 'list' as const, members: ['BotAnimatedFaceView'] }],
      members: [
        { id: 'BotAvatarView', source: 'BotAvatarView.swift:1', fidelity: 'approximated' as const, relationship: 'Main component', description: 'The whole.' },
        {
          id: 'BotAnimatedFaceView', source: 'BotFaceMotion.swift:1', fidelity: 'approximated' as const, relationship: 'Helper',
          description: 'The face.', states: { items: [{ key: 'a', label: 'A', node: null }] },
        },
      ],
    });
    buildCatalogSections([page], familyComponents);
    assert.ok(errors.some((e) => e.includes('"BotAnimatedFaceView" has specimens, but list sections')), errors.join('\n'));
  } finally {
    console.error = originalError;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
});

test('buildCatalogSections: a member\'s component is documented, suppressing its "No examples documented." stub', () => {
  const { sections } = buildCatalogSections([familyPage()], familyComponents);
  assert.equal(sections.some((s) => s.id === 'BotAnimatedFaceView'), false);
});

test('buildCatalogSections: each member\'s props come from its own component', () => {
  const { sections } = buildCatalogSections([familyPage()], familyComponents);
  const family = sections.find((s) => s.id === 'BotAvatarView')?.family;
  const face = family?.members.find((m) => m.id === 'BotAnimatedFaceView');
  assert.deepEqual(face?.props, [{ name: 'expression', type: 'string', required: false, default: undefined, desc: 'Face expression.' }]);
  const whole = family?.members.find((m) => m.id === 'BotAvatarView');
  assert.equal(whole?.props, undefined);
});

test('buildCatalogSections: a member\'s path is its component file, else its source', () => {
  const { sections } = buildCatalogSections([familyPage()], familyComponents);
  const family = sections.find((s) => s.id === 'BotAvatarView')?.family;
  assert.equal(family?.members.find((m) => m.id === 'BotAnimatedFaceView')?.path, 'src/components/Bots/BotAnimatedFaceView.tsx');
  assert.equal(family?.members.find((m) => m.id === 'BotAvatarView')?.path, 'BotAvatarView.swift:1');
});

// V2d item 4: a member's own `composedOf` is carried through to `FamilyDef.members`, the same way
// every other member field already is.
test('buildCatalogSections: a member\'s composedOf is carried through to the section', () => {
  const composedOf = [{ component: 'Button', role: 'Primary action', relationship: 'built-in' as const }];
  const page = { ...familyPage(), members: familyPage().members!.map((m) => (m.id === 'BotAnimatedFaceView' ? { ...m, composedOf } : m)) };
  const { sections } = buildCatalogSections([page], familyComponents);
  const family = sections.find((s) => s.id === 'BotAvatarView')?.family;
  assert.deepEqual(family?.members.find((m) => m.id === 'BotAnimatedFaceView')?.composedOf, composedOf);
});

// V2d item 4: `buildCatalogSections` runs `validateComposedOf` on each member's own `composedOf`
// too, with every member id (not just component names and page ids) added to the known names —
// here `ToastHelper` is neither, only a sibling member's own id.
test('buildCatalogSections warns in development about an unknown composedOf name on a member, and accepts a sibling member\'s id', () => {
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message: string) => warnings.push(message);
  try {
    const page = defineCatalogPage({
      id: 'Toast', group: 'Patterns', description: 'x',
      whole: 'Toast',
      sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['ToastHelper'] }],
      members: [
        {
          id: 'Toast', source: 'x:1', fidelity: 'documentation-only' as const, relationship: 'Main pattern', description: 'd',
          composedOf: [
            { component: 'ToastHelper', role: 'Helper', relationship: 'built-in' as const },
            { component: 'NoSuchThing', role: 'Ghost', relationship: 'related' as const },
          ],
        },
        { id: 'ToastHelper', source: 'x:2', fidelity: 'documentation-only' as const, relationship: 'Helper', description: 'd' },
      ],
    });
    buildCatalogSections([page], []);
    assert.ok(warnings.some((w) => w.includes('composedOf') && w.includes('"NoSuchThing"')));
    assert.ok(!warnings.some((w) => w.includes('"ToastHelper"')));
  } finally {
    console.warn = originalWarn;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
});

// N8: a composedOf entry naming a member's own alias must resolve — `FamilyPage`'s own link
// resolution (`resolvesAddress`, built from `aliasTargets`) already accepts member aliases, so the
// dev-console unknown-name check must accept the same universe, not warn about a name that
// actually renders as a working link.
test('buildCatalogSections does not warn about a composedOf name that is a member\'s own alias', () => {
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message: string) => warnings.push(message);
  try {
    const page = defineCatalogPage({
      id: 'Toast', group: 'Patterns', description: 'x',
      whole: 'Toast',
      sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['ToastBanner'] }],
      members: [
        {
          id: 'Toast', source: 'x:1', fidelity: 'documentation-only' as const, relationship: 'Main pattern', description: 'd',
          composedOf: [{ component: 'ToastBannerAlias', role: 'Helper', relationship: 'built-in' as const }],
        },
        {
          id: 'ToastBanner', source: 'x:2', fidelity: 'documentation-only' as const, relationship: 'Helper', description: 'd',
          aliases: ['ToastBannerAlias'],
        },
      ],
    });
    buildCatalogSections([page], []);
    assert.ok(!warnings.some((w) => w.includes('ToastBannerAlias')));
  } finally {
    console.warn = originalWarn;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
});

// N8: same for a page-level alias (a retired page id, not a member id at all).
test('buildCatalogSections does not warn about a composedOf name that is another page\'s own alias', () => {
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message: string) => warnings.push(message);
  try {
    const oldPage = defineCatalogPage({
      id: 'Toast', group: 'Patterns', description: 'x',
      whole: 'Toast',
      aliases: ['OldToast'],
      sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['ToastBanner'] }],
      members: [
        { id: 'Toast', source: 'x:1', fidelity: 'documentation-only' as const, relationship: 'Main pattern', description: 'd' },
        { id: 'ToastBanner', source: 'x:2', fidelity: 'documentation-only' as const, relationship: 'Helper', description: 'd' },
      ],
    });
    const otherPage = defineCatalogPage({
      id: 'Other', group: 'Patterns', description: 'x',
      composedOf: [{ component: 'OldToast', role: 'Helper', relationship: 'related' as const }],
    });
    buildCatalogSections([oldPage, otherPage], []);
    assert.ok(!warnings.some((w) => w.includes('OldToast')));
  } finally {
    console.warn = originalWarn;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
});

test('buildCatalogSections: the section\'s family carries the outline and the authored sections/whole', () => {
  const { sections } = buildCatalogSections([familyPage()], familyComponents);
  const family = sections.find((s) => s.id === 'BotAvatarView')?.family;
  assert.equal(family?.whole, 'BotAvatarView');
  assert.deepEqual(family?.outline.get('BotAnimatedFaceView'), { number: '1.1', level: 2 });
  assert.deepEqual(family?.sections, [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['BotAnimatedFaceView'] }]);
});

// V2c item 13: a full-object comparison, not just "family is undefined" — a page without
// `members` must produce exactly the section buildCatalogSections has always produced for it.
test('buildCatalogSections: a page without members gives a byte-identical section to today\'s', () => {
  const pages = [defineCatalogPage({ id: 'Button', group: 'Components', description: 'Press it.' })];
  const { sections } = buildCatalogSections(pages, [components[0]]);
  assert.deepEqual(sections[0], {
    id: 'Button',
    title: undefined,
    osComponent: undefined,
    description: 'Press it.',
    path: 'src/components/Button/index.ts',
    whenToUse: undefined,
    props: [{ name: 'label', type: 'string', required: false, default: "'Button'", desc: 'Button label.' }],
    a11y: undefined,
    variants: undefined,
    states: undefined,
    render: undefined,
    tokenGallery: undefined,
    tokenSections: undefined,
    tokenColumns: undefined,
    fullWidthLabel: undefined,
    comparison: undefined,
    specimenSize: undefined,
    specimenSurface: undefined,
    previewWidths: undefined,
    previewLayout: undefined,
    hide: undefined,
    composedOf: undefined,
    internalProps: undefined,
    intentionalStaticPreview: undefined,
    family: undefined,
  });
});

test('buildCatalogSections: family validation issues reach console.error in development', () => {
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => errors.push(message);
  try {
    const invalid = defineCatalogPage({
      id: 'BotAvatarView',
      group: 'Components',
      description: 'A bot\'s avatar.',
      whole: 'NoSuchMember',
      sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: [] }],
      members: [{ id: 'BotAvatarView', source: 'x:1', fidelity: 'approximated' as const, relationship: 'Main component', description: 'The whole.' }],
    });
    buildCatalogSections([invalid], []);
    assert.ok(errors.some((e) => e.startsWith('[Catalog] ') && e.includes('is not one of its members')));
  } finally {
    console.error = originalError;
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
