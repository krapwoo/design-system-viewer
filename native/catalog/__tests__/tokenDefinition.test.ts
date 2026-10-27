import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalTokenTitle,
  findDuplicateIds,
  isTokenKind,
  pairLightDarkColorEntries,
  sectionEntryCount,
  tokenEntryAddress,
  validateTokenDefinition,
  validateTokenDefinitionUsage,
  type ColorTokenEntry,
  type MotionTokenEntry,
  type TokenDefinition,
  type TokenDefinitionSection,
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

// #64 B1: groups inside a category.
test('validateTokenDefinition: a duplicate group id within a section is reported', () => {
  const def: TokenDefinition = {
    kind: 'colors',
    sections: [{
      id: 'palette', title: 'Palette', entries: [],
      groups: [
        { id: 'brand', title: 'Brand', entries: [] },
        { id: 'brand', title: 'Brand (again)', entries: [] },
      ],
    }],
  };
  assert.deepEqual(validateTokenDefinition(def), ['tokenDefinition section "palette" has more than one group with id "brand".']);
});

test('validateTokenDefinition: a duplicate entry id within one group is reported, but the same id in a sibling group or the section\'s own entries is not', () => {
  const dupInGroup: ColorTokenEntry = { id: 'dup', name: 'A', kind: 'colors', value: namedResolved({ color: '#111111' }) };
  const dupInGroupAgain: ColorTokenEntry = { id: 'dup', name: 'B', kind: 'colors', value: namedResolved({ color: '#222222' }) };
  const sameIdSiblingGroup: ColorTokenEntry = { id: 'dup', name: 'C', kind: 'colors', value: namedResolved({ color: '#333333' }) };
  const sameIdOwnEntries: ColorTokenEntry = { id: 'dup', name: 'D', kind: 'colors', value: namedResolved({ color: '#444444' }) };
  const def: TokenDefinition = {
    kind: 'colors',
    sections: [{
      id: 'palette', title: 'Palette', entries: [sameIdOwnEntries],
      groups: [
        { id: 'brand', title: 'Brand', entries: [dupInGroup, dupInGroupAgain] },
        { id: 'accent', title: 'Accent', entries: [sameIdSiblingGroup] },
      ],
    }],
  };
  const issues = validateTokenDefinition(def);
  assert.equal(issues.length, 1);
  assert.match(issues[0], /section "palette" group "brand" has more than one entry with id "dup"/);
});

test('validateTokenDefinition: an entry inside a group whose own kind does not match the page kind is reported', () => {
  const motionEntry: MotionTokenEntry = {
    id: 'base', name: 'Base', kind: 'motion',
    value: { provenance: 'inline', resolution: { status: 'resolved', value: { kind: 'timing', durationMs: 200, sourceValue: 0.2, sourceUnit: 's' } } },
  };
  const def: TokenDefinition = {
    kind: 'colors',
    sections: [{ id: 's', title: 'S', entries: [], groups: [{ id: 'g', title: 'G', entries: [motionEntry as never] }] }],
  };
  const issues = validateTokenDefinition(def);
  assert.equal(issues.length, 1);
  assert.match(issues[0], /section "s" group "g": entry "base" has kind "motion", but the page's kind is "colors"/);
});

test('validateTokenDefinition: a well-formed definition with groups has no issues', () => {
  const def: TokenDefinition = {
    kind: 'opacity',
    sections: [{
      id: 'scale', title: 'Scale',
      entries: [{ id: 'muted', name: 'Muted', kind: 'opacity', value: namedResolved({ amount: 0.5 }) }],
      groups: [{ id: 'extra', title: 'Extra', entries: [{ id: 'faint', name: 'Faint', kind: 'opacity', value: namedResolved({ amount: 0.1 }) }] }],
    }],
  };
  assert.deepEqual(validateTokenDefinition(def), []);
});

// #64 B2: category jump row entry counts.
test('sectionEntryCount counts a section\'s own entries plus every group\'s entries', () => {
  const section: TokenDefinitionSection = {
    id: 's', title: 'S',
    entries: [{ id: 'a', name: 'A', kind: 'opacity', value: namedResolved({ amount: 0.1 }) }],
    groups: [
      { id: 'g1', title: 'G1', entries: [{ id: 'b', name: 'B', kind: 'opacity', value: namedResolved({ amount: 0.2 }) }, { id: 'c', name: 'C', kind: 'opacity', value: namedResolved({ amount: 0.3 }) }] },
      { id: 'g2', title: 'G2', entries: [] },
    ],
  };
  assert.equal(sectionEntryCount('opacity', section), 3);
});

test('sectionEntryCount counts a light/dark color pair once, the way it renders as one swatch', () => {
  const color = (id: string, name: string, appearance?: 'light' | 'dark') =>
    ({ id, name, kind: 'colors' as const, ...(appearance ? { appearance } : {}), value: { provenance: 'named' as const, resolution: { status: 'resolved' as const, value: { color: '#000000' } } } });
  const section = {
    id: 's', title: 'S',
    entries: [color('aL', 'A', 'light'), color('aD', 'A', 'dark'), color('b', 'B')],
    groups: [{ id: 'g', title: 'G', entries: [color('cL', 'C', 'light'), color('cD', 'C', 'dark'), color('d', 'D', 'dark')] }],
  };
  assert.equal(sectionEntryCount('colors', section), 4);
});

test('sectionEntryCount counts an unresolved light/dark pair as two cells, since the renderer falls back to one cell per side', () => {
  const resolved = (id: string, name: string, appearance: 'light' | 'dark') =>
    ({ id, name, kind: 'colors' as const, appearance, value: { provenance: 'named' as const, resolution: { status: 'resolved' as const, value: { color: '#000000' } } } });
  const unresolved = (id: string, name: string, appearance: 'light' | 'dark') =>
    ({ id, name, kind: 'colors' as const, appearance, value: { provenance: 'named' as const, resolution: { status: 'unresolved' as const, reason: 'platform-provided dynamic color' } } });
  const section = {
    id: 's', title: 'S',
    entries: [resolved('aL', 'A', 'light'), resolved('aD', 'A', 'dark'), unresolved('bL', 'B', 'light'), resolved('bD', 'B', 'dark')],
  };
  assert.equal(sectionEntryCount('colors', section as never), 3, 'one resolved pair (1) + one unresolved pair (2)');
});

test('sectionEntryCount counts what renders: a repeated id and a kind-mismatched entry are not counted', () => {
  const opacity = (id: string) => ({ id, name: id, kind: 'opacity' as const, value: namedResolved({ amount: 0.1 }) });
  const section = {
    id: 's', title: 'S',
    entries: [opacity('a'), opacity('a'), { ...opacity('m'), kind: 'motion' as const }],
    groups: [{ id: 'g', title: 'G', entries: [opacity('a'), opacity('b'), opacity('b')] }],
  };
  assert.equal(sectionEntryCount('opacity', section as never), 3, 'own: a (dupe and mismatch dropped); group: a, b (its own scope, dupe dropped)');
});

test('sectionEntryCount with no groups counts just the section\'s own entries', () => {
  assert.equal(sectionEntryCount('opacity', { id: 's', title: 'S', entries: [] }), 0);
  assert.equal(sectionEntryCount('opacity', { id: 's', title: 'S', entries: [{ id: 'a', name: 'A', kind: 'opacity', value: namedResolved({ amount: 0.1 }) }] }), 1);
});

// #64 B3: light/dark pairing — the extracted pure decision.
function colorEntry(id: string, name: string, appearance?: 'light' | 'dark'): ColorTokenEntry {
  return { id, name, kind: 'colors', appearance, value: namedResolved({ color: '#000000' }) };
}

test('pairLightDarkColorEntries pairs a light and a dark entry with the same name, preserving the position of whichever comes first', () => {
  const light = colorEntry('accentLight', 'Accent', 'light');
  const dark = colorEntry('accentDark', 'Accent', 'dark');
  const other = colorEntry('brand', 'Brand');
  assert.deepEqual(pairLightDarkColorEntries([light, dark, other]), [
    { kind: 'pair', name: 'Accent', light, dark },
    { kind: 'single', entry: other },
  ]);
  // Dark listed first: the pair still forms, positioned at the dark entry's own spot.
  assert.deepEqual(pairLightDarkColorEntries([dark, light]), [{ kind: 'pair', name: 'Accent', light, dark }]);
});

test('pairLightDarkColorEntries leaves an unmatched appearance entry unpaired, exactly as a plain entry', () => {
  const dark = colorEntry('onlyDark', 'Solo', 'dark');
  assert.deepEqual(pairLightDarkColorEntries([dark]), [{ kind: 'single', entry: dark }]);
});

test('pairLightDarkColorEntries never double-pairs: a third same-named entry stays single once both appearances are claimed', () => {
  const light = colorEntry('l', 'Dup', 'light');
  const dark = colorEntry('d', 'Dup', 'dark');
  const secondLight = colorEntry('l2', 'Dup', 'light');
  assert.deepEqual(pairLightDarkColorEntries([light, dark, secondLight]), [
    { kind: 'pair', name: 'Dup', light, dark },
    { kind: 'single', entry: secondLight },
  ]);
});
