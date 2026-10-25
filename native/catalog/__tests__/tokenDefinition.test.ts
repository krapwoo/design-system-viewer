import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalTokenTitle,
  findDuplicateIds,
  isTokenKind,
  tokenEntryAddress,
  validateTokenDefinition,
  validateTokenDefinitionUsage,
  type ColorTokenEntry,
  type MotionTokenEntry,
  type TokenDefinition,
} from '../tokenDefinition.ts';

test('isTokenKind/canonicalTokenTitle cover exactly the eight approved kinds', () => {
  const kinds = ['colors', 'typography', 'spacing', 'radius', 'dimensions', 'shadows', 'opacity', 'motion'];
  for (const kind of kinds) assert.equal(isTokenKind(kind), true);
  assert.equal(isTokenKind('colour'), false);
  assert.equal(canonicalTokenTitle('colors'), 'Colors');
  assert.equal(canonicalTokenTitle('dimensions'), 'Dimensions');
});

test('findDuplicateIds reports each duplicate once, order-independent', () => {
  assert.deepEqual(findDuplicateIds(['a', 'b', 'a', 'c', 'b', 'b']).sort(), ['a', 'b']);
  assert.deepEqual(findDuplicateIds(['a', 'b', 'c']), []);
});

test('tokenEntryAddress escapes a separator inside any one part so distinct inputs never collide', () => {
  const a = tokenEntryAddress('page', 'section', 'a/b');
  const b = tokenEntryAddress('page', 'section/a', 'b');
  assert.notEqual(a, b);
  assert.equal(tokenEntryAddress('p', 's', 'e'), 'p/s/e');
});

function namedResolved<V>(value: V) {
  return { provenance: 'named' as const, resolution: { status: 'resolved' as const, value } };
}

test('validateTokenDefinition: duplicate entry ids are rejected only within their own section', () => {
  const colorA: ColorTokenEntry = { id: 'brand', name: 'Brand', kind: 'colors', value: namedResolved({ color: '#102030' }) };
  const colorB: ColorTokenEntry = { id: 'brand', name: 'Brand (duplicate)', kind: 'colors', value: namedResolved({ color: '#102031' }) };
  const colorOtherScope: ColorTokenEntry = { id: 'brand', name: 'Brand (other scope)', kind: 'colors', value: namedResolved({ color: '#102032' }) };
  const def: TokenDefinition = {
    kind: 'colors',
    sections: [
      { id: 'palette', title: 'Palette', entries: [colorA, colorB] },
      { id: 'semantic', title: 'Semantic', entries: [colorOtherScope] },
    ],
  };
  const issues = validateTokenDefinition(def);
  assert.equal(issues.length, 1);
  assert.match(issues[0], /section "palette".*more than one entry.*"brand"/);
});

test('validateTokenDefinition: duplicate section ids are reported', () => {
  const def: TokenDefinition = {
    kind: 'spacing',
    sections: [
      { id: 'scale', title: 'Scale', entries: [] },
      { id: 'scale', title: 'Scale (again)', entries: [] },
    ],
  };
  assert.deepEqual(validateTokenDefinition(def), ['tokenDefinition has more than one section with id "scale".']);
});

test('validateTokenDefinition: an entry whose own kind does not match the page kind is reported', () => {
  const motionEntry: MotionTokenEntry = {
    id: 'base', name: 'Base', kind: 'motion',
    value: { provenance: 'inline', resolution: { status: 'resolved', value: { kind: 'timing', durationMs: 200, sourceValue: 0.2, sourceUnit: 's' } } },
  };
  const def: TokenDefinition = { kind: 'colors', sections: [{ id: 's', title: 'S', entries: [motionEntry as never] }] };
  const issues = validateTokenDefinition(def);
  assert.equal(issues.length, 1);
  assert.match(issues[0], /kind "motion", but the page's kind is "colors"/);
});

test('validateTokenDefinition: a well-formed definition has no issues', () => {
  const def: TokenDefinition = {
    kind: 'opacity',
    sections: [{ id: 'scale', title: 'Scale', entries: [{ id: 'muted', name: 'Muted', kind: 'opacity', value: namedResolved({ amount: 0.5 }) }] }],
  };
  assert.deepEqual(validateTokenDefinition(def), []);
});

test('validateTokenDefinitionUsage: flags a conflicting legacy render/tokenGallery/tokenSections/family', () => {
  assert.deepEqual(validateTokenDefinitionUsage('colors', { hasRender: true }), [
    'tokenDefinition conflicts with this page\'s own "render" — remove one of them.',
  ]);
  assert.deepEqual(validateTokenDefinitionUsage('colors', { hasTokenGallery: true }), [
    'tokenDefinition conflicts with this page\'s own "tokenGallery" — remove one of them.',
  ]);
  assert.deepEqual(validateTokenDefinitionUsage('colors', { hasTokenSections: true }), [
    'tokenDefinition conflicts with this page\'s own "tokenSections" — remove one of them.',
  ]);
  assert.deepEqual(validateTokenDefinitionUsage('colors', { hasFamily: true }), [
    'tokenDefinition conflicts with this page\'s own "members" (a family page) — remove one of them.',
  ]);
});

test('validateTokenDefinitionUsage: an explicit title conflicting with the kind is reported; a matching or omitted title is not', () => {
  const conflict = validateTokenDefinitionUsage('spacing', { title: 'Sizes' });
  assert.equal(conflict.length, 1);
  assert.match(conflict[0], /title "Sizes" conflicts with kind "spacing" \(expected "Spacing"\)/);
  assert.deepEqual(validateTokenDefinitionUsage('spacing', { title: 'Spacing' }), []);
  assert.deepEqual(validateTokenDefinitionUsage('spacing', {}), []);
});

test('validateTokenDefinitionUsage: a clean page with no conflicts reports nothing', () => {
  assert.deepEqual(validateTokenDefinitionUsage('motion', {}), []);
});
