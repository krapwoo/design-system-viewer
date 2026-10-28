import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectIssues, type DoctorIssue } from '../doctor.ts';
import type { StaticMember, StaticPage } from '../staticPage.ts';

// #66: `part-own-page`, `nothing-to-show`, and `standalone-reason-empty` (cli/doctor.ts).

function page(overrides: Partial<StaticPage>): StaticPage {
  return { file: '/x/Widget.catalog.tsx', checkable: true, ...overrides };
}

const SPECIMEN = [{ key: 'a', name: 'A' }];

/** A part `Part` that shows a specimen, plus `Owner` declaring it with the given relationship. */
function pair(relationship: string | undefined, part: Partial<StaticPage> = {}, owner: Partial<StaticPage> = {}): StaticPage[] {
  return [
    page({ id: 'Part', component: 'Part', file: '/x/Part.catalog.tsx', variantsItems: SPECIMEN, ...part }),
    page({
      id: 'Owner', component: 'Owner', file: '/x/Owner.catalog.tsx', variantsItems: SPECIMEN,
      composedOf: [relationship === undefined ? { component: 'Part' } : { component: 'Part', relationship }], ...owner,
    }),
  ];
}

function run(pages: StaticPage[], id: string): DoctorIssue[] {
  return collectIssues(pages, []).filter((i) => i.id === id);
}

const memberOf = (id: string): StaticMember => ({ id, hasWhenToUse: true, hasA11y: true, hasExamples: true });

// ---- part-own-page ----

test('part-own-page reports a part built into exactly one other page', () => {
  const found = run(pair('built-in'), 'part-own-page');
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, 'warning');
  assert.equal(found[0].page, 'Part');
  assert.equal(found[0].message, '`Part` is a built-in part of `Owner` only, but has its own page.');
  assert.match(found[0].fix, /List it as a part in Owner's family/);
  assert.match(found[0].fix, /standalone: '<reason>'/);
});

test('part-own-page exempts a part built into two pages', () => {
  const pages = [...pair('built-in'), page({ id: 'Other', component: 'Other', file: '/x/Other.catalog.tsx', variantsItems: SPECIMEN, composedOf: [{ component: 'Part', relationship: 'built-in' }] })];
  assert.equal(run(pages, 'part-own-page').length, 0);
});

test('part-own-page ignores slot, related, and missing relationships', () => {
  for (const relationship of ['slot', 'related', undefined]) {
    assert.equal(run(pair(relationship), 'part-own-page').length, 0, String(relationship));
  }
});

test('part-own-page does not count a non-literal relationship as built-in', () => {
  // The reader leaves a non-literal relationship off the entry (cli/staticPage.ts).
  assert.equal(run(pair(undefined), 'part-own-page').length, 0);
});

test('part-own-page does not report a part that is already a member of its owner', () => {
  // A real family member has its own id and names the part's component (a member can't share a page id).
  const asComponent = pair('built-in', {}, { members: [{ ...memberOf('PartMember'), component: 'Part' }], hasMembers: true, whole: 'Owner' });
  assert.equal(run(asComponent, 'part-own-page').length, 0, 'member names the component');
  const asAlias = pair('built-in', {}, { members: [{ ...memberOf('PartMember'), aliases: ['Part'] }], hasMembers: true, whole: 'Owner' });
  assert.equal(run(asAlias, 'part-own-page').length, 0, 'member alias names the page');
  const unrelated = pair('built-in', {}, { members: [{ ...memberOf('Other'), component: 'Other' }], hasMembers: true, whole: 'Owner' });
  assert.equal(run(unrelated, 'part-own-page').length, 1, 'an unrelated member does not exempt it');
});

test('part-own-page matches a page without a component by its id', () => {
  const pages = pair('built-in', { component: undefined });
  assert.equal(run(pages, 'part-own-page').length, 1);
});

test("part-own-page exempts navigation: 'reference'", () => {
  assert.equal(run(pair('built-in', { navigation: 'reference' }), 'part-own-page').length, 0);
});

test('part-own-page exempts token pages', () => {
  assert.equal(run(pair('built-in', { tokenGallery: true }), 'part-own-page').length, 0);
  assert.equal(run(pair('built-in', { hasTokenDefinition: true }), 'part-own-page').length, 0);
  assert.equal(run(pair('built-in', { tokenSectionTitles: ['Colors'] }), 'part-own-page').length, 0);
});

test('part-own-page exempts a family page (a page with members)', () => {
  assert.equal(run(pair('built-in', { members: [memberOf('Inner')], hasMembers: true }), 'part-own-page').length, 0);
});

test('part-own-page honours a standalone reason', () => {
  assert.equal(run(pair('built-in', { standalone: 'Draws its own counts.' }), 'part-own-page').length, 0);
});

test('part-own-page does not treat a blank standalone as an opt-out', () => {
  assert.equal(run(pair('built-in', { standalone: '   ' }), 'part-own-page').length, 1);
});

test('part-own-page leaves a page it could not read alone', () => {
  assert.equal(run(pair('built-in', { checkable: false }), 'part-own-page').length, 0);
});

// ---- standalone-reason-empty ----

test('standalone-reason-empty reports a blank or whitespace reason', () => {
  for (const standalone of ['', '   ']) {
    const found = run([page({ id: 'Part', variantsItems: SPECIMEN, standalone })], 'standalone-reason-empty');
    assert.equal(found.length, 1, JSON.stringify(standalone));
    assert.equal(found[0].severity, 'warning');
  }
});

test('standalone-reason-empty is silent for a real reason or no field', () => {
  assert.equal(run([page({ id: 'Part', variantsItems: SPECIMEN, standalone: 'Own counts.' })], 'standalone-reason-empty').length, 0);
  assert.equal(run([page({ id: 'Part', variantsItems: SPECIMEN })], 'standalone-reason-empty').length, 0);
});

test('a blank standalone is reported alongside nothing-to-show, not instead of it', () => {
  const pages = [page({ id: 'Empty', standalone: '' })];
  assert.equal(run(pages, 'standalone-reason-empty').length, 1);
  assert.equal(run(pages, 'nothing-to-show').length, 1);
});

// ---- nothing-to-show ----

// W1: the contract's exact wording, the same for every variant; it no longer suggests
// `navigation: 'reference'`.
const NOTHING_TO_SHOW_FIX = 'Add a specimen, list it as a documentation-only part of a page that uses it, or remove the page (record why in your own docs).';

test('nothing-to-show reports an empty page that no other page uses', () => {
  const found = run([page({ id: 'Empty', component: 'Empty' })], 'nothing-to-show');
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, 'warning');
  assert.equal(found[0].message, '`Empty` shows no specimens and no other page uses it.');
  assert.equal(found[0].fix, NOTHING_TO_SHOW_FIX);
});

test('nothing-to-show names every page that uses an empty page, via composedOf of any relationship', () => {
  const pages = [
    page({ id: 'Empty', component: 'Empty', file: '/x/Empty.catalog.tsx' }),
    page({ id: 'Y', file: '/x/Y.catalog.tsx', variantsItems: SPECIMEN, composedOf: [{ component: 'Empty', relationship: 'slot' }] }),
    page({ id: 'Z', file: '/x/Z.catalog.tsx', variantsItems: SPECIMEN, composedOf: [{ component: 'Empty' }] }),
  ];
  const found = run(pages, 'nothing-to-show');
  assert.equal(found.length, 1);
  assert.equal(found[0].message, '`Empty` shows no specimens. It is used by `Y`, `Z`.');
  assert.equal(found[0].fix, NOTHING_TO_SHOW_FIX);
});

test('nothing-to-show finds a user that lists the empty page by id when the page has a different component', () => {
  const pages = [
    page({ id: 'EmptyPage', component: 'Empty', file: '/x/Empty.catalog.tsx' }),
    page({ id: 'Y', file: '/x/Y.catalog.tsx', variantsItems: SPECIMEN, composedOf: [{ component: 'EmptyPage' }] }),
  ];
  assert.match(run(pages, 'nothing-to-show')[0].message, /It is used by `Y`\./);
});

test('nothing-to-show is silent for every kind of specimen', () => {
  const specimens: Partial<StaticPage>[] = [
    { variantsItems: SPECIMEN },
    { statesItems: SPECIMEN },
    { hasRender: true },
    { comparison: { rows: { items: [] }, columns: { items: [] } } },
  ];
  for (const specimen of specimens) {
    assert.equal(run([page({ id: 'Shown', ...specimen })], 'nothing-to-show').length, 0, JSON.stringify(specimen));
  }
});

test('nothing-to-show leaves a page with unreadable specimens alone', () => {
  // A non-literal `variants` makes the reader mark the page not checkable and leave variantsItems unset.
  assert.equal(run([page({ id: 'Unread', checkable: false })], 'nothing-to-show').length, 0);
});

test("nothing-to-show exempts navigation: 'reference'", () => {
  assert.equal(run([page({ id: 'Ref', navigation: 'reference' })], 'nothing-to-show').length, 0);
});

test('nothing-to-show exempts token pages', () => {
  assert.equal(run([page({ id: 'Tokens', hasTokenDefinition: true })], 'nothing-to-show').length, 0);
  assert.equal(run([page({ id: 'Tokens', tokenGallery: true })], 'nothing-to-show').length, 0);
  assert.equal(run([page({ id: 'Tokens', tokenSectionTitles: ['Colors'] })], 'nothing-to-show').length, 0);
});

const bareMember = (id: string): StaticMember => ({ ...memberOf(id), hasExamples: false });

test('nothing-to-show reports a family page whose page and every member show nothing', () => {
  const family = page({ id: 'Family', members: [bareMember('Inner'), bareMember('Other')], hasMembers: true, whole: 'Family' });
  const found = run([family], 'nothing-to-show');
  assert.equal(found.length, 1);
  assert.equal(found[0].page, 'Family');
  assert.match(found[0].message, /`Family` shows no specimens/);
});

test('nothing-to-show is silent for a family where one member or the page itself has a specimen', () => {
  const members = [bareMember('Inner'), memberOf('Shown')];
  assert.equal(run([page({ id: 'Family', members, hasMembers: true, whole: 'Family' })], 'nothing-to-show').length, 0, 'one member has a specimen');
  assert.equal(run([page({ id: 'Family', members: [bareMember('Inner')], hasMembers: true, variantsItems: SPECIMEN })], 'nothing-to-show').length, 0, 'the page has a variant');
  assert.equal(run([page({ id: 'Family', members: [bareMember('Inner')], hasMembers: true, hasRender: true })], 'nothing-to-show').length, 0, 'the page has a render');
});

test('nothing-to-show treats a group page (members, no whole) the same way', () => {
  assert.equal(run([page({ id: 'Group', members: [bareMember('A'), bareMember('B')], hasMembers: true })], 'nothing-to-show').length, 1);
  assert.equal(run([page({ id: 'Group', members: [bareMember('A'), memberOf('B')], hasMembers: true })], 'nothing-to-show').length, 0);
});

test('nothing-to-show leaves a family whose members were not read in full alone', () => {
  assert.equal(run([page({ id: 'Family', hasMembers: true, checkable: false })], 'nothing-to-show').length, 0);
});

test('nothing-to-show honours a standalone reason on a family page', () => {
  const family = page({ id: 'Family', members: [bareMember('Inner')], hasMembers: true, standalone: 'Documentation only.' });
  assert.equal(run([family], 'nothing-to-show').length, 0);
});

test('nothing-to-show honours a standalone reason', () => {
  assert.equal(run([page({ id: 'Quiet', standalone: 'Documentation only.' })], 'nothing-to-show').length, 0);
});

// ---- pattern pages (patternGroups) ----

test('part-own-page never counts a pattern page as the whole', () => {
  assert.equal(run(pair('built-in', {}, { group: 'Patterns' }), 'part-own-page').length, 0);
  assert.equal(run(pair('built-in', {}, { group: 'patterns' }), 'part-own-page').length, 0, 'case-insensitive');
});

test('part-own-page still reports a part whose only non-pattern user is one component page', () => {
  const pages = [...pair('built-in'), page({ id: 'Screen', component: 'Screen', group: 'Patterns', file: '/x/Screen.catalog.tsx', variantsItems: SPECIMEN, composedOf: [{ component: 'Part', relationship: 'built-in' }] })];
  const found = run(pages, 'part-own-page');
  assert.equal(found.length, 1);
  assert.equal(found[0].message, '`Part` is a built-in part of `Owner` only, but has its own page.');
});

test('patternGroups replaces the default pattern group', () => {
  const pages = pair('built-in', {}, { group: 'Screens' });
  assert.equal(collectIssues(pages, [], { patternGroups: ['Screens'] }).filter((i) => i.id === 'part-own-page').length, 0);
  assert.equal(collectIssues(pages, []).filter((i) => i.id === 'part-own-page').length, 1, 'Screens is not a pattern group by default');
  assert.equal(collectIssues(pair('built-in', {}, { group: 'Patterns' }), [], { patternGroups: ['Screens'] }).filter((i) => i.id === 'part-own-page').length, 1, 'the configured list replaces the default');
});

test('nothing-to-show says when only pattern pages use an empty page', () => {
  const found = run(pair('built-in', { variantsItems: undefined }, { group: 'Patterns' }), 'nothing-to-show');
  assert.equal(found.length, 1);
  assert.equal(found[0].message, '`Part` shows no specimens. Only pattern pages use it (`Owner`).');
  assert.equal(found[0].fix, NOTHING_TO_SHOW_FIX);
});

test('nothing-to-show uses the same fix text for every variant and never suggests navigation: reference', () => {
  const unreadable = page({ id: 'Opaque', component: 'Opaque', file: '/x/Opaque.catalog.tsx', variantsItems: SPECIMEN, hasComposedOf: true });
  const variants = [
    run([page({ id: 'Empty', file: '/x/Empty.catalog.tsx' })], 'nothing-to-show'), // nothing uses it
    run([page({ id: 'Empty', file: '/x/Empty.catalog.tsx' }), unreadable], 'nothing-to-show'), // an unreadable composedOf
    run(pair('related', { variantsItems: undefined }), 'nothing-to-show'), // a page uses it
    run(pair('built-in', { variantsItems: undefined }, { group: 'Patterns' }), 'nothing-to-show'), // only pattern pages use it
  ];
  for (const found of variants) {
    assert.equal(found.length, 1);
    assert.equal(found[0].fix, NOTHING_TO_SHOW_FIX);
    assert.doesNotMatch(found[0].fix, /navigation/);
  }
});

// ---- review corrections ----

test('nothing-to-show does not count previewWidths alone as a specimen (it only sizes render)', () => {
  assert.equal(run([page({ id: 'Sized', previewWidths: [320] })], 'nothing-to-show').length, 1);
  assert.equal(run([page({ id: 'Rendered', previewWidths: [320], hasRender: true })], 'nothing-to-show').length, 0);
});

const familyHost = (memberComposedOf: { component: string; relationship?: string }[], extra: Partial<StaticPage> = {}): StaticPage => page({
  id: 'Host', component: 'Host', file: '/x/Host.catalog.tsx', whole: 'Host', hasMembers: true,
  members: [memberOf('Host'), { ...memberOf('HostPart'), component: 'HostPart', composedOf: memberComposedOf }], ...extra,
});

test('part-own-page counts a family member\'s composedOf as the owner', () => {
  const pages = [page({ id: 'Part', component: 'Part', file: '/x/Part.catalog.tsx', variantsItems: SPECIMEN }), familyHost([{ component: 'Part', relationship: 'built-in' }])];
  const found = run(pages, 'part-own-page');
  assert.equal(found.length, 1);
  assert.equal(found[0].message, '`Part` is a built-in part of `Host` only, but has its own page.');
});

test('part-own-page exempts a part whose second user is a family member on another page', () => {
  const pages = [...pair('built-in'), familyHost([{ component: 'Part', relationship: 'built-in' }])];
  assert.equal(run(pages, 'part-own-page').length, 0);
});

test('part-own-page counts a host once however many of its entries name the part', () => {
  const pages = [page({ id: 'Part', component: 'Part', file: '/x/Part.catalog.tsx', variantsItems: SPECIMEN }),
    familyHost([{ component: 'Part', relationship: 'built-in' }], { composedOf: [{ component: 'Part', relationship: 'built-in' }] })];
  assert.equal(run(pages, 'part-own-page').length, 1);
});

test('nothing-to-show names a page that uses the empty page through a member', () => {
  const pages = [page({ id: 'Empty', component: 'Empty', file: '/x/Empty.catalog.tsx' }), familyHost([{ component: 'Empty', relationship: 'slot' }])];
  assert.equal(run(pages, 'nothing-to-show')[0].message, '`Empty` shows no specimens. It is used by `Host`.');
});

test('nothing-to-show names pattern users too when a component page also uses the empty page', () => {
  const pages = [...pair('built-in', { variantsItems: undefined }), page({ id: 'Screen', component: 'Screen', group: 'Patterns', file: '/x/Screen.catalog.tsx', variantsItems: SPECIMEN, composedOf: [{ component: 'Part', relationship: 'built-in' }] })];
  assert.equal(run(pages, 'nothing-to-show')[0].message, '`Part` shows no specimens. It is used by `Owner`. Pattern pages also use it (`Screen`).');
});

test('both rules qualify their claim when another page\'s composedOf could not be read', () => {
  const unreadable = page({ id: 'Opaque', component: 'Opaque', file: '/x/Opaque.catalog.tsx', variantsItems: SPECIMEN, hasComposedOf: true });
  assert.match(run([...pair('built-in'), unreadable], 'part-own-page')[0].message, /could not be read, so another user may exist/);
  assert.equal(run([page({ id: 'Empty', file: '/x/Empty.catalog.tsx' }), unreadable], 'nothing-to-show')[0].message,
    '`Empty` shows no specimens, and no page whose `composedOf` doctor could read uses it.');
});

test('both rules qualify their claim when a member-level composedOf or a members list could not be read', () => {
  const opaqueMember = page({ id: 'Host', component: 'Host', file: '/x/Host.catalog.tsx', whole: 'Host', hasMembers: true,
    members: [memberOf('Host'), { ...memberOf('HostPart'), component: 'HostPart', hasComposedOf: true }] });
  const opaqueMembers = page({ id: 'Host2', component: 'Host2', file: '/x/Host2.catalog.tsx', hasMembers: true, checkable: false });
  for (const unreadable of [opaqueMember, opaqueMembers]) {
    assert.match(run([page({ id: 'Empty', file: '/x/Empty.catalog.tsx' }), unreadable], 'nothing-to-show')[0].message, /no page whose `composedOf` doctor could read/, unreadable.id);
    assert.match(run([...pair('built-in'), unreadable], 'part-own-page')[0].message, /could not be read/, unreadable.id);
  }
});
