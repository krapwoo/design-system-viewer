import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogSections, defineCatalogPage, numberFor, numberForGroupMember, resolveExternalPart, validateComposedOf, validateFamily, validateGroup } from '../pageApi.ts';
import { alsoUsedBySegments } from '../familyModel.ts';
import { validateTokenDefinition, validateTokenDefinitionUsage } from '../tokenDefinition.ts';
import type { TokenDefinition } from '../tokenDefinition.ts';

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

// #60: an opted-in page's `navigation` carries through unchanged; an omitted one leaves the
// section's own field undefined (identical to the explicit 'browse' default) — no legacy page's
// section shape changes just because this field now exists.
test('buildCatalogSections carries navigation through to the section, omitted by default', () => {
  const pages = [
    defineCatalogPage({ id: 'TokenSheet', group: 'Tokens', description: 'x', navigation: 'reference' }),
    defineCatalogPage({ id: 'Button', group: 'Components', description: 'x' }),
  ];
  const { sections } = buildCatalogSections(pages, [components[0]]);
  assert.equal(sections.find((s) => s.id === 'TokenSheet')?.navigation, 'reference');
  assert.equal(sections.find((s) => s.id === 'Button')?.navigation, undefined);
});

// #60: `SectionDef.component` is the real detected binding (never a guessed fallback) for a normal
// page — set even when the page's own id differs from the component it documents — and undefined
// both for a family page (each member carries its own binding instead) and for a standalone page
// with no matching component record at all.
test('buildCatalogSections sets component from the real binding, including when the page id differs from it, and leaves it undefined for a family page or a page with no component', () => {
  const widget = { name: 'Widget', file: 'src/Widget.tsx', props: [], inheritedFrom: [] };
  const pages = [
    defineCatalogPage({ id: 'FancyWidget', component: 'Widget', group: 'Components', description: 'x' }),
    { ...defineCatalogPage({ id: 'Overview', group: 'Guides', description: 'x' }), file: 'src/Overview.catalog.tsx' },
    familyPage(),
  ];
  const { sections } = buildCatalogSections(pages, [widget, ...familyComponents]);
  assert.equal(sections.find((s) => s.id === 'FancyWidget')?.component, 'Widget');
  assert.equal(sections.find((s) => s.id === 'Overview')?.component, undefined);
  assert.equal(sections.find((s) => s.id === 'BotAvatarView')?.component, undefined);
});

// #60: an undocumented component's own stub section also carries its real binding, the same way a
// documented page does — it is, after all, a real catalog address a reference could point at.
test('buildCatalogSections sets component on an undocumented-component stub too', () => {
  const { sections } = buildCatalogSections([], [components[1]]); // Badge, no page
  assert.equal(sections.find((s) => s.id === 'Badge')?.component, 'Badge');
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
// #60 updated this exact list to add its own three additive fields (`navigation`, `component`,
// `alsoUsedBy`); #61 adds its own one more (`tokenDefinition`); #64 B5 adds `tokenDefinitionAliases`
// (undefined for every page without a `tokenDefinition`) — every other field's expected value is
// unchanged from before this task.
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
    tokenDefinition: undefined,
    tokenDefinitionAliases: undefined,
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
    navigation: undefined,
    notes: undefined,
    component: 'Button',
    alsoUsedBy: [],
  });
});

// #61: a fixture definition exercising a named-token entry whose own value is platform-provided,
// an unresolved-finding entry with a real drawable literal, and a truly unresolved entry with no
// fabricated sample — labeled fixture values, never a real product's.
function fixtureColorsDefinition(): TokenDefinition {
  return {
    kind: 'colors',
    sections: [
      {
        id: 'semantic',
        title: 'Semantic (fixture)',
        entries: [
          {
            id: 'background', name: 'Background', kind: 'colors',
            value: { provenance: 'platform', named: true, resolution: { status: 'unresolved', reason: 'Provided by the platform at runtime.', expression: 'UIColor.systemBackground' } },
          },
        ],
      },
      {
        id: 'unresolved', title: 'Unresolved (fixture)',
        entries: [
          {
            id: 'liveActivityTint', name: 'Live Activity tint', kind: 'colors',
            value: { provenance: 'unresolved-finding', resolution: { status: 'resolved', value: { color: '#102030' } } },
          },
          {
            id: 'accentColor', name: 'AccentColor', kind: 'colors',
            value: { provenance: 'unresolved-finding', resolution: { status: 'unresolved', reason: 'AccentColor.colorset has no defined value.', expression: 'AccentColor' } },
          },
        ],
      },
    ],
  };
}

test('buildCatalogSections: tokenDefinition derives the canonical title and real tokenSections geometry', () => {
  const pages = [defineCatalogPage({ id: 'tokens-colors', group: 'Tokens', description: 'Fixture colors.', tokenDefinition: fixtureColorsDefinition() })];
  const { sections } = buildCatalogSections(pages, []);
  const page = sections.find((s) => s.id === 'tokens-colors');
  assert.equal(page?.title, 'Colors');
  assert.equal(page?.tokenGallery, true);
  assert.deepEqual(page?.tokenSections?.map((s) => ({ id: s.id, title: s.title, wide: s.wide })), [
    { id: 'semantic', title: 'Semantic (fixture)', wide: undefined },
    { id: 'unresolved', title: 'Unresolved (fixture)', wide: undefined },
  ]);
  assert.equal(page?.tokenDefinition, pages[0].tokenDefinition);
});

test('buildCatalogSections: an explicit title matching the kind\'s canonical title is kept, no conflict', () => {
  const pages = [defineCatalogPage({ id: 'tokens-colors', title: 'Colors', group: 'Tokens', description: 'Fixture.', tokenDefinition: fixtureColorsDefinition() })];
  const { sections } = buildCatalogSections(pages, []);
  assert.equal(sections[0].title, 'Colors');
});

test('buildCatalogSections: tokenDefinition conflicting with an explicit title/render/tokenGallery/members reaches console.error in development', () => {
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => errors.push(message);
  try {
    const pages = [
      defineCatalogPage({
        id: 'tokens-colors', title: 'Palette', group: 'Tokens', description: 'Fixture.',
        tokenDefinition: fixtureColorsDefinition(), render: () => null,
      }),
    ];
    buildCatalogSections(pages, []);
    assert.ok(errors.some((e) => e.includes('title "Palette" conflicts with kind "colors"')), errors.join('\n'));
    assert.ok(errors.some((e) => e.includes('conflicts with this page\'s own "render"')), errors.join('\n'));
  } finally {
    console.error = originalError;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
});

test('buildCatalogSections: duplicate entry ids within a tokenDefinition section reach console.error in development', () => {
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => errors.push(message);
  try {
    const def = fixtureColorsDefinition();
    def.sections[1].entries.push({ ...def.sections[1].entries[0] });
    const pages = [defineCatalogPage({ id: 'tokens-colors', group: 'Tokens', description: 'Fixture.', tokenDefinition: def })];
    buildCatalogSections(pages, []);
    assert.ok(errors.some((e) => e.includes('more than one entry with id "liveActivityTint"')), errors.join('\n'));
  } finally {
    console.error = originalError;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
});

// Correction C5(c): `deriveTokenDefinition`'s own local conflict/duplicate-id messages (reached
// only via `console.error` in development — `pageApi.ts`'s own doc comment explains why that
// duplication exists at all) must read byte-for-byte identical to `tokenDefinition.ts`'s own
// canonical `validateTokenDefinition`/`validateTokenDefinitionUsage`, for the exact same input —
// pinning the deliberate duplication so the two can never silently drift apart.
test('buildCatalogSections: tokenDefinition\'s console.error messages are byte-for-byte identical to validateTokenDefinition + validateTokenDefinitionUsage for the same conflicting input', () => {
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => errors.push(message);
  const def = fixtureColorsDefinition();
  // Add a duplicate-section-id conflict and a duplicate-entry-id conflict on top of the fixture's
  // own shape, so this one input exercises every message family `deriveTokenDefinition` emits.
  def.sections.push({ ...def.sections[1], id: def.sections[0].id });
  def.sections[1].entries.push({ ...def.sections[1].entries[0] });
  const page = defineCatalogPage({
    id: 'tokens-colors', title: 'Palette', group: 'Tokens', description: 'Fixture.',
    tokenDefinition: def, render: () => null,
  });
  try {
    buildCatalogSections([page], []);
  } finally {
    console.error = originalError;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
  const expected = [
    ...validateTokenDefinitionUsage(def.kind, { hasRender: true, title: 'Palette' }),
    ...validateTokenDefinition(def),
  ];
  const prefixed = errors.map((e) => {
    const match = e.match(/^\[Catalog\] tokens-colors: (.*)$/);
    assert.ok(match, `unexpected console.error message shape: ${e}`);
    return match![1];
  });
  assert.deepEqual(prefixed.slice().sort(), expected.slice().sort());
});

test('buildCatalogSections: a page without tokenDefinition is unaffected (omission stays legacy-identical)', () => {
  const pages = [defineCatalogPage({ id: 'tokens-legacy', group: 'Tokens', description: 'Legacy.', tokenGallery: true, render: () => null })];
  const { sections } = buildCatalogSections(pages, []);
  const page = sections.find((s) => s.id === 'tokens-legacy');
  assert.equal(page?.tokenGallery, true);
  assert.equal(page?.tokenSections, undefined);
  assert.equal(page?.tokenDefinition, undefined);
});

// #64 B4: one page per kind — the dev-console mirror of `cli/doctor.ts`'s own
// `token-definition-duplicate-kind` rule.
test('buildCatalogSections: two pages sharing a tokenDefinition kind each reach console.error naming the other', () => {
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => errors.push(message);
  try {
    const a = defineCatalogPage({ id: 'colors-a', group: 'Tokens', description: 'Fixture.', tokenDefinition: fixtureColorsDefinition() });
    const b = defineCatalogPage({ id: 'colors-b', group: 'Tokens', description: 'Fixture.', tokenDefinition: fixtureColorsDefinition() });
    buildCatalogSections([a, b], []);
  } finally {
    console.error = originalError;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
  assert.ok(errors.some((e) => e === '[Catalog] colors-a: tokenDefinition kind "colors" is also used by colors-b.'));
  assert.ok(errors.some((e) => e === '[Catalog] colors-b: tokenDefinition kind "colors" is also used by colors-a.'));
});

test('buildCatalogSections: a single tokenDefinition page never reaches console.error about its own kind', () => {
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => errors.push(message);
  try {
    const a = defineCatalogPage({ id: 'colors-only', group: 'Tokens', description: 'Fixture.', tokenDefinition: fixtureColorsDefinition() });
    buildCatalogSections([a], []);
  } finally {
    console.error = originalError;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
  assert.equal(errors.some((e) => e.includes('is also used by')), false);
});

// #64 B5: a tokenDefinition page's aliases join the catalog-wide "one owner" pool — the dev-console
// mirror of `cli/doctor.ts`'s own `family-invalid` reuse.
test('buildCatalogSections: a tokenDefinition page\'s own alias colliding with another page\'s id reaches console.error', () => {
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => errors.push(message);
  try {
    const withAlias = defineCatalogPage({ id: 'colors', group: 'Tokens', description: 'Fixture.', aliases: ['Button'], tokenDefinition: fixtureColorsDefinition() });
    const other = defineCatalogPage({ id: 'Button', group: 'Components', description: 'Fixture.' });
    buildCatalogSections([withAlias, other], []);
  } finally {
    console.error = originalError;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
  assert.ok(errors.some((e) => e === '[Catalog] Page "colors": id "Button" collides with another page\'s id.'));
});

test('buildCatalogSections: a tokenDefinition page\'s own alias never reaches console.error when nothing else claims it', () => {
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => errors.push(message);
  try {
    const withAlias = defineCatalogPage({ id: 'colors', group: 'Tokens', description: 'Fixture.', aliases: ['OldColors'], tokenDefinition: fixtureColorsDefinition() });
    buildCatalogSections([withAlias], []);
  } finally {
    console.error = originalError;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
  assert.equal(errors.some((e) => e.includes('OldColors')), false);
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

// #63 A1: the single permitted rewrite of this test (controller decision) — a page with `members`
// and neither `whole` nor `sections` is now a valid *group* page (a), not a family error; a page
// with exactly one of the two stays the same family-shape error as before (b, c).
test('validateFamily: members with neither whole nor sections is not a family error — see validateGroup', () => {
  assert.deepEqual(validateFamily({ id: 'X', members: [{ id: 'X' }] }, new Set(), new Set()), []);
});

test('validateFamily: members with a whole but no sections is still an error', () => {
  const issues = validateFamily({ id: 'X', whole: 'X', members: [{ id: 'X' }] }, new Set(), new Set());
  assert.ok(issues.some((issue) => issue.includes('requires both "whole" and "sections"')));
});

test('validateFamily: members with sections but no whole is still an error', () => {
  const issues = validateFamily(
    { id: 'X', sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: [] }], members: [{ id: 'X' }] },
    new Set(), new Set(),
  );
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

// #60: the same derived "also used by" relationship family members already get, now also surfaced
// on an ordinary (non-family) page (rendered by `ReferenceDetails`'s `AlsoUsedByFact`). Reverting the
// derivation (an always-undefined `alsoUsedBy`) fails every test below: each asserts a non-trivial
// value a no-op field would not match.
test('buildCatalogSections: an ordinary page with no users gets an empty alsoUsedBy', () => {
  const pages = [defineCatalogPage({ id: 'Button', group: 'Components', description: 'x' })];
  const { sections } = buildCatalogSections(pages, [components[0]]);
  assert.deepEqual(sections.find((s) => s.id === 'Button')?.alsoUsedBy, []);
});

test('buildCatalogSections: alsoUsedBy derives an outside user of an ordinary page, by its own id', () => {
  const dock = defineCatalogPage({
    id: 'Dock', group: 'Components', description: 'd',
    composedOf: [{ component: 'Button', role: 'Primary action', relationship: 'built-in' as const }],
  });
  const button = defineCatalogPage({ id: 'Button', group: 'Components', description: 'x' });
  const { sections } = buildCatalogSections([button, dock], [components[0]]);
  assert.deepEqual(sections.find((s) => s.id === 'Button')?.alsoUsedBy, [{ component: 'Dock', role: 'Primary action' }]);
});

// The target-canonicalization half of this task: an ordinary page's id ("PillButton") differs from
// its own bound component export ("Button") — another page's composedOf names the component, not
// the page id, and must still attribute to the real page address.
test('buildCatalogSections: alsoUsedBy resolves a composedOf entry naming an ordinary page\'s own component, not its id', () => {
  const widget = { name: 'Button', file: 'src/Button.tsx', props: [], inheritedFrom: [] };
  const pillButton = defineCatalogPage({ id: 'PillButton', component: 'Button', group: 'Components', description: 'x' });
  const dock = defineCatalogPage({
    id: 'Dock', group: 'Components', description: 'd',
    composedOf: [{ component: 'Button', role: 'Primary action', relationship: 'built-in' as const }],
  });
  const { sections } = buildCatalogSections([pillButton, dock], [widget]);
  assert.deepEqual(sections.find((s) => s.id === 'PillButton')?.alsoUsedBy, [{ component: 'Dock', role: 'Primary action' }]);
});

// Negative control: two ordinary pages binding the same component export name is ambiguous — the
// canonicalization must never guess one of them, so neither page's alsoUsedBy picks up the entry
// (it stays attributed to the literal, unresolved component name, which no page's own id matches).
test('buildCatalogSections: alsoUsedBy never guesses between two ordinary pages that bind the same component name', () => {
  const shared = { name: 'Shared', file: 'src/Shared.tsx', props: [], inheritedFrom: [] };
  const pageA = defineCatalogPage({ id: 'PageA', component: 'Shared', group: 'Components', description: 'a' });
  const pageB = defineCatalogPage({ id: 'PageB', component: 'Shared', group: 'Components', description: 'b' });
  const dock = defineCatalogPage({
    id: 'Dock', group: 'Components', description: 'd',
    composedOf: [{ component: 'Shared', role: 'r', relationship: 'built-in' as const }],
  });
  const { sections } = buildCatalogSections([pageA, pageB, dock], [shared]);
  assert.deepEqual(sections.find((s) => s.id === 'PageA')?.alsoUsedBy, []);
  assert.deepEqual(sections.find((s) => s.id === 'PageB')?.alsoUsedBy, []);
});

// C1: a family member's own `component` binding and an ordinary page's own `component` binding
// are the same kind of guess — two of them sharing one name is genuine ambiguity, not a case where
// one side has legacy priority. (The predecessor version of this test used the same two colliding
// `FaceComponent` bindings but asserted the member silently won; that encoded a guess as policy.
// Corrected per the controller's C1 instruction, not carried forward.)
test('buildCatalogSections: alsoUsedBy never guesses between a family member and an ordinary page that bind the same component name', () => {
  const faceComponent = { name: 'FaceComponent', file: 'src/Face.tsx', props: [], inheritedFrom: [] };
  const family = defineCatalogPage({
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
  const unrelated = defineCatalogPage({ id: 'UnrelatedPage', component: 'FaceComponent', group: 'Components', description: 'x' });
  const dock = defineCatalogPage({
    id: 'Dock', group: 'Components', description: 'd',
    composedOf: [{ component: 'FaceComponent', role: 'Header icon', relationship: 'built-in' as const }],
  });
  const { sections } = buildCatalogSections([family, unrelated, dock], [faceComponent]);
  const memberFamily = sections.find((s) => s.id === 'W')?.family;
  assert.deepEqual(memberFamily?.members.find((m) => m.id === 'Face')?.alsoUsedBy, []);
  assert.deepEqual(sections.find((s) => s.id === 'UnrelatedPage')?.alsoUsedBy, []);
});

// C1, the genuine (non-guessed) version of the legacy rule above: an explicit *alias* is a real
// registered address, so it still wins over a same-named ordinary page's mere component binding —
// unlike two colliding component bindings, there is no ambiguity here to guess around.
test('buildCatalogSections: alsoUsedBy prefers an explicit member alias over a same-named ordinary page\'s component binding', () => {
  const aliasComponent = { name: 'AliasedExport', file: 'src/Face.tsx', props: [], inheritedFrom: [] };
  const family = defineCatalogPage({
    id: 'W', group: 'Components', description: 'd',
    whole: 'W',
    sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['Face'] }],
    members: [
      { id: 'W', source: 'w.tsx:1', fidelity: 'documentation-only' as const, relationship: 'Whole', description: 'd' },
      {
        id: 'Face', source: 'f.tsx:1', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'W',
        description: 'd', aliases: ['FaceAlias'],
      },
    ],
  });
  // An ordinary page's component binding happens to share the member's *alias* string, not its id —
  // the alias is still the one real registered address for that string, so it must win.
  const unrelated = defineCatalogPage({ id: 'UnrelatedPage', component: 'FaceAlias', group: 'Components', description: 'x' });
  const dock = defineCatalogPage({
    id: 'Dock', group: 'Components', description: 'd',
    composedOf: [{ component: 'FaceAlias', role: 'Header icon', relationship: 'built-in' as const }],
  });
  const { sections } = buildCatalogSections([family, unrelated, dock], [aliasComponent]);
  const memberFamily = sections.find((s) => s.id === 'W')?.family;
  assert.deepEqual(memberFamily?.members.find((m) => m.id === 'Face')?.alsoUsedBy, [{ component: 'Dock', role: 'Header icon' }]);
  assert.deepEqual(sections.find((s) => s.id === 'UnrelatedPage')?.alsoUsedBy, []);
});

// C1: two different family members (in two different families) binding the same component name is
// the member-vs-member half of the same ambiguity rule as the ordinary-vs-ordinary negative control
// above — neither may be guessed.
test('buildCatalogSections: alsoUsedBy never guesses between two family members (in different families) that bind the same component name', () => {
  const shared = { name: 'Shared', file: 'src/Shared.tsx', props: [], inheritedFrom: [] };
  const familyOne = defineCatalogPage({
    id: 'One', group: 'Components', description: 'd', whole: 'One',
    sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['OnePart'] }],
    members: [
      { id: 'One', source: 'one.tsx:1', fidelity: 'documentation-only' as const, relationship: 'Whole', description: 'd' },
      { id: 'OnePart', component: 'Shared', source: 'one.tsx:2', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'One', description: 'd' },
    ],
  });
  const familyTwo = defineCatalogPage({
    id: 'Two', group: 'Components', description: 'd', whole: 'Two',
    sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['TwoPart'] }],
    members: [
      { id: 'Two', source: 'two.tsx:1', fidelity: 'documentation-only' as const, relationship: 'Whole', description: 'd' },
      { id: 'TwoPart', component: 'Shared', source: 'two.tsx:2', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'Two', description: 'd' },
    ],
  });
  const dock = defineCatalogPage({
    id: 'Dock', group: 'Components', description: 'd',
    composedOf: [{ component: 'Shared', role: 'r', relationship: 'built-in' as const }],
  });
  const { sections } = buildCatalogSections([familyOne, familyTwo, dock], [shared]);
  assert.deepEqual(sections.find((s) => s.id === 'One')?.family?.members.find((m) => m.id === 'OnePart')?.alsoUsedBy, []);
  assert.deepEqual(sections.find((s) => s.id === 'Two')?.family?.members.find((m) => m.id === 'TwoPart')?.alsoUsedBy, []);
});

// C1's real producer repro: an ordinary page's own id ("Button") is itself the exact, registered
// address for that name — it must win "also used by" even though another ordinary page
// ("Alternative") also binds its own `component` to the same name "Button". Before the fix,
// `Button`'s own id being equal to its own component name caused it to be skipped from the
// ambiguity bookkeeping entirely, letting `Alternative` claim the name uncontested.
test('buildCatalogSections: alsoUsedBy attributes to a page\'s own exact id, not another page that merely binds the same component name', () => {
  const widget = { name: 'Button', file: 'src/Button.tsx', props: [], inheritedFrom: [] };
  const button = defineCatalogPage({ id: 'Button', group: 'Components', description: 'x' });
  const alternative = defineCatalogPage({ id: 'Alternative', component: 'Button', group: 'Components', description: 'x' });
  const consumer = defineCatalogPage({
    id: 'Consumer', group: 'Components', description: 'd',
    composedOf: [{ component: 'Button', role: 'action', relationship: 'built-in' as const }],
  });
  for (const pages of [[button, alternative, consumer], [alternative, consumer, button], [consumer, button, alternative]]) {
    const { sections } = buildCatalogSections(pages, [widget]);
    assert.deepEqual(sections.find((s) => s.id === 'Button')?.alsoUsedBy, [{ component: 'Consumer', role: 'action' }]);
    assert.deepEqual(sections.find((s) => s.id === 'Alternative')?.alsoUsedBy, []);
  }
});

// Negative control: a page's own composedOf naming itself as built-in never becomes its own user.
test('buildCatalogSections: an ordinary page\'s alsoUsedBy excludes itself', () => {
  const pages = [defineCatalogPage({
    id: 'Button', group: 'Components', description: 'x',
    composedOf: [{ component: 'Button', role: 'r', relationship: 'built-in' as const }],
  })];
  const { sections } = buildCatalogSections(pages, [components[0]]);
  assert.deepEqual(sections.find((s) => s.id === 'Button')?.alsoUsedBy, []);
});

// Negative control, same rule family-level alsoUsedBy already follows: only 'built-in' counts.
test('buildCatalogSections: an ordinary page\'s alsoUsedBy ignores "slot" and "related" composedOf entries', () => {
  const dock = defineCatalogPage({
    id: 'Dock', group: 'Components', description: 'd',
    composedOf: [
      { component: 'Button', role: 'Optional icon', relationship: 'slot' as const },
      { component: 'Button', role: 'Seen together', relationship: 'related' as const },
    ],
  });
  const button = defineCatalogPage({ id: 'Button', group: 'Components', description: 'x' });
  const { sections } = buildCatalogSections([button, dock], [components[0]]);
  assert.deepEqual(sections.find((s) => s.id === 'Button')?.alsoUsedBy, []);
});

// An undocumented component's own stub also gets alsoUsedBy, the same derivation as a documented page.
test('buildCatalogSections: an undocumented-component stub also gets alsoUsedBy', () => {
  const dock = defineCatalogPage({
    id: 'Dock', group: 'Components', description: 'd',
    composedOf: [{ component: 'Badge', role: 'Status', relationship: 'built-in' as const }],
  });
  const { sections } = buildCatalogSections([dock], [components[1]]); // Badge, no page of its own
  assert.deepEqual(sections.find((s) => s.id === 'Badge')?.alsoUsedBy, [{ component: 'Dock', role: 'Status' }]);
});

// ---------------------------------------------------------------------------------------------
// #63 group pages (A1, A3, A4, A5, A6)
// ---------------------------------------------------------------------------------------------

test('validateGroup is a no-op for a page without members', () => {
  assert.deepEqual(validateGroup({ id: 'G' }, new Set(), new Set()), []);
});

test('validateGroup: a member id or member alias equal to its own page id is reported (it could never be addressed)', () => {
  const byId = validateGroup({ id: 'Widgets', members: [{ id: 'Widgets' }, { id: 'Other' }] }, new Set(), new Set());
  assert.ok(byId.some((i) => i.includes('"Widgets" collides with this group page\'s own id')), byId.join('\n'));
  const byAlias = validateGroup({ id: 'Widgets', members: [{ id: 'Other', aliases: ['Widgets'] }] }, new Set(), new Set());
  assert.ok(byAlias.some((i) => i.includes('"Widgets" collides with this group page\'s own id')), byAlias.join('\n'));
  assert.deepEqual(validateGroup({ id: 'Widgets', members: [{ id: 'WidgetsComponent' }] }, new Set(), new Set()), []);
});

test('validateGroup: a non-empty relatedPages is reported as unused (a group page renders no Related list); an empty one is fine', () => {
  const issues = validateGroup({ id: 'G', members: [{ id: 'Only' }], relatedPages: [{ page: 'Elsewhere' }] }, new Set(), new Set());
  assert.ok(issues.some((i) => i.includes('"relatedPages" is not used on a group page')), issues.join('\n'));
  assert.deepEqual(validateGroup({ id: 'G', members: [{ id: 'Only' }], relatedPages: [] }, new Set(), new Set()), []);
});

test('validateGroup: a single member with no parent is a valid minimal group', () => {
  const issues = validateGroup({ id: 'G', members: [{ id: 'Only' }] }, new Set(), new Set());
  assert.deepEqual(issues, []);
});

test('validateGroup: a parent unknown both on this page and catalog-wide is reported', () => {
  const issues = validateGroup({ id: 'G', members: [{ id: 'A', parent: 'Nope' }] }, new Set(), new Set());
  assert.ok(issues.some((i) => i.includes('member "A" has an unknown parent "Nope"')));
});

// A3: a member whose parent names a member on a *different* page (known catalog-wide) is
// top-level, not an error — the cross-page case this rule must allow.
test('validateGroup: a parent known catalog-wide but not on this page is accepted (cross-page top-level)', () => {
  const issues = validateGroup({ id: 'G', members: [{ id: 'A', parent: 'FamilyWhole' }] }, new Set(), new Set(['FamilyWhole']));
  assert.deepEqual(issues, []);
});

test('validateGroup: a same-page parent cycle is reported', () => {
  const issues = validateGroup({ id: 'G', members: [{ id: 'A', parent: 'B' }, { id: 'B', parent: 'A' }] }, new Set(), new Set());
  assert.ok(issues.some((i) => i.includes('parent cycle')));
});

// A6: no privileged "whole" exemption — every id, including a top-level member's own, is checked.
test('validateGroup: member and alias ids must be unique catalog-wide, with no whole exemption', () => {
  const collidesWithPage = validateGroup({ id: 'G', members: [{ id: 'A' }] }, new Set(['A']), new Set());
  assert.ok(collidesWithPage.some((i) => i.includes('id "A" collides with another page\'s id')));

  const collidesWithMember = validateGroup({ id: 'G', members: [{ id: 'A' }] }, new Set(), new Set(['A']));
  assert.ok(collidesWithMember.some((i) => i.includes('id "A" collides with another member or alias')));

  const duplicateOnPage = validateGroup({ id: 'G', members: [{ id: 'A' }, { id: 'B', aliases: ['A'] }] }, new Set(), new Set());
  assert.ok(duplicateOnPage.some((i) => i.includes('id "A" is used more than once on this page')));
});

test('validateGroup: page-level anatomy is reported', () => {
  const issues = validateGroup({ id: 'G', members: [{ id: 'A' }], anatomy: { groups: [] } }, new Set(), new Set());
  assert.ok(issues.some((i) => i.includes('page-level "anatomy" is not used on a group page')));
});

test('validateGroup: anatomy on a non-top-level member is reported', () => {
  const issues = validateGroup({
    id: 'G',
    members: [{ id: 'Top' }, { id: 'Part', parent: 'Top', anatomy: { groups: [] } }],
  }, new Set(), new Set());
  assert.ok(issues.some((i) => i.includes('member "Part" has "anatomy", but anatomy is only used on a top-level member')));
});

test('validateGroup: a top-level member\'s anatomy item naming a non-descendant is reported', () => {
  const issues = validateGroup({
    id: 'G',
    members: [
      { id: 'Top', anatomy: { groups: [{ label: 'X', items: [{ member: 'Other', description: 'd' }] }] } },
      { id: 'Part', parent: 'Top' },
      { id: 'Other' },
    ],
  }, new Set(), new Set());
  assert.ok(issues.some((i) => i.includes('anatomy item "Other" is not one of its descendants')));
});

test('validateGroup: a top-level member\'s anatomy item naming itself is reported', () => {
  const issues = validateGroup({
    id: 'G',
    members: [{ id: 'Top', anatomy: { groups: [{ label: 'X', items: [{ member: 'Top', description: 'd' }] }] } }],
  }, new Set(), new Set());
  assert.ok(issues.some((i) => i.includes('anatomy item "Top" names itself')));
});

test('validateGroup: a top-level member\'s anatomy naming a real descendant (including a grandchild) is valid', () => {
  const issues = validateGroup({
    id: 'G',
    members: [
      { id: 'Top', anatomy: { groups: [{ label: 'X', items: [{ member: 'Part', description: 'd' }, { member: 'Grand', description: 'g' }] }] } },
      { id: 'Part', parent: 'Top' },
      { id: 'Grand', parent: 'Part' },
    ],
  }, new Set(), new Set());
  assert.deepEqual(issues, []);
});

test('validateGroup: an anatomy item listing the same descendant twice is reported', () => {
  const issues = validateGroup({
    id: 'G',
    members: [
      { id: 'Top', anatomy: { groups: [{ label: 'X', items: [{ member: 'Part', description: 'd' }, { member: 'Part', description: 'd2' }] }] } },
      { id: 'Part', parent: 'Top' },
    ],
  }, new Set(), new Set());
  assert.ok(issues.some((i) => i.includes('anatomy lists member "Part" more than once')));
});

// A4: the same numbering algorithm `numberFor` uses for a family's own whole, re-anchored on one
// top-level group member.
test('numberForGroupMember: authored order, nested children, and no number for the top-level member itself', () => {
  const members = [
    { id: 'Top' },
    { id: 'P1', parent: 'Top' },
    { id: 'P2', parent: 'Top' },
    { id: 'C1', parent: 'P2' },
  ];
  const outline = numberForGroupMember('Top', members);
  assert.equal(outline.get('P1')?.number, '1');
  assert.equal(outline.get('P2')?.number, '2');
  assert.equal(outline.get('C1')?.number, '2.1');
  assert.equal(outline.has('Top'), false);
});

test('numberForGroupMember: a parent cycle does not throw and leaves the rest of the outline intact', () => {
  const members = [{ id: 'Top' }, { id: 'P1', parent: 'Top' }, { id: 'A', parent: 'B' }, { id: 'B', parent: 'A' }];
  const outline = numberForGroupMember('Top', members);
  assert.equal(outline.get('P1')?.number, '1');
  assert.equal(outline.has('A'), false);
  assert.equal(outline.has('B'), false);
});

test('resolveExternalPart: zero owners is reported', () => {
  const result = resolveExternalPart('X', [], 'Whole');
  assert.ok('issue' in result && result.issue.includes('is not defined on any group page'));
});

test('resolveExternalPart: more than one owner is reported', () => {
  const result = resolveExternalPart('X', [{ pageId: 'G1', isGroupPage: true, parent: 'Whole' }, { pageId: 'G2', isGroupPage: true, parent: 'Whole' }], 'Whole');
  assert.ok('issue' in result && result.issue.includes('more than one page'));
});

test('resolveExternalPart: an owner that is not a group page is reported', () => {
  const result = resolveExternalPart('X', [{ pageId: 'OrdinaryPage', isGroupPage: false, parent: 'Whole' }], 'Whole');
  assert.ok('issue' in result && result.issue.includes('is not a group page'));
});

test('resolveExternalPart: a parent that does not equal the family\'s whole is reported', () => {
  const result = resolveExternalPart('X', [{ pageId: 'G1', isGroupPage: true, parent: 'SomeoneElse' }], 'Whole');
  assert.ok('issue' in result && result.issue.includes('does not equal'));
});

test('resolveExternalPart: exactly one group-page owner with a matching parent resolves', () => {
  const result = resolveExternalPart('X', [{ pageId: 'G1', isGroupPage: true, parent: 'Whole' }], 'Whole');
  assert.deepEqual(result, { pageId: 'G1' });
});

function groupPage(overrides: Partial<Parameters<typeof defineCatalogPage>[0]> = {}) {
  return defineCatalogPage({
    id: 'Widgets', group: 'Components', description: 'A group of widgets.',
    members: [
      { id: 'WidgetA', source: 'a.swift:1', fidelity: 'documentation-only' as const, relationship: 'Top-level', description: 'A.' },
      { id: 'WidgetB', source: 'b.swift:1', fidelity: 'documentation-only' as const, relationship: 'Top-level', description: 'B.' },
    ],
    ...overrides,
  });
}

test('buildCatalogSections: a group page\'s family has whole undefined, kind "group", and no sections', () => {
  const { sections } = buildCatalogSections([groupPage()], []);
  const family = sections.find((s) => s.id === 'Widgets')?.family;
  assert.equal(family?.whole, undefined);
  assert.equal(family?.kind, 'group');
  assert.deepEqual(family?.sections, []);
});

test('buildCatalogSections: a group\'s outline numbers each top-level member\'s own parts independently', () => {
  const page = groupPage({
    members: [
      { id: 'Top1', source: 'a.swift:1', fidelity: 'documentation-only' as const, relationship: 'Top', description: 'd' },
      { id: 'Top1Part', source: 'a.swift:2', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'Top1', description: 'd' },
      { id: 'Top2', source: 'b.swift:1', fidelity: 'documentation-only' as const, relationship: 'Top', description: 'd' },
      { id: 'Top2Part', source: 'b.swift:2', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'Top2', description: 'd' },
    ],
  });
  const { sections } = buildCatalogSections([page], []);
  const family = sections.find((s) => s.id === 'Widgets')?.family;
  assert.equal(family?.outline.get('Top1Part')?.number, '1');
  assert.equal(family?.outline.get('Top2Part')?.number, '1');
  assert.equal(family?.outline.has('Top1'), false);
  assert.equal(family?.outline.has('Top2'), false);
});

test('buildCatalogSections: a group page\'s members are searchable via alsoUsedBy/component resolution like a family\'s', () => {
  const dock = defineCatalogPage({
    id: 'Dock', group: 'Components', description: 'd',
    composedOf: [{ component: 'WidgetA', role: 'Primary', relationship: 'built-in' as const }],
  });
  const { sections } = buildCatalogSections([groupPage(), dock], []);
  const family = sections.find((s) => s.id === 'Widgets')?.family;
  assert.deepEqual(family?.members.find((m) => m.id === 'WidgetA')?.alsoUsedBy, [{ component: 'Dock', role: 'Primary' }]);
});

test('buildCatalogSections: an invalid group reaches console.error in development', () => {
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => errors.push(message);
  try {
    const page = groupPage({ members: [{ id: 'A', parent: 'Nope', source: 'a:1', fidelity: 'documentation-only' as const, relationship: 'X', description: 'd' }] });
    buildCatalogSections([page], []);
    assert.ok(errors.some((e) => e.includes('unknown parent "Nope"')), errors.join('\n'));
  } finally {
    console.error = originalError;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
});

// A5/A6: a family's `inWhole` section lists an id defined on a group page, whose own `parent`
// equals the family's whole — the external-part happy path, on both sides.
function familyWithExternalPart(groupMemberOverrides: Record<string, unknown> = {}) {
  const family = defineCatalogPage({
    id: 'BotAvatarView', group: 'Components', description: 'd', whole: 'BotAvatarView',
    sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['BotAnimatedFaceView', 'ExternalEyes'] }],
    members: [
      { id: 'BotAvatarView', source: 'w.swift:1', fidelity: 'documentation-only' as const, relationship: 'Whole', description: 'd' },
      { id: 'BotAnimatedFaceView', source: 'f.swift:1', fidelity: 'documentation-only' as const, relationship: 'Part', parent: 'BotAvatarView', description: 'd' },
    ],
  });
  const group = defineCatalogPage({
    id: 'EyesGroup', group: 'Components', description: 'd',
    members: [
      { id: 'ExternalEyes', source: 'e.swift:1', fidelity: 'documentation-only' as const, relationship: 'Top', parent: 'BotAvatarView', description: 'd', ...groupMemberOverrides },
    ],
  });
  return { family, group };
}

test('buildCatalogSections: a valid external part gets a normal number in the family\'s outline, with no "not a member" issue', () => {
  const { family: familyPage, group } = familyWithExternalPart();
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => errors.push(message);
  try {
    const { sections } = buildCatalogSections([familyPage, group], []);
    const family = sections.find((s) => s.id === 'BotAvatarView')?.family;
    assert.equal(family?.outline.get('ExternalEyes')?.number, '2');
    assert.deepEqual(family?.externalParts?.get('ExternalEyes'), { pageId: 'EyesGroup', title: 'EyesGroup', fidelity: 'documentation-only' });
    assert.ok(!errors.some((e) => e.includes('is not a member of this page')), errors.join('\n'));
  } finally {
    console.error = originalError;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
});

test('buildCatalogSections: the external part\'s own group member gets partOf with the family\'s page id/title/number', () => {
  const { family: familyPage, group } = familyWithExternalPart();
  const { sections } = buildCatalogSections([familyPage, group], []);
  const groupFamily = sections.find((s) => s.id === 'EyesGroup')?.family;
  assert.deepEqual(groupFamily?.members.find((m) => m.id === 'ExternalEyes')?.partOf, {
    pageId: 'BotAvatarView', title: 'BotAvatarView', number: '2',
  });
});

test('buildCatalogSections: an external part whose owner\'s parent does not match the family\'s whole reaches console.error, and is still reported as not a member', () => {
  const { family: familyPage, group } = familyWithExternalPart({ parent: 'SomeoneElse' });
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => errors.push(message);
  try {
    const { sections } = buildCatalogSections([familyPage, group], []);
    const family = sections.find((s) => s.id === 'BotAvatarView')?.family;
    assert.equal(family?.externalParts?.get('ExternalEyes'), undefined);
    assert.ok(errors.some((e) => e.includes('does not equal')), errors.join('\n'));
    assert.ok(errors.some((e) => e.includes('"ExternalEyes", which is not a member of this page')), errors.join('\n'));
  } finally {
    console.error = originalError;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
});

test('buildCatalogSections: an external part owned by more than one page reaches console.error naming both', () => {
  const { family: familyPage, group } = familyWithExternalPart();
  const secondGroup = defineCatalogPage({
    id: 'OtherGroup', group: 'Components', description: 'd',
    members: [{ id: 'ExternalEyes', source: 'e2.swift:1', fidelity: 'documentation-only' as const, relationship: 'Top', parent: 'BotAvatarView', description: 'd' }],
  });
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => errors.push(message);
  try {
    buildCatalogSections([familyPage, group, secondGroup], []);
    assert.ok(errors.some((e) => e.includes('more than one page') && e.includes('EyesGroup') && e.includes('OtherGroup')), errors.join('\n'));
  } finally {
    console.error = originalError;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
});

test('validateFamily: an external part listed in two sections, or twice in one, is reported as in more than one section', () => {
  const base = { id: 'Card', whole: 'Card', members: [{ id: 'Card' }, { id: 'OwnPart', parent: 'Card' }] };
  const external = new Set(['ExternalPart']);
  const twoSections = { ...base, sections: [
    { label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['OwnPart', 'ExternalPart'] },
    { label: 'More', kind: 'blocks' as const, inWhole: true, members: ['ExternalPart'] },
  ] };
  const twiceInOne = { ...base, sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['OwnPart', 'ExternalPart', 'ExternalPart'] }] };
  const once = { ...base, sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['OwnPart', 'ExternalPart'] }] };
  for (const page of [twoSections, twiceInOne]) {
    const issues = validateFamily(page as never, new Set(['Card']), new Set(), external);
    assert.ok(issues.some((i) => i.includes('"ExternalPart" is in more than one section')), issues.join('\n'));
  }
  assert.deepEqual(validateFamily(once as never, new Set(['Card']), new Set(), external), []);
});

test('buildCatalogSections: an external part named twice reaches console.error as in more than one section', () => {
  const { family, group } = familyWithExternalPart();
  const twice = defineCatalogPage({
    ...family,
    sections: [
      { label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['BotAnimatedFaceView', 'ExternalEyes'] },
      { label: 'More', kind: 'blocks' as const, inWhole: true, members: ['ExternalEyes'] },
    ],
  } as never);
  const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => errors.push(message);
  try {
    buildCatalogSections([twice, group], []);
    assert.ok(errors.some((e) => e.includes('"ExternalEyes" is in more than one section')), errors.join('\n'));
  } finally {
    console.error = originalError;
    (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
  }
});

test('validateFamily: an anatomy item naming a resolved external part is valid, like the section listing it', () => {
  const page = {
    id: 'Card', whole: 'Card',
    members: [{ id: 'Card' }, { id: 'OwnPart', parent: 'Card' }],
    sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['OwnPart', 'ExternalPart'] }],
    anatomy: { groups: [{ label: 'Shown', items: [{ member: 'OwnPart', description: 'd' }, { member: 'ExternalPart', description: 'd' }] }] },
  };
  assert.deepEqual(validateFamily(page as never, new Set(['Card']), new Set(), new Set(['ExternalPart'])), []);
  // Still reported when the id is not a resolved external part.
  assert.ok(validateFamily(page as never, new Set(['Card']), new Set(), new Set()).some((i) => i.includes('anatomy item "ExternalPart" is not a member of this page')));
});
