import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
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
// plus (#66) a literal `relationship`; `role` is never read.
test('reads a literal composedOf array\'s component names and literal relationships', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Toast', group: 'Components', description: 'x',
      composedOf: [{ component: 'Button', role: 'Action', relationship: 'built-in' }, { component: 'Icon', role: 'Status', relationship: 'built-in' }],
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.hasComposedOf, true);
  assert.deepEqual(page.composedOf, [{ component: 'Button', relationship: 'built-in' }, { component: 'Icon', relationship: 'built-in' }]);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('a non-literal relationship is left unset on its entry and the page stays checkable', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    import { REL } from './rel';
    export default defineCatalogPage({
      component: 'Toast', group: 'Components', description: 'x',
      composedOf: [{ component: 'Button', relationship: REL }, { component: 'Icon', relationship: 'slot' }, { component: 'Badge' }],
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.deepEqual(page.composedOf, [{ component: 'Button' }, { component: 'Icon', relationship: 'slot' }, { component: 'Badge' }]);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('reads a literal standalone reason as authored, including a blank one', () => {
  const read = (value: string) => {
    const file = writePage(`
      import { defineCatalogPage } from '@krapwoo/ds-viewer';
      export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x', standalone: ${value} });
    `);
    const [page] = readStaticPages([file]);
    rmSync(path.dirname(file), { recursive: true, force: true });
    return page;
  };
  assert.equal(read("'Draws its own counts.'").standalone, 'Draws its own counts.');
  assert.equal(read("'  '").standalone, '  ');
  const nonLiteral = read('REASON');
  assert.equal(nonLiteral.standalone, undefined);
  assert.equal(nonLiteral.checkable, true);
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

test('viewerImports lists the imported names from @krapwoo/ds-viewer, even when the page is not literal-checkable', () => {
  const literal = writePage(`
    import { defineCatalogPage, PhoneFrame as Frame } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x' });
  `);
  assert.deepEqual(readStaticPages([literal])[0].viewerImports, ['defineCatalogPage', 'PhoneFrame']);
  const notLiteral = writePage(`
    import { defineCatalogPage, OverlayDemo } from '@krapwoo/ds-viewer';
    const make = () => ({ group: 'Components', description: 'x' });
    export default defineCatalogPage(make());
  `);
  const page = readStaticPages([notLiteral])[0];
  assert.equal(page.checkable, false);
  assert.deepEqual(page.viewerImports, ['defineCatalogPage', 'OverlayDemo']);
  rmSync(path.dirname(literal), { recursive: true, force: true });
  rmSync(path.dirname(notLiteral), { recursive: true, force: true });
});

test("previewLayout is read when literal, and a non-literal one makes the page not checkable", () => {
  const table = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'A widget.',
      previewWidths: [402, 320], previewLayout: 'table', render: () => null,
    });
  `);
  const [page] = readStaticPages([table]);
  assert.equal(page.checkable, true);
  assert.equal(page.previewLayout, 'table');
  rmSync(path.dirname(table), { recursive: true, force: true });

  // Absent is fine: the viewer's own default is the frames card.
  const absent = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'A widget.', render: () => null,
    });
  `);
  const [plain] = readStaticPages([absent]);
  assert.equal(plain.checkable, true);
  assert.equal(plain.previewLayout, undefined);
  rmSync(path.dirname(absent), { recursive: true, force: true });

  // Unreadable is not: the two cards have different chrome, so guessing would make `explain`
  // report a different minimum than the viewer uses — the same rule `maxColumns` follows.
  const computed = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    const pick = () => 'table' as const;
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'A widget.',
      previewLayout: pick(), render: () => null,
    });
  `);
  const [opaque] = readStaticPages([computed]);
  assert.equal(opaque.checkable, false);
  assert.equal(opaque.previewLayout, undefined);
  rmSync(path.dirname(computed), { recursive: true, force: true });
});

// #60: `navigation` follows the exact same literal-or-not-checkable contract `previewLayout`
// already does above.
test('navigation is read when literal, and a non-literal or invalid one makes the page not checkable', () => {
  const reference = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'A widget.', navigation: 'reference',
    });
  `);
  const [page] = readStaticPages([reference]);
  assert.equal(page.checkable, true);
  assert.equal(page.navigation, 'reference');
  rmSync(path.dirname(reference), { recursive: true, force: true });

  // Absent is fine: the viewer's own default is the browse layer, unchanged.
  const absent = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'A widget.',
    });
  `);
  const [plain] = readStaticPages([absent]);
  assert.equal(plain.checkable, true);
  assert.equal(plain.navigation, undefined);
  rmSync(path.dirname(absent), { recursive: true, force: true });

  // An invalid string literal (not 'browse'/'reference') is not given the benefit of the doubt —
  // honest and actionable (page-not-checkable) rather than silently accepted or hidden.
  const invalid = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'A widget.', navigation: 'archived',
    });
  `);
  const [badLiteral] = readStaticPages([invalid]);
  assert.equal(badLiteral.checkable, false);
  assert.equal(badLiteral.navigation, undefined);
  rmSync(path.dirname(invalid), { recursive: true, force: true });

  // Unreadable (computed) is not checkable either — the same reasoning previewLayout follows.
  const computed = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    const pick = () => 'reference' as const;
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'A widget.', navigation: pick(),
    });
  `);
  const [opaque] = readStaticPages([computed]);
  assert.equal(opaque.checkable, false);
  assert.equal(opaque.navigation, undefined);
  rmSync(path.dirname(computed), { recursive: true, force: true });
});

// Plan V3: `members`/`whole`/`sections`/`aliases`, read with the same literal-resolution helpers
// as everything else — a non-literal value makes the page not checkable, as today.
test('reads members/whole/sections/aliases literally, flattening every section\'s own member ids', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      id: 'Toast', group: 'Patterns', description: 'A toast.',
      whole: 'Toast',
      aliases: ['OldToast'],
      sections: [
        { label: 'Parts', kind: 'blocks', inWhole: true, members: ['ToastBanner'] },
        { label: 'Related', kind: 'blocks', inWhole: false, members: ['ToastStandalone'] },
      ],
      members: [
        { id: 'Toast', source: 'x.tsx:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'd' },
        {
          id: 'ToastBanner', component: 'Banner', parent: 'Toast', aliases: ['BannerOld'],
          source: 'x.tsx:2', fidelity: 'replicated', relationship: 'Part', description: 'd',
          whenToUse: 'Use it.', a11y: 'Announces.', variants: { items: [] },
        },
        { id: 'ToastStandalone', source: 'x.tsx:3', fidelity: 'documentation-only', relationship: 'Related', description: 'd' },
      ],
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.equal(page.whole, 'Toast');
  assert.deepEqual(page.aliases, ['OldToast']);
  assert.deepEqual(page.sections, [
    { label: 'Parts', kind: 'blocks', members: ['ToastBanner'], inWhole: true },
    { label: 'Related', kind: 'blocks', members: ['ToastStandalone'], inWhole: false },
  ]);
  // The layout fields `explain` and `doctor`'s `comparison-hides-variants` read per member: all unset
  // for a member that authors none of them.
  const noLayout = {
    variantsItems: undefined, variantsItemsFill: undefined, variantsMaxColumns: undefined, variantsAxis: undefined, variantsAxisUnreadable: undefined,
    statesItems: undefined, statesItemsFill: undefined, statesMaxColumns: undefined, statesAxis: undefined, comparison: undefined, previewWidths: undefined, specimenSize: undefined,
  };
  assert.deepEqual(page.members, [
    { id: 'Toast', component: undefined, parent: undefined, aliases: undefined, composedOf: undefined, hasComposedOf: false, hasWhenToUse: false, hasA11y: false, hasExamples: false, anatomy: undefined, anatomyShape: undefined, relationship: 'Whole', fidelity: 'documentation-only', ...noLayout },
    // V2c item 5: `variants: { items: [] }` has no real specimen — `hasExamples` must be false,
    // not just "the variants key is present".
    { id: 'ToastBanner', component: 'Banner', parent: 'Toast', aliases: ['BannerOld'], composedOf: undefined, hasComposedOf: false, hasWhenToUse: true, hasA11y: true, hasExamples: false, anatomy: undefined, anatomyShape: undefined, relationship: 'Part', fidelity: 'replicated', ...noLayout, variantsItems: [] },
    { id: 'ToastStandalone', component: undefined, parent: undefined, aliases: undefined, composedOf: undefined, hasComposedOf: false, hasWhenToUse: false, hasA11y: false, hasExamples: false, anatomy: undefined, anatomyShape: undefined, relationship: 'Related', fidelity: 'documentation-only', ...noLayout },
  ]);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

// V2d item 5: a family member's own `composedOf` is read the same literal-checkable way the
// page-level one already is (component names only — role/relationship are prose `doctor` never
// needs for the unknown-name comparison below).
test('reads a family member\'s own composedOf, the same literal-checkable way as the page-level one', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      id: 'Toast', group: 'Patterns', description: 'A toast.',
      whole: 'Toast',
      sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['ToastBanner'] }],
      members: [
        {
          id: 'Toast', source: 'x.tsx:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'd',
          composedOf: [{ component: 'ToastBanner', role: 'Anatomy', relationship: 'built-in' }],
        },
        { id: 'ToastBanner', component: 'Banner', parent: 'Toast', source: 'x.tsx:2', fidelity: 'replicated', relationship: 'Part', description: 'd' },
      ],
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.deepEqual(page.members?.find((m) => m.id === 'Toast')?.composedOf, [{ component: 'ToastBanner', relationship: 'built-in' }]);
  assert.equal(page.members?.find((m) => m.id === 'ToastBanner')?.composedOf, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

// V2c item 5: a member's `hasExamples` requires a non-empty specimen list — presence of the
// `variants`/`states`/`comparison` key alone must never be enough (it mirrors the page-level rule,
// `pageHasExamples` in cli/doctor.ts, which counts items).
test('a member\'s hasExamples requires a non-empty specimen list; an empty variants.items is not an example', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      id: 'Toast', group: 'Patterns', description: 'A toast.',
      whole: 'Toast',
      sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['ToastBanner'] }],
      members: [
        { id: 'Toast', source: 'x.tsx:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'd' },
        {
          id: 'ToastBanner', component: 'Banner', parent: 'Toast',
          source: 'x.tsx:2', fidelity: 'replicated', relationship: 'Part', description: 'd',
          variants: { items: [] },
        },
      ],
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.equal(page.members?.find((m) => m.id === 'ToastBanner')?.hasExamples, false);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('a member\'s hasExamples is true with a real variants item, a states item, or a comparison', () => {
  const file = writePage(`
    import React from 'react';
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      id: 'Toast', group: 'Patterns', description: 'A toast.',
      whole: 'Toast',
      sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['ToastBanner'] }],
      members: [
        { id: 'Toast', source: 'x.tsx:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'd' },
        {
          id: 'ToastBanner', component: 'Banner', parent: 'Toast',
          source: 'x.tsx:2', fidelity: 'replicated', relationship: 'Part', description: 'd',
          variants: { items: [{ key: 'a', name: 'A', node: <Banner /> }] },
        },
      ],
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.members?.find((m) => m.id === 'ToastBanner')?.hasExamples, true);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

// N1: a member's `variants`/`states` slot must follow the same "never a partial read" contract the
// page level already does — a non-literal slot (e.g. an imported const) must make the whole page
// not checkable, never silently read as "no examples" (which would wrongly fire doctor's
// component-no-examples instead of page-not-checkable).
test('N1: a member whose variants.items is not a literal (e.g. an imported const) makes the whole page not checkable', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    import { SHARED_ITEMS } from './sharedItems';
    export default defineCatalogPage({
      id: 'Toast', group: 'Patterns', description: 'A toast.',
      whole: 'Toast',
      sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['ToastBanner'] }],
      members: [
        { id: 'Toast', source: 'x.tsx:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'd' },
        {
          id: 'ToastBanner', component: 'Banner', parent: 'Toast',
          source: 'x.tsx:2', fidelity: 'replicated', relationship: 'Part', description: 'd',
          variants: { items: SHARED_ITEMS },
        },
      ],
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, false);
  assert.equal(page.members, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('N1: a member whose comparison can\'t be read (not an object literal or grid() call) makes the whole page not checkable', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    function buildComparison() { return { rowLabel: 'R', columnLabel: 'C', rows: [], columns: [], cells: [] }; }
    export default defineCatalogPage({
      id: 'Toast', group: 'Patterns', description: 'A toast.',
      whole: 'Toast',
      sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['ToastBanner'] }],
      members: [
        { id: 'Toast', source: 'x.tsx:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'd' },
        {
          id: 'ToastBanner', component: 'Banner', parent: 'Toast',
          source: 'x.tsx:2', fidelity: 'replicated', relationship: 'Part', description: 'd',
          comparison: buildComparison(),
        },
      ],
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, false);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('a page with no members at all leaves members/whole/sections/aliases unset, and stays checkable', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x' });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.equal(page.members, undefined);
  assert.equal(page.whole, undefined);
  assert.equal(page.sections, undefined);
  assert.equal(page.aliases, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('a non-literal members array makes the page not checkable', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    const buildMembers = () => [{ id: 'X', source: 'x.tsx:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'd' }];
    export default defineCatalogPage({
      id: 'X', group: 'Patterns', description: 'x', whole: 'X',
      sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: [] }],
      members: buildMembers(),
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, false);
  assert.equal(page.members, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('a non-literal sections array makes the page not checkable, even though members/whole are literal', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    const buildSections = () => [{ label: 'Parts', kind: 'blocks' as const, inWhole: true, members: ['X'] }];
    export default defineCatalogPage({
      id: 'X', group: 'Patterns', description: 'x', whole: 'X',
      sections: buildSections(),
      members: [{ id: 'X', source: 'x.tsx:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'd' }],
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, false);
  assert.equal(page.sections, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

// Deprecation (`relatedPages`): a section's own `inWhole` is read literally, the same way
// `label`/`kind` already are. I1 (independent review): unlike `label`/`kind`/`members`, a
// non-literal `inWhole` is an advisory-only field (same leniency as `composedOf`) — it must
// never cost the page its other error-level family checks for one warning rule's sake, so the
// page stays checkable and only that section's own `inWhole` is left unset.
test('a non-literal inWhole on a section does not cost the page its checkability', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    const pick = () => true;
    export default defineCatalogPage({
      id: 'X', group: 'Patterns', description: 'x', whole: 'X',
      sections: [{ label: 'Parts', kind: 'blocks', inWhole: pick(), members: ['X'] }],
      members: [{ id: 'X', source: 'x.tsx:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'd' }],
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.equal(page.sections?.[0].inWhole, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('a non-literal whole makes the page not checkable, even though members/sections are literal', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    const pickWhole = () => 'X';
    export default defineCatalogPage({
      id: 'X', group: 'Patterns', description: 'x', whole: pickWhole(),
      sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['X'] }],
      members: [{ id: 'X', source: 'x.tsx:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'd' }],
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, false);
  assert.equal(page.whole, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('a non-literal aliases array makes the page not checkable', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    const buildAliases = () => ['OldX'];
    export default defineCatalogPage({
      id: 'X', group: 'Patterns', description: 'x', whole: 'X', aliases: buildAliases(),
      sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['X'] }],
      members: [{ id: 'X', source: 'x.tsx:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'd' }],
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, false);
  assert.equal(page.aliases, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

// I2 (independent review): `relatedPages` must be read down to `page`, the same literal-checkable
// way as `composedOf` (mirroring `readComposedOf`), so `doctor`'s `family-invalid` reuse of
// `validateFamily` can catch an unresolvable or self-naming entry — not only ever the browser path.
test('reads a literal relatedPages array\'s page names', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      id: 'X', group: 'Patterns', description: 'x', whole: 'X',
      sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['X'] }],
      members: [{ id: 'X', source: 'x.tsx:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'd' }],
      relatedPages: [{ page: 'OtherPage', note: 'A note.' }, { page: 'NoSuchPage' }],
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.deepEqual(page.relatedPages, [{ page: 'OtherPage' }, { page: 'NoSuchPage' }]);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('relatedPages is undefined with no "not checkable" penalty when it is authored non-literally', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    const RELATED = ['OtherPage'];
    export default defineCatalogPage({
      id: 'X', group: 'Patterns', description: 'x', whole: 'X',
      sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['X'] }],
      members: [{ id: 'X', source: 'x.tsx:1', fidelity: 'documentation-only', relationship: 'Whole', description: 'd' }],
      relatedPages: RELATED.map((page) => ({ page })),
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.equal(page.relatedPages, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

// #61: tokenDefinition.
test('reads a literal tokenDefinition\'s kind, sections and entry ids, and derives tokenGallery/tokenSectionTitles for parity with the runtime', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      id: 'tokens-colors', group: 'Tokens', description: 'Fixture.',
      tokenDefinition: {
        kind: 'colors',
        sections: [
          { id: 'palette', title: 'Palette', desc: 'Real palette colors.', entries: [{ id: 'brand', name: 'Brand', kind: 'colors', value: {} }] },
          { id: 'semantic', title: 'Semantic', wide: true, entries: [] },
        ],
      },
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.equal(page.hasTokenDefinition, true);
  assert.equal(page.tokenDefinition?.kind, 'colors');
  assert.deepEqual(page.tokenDefinition?.sections, [
    { id: 'palette', title: 'Palette', desc: 'Real palette colors.', wide: false, entryIds: ['brand'], entriesOpaque: false, groups: [], groupsOpaque: false },
    { id: 'semantic', title: 'Semantic', desc: undefined, wide: true, entryIds: [], entriesOpaque: false, groups: [], groupsOpaque: false },
  ]);
  assert.equal(page.tokenGallery, true);
  assert.deepEqual(page.tokenSectionTitles, ['Palette', 'Semantic']);
  assert.deepEqual(page.tokenSectionWide, [false, true]);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('a tokenDefinition with a non-literal kind makes the page not checkable, not a fabricated reading', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    const KIND = ['colors'][0];
    export default defineCatalogPage({
      id: 'tokens-colors', group: 'Tokens', description: 'Fixture.',
      tokenDefinition: { kind: KIND, sections: [] },
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, false);
  assert.equal(page.hasTokenDefinition, true);
  assert.equal(page.tokenDefinition, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('a tokenDefinition entry with a non-literal id is simply omitted from entryIds, never a "not checkable" penalty', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    const dynamicId = 'computed-' + Date.now();
    export default defineCatalogPage({
      id: 'tokens-colors', group: 'Tokens', description: 'Fixture.',
      tokenDefinition: {
        kind: 'colors',
        sections: [{ id: 'palette', title: 'Palette', entries: [{ id: dynamicId, name: 'Brand', kind: 'colors', value: {} }, { id: 'ok', name: 'Ok', kind: 'colors', value: {} }] }],
      },
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.deepEqual(page.tokenDefinition?.sections[0].entryIds, ['ok']);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('reads the page\'s own literal title, for the static title/kind conflict check', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      id: 'tokens-colors', title: 'Palette', group: 'Tokens', description: 'Fixture.',
      tokenDefinition: { kind: 'colors', sections: [] },
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.title, 'Palette');
  rmSync(path.dirname(file), { recursive: true, force: true });
});

// Correction C3: proves non-execution, not merely asserts it — a real entry `value` that, if ever
// evaluated, would write a sentinel file to disk, and a section whose own `entries` is an imported
// identifier (never resolved, so the module it points at is never even located, let alone run).
test('readStaticPage never executes an entry\'s value or resolves an imported entries list — the sentinel file never appears, and kind/section metadata is still read', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-staticpage-tokendef-exec-'));
  const sentinel = path.join(dir, 'sentinel-should-never-exist.txt');
  const file = path.join(dir, 'Widget.catalog.tsx');
  writeFileSync(file, `
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    import { EXTERNAL_ENTRIES } from './this-module-does-not-exist-and-is-never-resolved';
    export default defineCatalogPage({
      id: 'tokens-colors', group: 'Tokens', description: 'Fixture.',
      tokenDefinition: {
        kind: 'colors',
        sections: [
          {
            id: 'danger', title: 'Danger',
            entries: [{ id: 'brand', name: 'Brand', kind: 'colors', value: require('node:fs').writeFileSync(${JSON.stringify(sentinel)}, 'x') }],
          },
          { id: 'imported', title: 'Imported', entries: EXTERNAL_ENTRIES },
        ],
      },
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(existsSync(sentinel), false, 'the reader must never evaluate an entry value, even one written as an immediately-invoked side effect');
  assert.equal(page.checkable, true, 'neither the dangerous entry value nor the unresolved import makes the page itself not checkable');
  assert.equal(page.hasTokenDefinition, true);
  assert.equal(page.tokenDefinition?.kind, 'colors');
  assert.deepEqual(page.tokenDefinition?.sections.map((s) => ({ id: s.id, title: s.title })), [
    { id: 'danger', title: 'Danger' },
    { id: 'imported', title: 'Imported' },
  ]);
  assert.deepEqual(page.tokenDefinition?.sections[0].entryIds, ['brand'], 'the literal id is still read even though the sibling value expression was never touched');
  assert.equal(page.tokenDefinition?.sections[0].entriesOpaque, false, 'the "danger" section is itself fully literal — only its value expression is unexamined');
  assert.equal(page.tokenDefinition?.sections[1].entriesOpaque, true, 'an imported identifier never resolves to a literal entries array');
  rmSync(dir, { recursive: true, force: true });
});

test('an explicit tokenSections is not overwritten by a co-authored tokenDefinition\'s own geometry', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      id: 'tokens-colors', group: 'Tokens', description: 'Fixture.',
      tokenSections: [{ title: 'Legacy', render: () => null }],
      tokenDefinition: { kind: 'colors', sections: [{ id: 'palette', title: 'Palette', entries: [] }] },
    });
  `);
  const [page] = readStaticPages([file]);
  assert.deepEqual(page.tokenSectionTitles, ['Legacy']);
  assert.equal(page.hasTokenDefinition, true);
  assert.equal(page.tokenDefinition?.sections[0]?.title, 'Palette');
  rmSync(path.dirname(file), { recursive: true, force: true });
});

// #63 A1/A10: a group page (`members` with no `whole`/`sections`) reads exactly like today's
// family reader already handles each field independently — no code change needed in the reader
// itself, only in `cli/doctor.ts`'s own consumer.
test('reads a group page (members with no whole or sections) the same way as a family\'s members', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      id: 'Widgets', group: 'Components', description: 'A group.',
      members: [
        { id: 'WidgetA', source: 'a.tsx:1', fidelity: 'documentation-only', relationship: 'Top', description: 'd' },
        { id: 'WidgetB', source: 'b.tsx:1', fidelity: 'documentation-only', relationship: 'Top', description: 'd', parent: 'Elsewhere' },
      ],
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.equal(page.whole, undefined);
  assert.equal(page.sections, undefined);
  assert.equal(page.hasMembers, true);
  assert.deepEqual(page.members?.map((m) => m.id), ['WidgetA', 'WidgetB']);
  assert.equal(page.members?.[1].parent, 'Elsewhere');
  rmSync(path.dirname(file), { recursive: true, force: true });
});

// #63 A4/A10: member-level `anatomy`, read down to its literal `member` ids only.
test('reads a member\'s own anatomy down to its literal member ids, ignoring "other"/description', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      id: 'Widgets', group: 'Components', description: 'A group.',
      members: [
        {
          id: 'Top', source: 'a.tsx:1', fidelity: 'documentation-only', relationship: 'Top', description: 'd',
          anatomy: { groups: [{ label: 'X', items: [
            { member: 'Part', description: 'd1' },
            { other: 'SomeOtherComponent', description: 'd2' },
          ] }] },
        },
        { id: 'Part', source: 'a.tsx:2', fidelity: 'documentation-only', relationship: 'Part', parent: 'Top', description: 'd' },
      ],
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.deepEqual(page.members?.find((m) => m.id === 'Top')?.anatomy, { memberIds: ['Part'] });
  assert.equal(page.members?.find((m) => m.id === 'Part')?.anatomy, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

// #63 A1/A10: page-level `anatomy` presence, independent of its own shape — `doctor`'s group-shape
// rule only ever needs to know it was authored at all.
test('hasAnatomy reflects whether the page object has its own "anatomy" property, regardless of value', () => {
  const withAnatomy = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      id: 'Widgets', group: 'Components', description: 'd', members: [{ id: 'A', source: 'a:1', fidelity: 'documentation-only', relationship: 'x', description: 'd' }],
      anatomy: { groups: [] },
    });
  `);
  const [page1] = readStaticPages([withAnatomy]);
  assert.equal(page1.hasAnatomy, true);
  rmSync(path.dirname(withAnatomy), { recursive: true, force: true });

  const withoutAnatomy = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ id: 'Widgets', group: 'Components', description: 'd' });
  `);
  const [page2] = readStaticPages([withoutAnatomy]);
  assert.equal(page2.hasAnatomy, false);
  rmSync(path.dirname(withoutAnatomy), { recursive: true, force: true });
});

// Review F9: presence of `whole`/`sections`, separate from their (literal-only) values.
test('hasWhole / hasSections record presence even when the value is not a literal', () => {
  const nonLiteral = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    const WHOLE = ['Card', 'Other'][0];
    export default defineCatalogPage({
      id: 'Card', group: 'Components', description: 'd', whole: WHOLE, sections: makeSections(),
      members: [{ id: 'Card', source: 'a:1', fidelity: 'documentation-only', relationship: 'x', description: 'd' }],
    });
  `);
  const [family] = readStaticPages([nonLiteral]);
  assert.equal(family.whole, undefined);
  assert.equal(family.sections, undefined);
  assert.equal(family.hasWhole, true);
  assert.equal(family.hasSections, true);
  rmSync(path.dirname(nonLiteral), { recursive: true, force: true });

  const group = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      id: 'Widgets', group: 'Components', description: 'd',
      members: [{ id: 'A', source: 'a:1', fidelity: 'documentation-only', relationship: 'x', description: 'd' }],
    });
  `);
  const [groupPage] = readStaticPages([group]);
  assert.equal(groupPage.hasWhole, false);
  assert.equal(groupPage.hasSections, false);
  rmSync(path.dirname(group), { recursive: true, force: true });
});


test('reads a literal sidebarParent, and leaves a non-literal one unset without making the page uncheckable', () => {
  const literal = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ id: 'Primary', group: 'Components', description: 'd', sidebarParent: 'Buttons' });
  `);
  const [child] = readStaticPages([literal]);
  assert.equal(child.sidebarParent, 'Buttons');
  rmSync(path.dirname(literal), { recursive: true, force: true });

  const computed = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    declare const parent: string;
    export default defineCatalogPage({ id: 'Primary', group: 'Components', description: 'd', sidebarParent: parent });
  `);
  const [dynamic] = readStaticPages([computed]);
  assert.equal(dynamic.sidebarParent, undefined);
  assert.equal(dynamic.checkable, true);
  rmSync(path.dirname(computed), { recursive: true, force: true });
});


test('reads a family member\'s literal title, and leaves a non-literal one unset', () => {
  const file = writePage(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    declare const dynamic: string;
    export default defineCatalogPage({
      id: 'Whole', group: 'Components', description: 'd', whole: 'Whole',
      sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['A', 'B'] }],
      members: [
        { id: 'Whole', source: 's', fidelity: 'replicated', relationship: 'r', description: 'd' },
        { id: 'A', title: 'Alpha', parent: 'Whole', source: 's', fidelity: 'replicated', relationship: 'r', description: 'd' },
        { id: 'B', title: dynamic, parent: 'Whole', source: 's', fidelity: 'replicated', relationship: 'r', description: 'd' },
      ],
    });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.members?.find((m) => m.id === 'A')?.title, 'Alpha');
  assert.equal(page.members?.find((m) => m.id === 'B')?.title, undefined);
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('a page whose tokenDefinition is a tokenScale call stays checkable and counts as a tokenDefinition page', () => {
  const file = writePage(`
    import { defineCatalogPage, tokenScale } from '@krapwoo/ds-viewer';
    const FINDINGS = [{ expression: 'cornerRadius: 6', value: 6, unit: 'pt' }];
    const RADIUS = tokenScale('radius', FINDINGS);
    export default defineCatalogPage({ group: 'Tokens', description: 'Fixture.', tokenDefinition: RADIUS });
  `);
  const [page] = readStaticPages([file]);
  assert.equal(page.checkable, true);
  assert.equal(page.hasTokenDefinition, true);
  assert.equal(page.tokenDefinition?.kind, 'radius');
});
