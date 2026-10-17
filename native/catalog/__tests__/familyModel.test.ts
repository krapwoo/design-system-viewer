import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  anatomyColumns,
  anatomyPinFor,
  ariaLevelFor,
  buildPartTree,
  disclosureContent,
  disclosureLabel,
  linkifyRelated,
  numberFor,
  resolveWhole,
  sectionFor,
  shouldRunMemberJump,
  validateFamily,
} from '../familyModel.ts';
import type { CatalogMember, PropDef } from '../types.ts';

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

test('shouldRunMemberJump: true only for the current activation, while passes remain', () => {
  assert.equal(shouldRunMemberJump(undefined, 'X'), false);
  assert.equal(shouldRunMemberJump({ memberId: 'X', passesLeft: 1 }, 'X'), true);
  assert.equal(shouldRunMemberJump({ memberId: 'X', passesLeft: 0 }, 'X'), false);
  assert.equal(shouldRunMemberJump({ memberId: 'Y', passesLeft: 2 }, 'X'), false);
});

test('ariaLevelFor adds one to the outline level, capped at 6', () => {
  assert.equal(ariaLevelFor(1), 2);
  assert.equal(ariaLevelFor(2), 3);
  assert.equal(ariaLevelFor(3), 4);
  assert.equal(ariaLevelFor(4), 5);
  assert.equal(ariaLevelFor(5), 6);
  assert.equal(ariaLevelFor(6), 6);
});

function member(overrides: Partial<CatalogMember> = {}): CatalogMember {
  return { id: 'BotAnimatedFaceView', source: 'x.swift:1', fidelity: 'documentation-only', relationship: 'Anatomy', description: 'd', ...overrides };
}

// V2b item 9: "Swift API" is Hermex wording, not a generic viewer default. `disclosureLabel`
// takes the page's own `apiLabel` (default 'API') and whether the member has resolved props.
test('disclosureLabel: notes plus (api or props) combines "Notes and" with the apiLabel', () => {
  assert.equal(disclosureLabel(member({ notes: ['N'], api: 'struct X {}' })), 'Notes and API');
  assert.equal(disclosureLabel(member({ notes: ['N'] }), 'API', true), 'Notes and API');
  assert.equal(disclosureLabel(member({ notes: ['N'], api: 'struct X {}' }), 'Swift API'), 'Notes and Swift API');
});

// V2d item 2: `composedOf` ("Uses") counts the same way `notes` already does — alone it's "Notes",
// combined with api/props it's "Notes and ${apiLabel}".
const SOME_COMPOSED_OF = [{ component: 'Banner', role: 'Anatomy', relationship: 'built-in' as const }];

test('disclosureLabel: composedOf (Uses) counts like notes, alone and combined with api/props', () => {
  assert.equal(disclosureLabel(member({ composedOf: SOME_COMPOSED_OF })), 'Notes');
  assert.equal(disclosureLabel(member({ composedOf: SOME_COMPOSED_OF, api: 'struct X {}' })), 'Notes and API');
  assert.equal(disclosureLabel(member({ composedOf: SOME_COMPOSED_OF }), 'API', true), 'Notes and API');
  // Notes and composedOf together still combine to the same single "Notes and" lead.
  assert.equal(disclosureLabel(member({ notes: ['N'], composedOf: SOME_COMPOSED_OF, api: 'struct X {}' })), 'Notes and API');
});

test('disclosureLabel: api or props alone is just the apiLabel', () => {
  assert.equal(disclosureLabel(member({ api: 'struct X {}' })), 'API');
  assert.equal(disclosureLabel(member(), 'API', true), 'API');
  assert.equal(disclosureLabel(member({ api: 'struct X {}' }), 'Swift API'), 'Swift API');
});

test('disclosureLabel: notes alone is "Notes"', () => {
  assert.equal(disclosureLabel(member({ notes: ['N'] })), 'Notes');
  assert.equal(disclosureLabel(member({ notes: [] })), 'Details');
});

test('disclosureLabel: neither notes, api, nor props is "Details"', () => {
  assert.equal(disclosureLabel(member()), 'Details');
});

const SOME_PROPS: PropDef[] = [{ name: 'x', type: 'string', desc: 'd' }];

test('disclosureContent orders notes, whenToUse, a11y, props, api; omits what is absent', () => {
  const full = member({ notes: ['N'], whenToUse: 'Use it for X.', a11y: 'Announces as a button.', api: 'struct X {}' });
  assert.deepEqual(disclosureContent(full, SOME_PROPS), ['notes', 'whenToUse', 'a11y', 'props', 'api']);
  assert.deepEqual(disclosureContent(member()), []);
});

// V2d item 2: `uses` sits after `notes` and before `whenToUse`, present only when `composedOf` is
// non-empty — an empty array is treated the same as absent (nothing to show).
test('disclosureContent: uses sits after notes and before whenToUse, present only when composedOf is non-empty', () => {
  const full = member({
    notes: ['N'], composedOf: SOME_COMPOSED_OF, whenToUse: 'Use it for X.', a11y: 'Announces as a button.', api: 'struct X {}',
  });
  assert.deepEqual(disclosureContent(full, SOME_PROPS), ['notes', 'uses', 'whenToUse', 'a11y', 'props', 'api']);
  assert.deepEqual(disclosureContent(member({ composedOf: SOME_COMPOSED_OF })), ['uses']);
  assert.deepEqual(disclosureContent(member({ composedOf: [] })), []);
});

test('disclosureContent honors hide.accessibility and hide.props', () => {
  const full = member({ notes: ['N'], whenToUse: 'Use it.', a11y: 'Announces as a button.', api: 'struct X {}' });
  assert.deepEqual(disclosureContent({ ...full, hide: { accessibility: true } }, SOME_PROPS), ['notes', 'whenToUse', 'props', 'api']);
  assert.deepEqual(disclosureContent({ ...full, hide: { props: true } }, SOME_PROPS), ['notes', 'whenToUse', 'a11y', 'api']);
  assert.deepEqual(disclosureContent({ ...full, hide: { accessibility: true, props: true } }, SOME_PROPS), ['notes', 'whenToUse', 'api']);
});

// Errata 6: disclosureContent lists "props" only when the member actually HAS resolved props
// (passed in by the caller — FamilyPage passes the member's own resolved `props`), never merely
// because `hide.props` is unset — even for a documentation-only member with no `component` at all.
test('Errata 6: disclosureContent omits "props" when the member has no resolved props, even with no component', () => {
  const withNotesOnly = member({ notes: ['N'] });
  assert.deepEqual(disclosureContent(withNotesOnly), ['notes']);
  assert.deepEqual(disclosureContent(withNotesOnly, []), ['notes']);
  assert.deepEqual(disclosureContent(withNotesOnly, SOME_PROPS), ['notes', 'props']);
  // hide.props still wins even when real props exist.
  assert.deepEqual(disclosureContent({ ...withNotesOnly, hide: { props: true } }, SOME_PROPS), ['notes']);
});

test('sectionFor: the section containing a member id, or undefined', () => {
  assert.equal(sectionFor(botAvatar.sections, 'BotAnimatedFaceView'), botAvatar.sections[0]);
  assert.equal(sectionFor(botAvatar.sections, 'BotRoomMemberAvatar'), botAvatar.sections[1]);
  assert.equal(sectionFor(botAvatar.sections, 'NoSuchMember'), undefined);
});

test('linkifyRelated: splits on whole-word member id matches, longest id first', () => {
  assert.deepEqual(linkifyRelated('Wraps BotAvatarView directly.', ['BotAvatarView']), [
    { text: 'Wraps ' },
    { text: 'BotAvatarView', memberId: 'BotAvatarView' },
    { text: ' directly.' },
  ]);
  // Longest id wins so a shorter id that is a prefix of a longer one never splits it apart.
  assert.deepEqual(linkifyRelated('See BotAvatarViewLegacy.', ['BotAvatarView', 'BotAvatarViewLegacy']), [
    { text: 'See ' },
    { text: 'BotAvatarViewLegacy', memberId: 'BotAvatarViewLegacy' },
    { text: '.' },
  ]);
});

test('linkifyRelated: no ids, or no match, returns the text as one unlinked segment', () => {
  assert.deepEqual(linkifyRelated('Plain text.', []), [{ text: 'Plain text.' }]);
  assert.deepEqual(linkifyRelated('No match here.', ['BotAvatarView']), [{ text: 'No match here.' }]);
});

test('linkifyRelated: matches only whole words, and every occurrence', () => {
  assert.deepEqual(linkifyRelated('A A and A.', ['A']), [
    { text: 'A', memberId: 'A' },
    { text: ' ' },
    { text: 'A', memberId: 'A' },
    { text: ' and ' },
    { text: 'A', memberId: 'A' },
    { text: '.' },
  ]);
});

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

// N7: `resolveWhole` is the pure decision `FamilyPage` uses to skip rendering the whole block when
// `family.whole` doesn't resolve to one of its own members (bad data, already reported by
// `validateFamily`) — never a crash reading an absent member.
test('resolveWhole: the whole member when it resolves, undefined for bad data', () => {
  const members = new Map([['BotAvatarView', { id: 'BotAvatarView' }]]);
  assert.deepEqual(resolveWhole(members, 'BotAvatarView'), { id: 'BotAvatarView' });
  assert.equal(resolveWhole(members, 'NoSuchMember'), undefined);
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

// E1: `buildPartTree` — moved here from `FamilyPage.tsx` so it runs under Node's test runner.
// Reconstructs each `blocks` section's own parent/child nesting from `numberFor`'s own outline
// (a child's number is its parent's number plus one more `.` segment), scoped to the member ids
// given — so a parent living in a different section never nests a child under it.
test('buildPartTree: nests children under their parent, in outline order', () => {
  const outline = numberFor(numberForFixture);
  const tree = buildPartTree(['P1', 'P2', 'C1', 'C2', 'P3', 'C3'], outline);
  assert.deepEqual(tree.map((n) => n.id), ['P1', 'P2', 'P3']);
  const p2 = tree.find((n) => n.id === 'P2')!;
  assert.deepEqual(p2.children.map((n) => n.id), ['C1', 'C2']);
  const p3 = tree.find((n) => n.id === 'P3')!;
  assert.deepEqual(p3.children.map((n) => n.id), ['C3']);
});

test('buildPartTree: a child listed before its parent still nests correctly', () => {
  const outline = numberFor(numberForFixture);
  const tree = buildPartTree(['C1', 'C2', 'P2'], outline);
  assert.deepEqual(tree.map((n) => n.id), ['P2']);
  assert.deepEqual(tree[0].children.map((n) => n.id), ['C1', 'C2']);
});

// E1: a parent that belongs to a different section (so it's outside the member ids given to this
// call) never has its child nested under it — the child becomes a root of its own section's tree.
test('buildPartTree: a parent in another section leaves its child as a root here', () => {
  const outline = numberFor(numberForFixture);
  const tree = buildPartTree(['C1'], outline);
  assert.deepEqual(tree.map((n) => n.id), ['C1']);
  assert.deepEqual(tree[0].children, []);
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

// D2 item A2: an anatomy `member` item whose member has no number — outside every `inWhole`
// section — must be reported, not silently render a blank pin slot.
test('validateFamily: an anatomy member item outside every inWhole section is reported', () => {
  const page = { ...botAvatar, anatomy: { groups: [{ label: 'X', items: [{ member: 'BotRoomMemberAvatar' }] }] } };
  const issues = validateFamily(page, new Set(), new Set());
  assert.ok(issues.some((issue) => issue.includes('anatomy item "BotRoomMemberAvatar" has no number')));
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

// Slice D1 item 5: `AnatomyPin` looks up its number and dashed style through this pure helper.
test('anatomyPinFor: resolves a member\'s number, dashed for documentation-only', () => {
  const members = new Map([
    ['BotAvatarView', { fidelity: 'replicated' as const }],
    ['BotAnimatedFaceView', { fidelity: 'documentation-only' as const }],
  ]);
  const outline = new Map([
    ['BotAvatarView', { number: '1' }],
    ['BotAnimatedFaceView', { number: '1.1' }],
  ]);
  assert.deepEqual(anatomyPinFor('BotAvatarView', members, outline), { number: '1', dashed: false });
  assert.deepEqual(anatomyPinFor('BotAnimatedFaceView', members, outline), { number: '1.1', dashed: true });
});

test('anatomyPinFor: undefined for an unknown member, or one with no number', () => {
  const members = new Map([['BotAvatarView', { fidelity: 'replicated' as const }]]);
  const outline = new Map([['BotAvatarView', { number: '1' }]]);
  assert.equal(anatomyPinFor('NoSuchMember', members, outline), undefined);
  const noNumber = new Map([['BotRoomMemberAvatar', { fidelity: 'replicated' as const }]]);
  assert.equal(anatomyPinFor('BotRoomMemberAvatar', noNumber, new Map()), undefined);
});

// Slice D1 item 5: the legend goes below the picture in up to three columns, balancing item
// counts, without ever splitting a group across columns.
test('anatomyColumns: balances whole groups across up to three columns', () => {
  const groups = [{ items: [1, 2, 3] }, { items: [1] }, { items: [1, 2] }, { items: [1, 2, 3, 4] }];
  const columns = anatomyColumns(groups, 3);
  assert.equal(columns.length, 3);
  assert.equal(columns.flat().length, 4);
  // Every original group appears whole, in exactly one column.
  assert.equal(new Set(columns.flat()).size, groups.length);
  for (const g of groups) assert.ok(columns.flat().includes(g));
});

test('anatomyColumns: each group goes into the shortest column, so the columns end nearly level', () => {
  // The transcript legend: groups of 4, 2, 5 and 3 items (5, 3, 6 and 4 rows with labels).
  const a = { items: [1, 2, 3, 4] }, b = { items: [1, 2] }, c = { items: [1, 2, 3, 4, 5] }, d = { items: [1, 2, 3] };
  assert.deepEqual(anatomyColumns([a, b, c, d], 3), [[a], [b, d], [c]]);
});

test('anatomyColumns: never produces more columns than groups', () => {
  const groups = [{ items: [1, 2] }, { items: [1] }];
  assert.equal(anatomyColumns(groups, 3).length, 2);
  assert.deepEqual(anatomyColumns([], 3), []);
});
