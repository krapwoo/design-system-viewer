import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { explainPage, formatExplain, parseHeights } from '../explain.ts';
import type { ResolvedConfig } from '../types.ts';

function makeProject(pageSource: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-viewer-explain-'));
  mkdirSync(path.join(dir, 'components', 'Widget'), { recursive: true });
  writeFileSync(path.join(dir, 'components', 'Widget', 'index.ts'), 'export function Widget() { return null; }\n');
  writeFileSync(path.join(dir, 'components', 'Widget', 'Widget.catalog.tsx'), pageSource);
  return dir;
}

function configFor(dir: string): ResolvedConfig {
  return {
    name: 'Fixture', components: ['components/*/index.ts'], tokens: [], pages: [],
    updateCheck: true, doctor: { strict: false }, projectRoot: dir, configPath: path.join(dir, 'ds-viewer.config.ts'),
  };
}

test('explains a grid page\'s row/column count and whether it fits a 1280px laptop', () => {
  const dir = makeProject(`
    import { defineCatalogPage, grid } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      comparison: grid('Variant', 'State',
        [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
        [{ key: 'c', label: 'C' }, { key: 'd', label: 'D' }, { key: 'e', label: 'E' }],
        (row, column) => null,
      ),
    });
  `);
  const result = explainPage(configFor(dir), 'Widget');
  assert.equal(result?.blocks[0].kind, 'grid');
  assert.match(result!.blocks[0].reason, /2 rows × 3 columns \(regular\); 3 of 3 max regular columns used — fits/);
  rmSync(dir, { recursive: true, force: true });
});

test('explains a list page\'s column/row/filler geometry', () => {
  // 4 compact items on a 952px-wide laptop lay out as one row of 4 (same fixture as
  // `native/catalog/__tests__/comparison.test.ts`'s own `listGeometry(4, 952, 'compact')` case).
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x', specimenSize: 'compact',
      states: { items: [
        { key: 'a', name: 'A', node: null }, { key: 'b', name: 'B', node: null },
        { key: 'c', name: 'C', node: null }, { key: 'd', name: 'D', node: null },
      ] },
    });
  `);
  const result = explainPage(configFor(dir), 'Widget');
  assert.equal(result?.blocks[0].kind, 'list');
  assert.match(result!.blocks[0].reason, /4 items \(compact\) → 4 columns × 1 row\./);
  rmSync(dir, { recursive: true, force: true });
});

test('explains the same capped list geometry the viewer renders', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x', specimenSize: 'compact',
      states: { maxColumns: 2, items: [
        { key: 'a', name: 'A', node: null }, { key: 'b', name: 'B', node: null },
        { key: 'c', name: 'C', node: null }, { key: 'd', name: 'D', node: null },
      ] },
    });
  `);
  const result = explainPage(configFor(dir), 'Widget');
  assert.equal(result?.blocks[0].kind, 'list');
  assert.match(result!.blocks[0].reason, /4 items \(compact\) → 2 columns × 2 rows\./);
  rmSync(dir, { recursive: true, force: true });
});

test('explains a grouped-rows page by its group count', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      variants: { items: [{ key: 'circle', name: 'Circle', node: null }] },
      states: { items: [{ key: 'small', name: 'Small', group: 'circle', node: null }] },
    });
  `);
  const result = explainPage(configFor(dir), 'Widget');
  assert.equal(result?.blocks[0].kind, 'grouped');
  assert.match(result!.blocks[0].reason, /1 variant row/);
  rmSync(dir, { recursive: true, force: true });
});

test('explains a render()-only page as a preview block at its configured widths', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x', previewWidths: [402, 320], render: () => null });
  `);
  const result = explainPage(configFor(dir), 'Widget');
  assert.equal(result?.blocks[0].kind, 'preview');
  assert.match(result!.blocks[0].reason, /402\/320px/);
  rmSync(dir, { recursive: true, force: true });
});

test('explains a token page with sections as one block naming each section and how many fit side by side', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Tokens', description: 'x', tokenColumns: 3,
      tokenSections: [
        { title: 'Body', render: () => null },
        { title: 'Title', render: () => null },
        { title: 'Palette', wide: true, render: () => null },
      ],
    });
  `);
  const result = explainPage(configFor(dir), 'Widget');
  assert.deepEqual(result?.blocks.map((b) => b.kind), ['tokenSections']);
  assert.equal(result!.blocks[0].reason, '3 sections (Body, Title, Palette): 2 side by side on a 1280px laptop; 1 full width.');
  rmSync(dir, { recursive: true, force: true });
});

test('explains a page with nothing documented as one empty block', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x' });
  `);
  const result = explainPage(configFor(dir), 'Widget');
  assert.deepEqual(result?.blocks.map((b) => b.kind), ['empty']);
  rmSync(dir, { recursive: true, force: true });
});

test('a two-block page with no --heights reports placement as "decided in the viewer"', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      variants: { items: [{ key: 'a', name: 'A', node: null }] },
      states: { items: [{ key: 'b', name: 'B', node: null }, { key: 'c', name: 'C', node: null }] },
    });
  `);
  const result = explainPage(configFor(dir), 'Widget');
  assert.equal(result?.placement?.decision, 'decided-in-viewer');
  assert.match(result!.placement!.reason, /--heights/);
  rmSync(dir, { recursive: true, force: true });
});

test('--heights lets explain compute the same side/stacked decision the viewer would', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      variants: { items: [{ key: 'a', name: 'A', node: null }] },
      states: { items: [{ key: 'b', name: 'B', node: null }, { key: 'c', name: 'C', node: null }] },
    });
  `);
  // A tall first block (a single-item "Variants" list, which hugs a narrow ~404px content width —
  // see `toPlacementBlock` below) and a much shorter second block: side by side saves more than
  // `PLACEMENT_MIN_SAVING` (120px) here, by the same arithmetic `choosePlacement`'s own tests in
  // `native/catalog/__tests__/comparison.test.ts` use.
  const result = explainPage(configFor(dir), 'Widget', { heights: [300, 120] });
  assert.equal(result?.placement?.decision, 'side');
  rmSync(dir, { recursive: true, force: true });
});

test('explainPage returns undefined for a page whose component folder is excluded via config.exclude', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ group: 'Components', description: 'x' });
  `);
  const config = { ...configFor(dir), exclude: [path.join('components', 'Widget', 'index.ts')] };
  assert.equal(explainPage(config, 'Widget'), undefined);
  rmSync(dir, { recursive: true, force: true });
});

test('explainPage reports a page that is not statically checkable as such, instead of explaining it from partial/empty data', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    function buildItems() { return [{ key: 'a', name: 'A', node: null }]; }
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x', states: { items: buildItems() } });
  `);
  const result = explainPage(configFor(dir), 'Widget');
  assert.equal(result?.notCheckable, true);
  assert.deepEqual(result?.blocks, []);
  rmSync(dir, { recursive: true, force: true });
});

test('explainPage returns undefined for an unknown page id', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x' });
  `);
  assert.equal(explainPage(configFor(dir), 'NoSuchPage'), undefined);
  rmSync(dir, { recursive: true, force: true });
});

test('formatExplain lists each block, its reason, then Placement', () => {
  const text = formatExplain({
    pageId: 'Widget',
    blocks: [{ kind: 'list', title: 'States / configurations', reason: '4 items.' }],
    placement: undefined,
  });
  assert.match(text, /^Widget\n/);
  assert.match(text, /States \/ configurations\n  4 items\./);
});

test('formatExplain reports a not-checkable page with its own message, not an empty block list', () => {
  const text = formatExplain({ pageId: 'Widget', notCheckable: true, blocks: [] });
  assert.match(text, /^Widget\n/);
  assert.match(text, /not statically checkable/);
});

test('parseHeights accepts "first,second" and rejects anything else', () => {
  assert.deepEqual(parseHeights('80,300'), [80, 300]);
  assert.equal(parseHeights('80'), undefined);
  assert.equal(parseHeights('a,b'), undefined);
  assert.equal(parseHeights('-1,5'), undefined);
});
