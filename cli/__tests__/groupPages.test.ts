import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectIssues } from '../doctor.ts';
import type { ComponentRecord } from '../types.ts';
import type { StaticMember, StaticPage } from '../staticPage.ts';

function page(overrides: Partial<StaticPage>): StaticPage {
  return { file: '/x/Widget.catalog.tsx', checkable: true, ...overrides };
}

function component(overrides: Partial<ComponentRecord>): ComponentRecord {
  return { name: 'Widget', file: '/x/Widget.tsx', props: [], inheritedFrom: [], ...overrides };
}

// #63 A1/A3/A4/A6: `checkGroupValidity` (doctor.ts) against a group page (`members` with no
// `whole`/`sections`), mirroring `pageApi.ts`'s own `validateGroup`.

function groupPage(overrides: Partial<StaticPage> = {}): StaticPage {
  return page({
    id: 'Widgets', group: 'Components',
    members: [
      { id: 'WidgetA', hasWhenToUse: true, hasA11y: true, hasExamples: true },
      { id: 'WidgetB', hasWhenToUse: true, hasA11y: true, hasExamples: true },
    ],
    ...overrides,
  });
}

test('a valid group page reports no family-invalid, group-anatomy-member, or family-external-part issues', () => {
  const issues = collectIssues([groupPage()], [component({ name: 'WidgetA' }), component({ name: 'WidgetB' })]);
  assert.equal(issues.filter((i) => ['family-invalid', 'group-anatomy-member', 'family-external-part'].includes(i.id)).length, 0);
});

test('family-invalid reports a group member with an unknown parent', () => {
  const broken = groupPage({ members: [{ id: 'WidgetA', parent: 'Nope', hasWhenToUse: true, hasA11y: true, hasExamples: true }] });
  const issues = collectIssues([broken], [component({ name: 'WidgetA' })]);
  assert.ok(issues.some((i) => i.id === 'family-invalid' && i.severity === 'error' && i.message.includes('unknown parent "Nope"')));
});

test('family-invalid reports page-level anatomy on a group page (A1)', () => {
  const withPageAnatomy = groupPage({ hasAnatomy: true });
  const issues = collectIssues([withPageAnatomy], [component({ name: 'WidgetA' }), component({ name: 'WidgetB' })]);
  assert.ok(issues.some((i) => i.id === 'family-invalid' && i.message.includes('page-level "anatomy" is not used on a group page')));
});

test('group-anatomy-member reports an embedded anatomy item naming a non-descendant', () => {
  const withBadAnatomy = groupPage({
    members: [
      { id: 'Top', hasWhenToUse: true, hasA11y: true, hasExamples: true, anatomy: { memberIds: ['WidgetB'] } },
      { id: 'Part', parent: 'Top', hasWhenToUse: true, hasA11y: true, hasExamples: true },
      { id: 'WidgetB', hasWhenToUse: true, hasA11y: true, hasExamples: true },
    ],
  });
  const issues = collectIssues([withBadAnatomy], [component({ name: 'Top' }), component({ name: 'Part' }), component({ name: 'WidgetB' })]);
  assert.ok(issues.some((i) => i.id === 'group-anatomy-member' && i.message.includes('anatomy item "WidgetB" is not one of its descendants')));
});

test('group-anatomy-member reports anatomy on a non-top-level member', () => {
  const withBadAnatomy = groupPage({
    members: [
      { id: 'Top', hasWhenToUse: true, hasA11y: true, hasExamples: true },
      { id: 'Part', parent: 'Top', hasWhenToUse: true, hasA11y: true, hasExamples: true, anatomy: { memberIds: [] } },
    ],
  });
  const issues = collectIssues([withBadAnatomy], [component({ name: 'Top' }), component({ name: 'Part' })]);
  assert.ok(issues.some((i) => i.id === 'group-anatomy-member' && i.message.includes('anatomy is only used on a top-level member')));
});

test('group-anatomy-member reports an embedded anatomy that lists the same member twice (not family-invalid)', () => {
  const duplicated = groupPage({
    members: [
      { id: 'Top', hasWhenToUse: true, hasA11y: true, hasExamples: true, anatomy: { memberIds: ['Part', 'Part'] } },
      { id: 'Part', parent: 'Top', hasWhenToUse: true, hasA11y: true, hasExamples: true },
    ],
  });
  const issues = collectIssues([duplicated], [component({ name: 'Top' }), component({ name: 'Part' })]);
  assert.ok(issues.some((i) => i.id === 'group-anatomy-member' && i.message.includes('anatomy lists member "Part" more than once')), JSON.stringify(issues.map((i) => [i.id, i.message])));
  assert.equal(issues.some((i) => i.id === 'family-invalid' && i.message.includes('more than once')), false);
});

test('group-anatomy-member accepts a top-level member\'s anatomy naming a real descendant', () => {
  const valid = groupPage({
    members: [
      { id: 'Top', hasWhenToUse: true, hasA11y: true, hasExamples: true, anatomy: { memberIds: ['Part'] } },
      { id: 'Part', parent: 'Top', hasWhenToUse: true, hasA11y: true, hasExamples: true },
    ],
  });
  const issues = collectIssues([valid], [component({ name: 'Top' }), component({ name: 'Part' })]);
  assert.equal(issues.filter((i) => ['family-invalid', 'group-anatomy-member'].includes(i.id)).length, 0);
});

test('a group member (or its alias) with the same id as its own page is reported as family-invalid', () => {
  const byId = collectIssues([groupPage({ members: [{ id: 'Widgets', hasWhenToUse: true, hasA11y: true, hasExamples: true }] })], [component({ name: 'Widgets' })]);
  assert.ok(byId.some((i) => i.id === 'family-invalid' && i.message.includes("collides with this group page's own id")), JSON.stringify(byId.map((i) => i.message)));
  const byAlias = collectIssues([groupPage({ members: [{ id: 'WidgetA', aliases: ['Widgets'], hasWhenToUse: true, hasA11y: true, hasExamples: true }] })], [component({ name: 'WidgetA' })]);
  assert.ok(byAlias.some((i) => i.id === 'family-invalid' && i.message.includes("collides with this group page's own id")));
});

test('a group page with relatedPages is reported as family-invalid (unused on a group page)', () => {
  const issues = collectIssues([groupPage({ relatedPages: [{ page: 'Elsewhere' }] })], [component({ name: 'WidgetA' }), component({ name: 'WidgetB' })]);
  assert.ok(issues.some((i) => i.id === 'family-invalid' && i.message.includes('"relatedPages" is not used on a group page')), JSON.stringify(issues.map((i) => i.message)));
});

// #63 A5/A6: `family-external-part` — a family's `inWhole` section lists an id that must resolve
// to exactly one group-page member, whose own `parent` equals the family's `whole`.

function familyPage(overrides: Partial<StaticPage> = {}): StaticPage {
  return page({
    id: 'BotAvatarView', group: 'Components', whole: 'BotAvatarView',
    sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['BotAnimatedFaceView', 'ExternalEyes'] }],
    members: [
      { id: 'BotAvatarView', hasWhenToUse: true, hasA11y: true, hasExamples: false },
      { id: 'BotAnimatedFaceView', parent: 'BotAvatarView', hasWhenToUse: true, hasA11y: true, hasExamples: true },
    ],
    ...overrides,
  });
}

function eyesGroup(memberOverrides: Partial<StaticMember> = {}): StaticPage {
  return page({
    file: '/x/EyesGroup.catalog.tsx', id: 'EyesGroup', group: 'Components',
    members: [{ id: 'ExternalEyes', parent: 'BotAvatarView', hasWhenToUse: true, hasA11y: true, hasExamples: true, ...memberOverrides }],
  });
}

test('a valid external part reports no family-external-part or family-invalid "not a member" issue', () => {
  const issues = collectIssues([familyPage(), eyesGroup()], [component({ name: 'BotAnimatedFaceView' }), component({ name: 'ExternalEyes' })]);
  assert.equal(issues.filter((i) => i.id === 'family-external-part').length, 0);
  assert.equal(issues.filter((i) => i.id === 'family-invalid' && i.message.includes('is not a member of this page')).length, 0);
});

test('family-external-part reports an id with no owner anywhere, naming it; family-invalid still reports it as "not a member"', () => {
  const issues = collectIssues([familyPage()], [component({ name: 'BotAnimatedFaceView' })]); // no EyesGroup page at all
  assert.equal(issues.filter((i) => i.id === 'family-external-part').length, 0); // genuinely unknown, not an external-part resolution issue
  assert.ok(issues.some((i) => i.id === 'family-invalid' && i.message.includes('"ExternalEyes", which is not a member of this page')));
});

test('family-external-part reports an id owned by more than one page', () => {
  const secondGroup = page({ file: '/x/OtherGroup.catalog.tsx', id: 'OtherGroup', group: 'Components', members: [{ id: 'ExternalEyes', parent: 'BotAvatarView', hasWhenToUse: true, hasA11y: true, hasExamples: true }] });
  const issues = collectIssues([familyPage(), eyesGroup(), secondGroup], [component({ name: 'BotAnimatedFaceView' }), component({ name: 'ExternalEyes' })]);
  assert.ok(issues.some((i) => i.id === 'family-external-part' && i.message.includes('more than one page') && i.message.includes('EyesGroup') && i.message.includes('OtherGroup')));
});

test('family-invalid reports an external part listed in two sections as in more than one section', () => {
  const twice = familyPage({ sections: [
    { label: 'Parts', kind: 'blocks', inWhole: true, members: ['BotAnimatedFaceView', 'ExternalEyes'] },
    { label: 'More', kind: 'blocks', inWhole: true, members: ['ExternalEyes'] },
  ] });
  const issues = collectIssues([twice, eyesGroup()], [component({ name: 'BotAnimatedFaceView' }), component({ name: 'ExternalEyes' })]);
  assert.ok(issues.some((i) => i.id === 'family-invalid' && i.message.includes('"ExternalEyes" is in more than one section')), JSON.stringify(issues.map((i) => i.message)));
  const once = collectIssues([familyPage(), eyesGroup()], [component({ name: 'BotAnimatedFaceView' }), component({ name: 'ExternalEyes' })]);
  assert.equal(once.filter((i) => i.message.includes('more than one section')).length, 0);
});

test('a family page with a non-literal whole/sections is never classified as a group page, so it cannot own an external part', () => {
  // `whole`/`sections` unset (not literal) but authored: the page is non-checkable, not a group.
  const opaqueFamily = page({
    file: '/x/Opaque.catalog.tsx', id: 'Opaque', group: 'Components', checkable: false, hasWhole: true, hasSections: true,
    members: [{ id: 'ExternalEyes', parent: 'BotAvatarView', hasWhenToUse: true, hasA11y: true, hasExamples: true }],
  });
  const issues = collectIssues([familyPage(), opaqueFamily], [component({ name: 'BotAnimatedFaceView' }), component({ name: 'ExternalEyes' })]);
  assert.ok(issues.some((i) => i.id === 'family-external-part' && i.message.includes('is not a group page')), JSON.stringify(issues.map((i) => i.message)));
});

test('family-external-part reports an owner that is not a group page', () => {
  const ordinaryPage = page({ file: '/x/Ordinary.catalog.tsx', id: 'Ordinary', component: 'Ordinary', group: 'Components', members: [{ id: 'ExternalEyes', parent: 'BotAvatarView', hasWhenToUse: true, hasA11y: true, hasExamples: true }], whole: 'Ordinary', sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['ExternalEyes'] }] });
  const issues = collectIssues([familyPage(), ordinaryPage], [component({ name: 'BotAnimatedFaceView' }), component({ name: 'ExternalEyes' })]);
  assert.ok(issues.some((i) => i.id === 'family-external-part' && i.message.includes('is not a group page')));
});

test('family-external-part reports a mismatched parent', () => {
  const issues = collectIssues([familyPage(), eyesGroup({ parent: 'SomeoneElse' })], [component({ name: 'BotAnimatedFaceView' }), component({ name: 'ExternalEyes' })]);
  assert.ok(issues.some((i) => i.id === 'family-external-part' && i.message.includes('does not equal')));
});
