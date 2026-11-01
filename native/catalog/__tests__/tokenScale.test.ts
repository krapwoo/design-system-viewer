import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTokenScaleKind, tokenScale, type TokenFinding } from '../tokenScale.ts';
import { noTokensNote, validateTokenDefinition, type TokenDefinition } from '../tokenDefinition.ts';

// Every finding below is a labeled fixture, not a real project's scan.
const FINDINGS: TokenFinding[] = [
  { expression: 'cornerRadius: 6', usages: ['A.swift:1', 'B.swift:2'], unit: 'pt', value: 6 },
  { expression: 'RoundedRectangle(cornerRadius: 6, style: .continuous)', usages: ['B.swift:2', 'C.swift:3'], unit: 'pt', value: 6 },
  { expression: 'cornerRadius: 17', usages: ['D.swift:4'], unit: 'pt', value: 17 },
  { expression: 'cornerRadius: 2', usages: ['E.swift:5'], unit: 'pt', value: 2 },
  { expression: 'Metrics.cardCornerRadius', name: 'Metrics.cardCornerRadius', usages: ['F.swift:6'], unit: 'pt', value: 12 },
  { expression: 'cornerRadius: pill.height / 2', usages: ['G.swift:7'], unresolved: { reason: 'size', detail: 'Half of the pill\'s height' } },
  { expression: 'cornerRadius: isExpanded ? 12 : 8', usages: ['H.swift:8'], unresolved: { reason: 'state' } },
  { expression: 'cornerRadius: theme.radius', unresolved: { reason: 'other', detail: 'Read from the theme' } },
];

function section(def: TokenDefinition, id: string) {
  const found = def.sections.find((s) => s.id === id);
  assert.ok(found, `section ${id}`);
  return found;
}

test('findings with one value, unit and constraint become one entry named by value, with every written form and site', () => {
  const def = tokenScale('radius', FINDINGS);
  const six = section(def, 'values').entries.find((e) => e.name === '6pt');
  assert.ok(six);
  assert.deepEqual(six.expressions, ['cornerRadius: 6', 'RoundedRectangle(cornerRadius: 6, style: .continuous)']);
  assert.equal(six.expression, 'cornerRadius: 6');
  assert.deepEqual(six.usages, ['A.swift:1', 'B.swift:2', 'C.swift:3'], 'each site once');
  assert.equal(section(def, 'values').entries.filter((e) => e.name === '6pt').length, 1);
});

test('literal values run smallest to largest', () => {
  const names = section(tokenScale('radius', FINDINGS), 'values').entries.map((e) => e.name);
  assert.deepEqual(names, ['2pt', '6pt', '17pt']);
});

test('a constraint makes a different value: 360pt, max 360pt and min 360pt are three entries, in one order', () => {
  const def = tokenScale('dimensions', [
    { expression: 'minWidth: 360', value: 360, unit: 'pt', constraint: 'min' },
    { expression: 'width: 360', value: 360, unit: 'pt' },
    { expression: 'maxWidth: 360', value: 360, unit: 'pt', constraint: 'max' },
    { expression: 'width: 44', value: 44, unit: 'pt' },
  ]);
  assert.deepEqual(section(def, 'values').entries.map((e) => e.name), ['44pt', '360pt', 'min 360pt', 'max 360pt']);
});

test('named values come first, in their own section, and stay inline provenance unless the project says named', () => {
  const def = tokenScale('radius', FINDINGS);
  assert.deepEqual(def.sections.map((s) => s.id), ['named', 'values', 'not-fixed']);
  const [twelve] = section(def, 'named').entries;
  assert.equal(twelve.name, '12pt');
  assert.equal(twelve.note, 'Metrics.cardCornerRadius');
  assert.equal(twelve.value.provenance, 'inline', 'a component constant is not a design-system token');
  const declared = tokenScale('radius', [{ expression: 'DS.r', name: 'DS.r', value: 4, unit: 'pt', provenance: 'named' }]);
  assert.equal(declared.sections[0].entries[0].value.provenance, 'named');
});

test('what is not a fixed value goes last, one group per reason, never a sample', () => {
  const last = tokenScale('radius', FINDINGS).sections.at(-1)!;
  assert.equal(last.id, 'not-fixed');
  assert.deepEqual(last.entries, []);
  assert.deepEqual(last.groups!.map((g) => g.title), ['Depends on size', 'Depends on state', 'Other']);
  const [size] = last.groups![0].entries;
  assert.equal(size.name, 'cornerRadius: pill.height / 2');
  assert.deepEqual(size.value.resolution, { status: 'unresolved', reason: 'Half of the pill\'s height' });
  assert.equal(size.value.provenance, 'unresolved-finding');
  const [state] = last.groups![1].entries;
  assert.equal((state.value.resolution as { reason: string }).reason, 'Depends on state', 'the group title stands in when no detail is given');
});

test('empty reasons make no group, and no unresolved findings make no section', () => {
  const only = tokenScale('radius', [FINDINGS[7]]);
  assert.deepEqual(only.sections[0].groups!.map((g) => g.id), ['other']);
  assert.deepEqual(tokenScale('radius', [FINDINGS[0]]).sections.map((s) => s.id), ['values']);
  assert.deepEqual(tokenScale('radius', []).sections, []);
});

test('a finding with no number and no stated reason is unresolved, not a guessed value', () => {
  const def = tokenScale('spacing', [{ expression: 'padding(x)' }]);
  const [entry] = def.sections[0].groups![0].entries;
  assert.equal(entry.value.resolution.status, 'unresolved');
  assert.equal((entry.value.resolution as { reason: string }).reason, 'No value found');
});

test('the same unresolved expression merges, combining its sites', () => {
  const def = tokenScale('radius', [
    { expression: 'r / 2', usages: ['A:1'], unresolved: { reason: 'size' } },
    { expression: 'r / 2', usages: ['B:2'], unresolved: { reason: 'size' } },
  ]);
  const entries = def.sections[0].groups![0].entries;
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].usages, ['A:1', 'B:2']);
});

test('options.scales split the literal values into sub-scales; an unknown or missing scale goes to the rest', () => {
  const def = tokenScale('dimensions', [
    { expression: 'width: 320', value: 320, unit: 'pt', scale: 'widths' },
    { expression: 'height: 44', value: 44, unit: 'pt', scale: 'heights' },
    { expression: 'height: 28', value: 28, unit: 'pt', scale: 'heights' },
    { expression: 'size: 18', value: 18, unit: 'pt', scale: 'nope' },
    { expression: 'size: 20', value: 20, unit: 'pt' },
  ], { scales: [{ id: 'widths', title: 'Widths' }, { id: 'heights', title: 'Heights', desc: 'Control heights' }] });
  assert.deepEqual(def.sections.map((s) => s.title), ['Widths', 'Heights', 'Other values']);
  assert.deepEqual(def.sections[1].entries.map((e) => e.name), ['28pt', '44pt']);
  assert.equal(def.sections[1].desc, 'Control heights');
  assert.deepEqual(def.sections[2].entries.map((e) => e.name), ['18pt', '20pt']);
});

test('options.unit fills a missing unit, never overriding a given one; opacity has none', () => {
  const def = tokenScale('spacing', [{ expression: 'a', value: 8 }, { expression: 'b', value: 4, unit: 'px' }], { unit: 'pt' });
  assert.deepEqual(def.sections[0].entries.map((e) => e.name).sort(), ['4px', '8pt']);
  const opacity = tokenScale('opacity', [{ expression: '.opacity(0.5)', value: 0.5, unit: 'pt' }, { expression: 'opacity: 0.2', value: 0.2 }]);
  assert.deepEqual(opacity.sections[0].entries.map((e) => e.name), ['0.2', '0.5']);
  assert.deepEqual(opacity.sections[0].entries[0].value.resolution, { status: 'resolved', value: { amount: 0.2 } });
});

test('the result is a valid TokenDefinition (unique ids, matching kinds), for every scale kind', () => {
  for (const kind of ['radius', 'dimensions', 'spacing', 'opacity'] as const) {
    assert.deepEqual(validateTokenDefinition(tokenScale(kind, FINDINGS)), [], kind);
  }
  assert.equal(isTokenScaleKind('shadows'), false);
  assert.equal(isTokenScaleKind('radius'), true);
});

test('a page of findings says there are no tokens; one declared named token, or an opt-out, removes the line', () => {
  assert.deepEqual(noTokensNote(tokenScale('radius', FINDINGS)), { title: 'No radius tokens yet', body: "These are values written in the app's code, not shared tokens." });
  assert.equal(noTokensNote(tokenScale('radius', [...FINDINGS, { expression: 'DS.r', value: 4, unit: 'pt', provenance: 'named' }])), undefined);
  assert.equal(noTokensNote(tokenScale('radius', FINDINGS, { showNoTokensNote: false })), undefined);
  assert.equal(noTokensNote(tokenScale('radius', [])), undefined, 'a page with no entries makes no claim about the entries');
  const plain: TokenDefinition = { kind: 'motion', sections: [{ id: 's', title: 'S', entries: [{ id: 'a', name: 'Default', kind: 'motion', value: { provenance: 'platform', resolution: { status: 'resolved', value: { kind: 'timing', durationMs: 350, sourceValue: 0.35, sourceUnit: 's' } } } }] }] };
  assert.equal(noTokensNote(plain), undefined, 'a hand-written definition (platform values here) never claims "no tokens" unless it opts in');
  assert.ok(noTokensNote({ ...plain, showNoTokensNote: true }), 'and it can opt in');
});

test('a named value and a plain literal of the same number never merge: separate entries in their own sections', () => {
  const def = tokenScale('radius', [
    { expression: 'Metrics.cardCornerRadius', name: 'Metrics.cardCornerRadius', usages: ['Named.swift:1'], unit: 'pt', value: 12 },
    { expression: 'cornerRadius: 12', usages: ['Plain.swift:2'], unit: 'pt', value: 12 },
  ]);
  assert.deepEqual(def.sections.map((s) => s.id), ['named', 'values']);
  const [named] = section(def, 'named').entries;
  const [plain] = section(def, 'values').entries;
  assert.deepEqual([named.note, named.expressions, named.usages], ['Metrics.cardCornerRadius', undefined, ['Named.swift:1']]);
  assert.deepEqual([plain.note, plain.expression, plain.usages], [undefined, 'cornerRadius: 12', ['Plain.swift:2']], 'the literal keeps its own site and no name');
});

test('a scale called values, named or not-fixed cannot collide with a built-in section', () => {
  const def = tokenScale('dimensions', [
    { expression: 'width: 320', value: 320, unit: 'pt', scale: 'values' },
    { expression: 'width: 20', value: 20, unit: 'pt', scale: 'named' },
    { expression: 'width: 44', value: 44, unit: 'pt' },
    { expression: 'C.size', name: 'C.size', value: 8, unit: 'pt' },
    { expression: 'w / 2', unresolved: { reason: 'size' } },
  ], { scales: [{ id: 'values', title: 'Widths' }, { id: 'named', title: 'Named widths' }, { id: 'not-fixed', title: 'Unused' }] });
  const ids = def.sections.map((s) => s.id);
  assert.deepEqual(ids, ['named', 'scale-values', 'scale-named', 'values', 'not-fixed']);
  assert.equal(new Set(ids).size, ids.length, 'every section id is unique');
  assert.deepEqual(validateTokenDefinition(def), []);
  assert.deepEqual(section(def, 'scale-values').entries.map((e) => e.name), ['320pt'], 'drawn once, in its own section');
  assert.deepEqual(section(def, 'values').entries.map((e) => e.name), ['44pt']);
  assert.deepEqual(section(def, 'scale-named').entries.map((e) => e.name), ['20pt']);
});

test('a named finding with no value keeps its name as the note of its unresolved tile', () => {
  const def = tokenScale('radius', [{ expression: 'Metrics.cornerFromTheme', name: 'Metrics.cornerFromTheme', unresolved: { reason: 'other', detail: 'Read from the theme' } }]);
  const [entry] = def.sections[0].groups![0].entries;
  assert.equal(entry.note, 'Metrics.cornerFromTheme');
  const noValue = tokenScale('radius', [{ expression: 'Metrics.x', name: 'Metrics.x' }]);
  assert.equal(noValue.sections[0].groups![0].entries[0].note, 'Metrics.x');
  assert.equal(tokenScale('radius', [{ expression: 'cornerRadius: ?' }]).sections[0].groups![0].entries[0].note, undefined, 'no name, no note');
});

test('a finding with provenance named is named even without a name: first section, no inline claim', () => {
  const def = tokenScale('radius', [
    { expression: 'DS.r', value: 4, unit: 'pt', provenance: 'named' },
    { expression: 'cornerRadius: 9', value: 9, unit: 'pt' },
  ]);
  assert.deepEqual(def.sections.map((s) => s.id), ['named', 'values']);
  assert.deepEqual(section(def, 'named').entries.map((e) => e.name), ['4pt']);
  assert.equal(section(def, 'named').entries[0].value.provenance, 'named');
  assert.equal(noTokensNote(def), undefined);
});

test('unresolved findings of one expression keep every distinct detail, once each', () => {
  const def = tokenScale('radius', [
    { expression: 'r / 2', unresolved: { reason: 'size', detail: 'Half of the pill height' } },
    { expression: 'r / 2', unresolved: { reason: 'size', detail: 'Half of the chip height' } },
    { expression: 'r / 2', unresolved: { reason: 'size', detail: 'Half of the pill height' } },
    { expression: 'r / 2', unresolved: { reason: 'size' } },
  ]);
  const [entry] = def.sections[0].groups![0].entries;
  assert.deepEqual(entry.value.resolution, { status: 'unresolved', reason: 'Half of the pill height; Half of the chip height' });
});

test('NaN and Infinity are "No value found", never a tile', () => {
  const def = tokenScale('radius', [
    { expression: 'cornerRadius: NaN', value: Number.NaN, unit: 'pt' },
    { expression: 'cornerRadius: inf', value: Number.POSITIVE_INFINITY, unit: 'pt' },
    { expression: 'cornerRadius: 4', value: 4, unit: 'pt' },
  ]);
  assert.deepEqual(def.sections.map((s) => s.id), ['values', 'not-fixed']);
  assert.deepEqual(section(def, 'values').entries.map((e) => e.name), ['4pt']);
  const entries = section(def, 'not-fixed').groups![0].entries;
  assert.equal(entries.length, 2);
  for (const entry of entries) assert.deepEqual(entry.value.resolution, { status: 'unresolved', reason: 'No value found' });
});

test('the "no tokens yet" line uses a singular noun per kind and a body that stays true next to "Named in code"', () => {
  const nouns: [TokenDefinition['kind'], string][] = [['radius', 'radius'], ['dimensions', 'dimension'], ['spacing', 'spacing'], ['opacity', 'opacity']];
  for (const [kind, noun] of nouns) {
    const note = noTokensNote(tokenScale(kind as 'radius', [{ expression: 'x', value: 1 }]));
    assert.equal(note?.title, `No ${noun} tokens yet`, kind);
    assert.equal(note?.body, "These are values written in the app's code, not shared tokens.");
  }
  const entry = (kind: string, value: unknown) => ({ id: 'a', name: 'A', kind, value: { provenance: 'inline', resolution: { status: 'resolved', value } } });
  const optedIn = (kind: TokenDefinition['kind'], value: unknown): TokenDefinition =>
    ({ kind, showNoTokensNote: true, sections: [{ id: 's', title: 'S', entries: [entry(kind, value)] }] }) as TokenDefinition;
  assert.equal(noTokensNote(optedIn('colors', { color: '#fff' }))?.title, 'No color tokens yet');
  assert.equal(noTokensNote(optedIn('shadows', { color: '#000', opacity: 0.1, radius: 4, x: 0, y: 1 }))?.title, 'No shadow tokens yet');
});

test('the same number in two sub-scales is two values, one in each scale', () => {
  const def = tokenScale('dimensions', [
    { expression: '.frame(width: 44)', value: 44, unit: 'pt', scale: 'widths', usages: ['A.swift:1'] },
    { expression: '.frame(height: 44)', value: 44, unit: 'pt', scale: 'heights', usages: ['B.swift:2'] },
  ], { scales: [{ id: 'widths', title: 'Widths' }, { id: 'heights', title: 'Heights' }] });
  const widths = def.sections.find((s) => s.title === 'Widths');
  const heights = def.sections.find((s) => s.title === 'Heights');
  assert.deepEqual(widths?.entries.map((e) => [e.name, e.usages]), [['44pt', ['A.swift:1']]]);
  assert.deepEqual(heights?.entries.map((e) => [e.name, e.usages]), [['44pt', ['B.swift:2']]]);
  assert.deepEqual(validateTokenDefinition(def), []);
});
