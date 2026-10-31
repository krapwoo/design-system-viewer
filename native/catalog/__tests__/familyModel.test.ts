import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  alsoUsedBySegments,
  ANATOMY_LEGEND_MIN_COLUMN_WIDTH,
  ANATOMY_STAGE_PADDING,
  anatomyColumns,
  anatomyLayout,
  ANATOMY_PIN_GUTTER,
  anatomyPreviewWidth,
  anatomyPinFor,
  ariaLevelFor,
  buildPartTree,
  disclosureContent,
  disclosureLabel,
  linkifyRelated,
  resolveWhole,
  sectionFor,
  shouldRunMemberJump,
} from '../familyModel.ts';
// `numberFor` lives in `pageApi.ts` (see that file's own comments) — these tests only need it to
// build the outline `buildPartTree` (above) nests against.
import { numberFor } from '../pageApi.ts';
import { memberCodeLine, memberTitle, memberTitleMap } from '../familyModel.ts';
import { CATALOG_SPACE } from '../tokens.ts';
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

test('alsoUsedBySegments: empty set renders nothing', () => {
  assert.deepEqual(alsoUsedBySegments([]), []);
});

// Breaks if a lone user's own role stops showing in parentheses, or shows when empty.
test('alsoUsedBySegments: one user shows its role in parentheses, omitted when empty', () => {
  assert.deepEqual(alsoUsedBySegments([{ component: 'Dock', role: 'Header icon' }]), [
    { text: 'Also used by ' },
    { text: 'Dock', component: 'Dock' },
    { text: ' (Header icon)' },
  ]);
  assert.deepEqual(alsoUsedBySegments([{ component: 'Dock' }]), [
    { text: 'Also used by ' },
    { text: 'Dock', component: 'Dock' },
  ]);
});

// Breaks if two or three users ever show a role (they bloat the line) or drop the "and".
test('alsoUsedBySegments: two or three users join with commas and "and", never showing roles', () => {
  assert.deepEqual(alsoUsedBySegments([{ component: 'Dock', role: 'r1' }, { component: 'Toolbar', role: 'r2' }]), [
    { text: 'Also used by ' },
    { text: 'Dock', component: 'Dock' },
    { text: ' and ' },
    { text: 'Toolbar', component: 'Toolbar' },
  ]);
  assert.deepEqual(alsoUsedBySegments([{ component: 'Dock' }, { component: 'Toolbar' }, { component: 'Sidebar' }]), [
    { text: 'Also used by ' },
    { text: 'Dock', component: 'Dock' },
    { text: ', ' },
    { text: 'Toolbar', component: 'Toolbar' },
    { text: ' and ' },
    { text: 'Sidebar', component: 'Sidebar' },
  ]);
});

// Breaks if the "+N more" cap stops appearing past three users, if it shows as a link instead of
// plain text, or if more than three names are listed. Asserting the whole segment list matters:
// an earlier version only checked the last segment, which still passed when the slice was widened
// to show every name, because "+N more" is appended by a separate expression.
test('alsoUsedBySegments: more than three users shows the first three plus a plain-text "+N more"', () => {
  const segments = alsoUsedBySegments([{ component: 'Dock' }, { component: 'Toolbar' }, { component: 'Sidebar' }, { component: 'Modal' }, { component: 'Drawer' }]);
  assert.deepEqual(segments, [
    { text: 'Also used by ' },
    { text: 'Dock', component: 'Dock' },
    { text: ', ' },
    { text: 'Toolbar', component: 'Toolbar' },
    { text: ' and ' },
    { text: 'Sidebar', component: 'Sidebar' },
    { text: ' +2 more' },
  ]);
  assert.equal(segments.at(-1)?.component, undefined, '"+N more" has no page to link to');
  assert.equal(segments.filter((s) => s.component).length, 3, 'never more than three names, however many users there are');
});

// N7: `resolveWhole` is the pure decision `FamilyPage` uses to skip rendering the whole block when
// `family.whole` doesn't resolve to one of its own members (bad data, already reported by
// `validateFamily`) — never a crash reading an absent member.
test('resolveWhole: the whole member when it resolves, undefined for bad data', () => {
  const members = new Map([['BotAvatarView', { id: 'BotAvatarView' }]]);
  assert.deepEqual(resolveWhole(members, 'BotAvatarView'), { id: 'BotAvatarView' });
  assert.equal(resolveWhole(members, 'NoSuchMember'), undefined);
});

// #63: a group page's own `FamilyDef.whole` is `undefined` — `resolveWhole` must degrade to
// `undefined` the same way it does for bad data, never throw trying to look up an undefined key.
test('resolveWhole: undefined for a group page\'s own whole (undefined)', () => {
  const members = new Map([['WidgetA', { id: 'WidgetA' }]]);
  assert.equal(resolveWhole(members, undefined), undefined);
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

test('anatomyPinFor: an external part (numbered in the outline, documented on a group page) keeps its number', () => {
  const members = new Map([['BotPendingRequestCard', { fidelity: 'replicated' as const }]]);
  const outline = new Map([['BotPendingRequestCard', { number: '' }], ['BotQuestionRequestBody', { number: '1' }]]);
  assert.deepEqual(anatomyPinFor('BotQuestionRequestBody', members, outline), { number: '1', dashed: false });
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

// The comment on `ANATOMY_STAGE_PADDING` claims it equals `CATALOG_SPACE.xl`, not just the literal
// 24 — pin that claim against the real token so the two can never silently drift apart.
test('ANATOMY_STAGE_PADDING equals CATALOG_SPACE.xl', () => {
  assert.equal(ANATOMY_STAGE_PADDING, CATALOG_SPACE.xl);
});

// anatomy-narrow-layout: the consumer's own reproduced measurements (card 1112/440, picture 266,
// sidebar visible) — the 440px card is the exact defect the controller reproduced.
const WIDE_CARD = 1112;
const NARROW_CARD = 440;
const PICTURE_WIDTH = 266;

test('anatomyLayout: a roomy card (<=6 items) stays side by side', () => {
  assert.deepEqual(anatomyLayout(4, WIDE_CARD, PICTURE_WIDTH), { stacked: false, legendColumns: 1 });
  assert.deepEqual(anatomyLayout(6, WIDE_CARD, PICTURE_WIDTH), { stacked: false, legendColumns: 1 });
});

test('anatomyLayout: the reproduced 440px card stacks (<=6 items)', () => {
  assert.deepEqual(anatomyLayout(4, NARROW_CARD, PICTURE_WIDTH), { stacked: true, legendColumns: 1 });
});

test('anatomyLayout: wide -> narrow -> wide is reversible at the same inputs', () => {
  const wide = anatomyLayout(4, WIDE_CARD, PICTURE_WIDTH);
  const narrow = anatomyLayout(4, NARROW_CARD, PICTURE_WIDTH);
  const wideAgain = anatomyLayout(4, WIDE_CARD, PICTURE_WIDTH);
  assert.deepEqual(wide, { stacked: false, legendColumns: 1 });
  assert.deepEqual(narrow, { stacked: true, legendColumns: 1 });
  assert.deepEqual(wideAgain, wide, 'growing back to the same width must reproduce the same decision');
});

// The exact threshold width (picture + stage padding on both sides + one legend column) is
// side-by-side; one pixel narrower stacks — a pure boundary, not a guess.
test('anatomyLayout: the side-by-side/stacked boundary is exact and has no dead zone', () => {
  const threshold = PICTURE_WIDTH + 2 * ANATOMY_STAGE_PADDING + ANATOMY_LEGEND_MIN_COLUMN_WIDTH;
  assert.deepEqual(anatomyLayout(4, threshold, PICTURE_WIDTH), { stacked: false, legendColumns: 1 });
  // One pixel narrower stacks instead — its own stacked legend still gets the column count that
  // width affords (594 - 1 = 593px keeps two columns; it only drops to one much narrower).
  assert.deepEqual(anatomyLayout(4, threshold - 1, PICTURE_WIDTH), { stacked: true, legendColumns: 2 });
});

// A genuinely wider picture needs a wider card to stay side by side — the decision reads the
// picture's own measured width, not a hardcoded universal figure.
test('anatomyLayout: the same card width stacks for a wider picture that no longer fits beside a readable legend', () => {
  const cardWidth = PICTURE_WIDTH + 2 * ANATOMY_STAGE_PADDING + ANATOMY_LEGEND_MIN_COLUMN_WIDTH; // just fits at 266
  assert.deepEqual(anatomyLayout(4, cardWidth, PICTURE_WIDTH), { stacked: false, legendColumns: 1 });
  assert.deepEqual(anatomyLayout(4, cardWidth, 400), { stacked: true, legendColumns: 2 }, 'a wider picture no longer fits at the same card width');
});

test('anatomyLayout: more than 6 items always stacks, even at a wide card width', () => {
  assert.equal(anatomyLayout(7, WIDE_CARD, PICTURE_WIDTH).stacked, true);
  assert.equal(anatomyLayout(7, 3000, PICTURE_WIDTH).stacked, true);
});

// >6 items: the stacked legend itself still narrows from 3 to 2 to 1 columns as the card
// narrows, rather than staying cramped at 3 (field spec item 3).
test('anatomyLayout: a stacked (>6 item) legend narrows from 3 to 2 to 1 columns as the card narrows', () => {
  assert.equal(anatomyLayout(7, WIDE_CARD, PICTURE_WIDTH).legendColumns, 3);
  assert.equal(anatomyLayout(7, 2 * ANATOMY_LEGEND_MIN_COLUMN_WIDTH, PICTURE_WIDTH).legendColumns, 2);
  assert.equal(anatomyLayout(7, NARROW_CARD, PICTURE_WIDTH).legendColumns, 1);
});

// Paired with `anatomyColumns`: the stacked legend columns a narrowing card chooses never drop,
// duplicate, or split a group — only the column count (and which column each whole group lands
// in) changes.
test('anatomyLayout + anatomyColumns: a narrowing >6-item legend keeps every group intact across fewer columns', () => {
  const anatomyGroups = [{ items: [1, 2, 3] }, { items: [1] }, { items: [1, 2] }, { items: [1, 2, 3, 4] }];
  const totalItems = anatomyGroups.reduce((sum, g) => sum + g.items.length, 0);
  for (const width of [WIDE_CARD, 2 * ANATOMY_LEGEND_MIN_COLUMN_WIDTH, NARROW_CARD]) {
    const { legendColumns } = anatomyLayout(totalItems, width, PICTURE_WIDTH);
    const columns = anatomyColumns(anatomyGroups, legendColumns);
    assert.equal(columns.length, legendColumns, `width ${width}`);
    assert.equal(new Set(columns.flat()).size, anatomyGroups.length, `width ${width}: no group dropped or duplicated`);
    for (const g of anatomyGroups) assert.ok(columns.flat().includes(g), `width ${width}: ${JSON.stringify(g)} must survive whole`);
  }
});

// First measurement / native: an unmeasured width (0) — before layout settles, or on a platform
// that never measures at all (native keeps its own item-count decision; see FamilyPage.tsx's
// `onCardLayout`/`onPictureLayout`) — falls back to the original item-count-only rule.
test('anatomyLayout: an unmeasured width (0) falls back to the original item-count rule', () => {
  assert.deepEqual(anatomyLayout(4, 0, 0), { stacked: false, legendColumns: 3 });
  assert.deepEqual(anatomyLayout(7, 0, 0), { stacked: true, legendColumns: 3 });
  // A measured card with no picture measurement yet (or vice versa) is just as unmeasured.
  assert.deepEqual(anatomyLayout(4, WIDE_CARD, 0), { stacked: false, legendColumns: 3 });
  assert.deepEqual(anatomyLayout(4, 0, PICTURE_WIDTH), { stacked: false, legendColumns: 3 });
});

// The picture is laid out at the page's preview width, and beside the legend it gets half the box.
test('anatomyPreviewWidth: the first numeric previewWidths entry; none, empty or \'full\' means unset', () => {
  assert.equal(anatomyPreviewWidth([402, 320]), 402);
  assert.equal(anatomyPreviewWidth([320]), 320);
  assert.equal(anatomyPreviewWidth(undefined), undefined);
  assert.equal(anatomyPreviewWidth([]), undefined);
  assert.equal(anatomyPreviewWidth('full'), undefined);
});

test('anatomyLayout with a preview width: 50/50 beside the legend while half the box holds the picture, its pin margin and its padding', () => {
  const half = 402 + 2 * ANATOMY_PIN_GUTTER + 2 * ANATOMY_STAGE_PADDING;
  assert.deepEqual(anatomyLayout(4, 2 * half, 0, 402), { stacked: false, legendColumns: 1 });
  assert.equal(anatomyLayout(4, 2 * half - 2, 0, 402).stacked, true, 'half the box is now narrower than the picture needs');
});

test('anatomyLayout with a preview width: stacks when half the box is narrower than the preview width, however wide the legend', () => {
  assert.equal(anatomyLayout(2, 2 * 402 - 2, 0, 402).stacked, true);
  assert.equal(anatomyLayout(2, 700, 266, 402).stacked, true, 'the measured (narrow) picture no longer decides');
});

test('anatomyLayout without a preview width is unchanged', () => {
  assert.deepEqual(anatomyLayout(4, 700, 266), { stacked: false, legendColumns: 1 });
  assert.deepEqual(anatomyLayout(4, 700, 266, undefined), anatomyLayout(4, 700, 266));
  assert.deepEqual(anatomyLayout(4, 440, 266), { stacked: true, legendColumns: 1 });
});

test('anatomyLayout with a preview width: more than six items, and an unmeasured card, keep their old rules', () => {
  assert.equal(anatomyLayout(7, 2000, 0, 402).stacked, true);
  assert.deepEqual(anatomyLayout(4, 0, 0, 402), { stacked: false, legendColumns: 3 });
  assert.deepEqual(anatomyLayout(7, 0, 0, 402), { stacked: true, legendColumns: 3 });
});

test('anatomyLayout with a preview width: half the card must hold the width, its pin margin and padding', () => {
  // 402 + 2 * 30 (pin margins) + 2 * 24 (stage padding) = 510, so the card needs 1020.
  assert.deepEqual(anatomyLayout(4, 1020, 0, 402), { stacked: false, legendColumns: 1 });
  assert.equal(anatomyLayout(4, 1019, 0, 402).stacked, true);
  assert.equal(ANATOMY_PIN_GUTTER, 30);
});


// --- CatalogMember.title ---

test('memberTitle is the title, falling back to the id', () => {
  assert.equal(memberTitle({ id: 'BotAvatarView', title: 'Bot avatar' }), 'Bot avatar');
  assert.equal(memberTitle({ id: 'BotAvatarView' }), 'BotAvatarView');
});

test('memberCodeLine keeps the id (and a different component) before the source of a titled member only', () => {
  assert.equal(memberCodeLine({ id: 'A', source: 'a.tsx:1' }), 'a.tsx:1');
  assert.equal(memberCodeLine({ id: 'A', title: 'Alpha', source: 'a.tsx:1' }), 'A · a.tsx:1');
  assert.equal(memberCodeLine({ id: 'A', title: 'Alpha', component: 'AView', source: 'a.tsx:1' }), 'A · AView · a.tsx:1');
  assert.equal(memberCodeLine({ id: 'A', title: 'Alpha', component: 'A', source: 'a.tsx:1' }), 'A · a.tsx:1', 'a component named like the id is not repeated');
});

test('memberTitleMap lists titled members by id and alias, across pages, and skips untitled members and the whole', () => {
  const member = (id: string, extra: Record<string, unknown> = {}) => ({ id, source: 's', fidelity: 'replicated' as const, relationship: 'r', description: 'd', ...extra });
  const titles = memberTitleMap([
    { id: 'Whole', description: 'd', path: 'p', family: { whole: 'Whole', sections: [], outline: new Map(), members: [member('Whole', { title: 'Ignored' }), member('A', { title: 'Alpha', aliases: ['OldA'] }), member('B')] } },
    { id: 'Plain', description: 'd', path: 'p' },
    { id: 'Group', description: 'd', path: 'p', family: { kind: 'group', sections: [], outline: new Map(), members: [member('G', { title: 'Gee' })] } },
  ]);
  assert.deepEqual([...titles], [['A', 'Alpha'], ['OldA', 'Alpha'], ['G', 'Gee']]);
});

test('memberTitleMap also maps a member\'s component to its title, unless it is the id or collides with another name', () => {
  const member = (id: string, extra: Record<string, unknown> = {}) => ({ id, source: 's', fidelity: 'replicated' as const, relationship: 'r', description: 'd', ...extra });
  const titles = memberTitleMap([
    {
      id: 'Whole', description: 'd', path: 'p',
      family: {
        whole: 'Whole', sections: [], outline: new Map(),
        members: [
          member('Whole'),
          member('A', { title: 'Alpha', component: 'AView' }),
          member('Same', { title: 'Same title', component: 'Same' }),
          member('B', { title: 'Bee', component: 'Other' }),
          member('Other', { title: 'Other title' }),
          member('C', { title: 'Cee', component: 'Shared' }),
          member('D', { title: 'Dee', component: 'Shared' }),
          member('E', { title: 'Eee', component: 'Whole' }),
        ],
      },
    },
  ]);
  assert.equal(titles.get('AView'), 'Alpha', 'a component with its own name is mapped');
  assert.equal(titles.get('Same'), 'Same title');
  assert.equal(titles.get('Other'), 'Other title', 'a component equal to another member\'s id keeps that member\'s title');
  assert.equal(titles.has('Shared'), false, 'a component two members claim is ambiguous');
  assert.equal(titles.get('Whole'), undefined, 'a component named like a page id is left to the page');
});
