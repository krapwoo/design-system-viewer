import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectIssues, type DoctorIssue } from '../doctor.ts';
import type { StaticMember, StaticPage } from '../staticPage.ts';

// #66: `part-needs-page`, `nothing-to-show`, and `standalone-reason-empty` (cli/doctor.ts).

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

// ---- part-needs-page ----

/** A family page `Owner` whose whole is `Owner` plus one part member with the given fields. */
function family(part: Partial<StaticMember>, extra: Partial<StaticPage> = {}): StaticPage[] {
  return [page({
    id: 'Owner', component: 'Owner', file: '/x/Owner.catalog.tsx', hasMembers: true, hasWhole: true, hasSections: true, whole: 'Owner',
    members: [{ ...memberOf('Owner'), component: 'Owner' }, { ...memberOf('Sheet'), component: 'SheetView', parent: 'Owner', ...part }],
    sections: [{ label: 'Parts', kind: 'blocks', members: ['Sheet'], inWhole: true }], ...extra,
  })];
}

test('part-needs-page hints at a family part that is its own view', () => {
  const found = run(family({}), 'part-needs-page');
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, 'hint');
  assert.equal(found[0].page, 'Owner');
  assert.match(found[0].message, /`Sheet` of `Owner` is its own view/);
});

test('part-needs-page leaves a documentation-only part, an OS-drawn part and a part with no component alone', () => {
  assert.equal(run(family({ fidelity: 'documentation-only' }), 'part-needs-page').length, 0);
  assert.equal(run(family({ hasOsComponent: true, osComponent: 'full' }), 'part-needs-page').length, 0);
  assert.equal(run(family({ component: undefined }), 'part-needs-page').length, 0);
});

test('part-needs-page leaves a declared style, modifier, helper or native integration alone, and never guesses from names', () => {
  for (const relationship of ['Style', 'modifier', ' Helper ', 'Native integration']) {
    assert.equal(run(family({ relationship }), 'part-needs-page').length, 0, relationship);
  }
  assert.equal(run(family({ id: 'SheetStyle', relationship: 'Anatomy' }), 'part-needs-page').length, 1, 'a name ending in Style is not a declaration');
});

test('part-needs-page skips the whole, group pages and a part whose component already has a page', () => {
  const asWhole = family({}, { whole: 'Sheet' });
  assert.equal(run(asWhole, 'part-needs-page').length, 0, 'the whole is not a part');
  assert.equal(run(family({}, { hasWhole: false, hasSections: false, whole: undefined, sections: undefined }), 'part-needs-page').length, 0, 'a group page shows related components side by side');
  const paged = [...family({}), page({ id: 'SheetPage', component: 'SheetView', file: '/x/Sheet.catalog.tsx', variantsItems: SPECIMEN })];
  assert.equal(run(paged, 'part-needs-page').length, 0);
});

test("part-needs-page still hints at osComponent: 'partial' (it has a view of its own) and says how to fix it without sending the author into style-as-part", () => {
  const found = run(family({ hasOsComponent: true, osComponent: 'partial' }), 'part-needs-page');
  assert.equal(found.length, 1);
  assert.doesNotMatch(found[0].fix, /Helper\/Style\/Modifier/);
  assert.match(found[0].fix, /relationship to 'Helper'/);
  assert.match(found[0].fix, /relatedPages/);
  assert.match(found[0].fix, /osComponent: 'full'/);
});

test('part-needs-page gives an authored but unreadable relationship, fidelity or osComponent the benefit of the doubt', () => {
  assert.equal(run(family({ hasRelationship: true }), 'part-needs-page').length, 0, 'non-literal relationship');
  assert.equal(run(family({ hasFidelity: true }), 'part-needs-page').length, 0, 'non-literal fidelity');
  assert.equal(run(family({ hasOsComponent: true }), 'part-needs-page').length, 0, 'non-literal osComponent');
  assert.equal(run(family({ hasRelationship: true, relationship: 'Part', hasFidelity: true, fidelity: 'high' }), 'part-needs-page').length, 1, 'readable values still count');
});

test('part-needs-page leaves a Related-section member (and its descendants) to deprecated-related-section', () => {
  const related = (members: StaticMember[]) => [page({
    id: 'Owner', component: 'Owner', file: '/x/Owner.catalog.tsx', hasMembers: true, hasWhole: true, hasSections: true, whole: 'Owner',
    members: [{ ...memberOf('Owner'), component: 'Owner' }, ...members],
    sections: [{ label: 'Parts', kind: 'blocks', members: [], inWhole: true }, { label: 'Related', kind: 'blocks', members: ['Sheet'], inWhole: false }],
  })];
  const pages = related([{ ...memberOf('Sheet'), component: 'SheetView' }, { ...memberOf('Grip'), component: 'GripView', parent: 'Sheet' }]);
  const ids = collectIssues(pages, []).map((i) => i.id);
  assert.equal(ids.includes('part-needs-page'), false);
  assert.equal(ids.filter((id) => id === 'deprecated-related-section').length, 1);
});

test('part-needs-page skips a component that already has a page as a group-page member or a token-page documents entry', () => {
  const group = page({ id: 'SheetGroup', file: '/x/Group.catalog.tsx', hasMembers: true, members: [{ ...memberOf('SheetItem'), component: 'SheetView' }] });
  assert.equal(run([...family({}), group], 'part-needs-page').length, 0, 'group member');
  const tokens = page({ id: 'SheetTokens', file: '/x/Tokens.catalog.tsx', hasDocuments: true, documents: [{ component: 'SheetView', title: 'Sheet' }] });
  assert.equal(run([...family({}), tokens], 'part-needs-page').length, 0, 'documents entry');
});

test('part-needs-page treats a page declared with members: [] as the part\'s page, as at runtime', () => {
  const emptyMembers = page({ id: 'SheetPage', component: 'SheetView', file: '/x/Sheet.catalog.tsx', hasMembers: true, members: [], variantsItems: SPECIMEN });
  assert.equal(run([...family({}), emptyMembers], 'part-needs-page').length, 0);
  const unread = page({ id: 'SheetPage', component: 'SheetView', file: '/x/Sheet.catalog.tsx', hasMembers: true, variantsItems: SPECIMEN });
  assert.equal(run([...family({}), unread], 'part-needs-page').length, 1, 'members authored but unreadable: not claimed to be a page');
});

test('part-own-page no longer exists: a built-in part with its own page is fine', () => {
  const ids = collectIssues(pair('built-in'), []).map((i) => i.id);
  assert.equal(ids.includes('part-own-page'), false);
});

test('a Parts section may name a standalone page id without family-invalid', () => {
  const pages = [...family({}, { members: [{ ...memberOf('Owner'), component: 'Owner' }], sections: [{ label: 'Parts', kind: 'blocks', members: ['SheetPage'], inWhole: true }] }),
    page({ id: 'SheetPage', component: 'SheetView', file: '/x/Sheet.catalog.tsx', variantsItems: SPECIMEN })];
  assert.equal(collectIssues(pages, []).filter((i) => i.id === 'family-invalid' || i.id === 'family-external-part').length, 0);
  const missing = family({}, { members: [{ ...memberOf('Owner'), component: 'Owner' }], sections: [{ label: 'Parts', kind: 'blocks', members: ['Nowhere'], inWhole: true }] });
  assert.equal(collectIssues(missing, []).filter((i) => i.id === 'family-invalid').length, 1, 'an unknown id is still reported');
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
const NOTHING_TO_SHOW_FIX = 'Add a specimen, document it as a note on the page that owns it (if it is a helper, modifier, style or a part only the OS draws), or remove the page (record why in your own docs).';

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

test('patternGroups replaces the default pattern group', () => {
  const pages = pair('built-in', { variantsItems: undefined }, { group: 'Screens' });
  const messages = (groups?: string[]) => collectIssues(pages, [], groups ? { patternGroups: groups } : {}).filter((i) => i.id === 'nothing-to-show').map((i) => i.message);
  assert.match(messages()[0], /It is used by `Owner`\./, 'Screens is not a pattern group by default');
  assert.match(messages(['Screens'])[0], /Only pattern pages use it/);
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

test('nothing-to-show names a page that uses the empty page through a member', () => {
  const pages = [page({ id: 'Empty', component: 'Empty', file: '/x/Empty.catalog.tsx' }), familyHost([{ component: 'Empty', relationship: 'slot' }])];
  assert.equal(run(pages, 'nothing-to-show')[0].message, '`Empty` shows no specimens. It is used by `Host`.');
});

test('nothing-to-show names pattern users too when a component page also uses the empty page', () => {
  const pages = [...pair('built-in', { variantsItems: undefined }), page({ id: 'Screen', component: 'Screen', group: 'Patterns', file: '/x/Screen.catalog.tsx', variantsItems: SPECIMEN, composedOf: [{ component: 'Part', relationship: 'built-in' }] })];
  assert.equal(run(pages, 'nothing-to-show')[0].message, '`Part` shows no specimens. It is used by `Owner`. Pattern pages also use it (`Screen`).');
});

test('nothing-to-show qualifies its claim when another page\'s composedOf could not be read', () => {
  const unreadable = page({ id: 'Opaque', component: 'Opaque', file: '/x/Opaque.catalog.tsx', variantsItems: SPECIMEN, hasComposedOf: true });
  assert.equal(run([page({ id: 'Empty', file: '/x/Empty.catalog.tsx' }), unreadable], 'nothing-to-show')[0].message,
    '`Empty` shows no specimens, and no page whose `composedOf` doctor could read uses it.');
});

test('nothing-to-show qualifies its claim when a member-level composedOf or a members list could not be read', () => {
  const opaqueMember = page({ id: 'Host', component: 'Host', file: '/x/Host.catalog.tsx', whole: 'Host', hasMembers: true,
    members: [memberOf('Host'), { ...memberOf('HostPart'), component: 'HostPart', hasComposedOf: true }] });
  const opaqueMembers = page({ id: 'Host2', component: 'Host2', file: '/x/Host2.catalog.tsx', hasMembers: true, checkable: false });
  for (const unreadable of [opaqueMember, opaqueMembers]) {
    assert.match(run([page({ id: 'Empty', file: '/x/Empty.catalog.tsx' }), unreadable], 'nothing-to-show')[0].message, /no page whose `composedOf` doctor could read/, unreadable.id);
  }
});

// ---- standalone pages in a Parts section (doctor side) ----

const partsFamily = (listed: string[]): StaticPage[] => family({}, { members: [{ ...memberOf('Owner'), component: 'Owner' }], sections: [{ label: 'Parts', kind: 'blocks', members: listed, inWhole: true }] });
const familyProblems = (pages: StaticPage[]) => collectIssues(pages, []).filter((i) => i.id === 'family-invalid' || i.id === 'family-external-part');

test('a Parts section cannot name a group page, another family page or its own page as a part', () => {
  const group = page({ id: 'SheetGroup', file: '/x/Group.catalog.tsx', hasMembers: true, members: [memberOf('SheetItem')] });
  const other = page({ id: 'OtherFamily', file: '/x/Other.catalog.tsx', hasMembers: true, hasWhole: true, hasSections: true, whole: 'OtherFamily',
    members: [memberOf('OtherFamily')], sections: [{ label: 'Parts', kind: 'blocks', members: [], inWhole: true }] });
  for (const id of ['SheetGroup', 'OtherFamily', 'Owner']) {
    assert.equal(familyProblems([...partsFamily([id]), group, other]).filter((i) => i.page === 'Owner').length >= 1, true, id);
  }
});

test('a page with members: [] counts as a standalone page, as at runtime, so a Parts section may list it', () => {
  const pages = [...partsFamily(['SheetPage']), page({ id: 'SheetPage', file: '/x/Sheet.catalog.tsx', hasMembers: true, members: [], variantsItems: SPECIMEN })];
  assert.deepEqual(familyProblems(pages), []);
  const unread = [...partsFamily(['SheetPage']), page({ id: 'SheetPage', file: '/x/Sheet.catalog.tsx', hasMembers: true, variantsItems: SPECIMEN })];
  assert.equal(familyProblems(unread).length, 1, 'members authored but unreadable: not claimed standalone');
});

test('nothing-to-show counts a Parts-section listing as a use of a standalone part page', () => {
  const sheet = page({ id: 'SheetPage', component: 'SheetView', file: '/x/Sheet.catalog.tsx' });
  const found = run([...partsFamily(['SheetPage']), sheet], 'nothing-to-show');
  assert.equal(found.length, 1);
  assert.match(found[0].message, /It is used by `Owner`\./);
  const notListed = run([...partsFamily([]), sheet], 'nothing-to-show');
  assert.match(notListed[0].message, /no other page uses it/);
});

test('standalone-reason-empty and its fix no longer describe the removed structure rule', () => {
  const found = run([page({ id: 'Part', variantsItems: SPECIMEN, standalone: '' })], 'standalone-reason-empty');
  assert.match(found[0].message, /`nothing-to-show`/);
  assert.doesNotMatch(found[0].fix, /GitFileCard/);
});

test('a style, token or reference page cannot be listed as a numbered part (it is "not a member"), a plain page can', () => {
  const kinds: Record<string, Partial<StaticPage>> = {
    style: { pageKind: 'style' },
    'token definition': { hasTokenDefinition: true },
    'token gallery': { tokenGallery: true },
    'token sections': { hasExplicitTokenSections: true, tokenSectionTitles: ['Colors'] },
    reference: { navigation: 'reference' },
  };
  for (const [name, extra] of Object.entries(kinds)) {
    for (const members of [undefined, []] as const) {
      const other = page({ id: 'SheetPage', file: '/x/Sheet.catalog.tsx', variantsItems: SPECIMEN, ...(members ? { hasMembers: true, members } : {}), ...extra });
      const problems = familyProblems([...partsFamily(['SheetPage']), other]);
      assert.equal(problems.length, 1, name);
      assert.match(problems[0].message, /not a member/, name);
    }
  }
  assert.deepEqual(familyProblems([...partsFamily(['SheetPage']), page({ id: 'SheetPage', file: '/x/Sheet.catalog.tsx', variantsItems: SPECIMEN })]), []);
});

test('a style, token or reference page still counts as the page of its own component for part-needs-page', () => {
  for (const extra of [{ pageKind: 'style' as const }, { tokenGallery: true }, { navigation: 'reference' as const }]) {
    const other = page({ id: 'SheetPage', component: 'SheetView', file: '/x/Sheet.catalog.tsx', variantsItems: SPECIMEN, ...extra });
    assert.equal(run([...family({}), other], 'part-needs-page').length, 0, JSON.stringify(extra));
  }
});
