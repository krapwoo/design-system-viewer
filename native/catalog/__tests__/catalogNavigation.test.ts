import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterGroups, groupLabelFor, hashForId, idFromHash, neighbors, orderedIds, sortIds } from '../catalogNavigation.ts';
import { DS_VIEWER_SECRET_HEADER, footerLabel, resolveActiveFromHash, shouldShowMajorBanner, UPDATE_PAGE_ID } from '../catalogNavigation.ts';
import type { UpdateNotice } from '../types.ts';

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
