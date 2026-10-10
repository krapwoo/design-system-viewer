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
