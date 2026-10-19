import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogSections, defineCatalogPage, numberFor, validateComposedOf, validateFamily } from '../pageApi.ts';
import { alsoUsedBySegments } from '../familyModel.ts';

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

// "Also used by" (derived, never authored): `buildCatalogSections` inverts every catalog-wide
// `composedOf` declaration with `relationship: 'built-in'` — the forward direction renders as
// "Uses X" (`UsesLine`); this is that same relationship read from the other end, so a page's own
// `composedOf` is the only way this data ever gets authored — `alsoUsedBy` itself has no input
// field anywhere.

// Reverting the whole feature (removing the `alsoUsedBy` computation) fails every test below: each
// one asserts a non-trivial `alsoUsedBy` value that a no-op/undefined field would not match.
test('buildCatalogSections: a member with no users gets an empty alsoUsedBy', () => {
  const { sections } = buildCatalogSections([familyPage()], familyComponents);
  const family = sections.find((s) => s.id === 'BotAvatarView')?.family;
  assert.deepEqual(family?.members.find((m) => m.id === 'BotAnimatedFaceView')?.alsoUsedBy, []);
});

// Breaks if the inverse index stops attributing a page-level `composedOf` entry to that page's own
// id, or stops carrying its `role` through.
test('buildCatalogSections: alsoUsedBy derives a single outside user with its role', () => {
  const dock = defineCatalogPage({
    id: 'Dock', group: 'Components', description: 'd',
    composedOf: [{ component: 'BotAnimatedFaceView', role: 'Header icon', relationship: 'built-in' as const }],
  });
  const { sections } = buildCatalogSections([familyPage(), dock], familyComponents);
  const family = sections.find((s) => s.id === 'BotAvatarView')?.family;
  assert.deepEqual(family?.members.find((m) => m.id === 'BotAnimatedFaceView')?.alsoUsedBy, [{ component: 'Dock', role: 'Header icon' }]);

  // Minor 3: types.ts:120 documents that an empty role is omitted, not carried through as ''. No
  // other test authors `role: ''`, so `role: entry.role || undefined` could silently regress to
  // `role: entry.role` without anything noticing.
  const silentDock = defineCatalogPage({
    id: 'SilentDock', group: 'Components', description: 'd',
    composedOf: [{ component: 'BotAnimatedFaceView', role: '', relationship: 'built-in' as const }],
  });
  const { sections: silentSections } = buildCatalogSections([familyPage(), silentDock], familyComponents);
  const silentFamily = silentSections.find((s) => s.id === 'BotAvatarView')?.family;
  assert.deepEqual(silentFamily?.members.find((m) => m.id === 'BotAnimatedFaceView')?.alsoUsedBy, [{ component: 'SilentDock', role: undefined }]);
});

// Breaks if a second user ever overwrites, rather than accumulates alongside, the first.
test('buildCatalogSections: alsoUsedBy derives two outside users, one per declaring page', () => {
  const dock = defineCatalogPage({ id: 'Dock', group: 'Components', description: 'd', composedOf: [{ component: 'BotAnimatedFaceView', role: 'Header icon', relationship: 'built-in' as const }] });
  const toolbar = defineCatalogPage({ id: 'Toolbar', group: 'Components', description: 'd', composedOf: [{ component: 'BotAnimatedFaceView', role: 'Status icon', relationship: 'built-in' as const }] });
  const { sections } = buildCatalogSections([familyPage(), dock, toolbar], familyComponents);
  const family = sections.find((s) => s.id === 'BotAvatarView')?.family;
  assert.deepEqual(family?.members.find((m) => m.id === 'BotAnimatedFaceView')?.alsoUsedBy, [
    { component: 'Dock', role: 'Header icon' },
    { component: 'Toolbar', role: 'Status icon' },
  ]);
});

test('buildCatalogSections: alsoUsedBy derives three outside users', () => {
  const pages = ['Dock', 'Toolbar', 'Sidebar'].map((id) =>
    defineCatalogPage({ id, group: 'Components', description: 'd', composedOf: [{ component: 'BotAnimatedFaceView', role: 'r', relationship: 'built-in' as const }] }),
  );
  const { sections } = buildCatalogSections([familyPage(), ...pages], familyComponents);
  const family = sections.find((s) => s.id === 'BotAvatarView')?.family;
  assert.deepEqual(
    family?.members.find((m) => m.id === 'BotAnimatedFaceView')?.alsoUsedBy.map((e) => e.component),
    ['Dock', 'Toolbar', 'Sidebar'],
  );
});

// The data layer never caps the derived set itself — only `alsoUsedBySegments` (rendering) caps
// the first three plus a "+N more" — so this exercises both: the full, uncapped derivation, and
// the cap it feeds. Breaks if either the derivation starts dropping entries past 3, or the cap
// stops kicking in once there really are more than 3.
test('buildCatalogSections: alsoUsedBy is never capped in the data — the "+N more" cap applies only when rendered', () => {
  const pages = ['Dock', 'Toolbar', 'Sidebar', 'Modal'].map((id) =>
    defineCatalogPage({ id, group: 'Components', description: 'd', composedOf: [{ component: 'BotAnimatedFaceView', role: 'r', relationship: 'built-in' as const }] }),
  );
  const { sections } = buildCatalogSections([familyPage(), ...pages], familyComponents);
  const family = sections.find((s) => s.id === 'BotAvatarView')?.family;
  const alsoUsedBy = family?.members.find((m) => m.id === 'BotAnimatedFaceView')?.alsoUsedBy;
  assert.equal(alsoUsedBy?.length, 4);
  assert.ok(alsoUsedBySegments(alsoUsedBy!).some((segment) => segment.text === ' +1 more'));
});

// Breaks if a 'slot' or 'related' entry is ever included alongside (or instead of) 'built-in' —
// only 'built-in' means "uses it".
test('buildCatalogSections: alsoUsedBy ignores "slot" and "related" composedOf entries', () => {
  const dock = defineCatalogPage({
    id: 'Dock', group: 'Components', description: 'd',
    composedOf: [
      { component: 'BotAnimatedFaceView', role: 'Optional icon', relationship: 'slot' as const },
      { component: 'BotAnimatedFaceView', role: 'Seen together', relationship: 'related' as const },
    ],
  });
  const { sections } = buildCatalogSections([familyPage(), dock], familyComponents);
  const family = sections.find((s) => s.id === 'BotAvatarView')?.family;
  assert.deepEqual(family?.members.find((m) => m.id === 'BotAnimatedFaceView')?.alsoUsedBy, []);
});

// A deeper family (whole -> Mid -> Leaf, plus an unrelated Sibling) so each exclusion rule can be
// isolated: Leaf's own parent is Mid (not the whole), so a user equal to the whole, or to a
// sibling that isn't Leaf's parent, tests a genuinely different condition than "is this the
// member's own parent".
function deepFamilyPage() {
  return defineCatalogPage({
    id: 'W', group: 'Components', description: 'd',
    whole: 'W',
    sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['Mid', 'Leaf', 'Sibling'] }],
    members: [
      { id: 'W', source: 'w.tsx:1', fidelity: 'documentation-only' as const, relationship: 'Whole', description: 'd' },
      { id: 'Mid', source: 'm.tsx:1', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'W', description: 'd' },
      { id: 'Leaf', source: 'l.tsx:1', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'Mid', description: 'd' },
      { id: 'Sibling', source: 's.tsx:1', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'W', description: 'd' },
    ],
  });
}

// Breaks if a member's own parent composing it still counts as an "also used by" — that edge is
// the tree already (the parent/child relationship), not a second user.
test('buildCatalogSections: alsoUsedBy excludes a member\'s own parent', () => {
  const base = deepFamilyPage();
  const page = { ...base, members: base.members!.map((m) => (m.id === 'Mid' ? { ...m, composedOf: [{ component: 'Leaf', role: 'r', relationship: 'built-in' as const }] } : m)) };
  const { sections } = buildCatalogSections([page], familyComponents);
  const family = sections.find((s) => s.id === 'W')?.family;
  assert.deepEqual(family?.members.find((m) => m.id === 'Leaf')?.alsoUsedBy, []);
});

// Breaks if the page's own whole composing one of its parts still counts, even when the whole
// isn't that part's direct parent (Leaf's parent here is Mid, not W).
test('buildCatalogSections: alsoUsedBy excludes the page\'s own whole', () => {
  const base = deepFamilyPage();
  const page = { ...base, members: base.members!.map((m) => (m.id === 'W' ? { ...m, composedOf: [{ component: 'Leaf', role: 'r', relationship: 'built-in' as const }] } : m)) };
  const { sections } = buildCatalogSections([page], familyComponents);
  const family = sections.find((s) => s.id === 'W')?.family;
  assert.deepEqual(family?.members.find((m) => m.id === 'Leaf')?.alsoUsedBy, []);
});

// Breaks if a member composing itself (bad authored data) ever shows up as its own user.
test('buildCatalogSections: alsoUsedBy excludes a member composing itself', () => {
  const base = deepFamilyPage();
  const page = { ...base, members: base.members!.map((m) => (m.id === 'Leaf' ? { ...m, composedOf: [{ component: 'Leaf', role: 'r', relationship: 'built-in' as const }] } : m)) };
  const { sections } = buildCatalogSections([page], familyComponents);
  const family = sections.find((s) => s.id === 'W')?.family;
  assert.deepEqual(family?.members.find((m) => m.id === 'Leaf')?.alsoUsedBy, []);
});

// Breaks if a sibling on the same page composing this member (neither its parent nor the whole)
// still counts — a sibling composing it is still the same family.
test('buildCatalogSections: alsoUsedBy excludes a same-page sibling', () => {
  const base = deepFamilyPage();
  const page = { ...base, members: base.members!.map((m) => (m.id === 'Sibling' ? { ...m, composedOf: [{ component: 'Leaf', role: 'r', relationship: 'built-in' as const }] } : m)) };
  const { sections } = buildCatalogSections([page], familyComponents);
  const family = sections.find((s) => s.id === 'W')?.family;
  assert.deepEqual(family?.members.find((m) => m.id === 'Leaf')?.alsoUsedBy, []);
});

// Important finding 2: `knownComposedOfNames` (N8) deliberately accepts a member's own *alias* as a
// valid `composedOf` target — `resolvesAddress` links it fine going forward — so the inverse index
// must resolve an alias-named entry back to that member's canonical id, or it silently derives
// nothing. Breaks if the index goes back to keying on the raw, unresolved `entry.component`.
test('buildCatalogSections: alsoUsedBy resolves a composedOf entry that names a member\'s alias, not its canonical id', () => {
  const base = familyPage();
  const page = {
    ...base,
    members: base.members!.map((m) => (m.id === 'BotAnimatedFaceView' ? { ...m, aliases: ['FaceAlias'] } : m)),
  };
  const dock = defineCatalogPage({
    id: 'Dock', group: 'Components', description: 'd',
    composedOf: [{ component: 'FaceAlias', role: 'Header icon', relationship: 'built-in' as const }],
  });
  const { sections } = buildCatalogSections([page, dock], familyComponents);
  const family = sections.find((s) => s.id === 'BotAvatarView')?.family;
  assert.deepEqual(family?.members.find((m) => m.id === 'BotAnimatedFaceView')?.alsoUsedBy, [{ component: 'Dock', role: 'Header icon' }]);
});

// Important finding 2, the other half: a member whose `component` differs from its own `id` is the
// same hole — an entry naming the `component` must resolve to the member's id just as an alias does.
test('buildCatalogSections: alsoUsedBy resolves a composedOf entry that names a member\'s component, not its id', () => {
  const page = defineCatalogPage({
    id: 'W', group: 'Components', description: 'd',
    whole: 'W',
    sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['Face'] }],
    members: [
      { id: 'W', source: 'w.tsx:1', fidelity: 'documentation-only' as const, relationship: 'Whole', description: 'd' },
      {
        id: 'Face', component: 'FaceComponent', source: 'f.tsx:1', fidelity: 'documentation-only' as const,
        relationship: 'Part', parent: 'W', description: 'd',
      },
    ],
  });
  const dock = defineCatalogPage({
    id: 'Dock', group: 'Components', description: 'd',
    composedOf: [{ component: 'FaceComponent', role: 'Header icon', relationship: 'built-in' as const }],
  });
  const { sections } = buildCatalogSections([page, dock], familyComponents);
  const family = sections.find((s) => s.id === 'W')?.family;
  assert.deepEqual(family?.members.find((m) => m.id === 'Face')?.alsoUsedBy, [{ component: 'Dock', role: 'Header icon' }]);
});

// Important finding 3: page-level entries attribute to `page.id`, whole-member entries to
// `member.id` — the same string for a family's whole (`validateFamily` forces `whole === page.id`)
// — so a page declaring the same user at both levels must collapse to one entry, not render "Also
// used by P and P". Breaks if the dedupe is removed.
test('buildCatalogSections: alsoUsedBy dedupes a user declared at both the page level and on its own whole member', () => {
  const dock = defineCatalogPage({
    id: 'Dock', group: 'Components', description: 'd',
    whole: 'Dock',
    sections: [],
    members: [
      {
        id: 'Dock', source: 'dock.tsx:1', fidelity: 'documentation-only' as const, relationship: 'Whole', description: 'd',
        composedOf: [{ component: 'BotAnimatedFaceView', role: 'Whole-member role', relationship: 'built-in' as const }],
      },
    ],
    composedOf: [{ component: 'BotAnimatedFaceView', role: 'Page-level role', relationship: 'built-in' as const }],
  });
  const { sections } = buildCatalogSections([familyPage(), dock], familyComponents);
  const family = sections.find((s) => s.id === 'BotAvatarView')?.family;
  assert.deepEqual(family?.members.find((m) => m.id === 'BotAnimatedFaceView')?.alsoUsedBy, [{ component: 'Dock', role: 'Page-level role' }]);
});

// Important finding 3, the other half: plain duplicate entries inside one `composedOf` list —
// `validateComposedOf` has no duplicate check of its own, so these reach the derivation unchanged.
test('buildCatalogSections: alsoUsedBy dedupes plain duplicate entries within one composedOf list', () => {
  const dock = defineCatalogPage({
    id: 'Dock', group: 'Components', description: 'd',
    composedOf: [
      { component: 'BotAnimatedFaceView', role: 'Header icon', relationship: 'built-in' as const },
      { component: 'BotAnimatedFaceView', role: 'Header icon', relationship: 'built-in' as const },
    ],
  });
  const { sections } = buildCatalogSections([familyPage(), dock], familyComponents);
  const family = sections.find((s) => s.id === 'BotAvatarView')?.family;
  assert.deepEqual(family?.members.find((m) => m.id === 'BotAnimatedFaceView')?.alsoUsedBy, [{ component: 'Dock', role: 'Header icon' }]);
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

// Slice D1 item 2: `numberFor` numbers an in-whole top-level part `1`, `2`, … (not `1.1`, `1.2`,
// … — that was `outlineFor`'s superseded rule); `BotAnimatedFaceView`'s `parent` is the whole.
test('buildCatalogSections: the section\'s family carries the outline and the authored sections/whole', () => {
  const { sections } = buildCatalogSections([familyPage()], familyComponents);
  const family = sections.find((s) => s.id === 'BotAvatarView')?.family;
  assert.equal(family?.whole, 'BotAvatarView');
  assert.deepEqual(family?.outline.get('BotAnimatedFaceView'), { number: '1', level: 2 });
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

// Slice D1 item 1: `anatomy` passes through to `FamilyDef.anatomy` unchanged.
test('buildCatalogSections: the section\'s family carries the authored anatomy', () => {
  const anatomy = { groups: [{ label: 'In this picture', items: [{ member: 'BotAnimatedFaceView', description: 'The face.' }] }] };
  const page = { ...familyPage(), anatomy };
  const { sections } = buildCatalogSections([page], familyComponents);
  const family = sections.find((s) => s.id === 'BotAvatarView')?.family;
  assert.deepEqual(family?.anatomy, anatomy);
});

// Slice D1 item 3: a bad anatomy item is a validation issue, reaching console.error like any other.
test('buildCatalogSections: an invalid anatomy reaches console.error in development', () => {
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => errors.push(message);
  try {
    const page = { ...familyPage(), anatomy: { groups: [{ label: 'In this picture', items: [{ member: 'Typo', description: 'x' }] }] } };
    buildCatalogSections([page], familyComponents);
    assert.ok(errors.some((e) => e.includes('anatomy item "Typo" is not a member of this page')), errors.join('\n'));
  } finally {
    console.error = originalError;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
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

// Appendix fixtures — copied from `.hermes-task/family-registry-input.json`, keeping only `id`,
// `parent`, section `label`, `kind` and `inWhole` (plan V1.1).

const botAvatar = {
  id: 'BotAvatarView',
  whole: 'BotAvatarView',
  sections: [
    { label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['BotAnimatedFaceView', 'BotAvatarMarkView', 'BotAvatarBody'] },
    { label: 'Related', kind: 'blocks' as const, inWhole: false, members: ['BotRoomMemberAvatar'] },
  ],
  members: [
    { id: 'BotAvatarView' },
    { id: 'BotAnimatedFaceView', parent: 'BotAvatarView' },
    { id: 'BotAvatarMarkView', parent: 'BotAnimatedFaceView' },
    { id: 'BotAvatarBody', parent: 'BotAvatarMarkView' },
    { id: 'BotRoomMemberAvatar' },
  ],
};

const responseSelection = {
  id: 'ResponseTextSelection',
  whole: 'ResponseTextSelection',
  sections: [
    {
      label: 'UIKit implementation', kind: 'list' as const, inWhole: true,
      members: ['ResponseSelectionController', 'ResponseSelectionInput', 'ResponseSelectionRect', 'ResponseTextRange', 'ResponseTextPosition'],
    },
    {
      label: 'Added to response text', kind: 'list' as const, inWhole: false,
      members: ['ResponseSelectionLeaf', 'RegisteredResponseSelectionLeaf', 'ResponseSelectionMarker', 'ResponseSelectionLeafView', 'ResponseSelectionRenderer', 'ResponseSelectionImageAttribute', 'ResponseTextSelectionPolicy'],
    },
  ],
  members: [
    { id: 'ResponseTextSelection' },
    { id: 'ResponseSelectionController', parent: 'ResponseTextSelection' },
    { id: 'ResponseSelectionInput', parent: 'ResponseSelectionController' },
    { id: 'ResponseSelectionRect', parent: 'ResponseSelectionInput' },
    { id: 'ResponseTextRange', parent: 'ResponseSelectionInput' },
    { id: 'ResponseTextPosition', parent: 'ResponseTextRange' },
    { id: 'ResponseSelectionLeaf' },
    { id: 'RegisteredResponseSelectionLeaf', parent: 'ResponseSelectionLeaf' },
    { id: 'ResponseSelectionMarker', parent: 'RegisteredResponseSelectionLeaf' },
    { id: 'ResponseSelectionLeafView', parent: 'ResponseSelectionMarker' },
    { id: 'ResponseSelectionRenderer', parent: 'RegisteredResponseSelectionLeaf' },
    { id: 'ResponseSelectionImageAttribute', parent: 'ResponseSelectionRenderer' },
    { id: 'ResponseTextSelectionPolicy' },
  ],
};

const transcript = {
  id: 'ChatTranscriptView',
  whole: 'ChatTranscriptView',
  sections: [
    {
      label: 'Rows and loading', kind: 'blocks' as const, inWhole: true,
      members: ['ChatTranscriptMessageBlock', 'ChatTranscriptMessageRow', 'TranscriptTurnFoldRowView', 'ForkOriginRowView', 'ChatTranscriptLoadingSkeletonView', 'ChatTranscriptLoadingSkeletonRow'],
    },
    {
      label: 'Scroll and state helpers', kind: 'list' as const, inWhole: true,
      members: ['ChatScrollObserver', 'ObserverView', 'ChatVerticalScrollAxisGuard', 'ChatVerticalScrollAxisGuardView', 'StreamingFollowTrigger'],
    },
    {
      label: 'Related', kind: 'blocks' as const, inWhole: false,
      members: ['TranscriptTimeSeparator', 'ChatDisclosureToggledModifier'],
    },
  ],
  members: [
    { id: 'ChatTranscriptView' },
    { id: 'ChatTranscriptMessageBlock', parent: 'ChatTranscriptView' },
    { id: 'ChatTranscriptMessageRow', parent: 'ChatTranscriptMessageBlock' },
    { id: 'TranscriptTurnFoldRowView', parent: 'ChatTranscriptMessageBlock' },
    { id: 'ForkOriginRowView', parent: 'ChatTranscriptView' },
    { id: 'ChatTranscriptLoadingSkeletonView', parent: 'ChatTranscriptView' },
    { id: 'ChatTranscriptLoadingSkeletonRow', parent: 'ChatTranscriptLoadingSkeletonView' },
    { id: 'ChatScrollObserver', parent: 'ChatTranscriptView' },
    { id: 'ObserverView', parent: 'ChatScrollObserver' },
    { id: 'ChatVerticalScrollAxisGuard', parent: 'ChatTranscriptView' },
    { id: 'ChatVerticalScrollAxisGuardView', parent: 'ChatVerticalScrollAxisGuard' },
    { id: 'StreamingFollowTrigger', parent: 'ChatTranscriptView' },
    { id: 'TranscriptTimeSeparator' },
    { id: 'ChatDisclosureToggledModifier' },
  ],
};

test('validateFamily reports no issues for a valid family', () => {
  assert.deepEqual(validateFamily(botAvatar, new Set(), new Set()), []);
  assert.deepEqual(validateFamily(responseSelection, new Set(), new Set()), []);
  assert.deepEqual(validateFamily(transcript, new Set(), new Set()), []);
});

test('validateFamily is a no-op for a page without members', () => {
  assert.deepEqual(validateFamily({ id: 'Button' }, new Set(), new Set()), []);
});

test('validateFamily: members requires both whole and sections', () => {
  const issues = validateFamily({ id: 'X', members: [{ id: 'X' }] }, new Set(), new Set());
  assert.ok(issues.some((issue) => issue.includes('requires both "whole" and "sections"')));
});

test('validateFamily: the whole must be one of the members', () => {
  const page = { ...botAvatar, whole: 'NoSuchMember' };
  const issues = validateFamily(page, new Set(), new Set());
  assert.ok(issues.some((issue) => issue.includes('whole "NoSuchMember" is not one of its members')));
});

test('validateFamily: the whole\'s id must equal the page id', () => {
  const page = { ...botAvatar, id: 'SomeOtherPageId' };
  const issues = validateFamily(page, new Set(), new Set());
  assert.ok(issues.some((issue) => issue.includes('must have the same id as the page')));
});

test('validateFamily: the whole must not appear in any section', () => {
  const page = {
    ...botAvatar,
    sections: [{ ...botAvatar.sections[0], members: [...botAvatar.sections[0].members, 'BotAvatarView'] }, botAvatar.sections[1]],
  };
  const issues = validateFamily(page, new Set(), new Set());
  assert.ok(issues.some((issue) => issue.includes('the whole "BotAvatarView" must not appear in any section')));
});

test('validateFamily: every other member must be in exactly one section', () => {
  const missing = { ...botAvatar, sections: [{ ...botAvatar.sections[0], members: ['BotAnimatedFaceView', 'BotAvatarMarkView'] }, botAvatar.sections[1]] };
  const missingIssues = validateFamily(missing, new Set(), new Set());
  assert.ok(missingIssues.some((issue) => issue.includes('member "BotAvatarBody" is not in any section')));

  const duplicated = {
    ...botAvatar,
    sections: [botAvatar.sections[0], { ...botAvatar.sections[1], members: ['BotRoomMemberAvatar', 'BotAnimatedFaceView'] }],
  };
  const duplicatedIssues = validateFamily(duplicated, new Set(), new Set());
  assert.ok(duplicatedIssues.some((issue) => issue.includes('member "BotAnimatedFaceView" is in more than one section')));
});

test('validateFamily: a parent must resolve within the page', () => {
  const page = { ...botAvatar, members: botAvatar.members.map((m) => (m.id === 'BotAnimatedFaceView' ? { ...m, parent: 'Ghost' } : m)) };
  const issues = validateFamily(page, new Set(), new Set());
  assert.ok(issues.some((issue) => issue.includes('unknown parent "Ghost"')));
});

test('validateFamily: parent cycles are rejected', () => {
  const page = {
    ...botAvatar,
    members: [
      { id: 'BotAvatarView' },
      { id: 'BotAnimatedFaceView', parent: 'BotAvatarMarkView' },
      { id: 'BotAvatarMarkView', parent: 'BotAnimatedFaceView' },
      { id: 'BotAvatarBody', parent: 'BotAvatarMarkView' },
      { id: 'BotRoomMemberAvatar' },
    ],
  };
  const issues = validateFamily(page, new Set(), new Set());
  assert.ok(issues.some((issue) => issue.includes('"BotAnimatedFaceView" has a parent cycle')));
  assert.ok(issues.some((issue) => issue.includes('"BotAvatarMarkView" has a parent cycle')));
});

test('validateFamily: member and alias ids must not collide with another page id, except the whole', () => {
  const issues = validateFamily(botAvatar, new Set(['BotAnimatedFaceView']), new Set());
  assert.ok(issues.some((issue) => issue.includes('id "BotAnimatedFaceView" collides with another page\'s id')));
  // The whole's own id equals the page id, by design, and is exempt.
  const wholeOk = validateFamily(botAvatar, new Set(['BotAvatarView']), new Set());
  assert.ok(!wholeOk.some((issue) => issue.includes('BotAvatarView')));
});

test('validateFamily: member and alias ids must be unique catalog-wide', () => {
  const issues = validateFamily(botAvatar, new Set(), new Set(['BotAvatarMarkView']));
  assert.ok(issues.some((issue) => issue.includes('id "BotAvatarMarkView" collides with another member or alias')));
});

test('validateFamily: an alias colliding with another page or member is reported the same way', () => {
  const page = { ...botAvatar, members: botAvatar.members.map((m) => (m.id === 'BotRoomMemberAvatar' ? { ...m, aliases: ['OldBotAvatar'] } : m)) };
  const issues = validateFamily(page, new Set(['OldBotAvatar']), new Set());
  assert.ok(issues.some((issue) => issue.includes('id "OldBotAvatar" collides with another page\'s id')));
});

// V2c item 2: a section listing an id that is not one of the page's own members.
test('validateFamily: a section listing an unknown id is reported', () => {
  const page = { ...botAvatar, sections: [botAvatar.sections[0], { ...botAvatar.sections[1], members: ['Typo', 'BotRoomMemberAvatar'] }] };
  const issues = validateFamily(page, new Set(), new Set());
  assert.ok(issues.some((issue) => issue.includes('section "Related" lists "Typo", which is not a member of this page')));
});

test('validateFamily: duplicate ids within the same page are reported', () => {
  const page = { ...botAvatar, members: [...botAvatar.members, { id: 'BotAvatarMarkView', parent: 'BotAvatarView' }] };
  const issues = validateFamily(page, new Set(), new Set());
  assert.ok(issues.some((issue) => issue.includes('id "BotAvatarMarkView" is used more than once on this page')));
});

// N6: a `list`-section member authored with a specimen — `FoldedRow` never renders one (it only
// shows the header, description, below-the-specimens line and disclosure) — must be reported, not
// silently dropped. `hasSpecimens` is computed by each caller (not a `CatalogMember` field).
test('validateFamily: a member with specimens in a list section is reported', () => {
  const page = {
    ...responseSelection,
    members: responseSelection.members.map((m) => (m.id === 'ResponseSelectionController' ? { ...m, hasSpecimens: true } : m)),
  };
  const issues = validateFamily(page, new Set(), new Set());
  assert.ok(issues.some((issue) =>
    issue.includes('"ResponseSelectionController" has specimens, but list sections show members as folded rows without specimens')));
});

test('validateFamily: a blocks-section member with specimens is not reported by the list-specimens rule', () => {
  const page = {
    ...botAvatar,
    members: botAvatar.members.map((m) => (m.id === 'BotAnimatedFaceView' ? { ...m, hasSpecimens: true } : m)),
  };
  const issues = validateFamily(page, new Set(), new Set());
  assert.ok(!issues.some((issue) => issue.includes('has specimens, but list sections')));
});

// Slice D1 item 2: `numberFor` replaces outline numbering with the anatomy-first rule — top-level
// parts are inWhole members whose parent is the whole, or who have no parent at all, numbered
// 1, 2, 3… in authored order; a child takes its parent's number plus `.1`, `.2`, …; members outside
// an `inWhole` section (Related) get no number at all.
const numberForFixture = {
  id: 'W',
  whole: 'W',
  sections: [
    { label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['P1', 'P2', 'C1', 'D1', 'E1', 'C2', 'P3', 'C3', 'P4'] },
    { label: 'Related', kind: 'blocks' as const, inWhole: false, members: ['R1'] },
  ],
  members: [
    { id: 'W' },
    { id: 'P1', parent: 'W' },
    { id: 'P2', parent: 'W' },
    { id: 'C1', parent: 'P2' },
    { id: 'D1', parent: 'C1' },
    { id: 'E1', parent: 'D1' },
    { id: 'C2', parent: 'P2' },
    { id: 'P3', parent: 'W' },
    { id: 'C3', parent: 'P3' },
    { id: 'P4' },
    { id: 'R1' },
  ],
};

test('numberFor: top-level parts in authored order, children as parentNumber.k', () => {
  const outline = numberFor(numberForFixture);
  assert.equal(outline.get('P1')?.number, '1');
  assert.equal(outline.get('P2')?.number, '2');
  assert.equal(outline.get('C1')?.number, '2.1');
  assert.equal(outline.get('C2')?.number, '2.2');
  assert.equal(outline.get('P3')?.number, '3');
  assert.equal(outline.get('C3')?.number, '3.1');
});

test('numberFor: a four-level chain', () => {
  const outline = numberFor(numberForFixture);
  assert.equal(outline.get('D1')?.number, '2.1.1');
  assert.equal(outline.get('E1')?.number, '2.1.1.1');
});

test('numberFor: a parentless in-whole root is still a top-level part', () => {
  const outline = numberFor(numberForFixture);
  assert.equal(outline.get('P4')?.number, '4');
});

test('numberFor: the whole and Related members get no number', () => {
  const outline = numberFor(numberForFixture);
  assert.equal(outline.has('W'), false);
  assert.equal(outline.has('R1'), false);
});

test('numberFor returns an empty map for a page without members', () => {
  assert.deepEqual(numberFor({ id: 'Button' }), new Map());
});

// E1: a section listing an id that isn't a real member must never occupy authored order (or be
// numbered), degrading to a missing part instead of shifting the real members' own numbers.
test('numberFor ignores a section id that is not a member of the page', () => {
  const page = {
    ...numberForFixture,
    sections: [
      { ...numberForFixture.sections[0], members: ['Typo', ...numberForFixture.sections[0].members] },
      numberForFixture.sections[1],
    ],
  };
  const outline = numberFor(page);
  assert.equal(outline.has('Typo'), false);
  assert.equal(outline.get('P1')?.number, '1');
});

// E1: a parent cycle, isolated from the rest of the tree by construction (each member has exactly
// one `parent`, so a cycle can never also be a child of a real top-level part) — must never throw,
// and must leave the rest of the outline intact.
test('numberFor: a parent cycle does not throw and leaves the rest of the outline intact', () => {
  const page = {
    id: 'W',
    whole: 'W',
    sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['P1', 'A', 'B'] }],
    members: [
      { id: 'W' },
      { id: 'P1', parent: 'W' },
      { id: 'A', parent: 'B' },
      { id: 'B', parent: 'A' },
    ],
  };
  const outline = numberFor(page);
  assert.deepEqual(outline.get('P1'), { number: '1', level: 2 });
  assert.equal(outline.has('A'), false);
  assert.equal(outline.has('B'), false);
});

// Slice D1 item 3: anatomy validation.
test('validateFamily: an anatomy member item that is not a member of the page is reported', () => {
  const page = { ...botAvatar, anatomy: { groups: [{ label: 'In this picture', items: [{ member: 'Typo' }] }] } };
  const issues = validateFamily(page, new Set(), new Set());
  assert.ok(issues.some((issue) => issue.includes('anatomy item "Typo" is not a member of this page')));
});

test('validateFamily: an anatomy item naming the whole is reported', () => {
  const page = { ...botAvatar, anatomy: { groups: [{ label: 'In this picture', items: [{ member: 'BotAvatarView' }] }] } };
  const issues = validateFamily(page, new Set(), new Set());
  assert.ok(issues.some((issue) => issue.includes('anatomy item "BotAvatarView" names the whole')));
});

test('validateFamily: a member listed in two anatomy items is reported', () => {
  const page = {
    ...botAvatar,
    anatomy: { groups: [{ label: 'In this picture', items: [{ member: 'BotAnimatedFaceView' }, { member: 'BotAnimatedFaceView' }] }] },
  };
  const issues = validateFamily(page, new Set(), new Set());
  assert.ok(issues.some((issue) => issue.includes('anatomy lists member "BotAnimatedFaceView" more than once')));
});

test('validateFamily: a valid anatomy is a no-op', () => {
  const page = { ...botAvatar, anatomy: { groups: [{ label: 'In this picture', items: [{ member: 'BotAnimatedFaceView' }, { other: 'SomeOtherComponent' }] }] } };
  assert.deepEqual(validateFamily(page, new Set(), new Set()), []);
});

// C1 (independent review), narrowing D2 item A2: a member outside every `inWhole` section is
// legitimately unnumbered by design (APPROVED.md: related members have no number), so it must
// NOT be reported — only an in-whole member that's unnumbered because its own parent isn't
// numbered (the next test) is a real defect.
test('validateFamily: an anatomy member item outside every inWhole section is not reported', () => {
  const page = { ...botAvatar, anatomy: { groups: [{ label: 'X', items: [{ member: 'BotRoomMemberAvatar' }] }] } };
  assert.deepEqual(validateFamily(page, new Set(), new Set()), []);
});

// D2 item A2: the same silent path for an `inWhole` member whose `parent` is a Related member —
// valid data for the other rules, but `numberFor` gives it no number either.
test('validateFamily: an anatomy member item under a parent that is not numbered is reported', () => {
  const page = {
    id: 'W',
    whole: 'W',
    sections: [
      { label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['P1'] },
      { label: 'Related', kind: 'blocks' as const, inWhole: false, members: ['R1'] },
    ],
    members: [{ id: 'W' }, { id: 'P1', parent: 'R1' }, { id: 'R1' }],
    anatomy: { groups: [{ label: 'X', items: [{ member: 'P1' }] }] },
  };
  const issues = validateFamily(page, new Set(), new Set());
  assert.ok(issues.some((issue) => issue.includes('anatomy item "P1" has no number')));
});

test('validateFamily: a relatedPages entry naming an unknown page is reported', () => {
  const page = { ...botAvatar, relatedPages: [{ page: 'NoSuchPage' }] };
  const issues = validateFamily(page, new Set(), new Set());
  assert.ok(issues.some((issue) => issue.includes('relatedPages entry "NoSuchPage" is not a catalog page')));
});

test('validateFamily: a relatedPages entry naming a known page is not reported', () => {
  const page = { ...botAvatar, relatedPages: [{ page: 'SettingsCard', note: 'A parallel card.' }] };
  const issues = validateFamily(page, new Set(['SettingsCard']), new Set());
  assert.ok(!issues.some((issue) => issue.includes('relatedPages')));
});

// I3 (independent review), matching N8: `otherMemberIds` carries another family's member ids and
// aliases plus another page's own alias — the same universe `FamilyPage`'s own `resolvesAddress`
// already treats as working links, so a relatedPages entry naming one must not be a false error.
test('validateFamily: a relatedPages entry naming a page alias or another family\'s member is not reported', () => {
  const page = { ...botAvatar, relatedPages: [{ page: 'SettingsCardAlias' }] };
  const issues = validateFamily(page, new Set(), new Set(['SettingsCardAlias']));
  assert.ok(!issues.some((issue) => issue.includes('relatedPages')));
});

test('validateFamily: a relatedPages entry naming the page itself is reported, and not also as unknown', () => {
  const page = { ...botAvatar, relatedPages: [{ page: 'BotAvatarView' }] };
  const issues = validateFamily(page, new Set(), new Set());
  assert.ok(issues.some((issue) => issue.includes('relatedPages entry "BotAvatarView" names this page itself')));
  assert.ok(!issues.some((issue) => issue.includes('is not a catalog page')));
});

// Minor 6 (independent review, confirmation pass): an entry naming one of this page's own members
// resolves as a live link at runtime (`FamilyPage.tsx`'s `resolvesAddress` unions `allMemberIds`),
// so reporting it as "is not a catalog page" would send the author looking for a typo that isn't
// there. The dedicated message instead points at the real mistake.
test('validateFamily: a relatedPages entry naming one of this page\'s own members is reported with a dedicated message', () => {
  const page = { ...botAvatar, relatedPages: [{ page: 'BotRoomMemberAvatar' }] };
  const issues = validateFamily(page, new Set(), new Set());
  assert.ok(issues.some((issue) => issue.includes('relatedPages entry "BotRoomMemberAvatar" is a member of this page, not another page')));
  assert.ok(!issues.some((issue) => issue.includes('is not a catalog page')));
});

test('validateFamily: duplicate relatedPages entries are reported', () => {
  const page = { ...botAvatar, relatedPages: [{ page: 'SettingsCard' }, { page: 'SettingsCard' }] };
  const issues = validateFamily(page, new Set(['SettingsCard']), new Set());
  assert.ok(issues.some((issue) => issue.includes('relatedPages lists "SettingsCard" more than once')));
});

// Minor 3 (independent review), matching the anatomy dedupe's own `continue`: a duplicated AND
// unresolvable entry must report the duplicate once per repeat occurrence, never also "is not a
// catalog page" piled on top for that same occurrence.
test('validateFamily: a duplicated and unresolvable relatedPages entry reports only the duplicate message for the repeat', () => {
  const page = { ...botAvatar, relatedPages: [{ page: 'NoSuchPage' }, { page: 'NoSuchPage' }] };
  const issues = validateFamily(page, new Set(), new Set());
  assert.equal(issues.filter((issue) => issue.includes('relatedPages lists "NoSuchPage" more than once')).length, 1);
  assert.equal(issues.filter((issue) => issue.includes('relatedPages entry "NoSuchPage" is not a catalog page')).length, 1);
});

test('validateFamily: an empty relatedPages array is a no-op', () => {
  const page = { ...botAvatar, relatedPages: [] };
  assert.deepEqual(validateFamily(page, new Set(), new Set()), []);
});

test('buildCatalogSections: the section\'s family carries the authored relatedPages', () => {
  const relatedPages = [{ page: 'OtherPage', note: 'Why you would go there.' }];
  const otherPage = defineCatalogPage({ id: 'OtherPage', group: 'Components', description: 'x' });
  const page = { ...familyPage(), relatedPages };
  const { sections } = buildCatalogSections([page, otherPage], familyComponents);
  const family = sections.find((s) => s.id === 'BotAvatarView')?.family;
  assert.deepEqual(family?.relatedPages, relatedPages);
});

// A page's `relatedPages` is optional and additive — omitting it must leave `family.relatedPages`
// undefined, so a page authored before this field existed renders exactly as it did before.
test('buildCatalogSections: a family page without relatedPages leaves it undefined', () => {
  const { sections } = buildCatalogSections([familyPage()], familyComponents);
  const family = sections.find((s) => s.id === 'BotAvatarView')?.family;
  assert.equal(family?.relatedPages, undefined);
});

test('buildCatalogSections: an unresolvable relatedPages entry reaches console.error in development', () => {
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => errors.push(message);
  try {
    const page = { ...familyPage(), relatedPages: [{ page: 'NoSuchPage' }] };
    buildCatalogSections([page], familyComponents);
    assert.ok(errors.some((e) => e.includes('relatedPages entry "NoSuchPage" is not a catalog page')), errors.join('\n'));
  } finally {
    console.error = originalError;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
});
