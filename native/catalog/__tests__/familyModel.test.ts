import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ariaLevelFor,
  disclosureContent,
  disclosureLabel,
  headerRoleFor,
  linkifyRelated,
  orderedSections,
  outlineFor,
  relationshipVisible,
  resolveWhole,
  sectionFor,
  shouldRunMemberJump,
  validateFamily,
} from '../familyModel.ts';
import type { CatalogMember, CatalogMemberSection, PropDef } from '../types.ts';

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

function outlineOf(fixture: typeof botAvatar, id: string) {
  return outlineFor(fixture).get(id);
}

test('outlineFor: Bot avatar golden numbering', () => {
  assert.deepEqual(outlineOf(botAvatar, 'BotAvatarView'), { number: '1', level: 1 });
  assert.deepEqual(outlineOf(botAvatar, 'BotAnimatedFaceView'), { number: '1.1', level: 2 });
  assert.deepEqual(outlineOf(botAvatar, 'BotAvatarMarkView'), { number: '1.1.1', level: 3 });
  assert.deepEqual(outlineOf(botAvatar, 'BotAvatarBody'), { number: '1.1.1.1', level: 4 });
  assert.deepEqual(outlineOf(botAvatar, 'BotRoomMemberAvatar'), { number: 'A', level: 2 });
});

test('outlineFor: Native response selection golden numbering', () => {
  assert.deepEqual(outlineOf(responseSelection, 'ResponseSelectionController'), { number: '1.1', level: 2 });
  assert.deepEqual(outlineOf(responseSelection, 'ResponseSelectionInput'), { number: '1.1.1', level: 3 });
  assert.deepEqual(outlineOf(responseSelection, 'ResponseSelectionRect'), { number: '1.1.1.1', level: 4 });
  assert.deepEqual(outlineOf(responseSelection, 'ResponseTextRange'), { number: '1.1.1.2', level: 4 });
  assert.deepEqual(outlineOf(responseSelection, 'ResponseTextPosition'), { number: '1.1.1.2.1', level: 5 });
  assert.deepEqual(outlineOf(responseSelection, 'ResponseSelectionLeaf'), { number: 'A', level: 2 });
  assert.deepEqual(outlineOf(responseSelection, 'RegisteredResponseSelectionLeaf'), { number: 'A.1', level: 3 });
  assert.deepEqual(outlineOf(responseSelection, 'ResponseSelectionMarker'), { number: 'A.1.1', level: 4 });
  assert.deepEqual(outlineOf(responseSelection, 'ResponseSelectionLeafView'), { number: 'A.1.1.1', level: 5 });
  assert.deepEqual(outlineOf(responseSelection, 'ResponseSelectionRenderer'), { number: 'A.1.2', level: 4 });
  assert.deepEqual(outlineOf(responseSelection, 'ResponseSelectionImageAttribute'), { number: 'A.1.2.1', level: 5 });
  assert.deepEqual(outlineOf(responseSelection, 'ResponseTextSelectionPolicy'), { number: 'B', level: 2 });
});

test('outlineFor: Conversation transcript golden numbering', () => {
  assert.deepEqual(outlineOf(transcript, 'ChatTranscriptMessageBlock'), { number: '1.1', level: 2 });
  assert.deepEqual(outlineOf(transcript, 'ChatTranscriptMessageRow'), { number: '1.1.1', level: 3 });
  assert.deepEqual(outlineOf(transcript, 'TranscriptTurnFoldRowView'), { number: '1.1.2', level: 3 });
  assert.deepEqual(outlineOf(transcript, 'ForkOriginRowView'), { number: '1.2', level: 2 });
  assert.deepEqual(outlineOf(transcript, 'ChatTranscriptLoadingSkeletonView'), { number: '1.3', level: 2 });
  assert.deepEqual(outlineOf(transcript, 'ChatTranscriptLoadingSkeletonRow'), { number: '1.3.1', level: 3 });
  assert.deepEqual(outlineOf(transcript, 'ChatScrollObserver'), { number: '1.4', level: 2 });
  assert.deepEqual(outlineOf(transcript, 'ObserverView'), { number: '1.4.1', level: 3 });
  assert.deepEqual(outlineOf(transcript, 'ChatVerticalScrollAxisGuard'), { number: '1.5', level: 2 });
  assert.deepEqual(outlineOf(transcript, 'ChatVerticalScrollAxisGuardView'), { number: '1.5.1', level: 3 });
  assert.deepEqual(outlineOf(transcript, 'StreamingFollowTrigger'), { number: '1.6', level: 2 });
  assert.deepEqual(outlineOf(transcript, 'TranscriptTimeSeparator'), { number: 'A', level: 2 });
  assert.deepEqual(outlineOf(transcript, 'ChatDisclosureToggledModifier'), { number: 'B', level: 2 });
});

test('outlineFor returns an empty map for a page without members', () => {
  assert.deepEqual(outlineFor({ id: 'Button' }), new Map());
});

// V2c item 2: a section listing an id that isn't a real member must never be assigned a letter
// (which would renumber the real related members) or otherwise appear in the outline.
test('outlineFor ignores a section id that is not a member of the page', () => {
  const page = {
    ...botAvatar,
    sections: [
      botAvatar.sections[0],
      { ...botAvatar.sections[1], members: ['Typo', 'BotRoomMemberAvatar'] },
    ],
  };
  const outline = outlineFor(page);
  assert.equal(outline.has('Typo'), false);
  assert.deepEqual(outline.get('BotRoomMemberAvatar'), { number: 'A', level: 2 });
});

// V2c item 14: an invalid parent graph — here, the whole itself ends up with a parent, forming a
// cycle reachable from the whole's own traversal (X → A → X → …) — must degrade to a partial
// outline, never an infinite recursion / stack overflow.
test('outlineFor: a parent cycle reachable from the whole produces a partial outline without throwing', () => {
  const page = {
    id: 'X',
    whole: 'X',
    sections: [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['A'] }],
    members: [
      { id: 'X', parent: 'A' },
      { id: 'A', parent: 'X' },
    ],
  };
  const outline = outlineFor(page);
  assert.deepEqual(outline.get('X'), { number: '1', level: 1 });
  assert.deepEqual(outline.get('A'), { number: '1.1', level: 2 });
});

test('shouldRunMemberJump: true only for the current activation, while passes remain', () => {
  assert.equal(shouldRunMemberJump(undefined, 'X'), false);
  assert.equal(shouldRunMemberJump({ memberId: 'X', passesLeft: 1 }, 'X'), true);
  assert.equal(shouldRunMemberJump({ memberId: 'X', passesLeft: 0 }, 'X'), false);
  assert.equal(shouldRunMemberJump({ memberId: 'Y', passesLeft: 2 }, 'X'), false);
});

test('headerRoleFor maps outline level to a header role', () => {
  assert.equal(headerRoleFor(1), 'heading1');
  assert.equal(headerRoleFor(2), 'heading2');
  assert.equal(headerRoleFor(3), 'heading3');
  assert.equal(headerRoleFor(4), 'bodyStrong');
  assert.equal(headerRoleFor(5), 'body');
  assert.equal(headerRoleFor(6), 'body');
});

test('ariaLevelFor adds one to the outline level, capped at 6', () => {
  assert.equal(ariaLevelFor(1), 2);
  assert.equal(ariaLevelFor(2), 3);
  assert.equal(ariaLevelFor(3), 4);
  assert.equal(ariaLevelFor(4), 5);
  assert.equal(ariaLevelFor(5), 6);
  assert.equal(ariaLevelFor(6), 6);
});

const section: CatalogMemberSection = { label: 'Parts', kind: 'blocks', inWhole: true, members: ['BotAnimatedFaceView'] };

function member(overrides: Partial<CatalogMember> = {}): CatalogMember {
  return { id: 'BotAnimatedFaceView', source: 'x.swift:1', fidelity: 'documentation-only', relationship: 'Anatomy', description: 'd', ...overrides };
}

test('relationshipVisible hides on the whole and in folded rows', () => {
  assert.equal(relationshipVisible(member(), section, true, false), false);
  assert.equal(relationshipVisible(member(), section, false, true), false);
  assert.equal(relationshipVisible(member(), section, true, true), false);
});

test('relationshipVisible shows otherwise, unless it repeats the section label (case-insensitive)', () => {
  assert.equal(relationshipVisible(member(), section, false, false), true);
  assert.equal(relationshipVisible(member({ relationship: 'Parts' }), section, false, false), false);
  assert.equal(relationshipVisible(member({ relationship: 'PARTS' }), section, false, false), false);
});

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

test('orderedSections: inWhole sections first, in authored order, then the rest', () => {
  const a: CatalogMemberSection = { label: 'A', kind: 'blocks', inWhole: false, members: [] };
  const b: CatalogMemberSection = { label: 'B', kind: 'blocks', inWhole: true, members: [] };
  const c: CatalogMemberSection = { label: 'C', kind: 'list', inWhole: true, members: [] };
  const d: CatalogMemberSection = { label: 'D', kind: 'blocks', inWhole: false, members: [] };
  assert.deepEqual(orderedSections([a, b, c, d]), [b, c, a, d]);
  assert.deepEqual(orderedSections([]), []);
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
