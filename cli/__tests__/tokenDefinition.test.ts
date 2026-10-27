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
      { id: 'palette', title: 'Palette', desc: 'Real colors.', wide: false, entryIds: ['brand', 'accent'], entriesOpaque: false },
      { id: 'semantic', title: 'Semantic', desc: undefined, wide: true, entryIds: [], entriesOpaque: false },
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
  assert.deepEqual(def?.sections[0], { id: 'scale', title: 'Scale', desc: undefined, wide: false, entryIds: [], entriesOpaque: false });
});
