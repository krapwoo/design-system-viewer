import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterGroups, groupLabelFor, hashForId, idFromHash, neighbors, orderedIds, sortIds } from '../catalogNavigation.ts';

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
