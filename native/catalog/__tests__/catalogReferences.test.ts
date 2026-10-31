import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browsableIds, buildReferenceIndex, hasReferenceNavigation, resolveReference, searchReferenceIndex } from '../catalogReferences.ts';
import { aliasTargets, orderedIds } from '../catalogNavigation.ts';
import { buildCatalogSections, defineCatalogPage } from '../pageApi.ts';
import type { SectionDef } from '../types.ts';

function section(overrides: Partial<SectionDef>): SectionDef {
  return { id: 'Button', description: 'd', path: 'p', ...overrides };
}

test('hasReferenceNavigation is false for a catalog with no opted-in page, true once any page opts in', () => {
  assert.equal(hasReferenceNavigation([section({ id: 'Button' }), section({ id: 'Card' })]), false);
  assert.equal(hasReferenceNavigation([section({ id: 'Button' }), section({ id: 'Card', navigation: 'reference' })]), true);
  // Omitted navigation is the same as explicit 'browse' — neither counts as opting in.
  assert.equal(hasReferenceNavigation([section({ id: 'Button', navigation: 'browse' })]), false);
});

test('browsableIds includes every page whose navigation is omitted or "browse", and excludes "reference" pages only', () => {
  const sections = [
    section({ id: 'Button' }),
    section({ id: 'Card', navigation: 'browse' }),
    section({ id: 'TokenSheet', navigation: 'reference' }),
  ];
  assert.deepEqual(browsableIds(sections), new Set(['Button', 'Card']));
});

test('browsableIds composes with orderedIds\'s own availableIds to drop a reference page from the browse sequence, while the page keeps its own address', () => {
  const sections = [section({ id: 'Button' }), section({ id: 'TokenSheet', navigation: 'reference' })];
  const groups = [{ label: 'Components', ids: ['Button', 'TokenSheet'] }];
  assert.deepEqual(orderedIds(groups, browsableIds(sections)), ['Button']);
});

const botAvatarFamily: SectionDef['family'] = {
  whole: 'BotAvatarView',
  outline: new Map(),
  sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['BotAnimatedFaceView'] }],
  aliases: ['OldBotAvatar'],
  members: [
    { id: 'BotAvatarView', source: 'x:1', fidelity: 'approximated', relationship: 'Main component', description: 'd', path: 'x:1' },
    {
      id: 'BotAnimatedFaceView', component: 'FaceComponent', source: 'y:1', fidelity: 'documentation-only',
      relationship: 'Anatomy', parent: 'BotAvatarView', description: 'd', path: 'y:1', aliases: ['OldFaceView'],
    },
  ],
};

test('buildReferenceIndex lists one entry per ordinary page, and never a separate entry for a family\'s own whole', () => {
  const entries = buildReferenceIndex([
    section({ id: 'Button', title: 'Button', component: 'Button', path: 'src/Button.tsx' }),
    section({ id: 'BotAvatarView', title: 'Bot avatar', family: botAvatarFamily, path: 'src/BotAvatarView.tsx' }),
  ]);
  assert.equal(entries.filter((e) => e.pageId === 'BotAvatarView' && e.memberId === undefined).length, 1);
  assert.equal(entries.filter((e) => e.memberId === 'BotAvatarView').length, 0); // the whole is not listed as its own member
  const button = entries.find((e) => e.pageId === 'Button');
  assert.deepEqual(button, { pageId: 'Button', title: 'Button', component: 'Button', aliases: [], path: 'src/Button.tsx' });
});

test('buildReferenceIndex lists every non-whole family member, with its own component/aliases/path, under its page id', () => {
  const entries = buildReferenceIndex([section({ id: 'BotAvatarView', family: botAvatarFamily, path: 'src/BotAvatarView.tsx' })]);
  const face = entries.find((e) => e.memberId === 'BotAnimatedFaceView');
  assert.deepEqual(face, {
    pageId: 'BotAvatarView', memberId: 'BotAnimatedFaceView', title: 'BotAnimatedFaceView',
    component: 'FaceComponent', aliases: ['OldFaceView'], path: 'y:1',
  });
  const whole = entries.find((e) => e.pageId === 'BotAvatarView' && e.memberId === undefined);
  assert.deepEqual(whole?.aliases, ['OldBotAvatar']); // family-level (page) aliases; this fixture's whole member itself has none
});

// C2 repro: a family's own main record (the whole) carries a real component binding and source,
// but the page-level entry used to never surface them — `component` stayed undefined and `path`
// fell back to the section's own path, never the whole member's real one.
const actionsFamily: SectionDef['family'] = {
  whole: 'Actions',
  outline: new Map(),
  sections: [],
  members: [
    {
      id: 'Actions', component: 'Button', source: 'native/Actions.swift', path: 'native/Actions.swift',
      description: 'd', relationship: 'Whole', fidelity: 'approximated',
    },
  ],
};

test('buildReferenceIndex retains the whole member\'s own component and path on the single page-level entry, not a duplicate whole entry', () => {
  const entries = buildReferenceIndex([section({ id: 'Actions', title: 'Actions', family: actionsFamily, path: 'generated/Actions.tsx' })]);
  assert.equal(entries.length, 1); // never a second, duplicate entry for the whole
  assert.deepEqual(entries[0], {
    pageId: 'Actions', title: 'Actions', component: 'Button', aliases: [], path: 'native/Actions.swift',
  });
  assert.ok(searchReferenceIndex(entries, 'Button').some((e) => e.pageId === 'Actions'));
  assert.deepEqual(resolveReference('Button', ['Actions'], new Map(), entries), { kind: 'address', pageId: 'Actions', memberId: undefined });
});

// C2's honesty requirement: a documentation-only whole with no detected binding must not invent one.
test('buildReferenceIndex leaves the page-level entry\'s component undefined when the whole has no binding', () => {
  const entries = buildReferenceIndex([section({ id: 'BotAvatarView', family: botAvatarFamily, path: 'src/BotAvatarView.tsx' })]);
  const whole = entries.find((e) => e.pageId === 'BotAvatarView' && e.memberId === undefined);
  assert.equal(whole?.component, undefined);
});

// C2's alias-merge requirement: the page-level entry's aliases are the family's own (page-level)
// aliases and the whole member's own aliases together, deduplicated, with neither author array mutated.
test('buildReferenceIndex merges page-level aliases with the whole member\'s own aliases, deduplicated', () => {
  const familyWithWholeAlias: SectionDef['family'] = {
    ...actionsFamily,
    aliases: ['OldActions', 'SharedAlias'],
    members: [{ ...actionsFamily.members[0], aliases: ['LegacyActions', 'SharedAlias'] }],
  };
  const beforePageAliases = [...familyWithWholeAlias.aliases!];
  const beforeMemberAliases = [...familyWithWholeAlias.members[0].aliases!];
  const entries = buildReferenceIndex([section({ id: 'Actions', family: familyWithWholeAlias, path: 'generated/Actions.tsx' })]);
  assert.deepEqual(entries[0].aliases, ['OldActions', 'SharedAlias', 'LegacyActions']);
  assert.deepEqual(familyWithWholeAlias.aliases, beforePageAliases); // not mutated
  assert.deepEqual(familyWithWholeAlias.members[0].aliases, beforeMemberAliases); // not mutated
});

test('searchReferenceIndex matches by id, title, component name, alias, or source path, case-insensitively; empty query finds nothing', () => {
  const entries = buildReferenceIndex([
    section({ id: 'BotAvatarView', title: 'Bot avatar', family: botAvatarFamily, path: 'src/BotAvatarView.tsx' }),
  ]);
  assert.equal(searchReferenceIndex(entries, '').length, 0);
  assert.ok(searchReferenceIndex(entries, 'bot avatar').some((e) => e.pageId === 'BotAvatarView' && e.memberId === undefined)); // title
  assert.ok(searchReferenceIndex(entries, 'facecomponent').some((e) => e.memberId === 'BotAnimatedFaceView')); // component
  assert.ok(searchReferenceIndex(entries, 'oldfaceview').some((e) => e.memberId === 'BotAnimatedFaceView')); // alias
  assert.ok(searchReferenceIndex(entries, 'y:1').some((e) => e.memberId === 'BotAnimatedFaceView')); // source path
  assert.equal(searchReferenceIndex(entries, 'zzz').length, 0);
});

test('the real builder retains native declaration sources separately from replica implementation paths', () => {
  const page = defineCatalogPage({
    id: 'Actions', group: 'Components', description: 'Actions', whole: 'Actions',
    members: [
      { id: 'Actions', component: 'ActionsReplica', source: 'native/Actions.swift:10', description: 'Actions', relationship: 'Whole', fidelity: 'approximated' },
      { id: 'Icon', component: 'IconReplica', source: 'native/ActionIcon.swift:20', description: 'Icon', relationship: 'Part', parent: 'Actions', fidelity: 'approximated' },
    ],
    sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['Icon'] }],
  });
  const { sections } = buildCatalogSections([{ ...page, id: 'Actions', file: 'pages/Actions.catalog.tsx' }], [
    { name: 'ActionsReplica', file: 'replicas/Actions.tsx', props: [], inheritedFrom: [] },
    { name: 'IconReplica', file: 'replicas/Icon.tsx', props: [], inheritedFrom: [] },
  ]);
  const entries = buildReferenceIndex(sections);
  assert.equal(entries.length, 2);
  for (const [name, source, path] of [
    ['Actions', 'native/Actions.swift:10', 'replicas/Actions.tsx'],
    ['Icon', 'native/ActionIcon.swift:20', 'replicas/Icon.tsx'],
  ]) {
    const entry = entries.find((item) => (item.memberId ?? item.pageId) === name)!;
    assert.equal(entry.source, source, 'preserve the native declaration source, not just the replica path');
    assert.equal(entry.path, path);
    assert.deepEqual(searchReferenceIndex(entries, source), [entry]);
    assert.deepEqual(searchReferenceIndex(entries, path), [entry]);
  }
});

test('resolveReference: an exact registered page id wins even when a component binding would also match it', () => {
  const entries = buildReferenceIndex([section({ id: 'Button', component: 'Dialog', path: 'p' })]);
  const order = ['Button', 'Dialog'];
  assert.deepEqual(resolveReference('Dialog', order, new Map(), entries), { kind: 'address', pageId: 'Dialog' });
});

test('resolveReference: a registered member/page alias wins over a same-named component binding', () => {
  const entries = buildReferenceIndex([section({ id: 'BotAvatarView', family: botAvatarFamily, path: 'p' })]);
  const targets = aliasTargets([section({ id: 'BotAvatarView', family: botAvatarFamily, path: 'p' })]);
  assert.deepEqual(
    resolveReference('OldFaceView', ['BotAvatarView'], targets, entries),
    { kind: 'address', pageId: 'BotAvatarView', memberId: 'BotAnimatedFaceView' },
  );
});

test('resolveReference: a component binding with no address collision resolves to its one owner, a page whose id differs from its export', () => {
  const entries = buildReferenceIndex([section({ id: 'PillButton', component: 'Button', path: 'p' })]);
  assert.deepEqual(resolveReference('Button', ['PillButton'], new Map(), entries), { kind: 'address', pageId: 'PillButton', memberId: undefined });
});

test('resolveReference: a component binding with no address collision resolves to a family member, not the whole', () => {
  const entries = buildReferenceIndex([section({ id: 'BotAvatarView', family: botAvatarFamily, path: 'p' })]);
  assert.deepEqual(
    resolveReference('FaceComponent', ['BotAvatarView'], new Map(), entries),
    { kind: 'address', pageId: 'BotAvatarView', memberId: 'BotAnimatedFaceView' },
  );
});

test('resolveReference: a component name claimed by more than one entry is ambiguous, never a guess', () => {
  const entries = buildReferenceIndex([
    section({ id: 'PageA', component: 'Shared', path: 'a' }),
    section({ id: 'PageB', component: 'Shared', path: 'b' }),
  ]);
  assert.deepEqual(resolveReference('Shared', ['PageA', 'PageB'], new Map(), entries), { kind: 'ambiguous' });
});

test('resolveReference: an unknown name is unresolved', () => {
  const entries = buildReferenceIndex([section({ id: 'Button', path: 'p' })]);
  assert.deepEqual(resolveReference('NoSuchThing', ['Button'], new Map(), entries), { kind: 'unresolved' });
});

// #63 A7: a group page's own `FamilyDef` has `whole: undefined` — `family?.members.find(m => m.id
// === family.whole)` never matches, so every member (there being no whole to skip) gets its own
// reference-index entry, exactly like a family's non-whole members already do, with no code change.
const groupFamily: SectionDef['family'] = {
  whole: undefined,
  kind: 'group',
  outline: new Map(),
  sections: [],
  members: [
    { id: 'WidgetA', component: 'WidgetAComponent', source: 'a:1', path: 'a:1', description: 'd', relationship: 'Top', fidelity: 'documentation-only' },
    { id: 'WidgetB', source: 'b:1', path: 'b:1', description: 'd', relationship: 'Top', fidelity: 'documentation-only' },
  ],
};

test('buildReferenceIndex lists a group page\'s own entry plus one entry per member — no member is skipped as "the whole"', () => {
  const entries = buildReferenceIndex([section({ id: 'Widgets', title: 'Widgets', family: groupFamily, path: 'src/Widgets.tsx' })]);
  assert.equal(entries.filter((e) => e.pageId === 'Widgets' && e.memberId === undefined).length, 1);
  assert.equal(entries.filter((e) => e.memberId === 'WidgetA').length, 1);
  assert.equal(entries.filter((e) => e.memberId === 'WidgetB').length, 1);
  assert.equal(entries.length, 3);
});

test('resolveReference: a group member\'s own component binding resolves to that member, not the page', () => {
  const entries = buildReferenceIndex([section({ id: 'Widgets', family: groupFamily, path: 'p' })]);
  assert.deepEqual(
    resolveReference('WidgetAComponent', ['Widgets'], new Map(), entries),
    { kind: 'address', pageId: 'Widgets', memberId: 'WidgetA' },
  );
});


test('buildReferenceIndex titles a member by its title, so reference search finds it by that name', () => {
  const family = { ...botAvatarFamily!, members: botAvatarFamily!.members.map((m) => (m.id === 'BotAnimatedFaceView' ? { ...m, title: 'Animated face' } : m)) };
  const entries = buildReferenceIndex([section({ id: 'BotAvatarView', family, path: 'src/BotAvatarView.tsx' })]);
  assert.equal(entries.find((e) => e.memberId === 'BotAnimatedFaceView')?.title, 'Animated face');
  assert.deepEqual(searchReferenceIndex(entries, 'animated face').map((e) => e.memberId), ['BotAnimatedFaceView']);
});
