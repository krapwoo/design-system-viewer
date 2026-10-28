import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextTopLevelNumber, partEntries, partNumbering } from '../partsModel.ts';
import type { CatalogAnatomy, ComposedOfEntry } from '../types.ts';

const e = (component: string, relationship: ComposedOfEntry['relationship'], role = `${component} role`): ComposedOfEntry => ({ component, role, relationship });

test('built-in and slot entries are parts, related ones are not, in declared order', () => {
  const parts = partEntries([{ composedOf: [e('B', 'built-in'), e('R', 'related'), e('A', 'slot'), e('C', 'built-in')] }]);
  assert.deepEqual(parts.map((p) => p.entry.component), ['B', 'A', 'C']);
});

test('nothing declared, or only related entries, gives no parts', () => {
  assert.deepEqual(partEntries([{ composedOf: undefined }]), []);
  assert.deepEqual(partEntries([{ composedOf: [e('R', 'related')] }, { composedOf: [] }]), []);
});

test('a whole\'s entries follow the page\'s, are deduplicated by name (first wins) and keep their source member', () => {
  const parts = partEntries([
    { composedOf: [e('X', 'built-in', 'page role'), e('Y', 'slot')] },
    { composedOf: [e('Y', 'built-in', 'whole role'), e('Z', 'built-in', 'whole z')], sourceMemberId: 'Whole' },
  ]);
  assert.deepEqual(parts.map((p) => [p.entry.component, p.entry.role, p.sourceMemberId]), [
    ['X', 'page role', undefined],
    ['Y', 'Y role', undefined],
    ['Z', 'whole z', 'Whole'],
  ]);
});

test('a name the page claims as its own member is left out', () => {
  const parts = partEntries([{ composedOf: [e('Member', 'built-in'), e('Other', 'built-in')] }], (name) => name === 'Member');
  assert.deepEqual(parts.map((p) => p.entry.component), ['Other']);
});

const anatomy = (...groups: string[][]): CatalogAnatomy => ({
  picture: null,
  groups: groups.map((names, i) => ({ label: `G${i}`, items: names.map((n) => (n.startsWith('@') ? { member: n.slice(1), description: '' } : { other: n, description: '' })) })),
});

test('nextTopLevelNumber: one past the highest top-level number, children counted under their parent', () => {
  const outline = new Map([['A', { number: '1' }], ['A1', { number: '1.1' }], ['B', { number: '2' }], ['B1', { number: '2.1' }]]);
  assert.equal(nextTopLevelNumber(outline), 3);
  assert.equal(nextTopLevelNumber(new Map()), 1);
  assert.equal(nextTopLevelNumber(outline, ['A', 'A1']), 2, 'limited to the given members');
});

test('numbering: members\' numbers first, then anatomy others in legend order, then Parts-only entries in block order', () => {
  const numbers = partNumbering({
    first: 3,
    anatomies: [anatomy(['@M', 'Toggle', 'Chip'], ['Banner', 'Toggle'])],
    partNames: ['Gadget', 'Chip', 'Panel'],
  });
  assert.deepEqual(['Toggle', 'Chip', 'Banner', 'Gadget', 'Panel'].map(numbers.numberOf), ['3', '4', '5', '6', '7']);
  assert.equal(numbers.numberOf('M'), undefined, 'a member is not numbered here');
  assert.equal(numbers.numberOf('Unknown'), undefined);
});

test('numbering: a page with no anatomy others and no parts hands out nothing', () => {
  const numbers = partNumbering({ first: 3, anatomies: [anatomy(['@M'])], partNames: [] });
  assert.equal(numbers.numberOf('M'), undefined);
});

test('numbering: names with the same identity share one number', () => {
  const ids: Record<string, string> = { Header: 'p#h', HeaderAlias: 'p#h' };
  const numbers = partNumbering({
    first: 1,
    anatomies: [anatomy(['HeaderAlias', 'Chip'])],
    partNames: ['Header', 'Toggle'],
    keyOf: (name) => ids[name] ?? name,
  });
  assert.deepEqual(['HeaderAlias', 'Header', 'Chip', 'Toggle'].map(numbers.numberOf), ['1', '1', '2', '3']);
});

test('numbering: several anatomies continue one sequence', () => {
  const numbers = partNumbering({ first: 1, anatomies: [anatomy(['A']), undefined, anatomy(['B', 'A'])], partNames: [] });
  assert.deepEqual(['A', 'B'].map(numbers.numberOf), ['1', '2']);
});

test('numbering: a name that does not count is never numbered, wherever it appears', () => {
  const numbers = partNumbering({
    first: 1,
    anatomies: [anatomy(['Style', 'Chip'])],
    partNames: ['Style', 'Toggle'],
    counts: (name) => name !== 'Style',
  });
  assert.deepEqual(['Style', 'Chip', 'Toggle'].map(numbers.numberOf), [undefined, '1', '2']);
});
