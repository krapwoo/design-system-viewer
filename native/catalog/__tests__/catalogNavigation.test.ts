import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterGroups, groupLabelFor, hashForId, idFromHash, neighbors, orderedIds, sortIds } from '../catalogNavigation.ts';
import { DS_VIEWER_SECRET_HEADER, footerLabel, resolveActiveFromHash, shouldShowMajorBanner, UPDATE_PAGE_ID } from '../catalogNavigation.ts';
import { aliasTargets, resolveRoute, searchResults } from '../catalogNavigation.ts';
import type { SectionDef, UpdateNotice } from '../types.ts';

const groups = [
  { label: 'Actions', ids: ['Pill', 'Button'] },
  { label: 'Tokens', ids: ['Spacing', 'Colors'] },
];

test('sortIds sorts alphabetically without mutating the input', () => {
  const ids = ['Pill', 'Button'];
  assert.deepEqual(sortIds(ids), ['Button', 'Pill']);
  assert.deepEqual(ids, ['Pill', 'Button']);
});

test('orderedIds follows group order, sorts within groups, dedupes, and drops unavailable ids', () => {
  assert.deepEqual(orderedIds(groups), ['Button', 'Pill', 'Colors', 'Spacing']);
  assert.deepEqual(orderedIds(groups, new Set(['Button', 'Colors', 'Spacing'])), ['Button', 'Colors', 'Spacing']);
  assert.deepEqual(orderedIds([...groups, { label: 'Again', ids: ['Button'] }]), ['Button', 'Pill', 'Colors', 'Spacing']);
});

test('groupLabelFor returns the owning group label', () => {
  assert.equal(groupLabelFor(groups, 'Colors'), 'Tokens');
  assert.equal(groupLabelFor(groups, 'Missing'), undefined);
});

test('neighbors does not wrap at either end', () => {
  const order = ['Button', 'Pill', 'Colors'];
  assert.deepEqual(neighbors(order, 'Button'), { previous: null, next: 'Pill' });
  assert.deepEqual(neighbors(order, 'Pill'), { previous: 'Button', next: 'Colors' });
  assert.deepEqual(neighbors(order, 'Colors'), { previous: 'Pill', next: null });
  assert.deepEqual(neighbors(order, 'Missing'), { previous: null, next: null });
});

test('filterGroups trims, ignores case, sorts, and drops empty groups', () => {
  assert.deepEqual(filterGroups(groups, ''), [
    { label: 'Actions', ids: ['Button', 'Pill'] },
    { label: 'Tokens', ids: ['Colors', 'Spacing'] },
  ]);
  assert.deepEqual(filterGroups(groups, '  BUT '), [{ label: 'Actions', ids: ['Button'] }]);
  assert.deepEqual(filterGroups(groups, 'co'), [{ label: 'Tokens', ids: ['Colors'] }]);
  assert.deepEqual(filterGroups(groups, 'zzz'), []);
});

test('hashForId and idFromHash round-trip and fall back to the first page', () => {
  const order = ['Button', 'Pill'];
  assert.equal(hashForId('Button'), '#Button');
  assert.equal(idFromHash(hashForId('Pill'), order), 'Pill');
  assert.equal(idFromHash('Pill', order), 'Pill');
  assert.equal(idFromHash('#Nope', order), 'Button');
  assert.equal(idFromHash('', order), 'Button');
  assert.equal(idFromHash('#%E0%A4%A', order), 'Button');
  assert.equal(idFromHash('#Button', []), undefined);
});

test('resolveActiveFromHash recognizes #ds-viewer-update even though it is never a member of order', () => {
  assert.equal(resolveActiveFromHash('#ds-viewer-update', ['Button', 'Card']), UPDATE_PAGE_ID);
});

test('resolveActiveFromHash falls back to the normal idFromHash behavior for every other hash', () => {
  assert.equal(resolveActiveFromHash('#Card', ['Button', 'Card']), 'Card');
  assert.equal(resolveActiveFromHash('#Nope', ['Button', 'Card']), 'Button'); // unknown fragment → first page
});

test('DS_VIEWER_SECRET_HEADER is the exact lowercase header name both the endpoint and the generated entry use', () => {
  assert.equal(DS_VIEWER_SECRET_HEADER, 'x-ds-viewer-secret');
});

const BREAKING: UpdateNotice = { current: '0.4.0', latest: '1.0.0', breaking: true, summary: [] };
const MINOR: UpdateNotice = { current: '0.4.0', latest: '0.5.0', breaking: false, summary: [] };

test('shouldShowMajorBanner: false with no update, a non-breaking update, when already on latest, or when latest is not actually newer', () => {
  assert.equal(shouldShowMajorBanner(null, null), false);
  assert.equal(shouldShowMajorBanner(undefined, null), false);
  assert.equal(shouldShowMajorBanner(MINOR, null), false);
  assert.equal(shouldShowMajorBanner({ ...BREAKING, latest: BREAKING.current }, null), false);
  // Defense in depth (Critical finding, Fable correction pass): `checkForUpdate` (Task 4) already
  // guarantees `update.json` never holds a `latest` that isn't newer than `current`, but this
  // function guards the same thing itself too, in case a future caller ever constructs an
  // `UpdateNotice` some other way — `current` ahead of `latest` (not merely equal) must never
  // show a downgrade banner either.
  assert.equal(shouldShowMajorBanner({ ...BREAKING, current: '1.0.0', latest: '0.9.0' }, null), false);
});

test('shouldShowMajorBanner: false once dismissed for this exact version, true otherwise', () => {
  assert.equal(shouldShowMajorBanner(BREAKING, '1.0.0'), false);
  assert.equal(shouldShowMajorBanner(BREAKING, '0.9.0'), true); // dismissed a different (older) major
  assert.equal(shouldShowMajorBanner(BREAKING, null), true);
});

test('footerLabel: undefined with no update, when already on latest, or when latest is not actually newer; the exact copy string otherwise', () => {
  assert.equal(footerLabel(null), undefined);
  assert.equal(footerLabel({ ...MINOR, latest: MINOR.current }), undefined);
  assert.equal(footerLabel({ ...MINOR, current: '1.0.0', latest: '0.9.0' }), undefined);
  assert.equal(footerLabel(MINOR), 'Update available · 0.5.0');
  assert.equal(footerLabel(BREAKING), 'Update available · 1.0.0'); // the footer line stays even for a major (design §5)
  // Errata 5: isNewerVersion parses with /^(\d+)\.(\d+)\.(\d+)/ so a prerelease suffix on `latest`
  // doesn't make Number() produce NaN — 0.4.1-verify must still compare newer than 0.4.0.
  assert.equal(footerLabel({ current: '0.4.0', latest: '0.4.1-verify', breaking: false, summary: [] }), 'Update available · 0.4.1-verify');
});

test('filterGroups also matches a page\'s display title', () => {
  const labels = new Map([['Spacing', 'Spacing scale'], ['Colors', 'Colour roles']]);
  assert.deepEqual(filterGroups(groups, 'colour', labels), [{ label: 'Tokens', ids: ['Colors'] }]);
  assert.deepEqual(filterGroups(groups, 'scale', labels), [{ label: 'Tokens', ids: ['Spacing'] }]);
});

test('filterGroups also matches a page\'s member ids or aliases, via an optional member index', () => {
  const memberIndex = new Map([['Button', ['PrimaryButtonView', 'OldButton']]]);
  assert.deepEqual(filterGroups(groups, 'primarybutton', undefined, memberIndex), [{ label: 'Actions', ids: ['Button'] }]);
  assert.deepEqual(filterGroups(groups, 'oldbutton', undefined, memberIndex), [{ label: 'Actions', ids: ['Button'] }]);
  assert.deepEqual(filterGroups(groups, 'zzz', undefined, memberIndex), []);
});

function section(id: string, family?: SectionDef['family']): SectionDef {
  return { id, description: 'd', path: 'p', family };
}

const botAvatarFamily: SectionDef['family'] = {
  whole: 'BotAvatarView',
  outline: new Map(),
  sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['BotAnimatedFaceView'] }],
  aliases: ['OldBotAvatar'],
  members: [
    { id: 'BotAvatarView', source: 'x:1', fidelity: 'approximated', relationship: 'Main component', description: 'd', path: 'x:1' },
    {
      id: 'BotAnimatedFaceView', source: 'y:1', fidelity: 'documentation-only', relationship: 'Anatomy',
      parent: 'BotAvatarView', description: 'd', path: 'y:1', aliases: ['OldFaceView'],
    },
  ],
};

const sectionsFixture: SectionDef[] = [section('BotAvatarView', botAvatarFamily), section('Button')];

test('aliasTargets maps every member id other than the whole, and every alias, to its family page', () => {
  const targets = aliasTargets(sectionsFixture);
  assert.deepEqual(targets.get('BotAnimatedFaceView'), { pageId: 'BotAvatarView', memberId: 'BotAnimatedFaceView' });
  assert.deepEqual(targets.get('OldFaceView'), { pageId: 'BotAvatarView', memberId: 'BotAnimatedFaceView' });
  assert.deepEqual(targets.get('OldBotAvatar'), { pageId: 'BotAvatarView' });
  assert.equal(targets.has('BotAvatarView'), false); // the whole already has its own page address
  assert.equal(targets.has('Button'), false); // not a family page
});

test('resolveRoute: the empty fragment', () => {
  assert.deepEqual(resolveRoute('', ['BotAvatarView', 'Button'], new Map()), { kind: 'empty' });
  assert.deepEqual(resolveRoute('#', ['BotAvatarView', 'Button'], new Map()), { kind: 'empty' });
});

test('resolveRoute: #ds-viewer-update', () => {
  assert.deepEqual(resolveRoute('#ds-viewer-update', ['BotAvatarView', 'Button'], new Map()), { kind: 'update' });
});

test('resolveRoute: a known page', () => {
  assert.deepEqual(resolveRoute('#Button', ['BotAvatarView', 'Button'], new Map()), { kind: 'page', id: 'Button' });
});

test('resolveRoute: a malformed fragment', () => {
  assert.deepEqual(resolveRoute('#%E0%A4%A', ['BotAvatarView', 'Button'], new Map()), { kind: 'notFound', raw: '%E0%A4%A' });
});

test('resolveRoute: an unknown fragment', () => {
  assert.deepEqual(resolveRoute('#Nope', ['BotAvatarView', 'Button'], new Map()), { kind: 'notFound', raw: 'Nope' });
});

test('resolveRoute: an alias to the whole, and an alias/member id to a member', () => {
  const targets = aliasTargets(sectionsFixture);
  assert.deepEqual(resolveRoute('#OldBotAvatar', ['BotAvatarView', 'Button'], targets), { kind: 'page', id: 'BotAvatarView' });
  assert.deepEqual(resolveRoute('#BotAnimatedFaceView', ['BotAvatarView', 'Button'], targets), { kind: 'member', pageId: 'BotAvatarView', memberId: 'BotAnimatedFaceView' });
  assert.deepEqual(resolveRoute('#OldFaceView', ['BotAvatarView', 'Button'], targets), { kind: 'member', pageId: 'BotAvatarView', memberId: 'BotAnimatedFaceView' });
});

test('searchResults returns member hits with the member id as its label and the owning family title', () => {
  const entries = [
    { pageId: 'BotAvatarView', memberId: 'BotAnimatedFaceView', aliases: ['OldFaceView'], familyTitle: 'Bot avatar' },
    { pageId: 'BotAvatarView', memberId: 'BotAvatarBody', familyTitle: 'Bot avatar' },
  ];
  assert.deepEqual(searchResults(entries, 'face'), [{ pageId: 'BotAvatarView', memberId: 'BotAnimatedFaceView', label: 'BotAnimatedFaceView', familyTitle: 'Bot avatar' }]);
  assert.deepEqual(searchResults(entries, 'oldface'), [{ pageId: 'BotAvatarView', memberId: 'BotAnimatedFaceView', label: 'BotAnimatedFaceView', familyTitle: 'Bot avatar' }]);
  assert.deepEqual(searchResults(entries, 'zzz'), []);
  assert.deepEqual(searchResults(entries, ''), []);
});

// Displayed-title page ordering (fix/title-page-order): `sortIds`/`orderedIds` take an optional
// `labels` map (id → `SectionDef.title`) and alphabetize by that displayed title instead of by id,
// falling back to the id itself when a page has no title. Equal titles break the tie on id.
//
// The user's own real-world example: a Bot avatar / App connection request / Code block family of
// pages whose real ids — BotAvatarView, BotConnectionRequestBody, ChatCodeBlock — sort as "Bot
// avatar, App connection request, Code block" by id alone — the wrong, pre-fix order reported
// below — but must read "App connection request, Bot avatar, Code block" once sorted by displayed
// title.
const titledGroups = [
  { label: 'Components', ids: ['BotAvatarView', 'BotConnectionRequestBody', 'ChatCodeBlock'] },
];
const titledLabels = new Map([
  ['BotAvatarView', 'Bot avatar'],
  ['BotConnectionRequestBody', 'App connection request'],
  ['ChatCodeBlock', 'Code block'],
]);

test('sortIds with no labels sorts by id alone — the pre-fix, wrong order for titled pages', () => {
  assert.deepEqual(sortIds(titledGroups[0].ids), ['BotAvatarView', 'BotConnectionRequestBody', 'ChatCodeBlock']);
});

test("sortIds with labels sorts by each id's displayed title instead of its id", () => {
  assert.deepEqual(sortIds(titledGroups[0].ids, titledLabels), ['BotConnectionRequestBody', 'BotAvatarView', 'ChatCodeBlock']);
});

test('orderedIds threads labels through to produce the same title order, within declared group order', () => {
  assert.deepEqual(orderedIds(titledGroups, undefined, titledLabels), ['BotConnectionRequestBody', 'BotAvatarView', 'ChatCodeBlock']);
});

test('sortIds falls back to the id itself for a page with no title, interleaving it with titled ones', () => {
  const ids = ['BotAvatarView', 'BotConnectionRequestBody', 'Bee'];
  // 'Bee' has no label, so it sorts by its own id ("Bee") against the other two's titles ("Bot
  // avatar", "App connection request") — it lands between them: "App connection request" < "Bee"
  // (A < B) < "Bot avatar" (comparing "Bee" to "Bot" letter-by-letter, 'e' < 'o').
  assert.deepEqual(sortIds(ids, titledLabels), ['BotConnectionRequestBody', 'Bee', 'BotAvatarView']);
});

test('sortIds breaks an equal-title tie on id, with the same collator, regardless of input order', () => {
  const labels = new Map([['Beta', 'Same title'], ['Alpha', 'Same title']]);
  assert.deepEqual(sortIds(['Beta', 'Alpha'], labels), ['Alpha', 'Beta']);
  assert.deepEqual(sortIds(['Alpha', 'Beta'], labels), ['Alpha', 'Beta']);
});

test('sortIds comparison is case-insensitive but accent-distinguishing, per Intl.Collator("en", {sensitivity:"accent"})', () => {
  // Case alone must not affect order ("apple" and "Apple" are equivalent) — the tie then breaks on
  // id, with the same case-insensitive collator ("Lower" < "Upper"), deterministically regardless
  // of input order.
  const caseLabels = new Map([['Lower', 'apple'], ['Upper', 'Apple']]);
  assert.deepEqual(sortIds(['Upper', 'Lower'], caseLabels), ['Lower', 'Upper']);
  assert.deepEqual(sortIds(['Lower', 'Upper'], caseLabels), ['Lower', 'Upper']);
  // Equal titles AND a case-insensitively-equal id tie ("alpha"/"Alpha", also equal under
  // {sensitivity:"accent"}) fall through the collator-based id tiebreak too, down to the final
  // exact code-unit comparison, which orders capitals before lowercase — "Alpha" < "alpha" —
  // again regardless of input order.
  const foldLabels = new Map([['alpha', 'fruit'], ['Alpha', 'fruit']]);
  assert.deepEqual(sortIds(['alpha', 'Alpha'], foldLabels), ['Alpha', 'alpha']);
  assert.deepEqual(sortIds(['Alpha', 'alpha'], foldLabels), ['Alpha', 'alpha']);
  // ...but an accent must ("café" sorts after "cafe", not equal to it).
  const accentLabels = new Map([['Accented', 'café'], ['Plain', 'cafe']]);
  assert.deepEqual(sortIds(['Accented', 'Plain'], accentLabels), ['Plain', 'Accented']);
});

test('sortIds never mutates its input array', () => {
  const ids = ['ChatCodeBlock', 'BotAvatarView', 'BotConnectionRequestBody'];
  const original = [...ids];
  sortIds(ids, titledLabels);
  assert.deepEqual(ids, original);
});

test('orderedIds preserves declared group order while sorting titles only within each group', () => {
  const groups = [
    { label: 'Z group', ids: ['ChatCodeBlock', 'BotAvatarView'] },
    { label: 'A group', ids: ['BotConnectionRequestBody'] },
  ];
  // "Z group" still comes first (declared order) even though its own titles ("Code block", "Bot
  // avatar") sort after "A group"'s ("App connection request") — only within-group order changes.
  assert.deepEqual(orderedIds(groups, undefined, titledLabels), ['BotAvatarView', 'ChatCodeBlock', 'BotConnectionRequestBody']);
});

test('orderedIds threads labels through sorting while still deduping and dropping unavailable ids', () => {
  const groupsWithDuplicate = [
    { label: 'Components', ids: ['BotAvatarView', 'BotConnectionRequestBody', 'ChatCodeBlock', 'BotAvatarView'] },
  ];
  const available = new Set(['BotAvatarView', 'BotConnectionRequestBody']);
  // The duplicate BotAvatarView collapses to a single occurrence, ChatCodeBlock is dropped as
  // unavailable, and the two survivors are still title-sorted: "App connection request" before
  // "Bot avatar".
  assert.deepEqual(orderedIds(groupsWithDuplicate, available, titledLabels), ['BotConnectionRequestBody', 'BotAvatarView']);
});

test('filterGroups preserves the canonical title order among filtered-in ids, by id, title, or member alias', () => {
  const memberIds = new Map([['ChatCodeBlock', ['CodeBlockViewImpl']]]);
  // No query: every id stays, in canonical (title) order.
  assert.deepEqual(filterGroups(titledGroups, '', titledLabels), [
    { label: 'Components', ids: ['BotConnectionRequestBody', 'BotAvatarView', 'ChatCodeBlock'] },
  ]);
  // A query matching by id substring: "view" is only in "BotAvatarView" now that the other two
  // ids — BotConnectionRequestBody, ChatCodeBlock — are the family's real, non-"View" ids.
  assert.deepEqual(filterGroups(titledGroups, 'view', titledLabels), [
    { label: 'Components', ids: ['BotAvatarView'] },
  ]);
  // A query matching two of the three ids/titles ("bot" is in both "BotAvatarView" and
  // "BotConnectionRequestBody") still returns them in canonical title order: "App connection
  // request" (BotConnectionRequestBody) before "Bot avatar" (BotAvatarView).
  assert.deepEqual(filterGroups(titledGroups, 'bot', titledLabels), [
    { label: 'Components', ids: ['BotConnectionRequestBody', 'BotAvatarView'] },
  ]);
  // A query matching only by title — "connection request" has a space, which no id contains —
  // proves the title path matches independently of the id path.
  assert.deepEqual(filterGroups(titledGroups, 'connection request', titledLabels), [
    { label: 'Components', ids: ['BotConnectionRequestBody'] },
  ]);
  // A query matching only by member alias still returns the matched id, correctly placed among
  // any other filtered-in ids — only one id matches here, so this also pins the member-alias path
  // isn't disturbed by the labels argument now being threaded through to sortIds.
  assert.deepEqual(filterGroups(titledGroups, 'codeblockviewimpl', titledLabels, memberIds), [
    { label: 'Components', ids: ['ChatCodeBlock'] },
  ]);
});

test('neighbors and idFromHash fallback share the same title-canonical order', () => {
  const order = orderedIds(titledGroups, undefined, titledLabels);
  assert.deepEqual(order, ['BotConnectionRequestBody', 'BotAvatarView', 'ChatCodeBlock']);
  // previous/next walk the title-sorted order, not id order.
  assert.deepEqual(neighbors(order, 'BotAvatarView'), { previous: 'BotConnectionRequestBody', next: 'ChatCodeBlock' });
  // An empty or unknown hash recovers to the title-canonical first page, not the id-canonical one.
  assert.equal(idFromHash('', order), 'BotConnectionRequestBody');
  assert.equal(idFromHash('#Nope', order), 'BotConnectionRequestBody');
});
