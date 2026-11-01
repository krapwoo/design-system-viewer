import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ts from 'typescript';
import { readStaticTokenDefinition } from '../tokenDefinition.ts';

function parseProperty(expression: string): { node: ts.Expression; consts: Map<string, ts.Expression> } {
  const source = ts.createSourceFile('fixture.ts', `const __x = (${expression});`, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const statement = source.statements[0] as ts.VariableStatement;
  const initializer = statement.declarationList.declarations[0].initializer!;
  // Unwrap the parenthesized expression this fixture wraps every literal in.
  const node = ts.isParenthesizedExpression(initializer) ? initializer.expression : initializer;
  return { node, consts: new Map() };
}

test('readStaticTokenDefinition reads kind, section id/title/desc/wide and entry ids', () => {
  const { node, consts } = parseProperty(`{
    kind: 'colors',
    sections: [
      { id: 'palette', title: 'Palette', desc: 'Real colors.', entries: [{ id: 'brand' }, { id: 'accent' }] },
      { id: 'semantic', title: 'Semantic', wide: true, entries: [] },
    ],
  }`);
  const def = readStaticTokenDefinition(node, consts);
  assert.deepEqual(def, {
    kind: 'colors',
    sections: [
      { id: 'palette', title: 'Palette', desc: 'Real colors.', wide: false, entryIds: ['brand', 'accent'], entriesOpaque: false, groups: [], groupsOpaque: false },
      { id: 'semantic', title: 'Semantic', desc: undefined, wide: true, entryIds: [], entriesOpaque: false, groups: [], groupsOpaque: false },
    ],
  });
});

test('readStaticTokenDefinition keeps duplicate entry ids, never deduplicating them', () => {
  const { node, consts } = parseProperty(`{
    kind: 'spacing',
    sections: [{ id: 'scale', title: 'Scale', entries: [{ id: 'sm' }, { id: 'sm' }] }],
  }`);
  const def = readStaticTokenDefinition(node, consts);
  assert.deepEqual(def?.sections[0].entryIds, ['sm', 'sm']);
});

test('readStaticTokenDefinition returns undefined for a non-literal kind', () => {
  const { node, consts } = parseProperty(`{ kind: ['colors'][0], sections: [] }`);
  assert.equal(readStaticTokenDefinition(node, consts), undefined);
});

test('readStaticTokenDefinition returns undefined when sections is not a literal array', () => {
  const { node, consts } = parseProperty(`{ kind: 'colors', sections: [].map((x) => x) }`);
  assert.equal(readStaticTokenDefinition(node, consts), undefined);
});

test('readStaticTokenDefinition returns undefined for a section missing a literal id or title', () => {
  const { node, consts } = parseProperty(`{ kind: 'colors', sections: [{ title: 'No id', entries: [] }] }`);
  assert.equal(readStaticTokenDefinition(node, consts), undefined);
});

test('readStaticTokenDefinition reads an unknown (non-approved) kind string as-is, leaving validity to the caller', () => {
  const { node, consts } = parseProperty(`{ kind: 'colour', sections: [] }`);
  const def = readStaticTokenDefinition(node, consts);
  assert.equal(def?.kind, 'colour');
});

test('readStaticTokenDefinition omits an entry with a non-literal id rather than rejecting the whole section, and marks the section entriesOpaque', () => {
  const { node, consts } = parseProperty(`{
    kind: 'colors',
    sections: [{ id: 'palette', title: 'Palette', entries: [{ id: ('computed-' + 1) }, { id: 'ok' }] }],
  }`);
  const def = readStaticTokenDefinition(node, consts);
  assert.deepEqual(def?.sections[0].entryIds, ['ok']);
  assert.equal(def?.sections[0].entriesOpaque, true, 'a non-literal entry id makes entryIds incomplete for this section');
});

test('readStaticTokenDefinition tolerates a definition with no entries field at all on a section, and does not mark it opaque', () => {
  const { node, consts } = parseProperty(`{ kind: 'motion', sections: [{ id: 'durations', title: 'Durations' }] }`);
  const def = readStaticTokenDefinition(node, consts);
  assert.deepEqual(def?.sections[0].entryIds, []);
  assert.equal(def?.sections[0].entriesOpaque, false, 'an omitted entries field is not the same as an unreadable one');
});

test('readStaticTokenDefinition marks a section entriesOpaque when entries itself is not a literal array', () => {
  const { node, consts } = parseProperty(`{
    kind: 'colors',
    sections: [{ id: 'palette', title: 'Palette', entries: IMPORTED_ENTRIES }],
  }`);
  const def = readStaticTokenDefinition(node, consts);
  assert.deepEqual(def?.sections[0].entryIds, []);
  assert.equal(def?.sections[0].entriesOpaque, true);
});

test('readStaticTokenDefinition marks a section entriesOpaque when one element is not a literal object, but still reads the literal ones', () => {
  const { node, consts } = parseProperty(`{
    kind: 'colors',
    sections: [{ id: 'palette', title: 'Palette', entries: [{ id: 'brand' }, ...SPREAD_ENTRIES] }],
  }`);
  const def = readStaticTokenDefinition(node, consts);
  assert.deepEqual(def?.sections[0].entryIds, ['brand']);
  assert.equal(def?.sections[0].entriesOpaque, true);
});

test('readStaticTokenDefinition leaves a fully literal section with no entries at all as not opaque', () => {
  const { node, consts } = parseProperty(`{ kind: 'spacing', sections: [{ id: 'scale', title: 'Scale', entries: [] }] }`);
  const def = readStaticTokenDefinition(node, consts);
  assert.deepEqual(def?.sections[0], { id: 'scale', title: 'Scale', desc: undefined, wide: false, entryIds: [], entriesOpaque: false, groups: [], groupsOpaque: false });
});

// #64 B1: groups, read the same literal-only way as sections/entries.
test('readStaticTokenDefinition reads a section\'s own groups and their entry ids', () => {
  const { node, consts } = parseProperty(`{
    kind: 'colors',
    sections: [{
      id: 'palette', title: 'Palette',
      entries: [{ id: 'brand' }],
      groups: [{ id: 'extra', title: 'Extra', entries: [{ id: 'accent' }, { id: 'accent2' }] }],
    }],
  }`);
  const def = readStaticTokenDefinition(node, consts);
  assert.deepEqual(def?.sections[0].groups, [{ id: 'extra', title: 'Extra', entryIds: ['accent', 'accent2'], entriesOpaque: false }]);
  assert.equal(def?.sections[0].groupsOpaque, false);
});

test('readStaticTokenDefinition marks groupsOpaque when a group element is not a literal object, and omits a group missing a literal id/title', () => {
  const { node, consts } = parseProperty(`{
    kind: 'colors',
    sections: [{ id: 'palette', title: 'Palette', entries: [], groups: [{ id: 'ok', title: 'Ok', entries: [] }, ...SPREAD_GROUPS] }],
  }`);
  const def = readStaticTokenDefinition(node, consts);
  assert.deepEqual(def?.sections[0].groups, [{ id: 'ok', title: 'Ok', entryIds: [], entriesOpaque: false }]);
  assert.equal(def?.sections[0].groupsOpaque, true);
});

test('readStaticTokenDefinition marks a group\'s own entriesOpaque independently of the section\'s', () => {
  const { node, consts } = parseProperty(`{
    kind: 'colors',
    sections: [{ id: 'palette', title: 'Palette', entries: [{ id: 'brand' }], groups: [{ id: 'extra', title: 'Extra', entries: IMPORTED_ENTRIES }] }],
  }`);
  const def = readStaticTokenDefinition(node, consts);
  assert.equal(def?.sections[0].entriesOpaque, false, 'the section\'s own entries are still fully literal');
  assert.equal(def?.sections[0].groups[0].entriesOpaque, true);
});

test('readStaticTokenDefinition leaves a section with no groups field at all as groups: [], groupsOpaque: false', () => {
  const { node, consts } = parseProperty(`{ kind: 'colors', sections: [{ id: 'palette', title: 'Palette', entries: [] }] }`);
  const def = readStaticTokenDefinition(node, consts);
  assert.deepEqual(def?.sections[0].groups, []);
  assert.equal(def?.sections[0].groupsOpaque, false);
});

// #64 B5: a section's own literal aliases.
test('readStaticTokenDefinition reads a section\'s own literal aliases', () => {
  const { node, consts } = parseProperty(`{
    kind: 'colors',
    sections: [{ id: 'palette', title: 'Palette', entries: [], aliases: ['OldPalette', 'LegacyPalette'] }],
  }`);
  const def = readStaticTokenDefinition(node, consts);
  assert.deepEqual(def?.sections[0].aliases, ['OldPalette', 'LegacyPalette']);
});

test('readStaticTokenDefinition omits aliases when absent, and when not a fully literal string array', () => {
  const { node, consts } = parseProperty(`{ kind: 'colors', sections: [{ id: 'palette', title: 'Palette', entries: [] }] }`);
  const def = readStaticTokenDefinition(node, consts);
  assert.equal(def?.sections[0].aliases, undefined);

  const { node: node2, consts: consts2 } = parseProperty(`{ kind: 'colors', sections: [{ id: 'palette', title: 'Palette', entries: [], aliases: COMPUTED_ALIASES }] }`);
  const def2 = readStaticTokenDefinition(node2, consts2);
  assert.equal(def2?.sections[0].aliases, undefined);
});

test('readStaticTokenDefinition reads a tokenScale call\'s literal kind and marks its sections as computed', () => {
  const { node, consts } = parseProperty(`tokenScale('radius', FINDINGS, { unit: 'pt' })`);
  assert.deepEqual(readStaticTokenDefinition(node, consts), { kind: 'radius', sections: [], fromTokenScale: true });
});

test('readStaticTokenDefinition follows a same-file const to a tokenScale call, and gives up on a non-literal kind', () => {
  const source = ts.createSourceFile('fixture.ts', `const RADIUS = tokenScale('radius', []); const ref = RADIUS;`, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const consts = new Map<string, ts.Expression>();
  for (const statement of source.statements) {
    for (const declaration of (statement as ts.VariableStatement).declarationList.declarations) consts.set((declaration.name as ts.Identifier).text, declaration.initializer!);
  }
  assert.equal(readStaticTokenDefinition(consts.get('ref')!, consts)?.kind, 'radius');
  const dynamic = parseProperty(`tokenScale(someKind, [])`);
  assert.equal(readStaticTokenDefinition(dynamic.node, dynamic.consts), undefined);
});

function parseWithConsts(source: string): Map<string, ts.Expression> {
  const file = ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const consts = new Map<string, ts.Expression>();
  for (const statement of file.statements) {
    for (const declaration of (statement as ts.VariableStatement).declarationList.declarations) consts.set((declaration.name as ts.Identifier).text, declaration.initializer!);
  }
  return consts;
}

test('readStaticTokenDefinition takes kind from a spread tokenScale call when the literal has none of its own', () => {
  const spread = parseProperty(`{ ...tokenScale('radius', FINDINGS), sections: [{ id: 'mine', title: 'Mine', entries: [{ id: 'a' }] }] }`);
  const def = readStaticTokenDefinition(spread.node, spread.consts);
  assert.equal(def?.kind, 'radius');
  assert.equal(def?.fromTokenScale, true);
  assert.deepEqual(def?.sections.map((s) => s.id), ['mine']);
  const alone = parseProperty(`{ ...tokenScale('spacing', FINDINGS), showNoTokensNote: false }`);
  assert.deepEqual(readStaticTokenDefinition(alone.node, alone.consts), { kind: 'spacing', sections: [], fromTokenScale: true });
});

test('readStaticTokenDefinition reads { ...scale, sections: [...scale.sections, mine] } through a same-file const', () => {
  const consts = parseWithConsts(`const scale = tokenScale('dimensions', F); const def = { ...scale, sections: [...scale.sections, { id: 'mine', title: 'Mine', entries: [] }] };`);
  const def = readStaticTokenDefinition(consts.get('def')!, consts);
  assert.equal(def?.kind, 'dimensions');
  assert.equal(def?.fromTokenScale, true);
  assert.deepEqual(def?.sections.map((s) => s.id), ['mine']);
});

test('readStaticTokenDefinition still gives up on an own non-literal kind, and on a spread that is not a tokenScale call', () => {
  const own = parseProperty(`{ ...tokenScale('radius', F), kind: someKind, sections: [] }`);
  assert.equal(readStaticTokenDefinition(own.node, own.consts), undefined, 'an own kind that is not a literal is not replaced by the spread');
  const other = parseProperty(`{ ...somethingElse(), sections: [] }`);
  assert.equal(readStaticTokenDefinition(other.node, other.consts), undefined);
  const unknownSpread = parseProperty(`{ kind: 'radius', sections: [...OTHER.sections] }`);
  assert.equal(readStaticTokenDefinition(unknownSpread.node, unknownSpread.consts), undefined, 'a spread of anything but a tokenScale call is still unreadable');
});
