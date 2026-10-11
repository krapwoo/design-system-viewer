import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readStaticPages } from '../staticPage.ts';

function writePage(contents: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-staticpage-'));
  const file = path.join(dir, 'Widget.catalog.tsx');
  writeFileSync(file, contents);
  return file;
}

test('reads a literal page with no comparison/variants/states', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget',
      group: 'Components',
      specimenSize: 'compact',
      description: 'A widget.',
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.equal(page.component, 'Widget');
  assert.equal(page.group, 'Components');
  assert.equal(page.specimenSize, 'compact');
  assert.equal(page.comparison, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('reads an unbound grid() call with literal row/column arrays', () => {
  const file = writePage(`
    import { defineCatalogPage, grid } from '@krapwoo/ds-viewer';
    const COMPARISON = grid('Variant', 'State',
      [{ key: 'primary', label: 'Primary' }, { key: 'ghost', label: 'Ghost' }],
      [{ key: 'default', label: 'Default' }],
      (row, column) => null,
    );
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x', comparison: COMPARISON });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  // Not `assert.deepEqual(page.comparison?.rows, { prop: undefined, items: [...] })` — `rows` here
  // has no `prop` key at all (an unbound axis), and `node:assert/strict`'s `deepEqual` compares own
  // key *sets*, so `{ items }` and `{ prop: undefined, items }` are never equal under it even
  // though `JSON.stringify` (what an earlier draft's spike used to "pass" this) drops `undefined`
  // values and can't tell the difference. Assert each field separately instead.
  assert.equal(page.comparison?.rows.prop, undefined);
  assert.deepEqual(page.comparison?.rows.items, [{ key: 'primary', label: 'Primary' }, { key: 'ghost', label: 'Ghost' }]);
  assert.equal(page.comparison?.columns.prop, undefined);
  assert.deepEqual(page.comparison?.columns.items, [{ key: 'default', label: 'Default' }]);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('reads a grid() call with a bound row axis', () => {
  const file = writePage(`
    import { defineCatalogPage, grid } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      comparison: grid('Variant', 'State',
        { prop: 'variant', items: [{ key: 'primary', label: 'Primary' }] },
        [{ key: 'default', label: 'Default' }],
        (row, column) => null,
        'compact',
      ),
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.comparison?.rows.prop, 'variant');
  assert.equal(page.comparison?.size, 'compact');
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('reads a comparison written directly as an object literal, with no grid() call', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      comparison: {
        rowLabel: 'Variant', columnLabel: 'State',
        rows: { prop: 'variant', items: [{ key: 'primary', label: 'Primary' }] },
        columns: [{ key: 'default', label: 'Default' }],
        cells: [],
      },
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.comparison?.rowLabel, 'Variant');
  assert.equal(page.comparison?.rows.prop, 'variant');
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('a row axis built by .map() is not literal: checkable is false and comparison is absent', () => {
  const file = writePage(`
    import { defineCatalogPage, grid } from '@krapwoo/ds-viewer';
    const TONES = [{ key: 'primary', label: 'Primary' }];
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      comparison: grid('Variant', 'State', TONES.map(({ key, label }) => ({ key, label })), [{ key: 'default', label: 'Default' }], (row, column) => null),
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, false);
  assert.equal(page.comparison, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('a row axis given as a same-file top-level const reference resolves through it', () => {
  const file = writePage(`
    import { defineCatalogPage, grid } from '@krapwoo/ds-viewer';
    const ROWS = [{ key: 'primary', label: 'Primary' }];
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      comparison: grid('Variant', 'State', ROWS, [{ key: 'default', label: 'Default' }], (row, column) => null),
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.deepEqual(page.comparison?.rows.items, [{ key: 'primary', label: 'Primary' }]);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('reads variants/states list items, including a props tag and maxColumns, and ignores each item\'s node', () => {
  const file = writePage(`
    import React from 'react';
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      variants: { maxColumns: 3, items: [{ key: 'primary', name: 'Primary', props: { variant: 'primary' }, node: <Widget variant="primary" /> }] },
      states: { maxColumns: 2, items: [{ key: 'disabled', name: 'Disabled', group: 'primary', node: <Widget disabled /> }] },
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  // Same reasoning as above: `readListItems` always sets both `group` and `props` on every item
  // (one of them `undefined` whenever the source doesn't tag it), so a whole-object `deepEqual`
  // against a literal that only names the keys actually present would never match. Assert fields.
  assert.equal(page.variantsItems?.[0].key, 'primary');
  assert.equal(page.variantsItems?.[0].name, 'Primary');
  assert.deepEqual(page.variantsItems?.[0].props, { variant: 'primary' });
  assert.equal(page.variantsMaxColumns, 3);
  assert.equal(page.statesItems?.[0].key, 'disabled');
  assert.equal(page.statesItems?.[0].name, 'Disabled');
  assert.equal(page.statesItems?.[0].group, 'primary');
  assert.equal(page.statesMaxColumns, 2);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('reads each list item\'s own fill, surface, and align override, same per-item fields the viewer renders with', () => {
  const file = writePage(`
    import React from 'react';
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      variants: { items: [{ key: 'full', name: 'Full', fill: true, surface: 'white', align: 'start', node: <Widget /> }] },
      states: { items: [{ key: 'plain', name: 'Plain', node: <Widget /> }] },
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.equal(page.variantsItems?.[0].fill, true);
  assert.equal(page.variantsItems?.[0].surface, 'white');
  assert.equal(page.variantsItems?.[0].align, 'start');
  // Neither is authored on the plain item — left unset, not defaulted to a guessed value.
  assert.equal(page.statesItems?.[0].fill, undefined);
  assert.equal(page.statesItems?.[0].surface, undefined);
  assert.equal(page.statesItems?.[0].align, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

// Regression: `readListItems` previously read `fill` as `resolve(...).kind === TrueKeyword`, so ANY
// present non-literal expression (a variable, a computed value) — not just a literal `false` — read
// as `false`, contrary to this file's own documented policy that a non-literal value stays unset.
// Only a known `true`/`false` literal may ever populate `fill`; anything else stays `undefined`.
test('a non-literal fill expression stays unset, not misread as false; literal true/false are both read correctly', () => {
  const file = writePage(`
    import React from 'react';
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    const computedFill = Math.random() > 0.5;
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      variants: { items: [
        { key: 'literal-true', name: 'Literal true', fill: true, node: <Widget /> },
        { key: 'literal-false', name: 'Literal false', fill: false, node: <Widget /> },
        { key: 'non-literal', name: 'Non-literal', fill: computedFill, node: <Widget /> },
      ] },
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.equal(page.variantsItems?.[0].fill, true);
  assert.equal(page.variantsItems?.[1].fill, false);
  assert.equal(page.variantsItems?.[2].fill, undefined, 'a non-literal fill expression must stay unset, never defaulted to false');
  rmSync(path.dirname(file), { recursive: true, force: true });
});

// Static grid cells (design's required omitted contract): a directly-authored object-literal
// `comparison.cells` array has its per-cell literal `surface`/`align`/`fill` preserved — a grid
// built through the starter kit's `grid()` helper (whose `cell` argument is a callback, never
// evaluated) must stay unrepresented, never guessed at or built by a second evaluator.
test('reads a direct object-literal comparison\'s per-cell surface/align/fill overrides; a grid() call\'s cells stay unrepresented', () => {
  const literalFile = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      comparison: {
        rowLabel: 'Variant', columnLabel: 'State',
        rows: [{ key: 'primary', label: 'Primary' }],
        columns: [{ key: 'default', label: 'Default' }, { key: 'disabled', label: 'Disabled' }],
        cells: [
          { rowKey: 'primary', columnKey: 'default', surface: 'white', align: 'start', fill: true, node: null },
          { rowKey: 'primary', columnKey: 'disabled', unavailableReason: 'n/a' },
        ],
      },
    });
  `);
  const [literalPage] = readStaticPages([literalFile]);
  assert.equal(literalPage.checkable, true);
  assert.deepEqual(literalPage.comparison?.cells, [
    { rowKey: 'primary', columnKey: 'default', surface: 'white', align: 'start', fill: true },
    { rowKey: 'primary', columnKey: 'disabled', surface: undefined, align: undefined, fill: undefined },
  ]);
  rmSync(path.dirname(literalFile), { recursive: true, force: true });

  const gridCallFile = writePage(`
    import { defineCatalogPage, grid } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      comparison: grid('Variant', 'State', [{ key: 'primary', label: 'Primary' }], [{ key: 'default', label: 'Default' }], (row, column) => null),
    });
  `);
  const [gridPage] = readStaticPages([gridCallFile]);
  assert.equal(gridPage.checkable, true);
  assert.equal(gridPage.comparison?.cells, undefined, 'a grid() call\'s cells come from an unevaluated cell() callback and must stay unrepresented, not built by a second evaluator');
  rmSync(path.dirname(gridCallFile), { recursive: true, force: true });
});

test('propNotes keys are read; a non-literal propNotes value makes the page not checkable', () => {
  const literalFile = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x', propNotes: { variant: 'See the design.' } });
  `);
  assert.deepEqual(readStaticPages([literalFile])[0].propNoteKeys, ['variant']);
  rmSync(path.dirname(literalFile), { recursive: true, force: true });

  const nonLiteralFile = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    function notes() { return { variant: 'See the design.' }; }
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x', propNotes: notes() });
  `);
  const [page] = readStaticPages([nonLiteralFile]);
  assert.equal(page.checkable, false);
  assert.equal(page.propNoteKeys, undefined);
  rmSync(path.dirname(nonLiteralFile), { recursive: true, force: true });
});

test('a page\'s own local, non-imported "grid" function is not recognized: comparison is absent', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    function grid(rowLabel, columnLabel, rows, columns, cell, size) {
      return { rowLabel, columnLabel, rows, columns, cells: [], size };
    }
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      comparison: grid('Variant', 'State', [{ key: 'primary', label: 'Primary' }], [{ key: 'default', label: 'Default' }], (row, column) => null),
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, false);
  assert.equal(page.comparison, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('a syntax error is reported as a parse error, distinct from "not checkable"', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, false);
  assert.ok(page.parseError && page.parseError.length > 0);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('a page whose default export is not a defineCatalogPage() call is not checkable, with no parse error', () => {
  const file = writePage(`
    export default { component: 'Widget', group: 'Components', description: 'x' };
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, false);
  assert.equal(page.parseError, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('an aliased import of defineCatalogPage/grid is still recognized by its local name', () => {
  const file = writePage(`
    import { defineCatalogPage as definePage, grid as buildGrid } from '@krapwoo/ds-viewer';
    export default definePage({
      component: 'Widget', group: 'Components', description: 'x',
      comparison: buildGrid('Variant', 'State', { prop: 'variant', items: [{ key: 'primary', label: 'Primary' }] }, [{ key: 'default', label: 'Default' }], (row, column) => null),
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.equal(page.comparison?.rows.prop, 'variant');
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('tokenGallery: true is read as a literal boolean', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ group: 'Tokens', description: 'x', tokenGallery: true, render: () => null });
  `);
  assert.equal(readStaticPages([file])[0].tokenGallery, true);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('hasWhenToUse/hasA11y/hasRender are presence checks, true when the property exists at all', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    function describe() { return 'computed guidance'; }
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x', whenToUse: describe() });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.hasWhenToUse, true);
  assert.equal(page.hasA11y, false);
  assert.equal(page.hasRender, false);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('hidesAccessibility is true only when hide.accessibility is literally true', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x', hide: { accessibility: true } });
  `);
  assert.equal(readStaticPages([file])[0].hidesAccessibility, true);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('previewWidths, fullWidthLabel, hide.variants/hide.states, and each slot\'s itemsFill are read as literals (Task 6\'s explain needs every one to match the viewer)', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      previewWidths: [402, 320],
      fullWidthLabel: 'Preview',
      hide: { states: true },
      variants: { itemsFill: true, items: [{ key: 'a', name: 'A', node: null }] },
      render: () => null,
    });
  `);
  const [page] = readStaticPages([file]);
  assert.deepEqual(page.previewWidths, [402, 320]);
  assert.equal(page.fullWidthLabel, 'Preview');
  assert.equal(page.hideVariants, false);
  assert.equal(page.hideStates, true);
  assert.equal(page.variantsItemsFill, true);
  rmSync(path.dirname(file), { recursive: true, force: true });

  const fullWidthFile = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ group: 'Tokens', description: 'x', tokenGallery: true, previewWidths: 'full', render: () => null });
  `);
  assert.equal(readStaticPages([fullWidthFile])[0].previewWidths, 'full');
  rmSync(path.dirname(fullWidthFile), { recursive: true, force: true });
});

// Minor finding (Fable's review): `readStaticPages` only guards the file *read* — an unexpected
// throw from deeper in one file's own AST walk (not just a missing/unreadable file) must not abort
// every other file in the same `doctor`/`explain` run. A long chain of same-file `const` aliases
// (each resolved one recursive `resolve()` call at a time, cli/staticPage.ts) is a real, reachable
// way to hit exactly that: valid TypeScript, but deep enough to overflow the call stack.
function longConstChainPage(length: number): string {
  const lines = ["import { defineCatalogPage } from '@krapwoo/ds-viewer';", "const c0 = 'Components';"];
  for (let i = 1; i <= length; i++) lines.push(`const c${i} = c${i - 1};`);
  lines.push(`export default defineCatalogPage({ component: 'Widget', group: c${length}, description: 'x' });`);
  return lines.join('\n');
}

test('a file whose own AST walk throws (not just an unreadable file) still yields one page-parse-error-shaped result, and sibling files are still read', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-staticpage-'));
  const crashFile = path.join(dir, 'Crash.catalog.tsx');
  writeFileSync(crashFile, longConstChainPage(50000));
  const goodFile = path.join(dir, 'Good.catalog.tsx');
  writeFileSync(goodFile, "import { defineCatalogPage } from '@krapwoo/ds-viewer';\nexport default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x' });\n");

  const [crashPage, goodPage] = readStaticPages([crashFile, goodFile]);
  assert.equal(crashPage.checkable, false);
  assert.equal(typeof crashPage.parseError, 'string');
  assert.equal(goodPage.checkable, true);
  assert.equal(goodPage.group, 'Components');
  rmSync(dir, { recursive: true, force: true });
});

// Guided intelligence design §4 / plan Task 3 — reading a page's own authored `composedOf` names
// (never role/relationship, which `doctor` never needs for the missing-composition comparison).
test('reads a literal composedOf array\'s component names', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Toast', group: 'Components', description: 'x',
      composedOf: [{ component: 'Button', role: 'Action', relationship: 'built-in' }, { component: 'Icon', role: 'Status', relationship: 'built-in' }],
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.hasComposedOf, true);
  assert.deepEqual(page.composedOf, [{ component: 'Button' }, { component: 'Icon' }]);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('composedOf is undefined with no "not checkable" penalty when the page has none at all', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x' });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.equal(page.hasComposedOf, false);
  assert.equal(page.composedOf, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

// Guided intelligence design §3 / plan Task 3 — the explicit interactive-vs-intentional-static
// author declaration, with its bounded reason, carried through for `cli/doctor.ts` to honor.
test('reads a literal intentionalStaticPreview reason', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'PillRow', group: 'Components', description: 'x',
      intentionalStaticPreview: { reason: 'Already demonstrated by SegmentedToggle.' },
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.intentionalStaticPreviewReason, 'Already demonstrated by SegmentedToggle.');
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('intentionalStaticPreviewReason is undefined with no declaration at all', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x' });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.intentionalStaticPreviewReason, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

// Guided intelligence design §3 / plan Task 3 — generic reading of a variants/states item's own
// `node:` JSX, used only by `cli/doctor.ts`'s interactive-preview advisory. Never evaluated as a
// value (design's own global constraint) — only its literal AST shape is read.
test('reads a direct JSX item\'s own attribute values: literal, no-op (empty arrow) callback, and an omitted callback', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    import { PillRow } from './PillRow';
    export default defineCatalogPage({
      component: 'PillRow', group: 'Components', description: 'x',
      variants: { items: [
        { key: 'a', name: 'A', node: <PillRow selected="one" onSelectedChange={() => {}} /> },
        { key: 'b', name: 'B', node: <PillRow selected="two" /> },
      ] },
    });
  `);
  const [page] = readStaticPages([file]);
  const [a, b] = page.variantsItems!;
  assert.equal(a.nodeDirectComponent, 'PillRow');
  assert.deepEqual(a.nodeAttributes?.selected, { kind: 'literal', value: 'one' });
  assert.deepEqual(a.nodeAttributes?.onSelectedChange, { kind: 'no-op-callback' });
  assert.equal(b.nodeDirectComponent, 'PillRow');
  assert.deepEqual(b.nodeAttributes?.selected, { kind: 'literal', value: 'two' });
  assert.equal(b.nodeAttributes?.onSelectedChange, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('reads an unknown (non-literal, non-empty-arrow) callback as "unknown", never claimed inert', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    import { PillRow } from './PillRow';
    function handleChange(next) { console.log(next); }
    export default defineCatalogPage({
      component: 'PillRow', group: 'Components', description: 'x',
      variants: { items: [{ key: 'a', name: 'A', node: <PillRow selected="one" onSelectedChange={handleChange} /> }] },
    });
  `);
  const [page] = readStaticPages([file]);
  assert.deepEqual(page.variantsItems![0].nodeAttributes?.onSelectedChange, { kind: 'unknown' });
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('recognizes a genuine same-file stateful wrapper (useState) as nodeStatefulWrapper, never an inert example', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    import { useState } from 'react';
    import { PillRow } from './PillRow';
    function PillRowDemo() {
      const [selected, setSelected] = useState('one');
      return <PillRow selected={selected} onSelectedChange={setSelected} />;
    }
    export default defineCatalogPage({
      component: 'PillRow', group: 'Components', description: 'x',
      variants: { items: [{ key: 'a', name: 'A', node: <PillRowDemo /> }] },
    });
  `);
  const [page] = readStaticPages([file]);
  const item = page.variantsItems![0];
  assert.equal(item.nodeStatefulWrapper, true);
  assert.equal(item.nodeDirectComponent, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('a same-file wrapper with no useState is left uncertain, not a stateful wrapper and not a direct component', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    import { PillRow } from './PillRow';
    function PillRowStatic() {
      return <PillRow selected="one" />;
    }
    export default defineCatalogPage({
      component: 'PillRow', group: 'Components', description: 'x',
      variants: { items: [{ key: 'a', name: 'A', node: <PillRowStatic /> }] },
    });
  `);
  const [page] = readStaticPages([file]);
  const item = page.variantsItems![0];
  assert.equal(item.nodeStatefulWrapper, undefined);
  assert.equal(item.nodeDirectComponent, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('a same-file wrapper calling an unrelated object\'s useState method is left uncertain, never nodeStatefulWrapper', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    import { PillRow } from './PillRow';
    function PillRowDemo() {
      const [selected, setSelected] = machine.useState('one');
      return <PillRow selected={selected} onSelectedChange={setSelected} />;
    }
    export default defineCatalogPage({
      component: 'PillRow', group: 'Components', description: 'x',
      variants: { items: [{ key: 'a', name: 'A', node: <PillRowDemo /> }] },
    });
  `);
  const [page] = readStaticPages([file]);
  const item = page.variantsItems![0];
  assert.equal(item.nodeStatefulWrapper, undefined);
  assert.equal(item.nodeDirectComponent, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('a computed/dynamic node leaves every node-example field unset — never claimed inert or stateful', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    import { PillRow } from './PillRow';
    const node = Math.random() > 0.5 ? <PillRow selected="one" /> : null;
    export default defineCatalogPage({
      component: 'PillRow', group: 'Components', description: 'x',
      variants: { items: [{ key: 'a', name: 'A', node }] },
    });
  `);
  const [page] = readStaticPages([file]);
  const item = page.variantsItems![0];
  assert.equal(item.nodeDirectComponent, undefined);
  assert.equal(item.nodeAttributes, undefined);
  assert.equal(item.nodeStatefulWrapper, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('composedOf stays undefined (but hasComposedOf true, and the page stays checkable) when it is authored as a non-literal expression', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    const COMPOSED_OF = [{ component: 'Button', role: 'Action', relationship: 'built-in' as const }];
    export default defineCatalogPage({ component: 'Toast', group: 'Components', description: 'x', composedOf: COMPOSED_OF.map((c) => c) });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.equal(page.hasComposedOf, true);
  assert.equal(page.composedOf, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});
