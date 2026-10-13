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

// Cross-path propagation: the same per-item `surface` override `native/catalog/comparison.ts`'s
// `presentationBlocks` (the runtime path `SectionBlock.tsx` renders with) resolves onto a
// `ListItem` must survive the static path (`staticPage.ts` → this file's `toSectionDef`) too, so
// `explain` never reports a page as plainer than what the viewer actually shows.
test('explains a list whose item carries its own surface override, the same per-item field the viewer renders with', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      states: { items: [
        { key: 'a', name: 'A', node: null },
        { key: 'b', name: 'B', surface: 'white', node: null },
      ] },
    });
  `);
  const result = explainPage(configFor(dir), 'Widget');
  assert.equal(result?.blocks[0].kind, 'list');
  assert.match(result!.blocks[0].reason, /1 item overrides the surface\./);
  rmSync(dir, { recursive: true, force: true });
});

// Cross-path propagation for the new typed `align` override: same reasoning as the surface test
// above — a per-item `align` must survive `staticPage.ts` → `toSectionDef` the same way the viewer
// itself renders it, so `explain` never under-reports what the page actually shows.
test('explains a list whose item carries its own align override, the same per-item field the viewer renders with', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      states: { items: [
        { key: 'a', name: 'A', node: null },
        { key: 'b', name: 'B', align: 'start', node: null },
      ] },
    });
  `);
  const result = explainPage(configFor(dir), 'Widget');
  assert.equal(result?.blocks[0].kind, 'list');
  assert.match(result!.blocks[0].reason, /1 item overrides the alignment\./);
  rmSync(dir, { recursive: true, force: true });
});

test('explains a grid whose directly-authored cells carry their own surface/align overrides', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      comparison: {
        rowLabel: 'Variant', columnLabel: 'State',
        rows: [{ key: 'primary', label: 'Primary' }],
        columns: [{ key: 'default', label: 'Default' }],
        cells: [{ rowKey: 'primary', columnKey: 'default', surface: 'white', align: 'end', node: null }],
      },
    });
  `);
  const result = explainPage(configFor(dir), 'Widget');
  assert.equal(result?.blocks[0].kind, 'grid');
  assert.match(result!.blocks[0].reason, /1 cell overrides the surface\./);
  assert.match(result!.blocks[0].reason, /1 cell overrides the alignment\./);
  rmSync(dir, { recursive: true, force: true });
});

test('explains a grouped page\'s own-surface override the same way a plain list does', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      variants: { items: [{ key: 'circle', name: 'Circle', node: null }] },
      states: { items: [{ key: 'small', name: 'Small', group: 'circle', surface: 'neutral', node: null }] },
    });
  `);
  const result = explainPage(configFor(dir), 'Widget');
  assert.equal(result?.blocks[0].kind, 'grouped');
  assert.match(result!.blocks[0].reason, /1 item overrides the surface\./);
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

// Guided intelligence design §3 / plan Task 3 — the explicit intentional-static declaration's
// bounded reason stays explainable rather than silently suppressing the advisory invisibly.
test('explainPage surfaces an authored intentionalStaticPreview reason', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      intentionalStaticPreview: { reason: 'Already demonstrated by SegmentedToggle.' },
    });
  `);
  const result = explainPage(configFor(dir), 'Widget');
  assert.equal(result?.intentionalStaticPreviewReason, 'Already demonstrated by SegmentedToggle.');
  rmSync(dir, { recursive: true, force: true });
});

test('explainPage leaves intentionalStaticPreviewReason undefined with no declaration at all', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x' });
  `);
  const result = explainPage(configFor(dir), 'Widget');
  assert.equal(result?.intentionalStaticPreviewReason, undefined);
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

test("explains a 'table' preview page, pricing it with the table card's own chrome", () => {
  // The preview's minimum is what decides side-by-side, and the two cards differ by 16px. At the
  // 952px laptop width both land on the same side of the half row (436 and 452 against 462), which
  // is exactly why carrying previewLayout was invisible until now — so this asserts the plumbing:
  // the page is read as checkable and explained, rather than skipped or priced as a frames card.
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      previewWidths: [402], previewLayout: 'table', render: () => null,
      states: { items: [{ key: 'a', name: 'A', node: null }, { key: 'b', name: 'B', node: null }] },
    });
  `);
  const result = explainPage(configFor(dir), 'Widget');
  assert.ok(result, 'a literal previewLayout must leave the page checkable');
  assert.equal(result!.blocks[0].kind, 'preview');
  assert.equal(result!.blocks[1].kind, 'list');
  rmSync(dir, { recursive: true, force: true });
});

test('a page whose previewLayout cannot be read is not explained, rather than explained wrongly', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    const pick = () => 'table' as const;
    export default defineCatalogPage({
      component: 'Widget', group: 'Components', description: 'x',
      previewLayout: pick(), render: () => null,
    });
  `);
  // Reported as not checkable, with no blocks — explain says why rather than pricing a card it
  // could not identify.
  const result = explainPage(configFor(dir), 'Widget');
  assert.equal(result?.notCheckable, true);
  assert.deepEqual(result?.blocks, []);
  assert.match(formatExplain(result!), /not statically checkable/);
  rmSync(dir, { recursive: true, force: true });
});

const WIDE_TWO_BLOCK = `
  import { defineCatalogPage } from '@krapwoo/ds-viewer';
  export default defineCatalogPage({
    component: 'Widget', group: 'Components', description: 'x',
    specimenSize: 'wide',
    variants: { items: [{ key: 'v0', name: 'V0', node: null }, { key: 'v1', name: 'V1', node: null }, { key: 'v2', name: 'V2', node: null }, { key: 'v3', name: 'V3', node: null }, { key: 'v4', name: 'V4', node: null }] },
    states: { items: [{ key: 's0', name: 'S0', node: null }, { key: 's1', name: 'S1', node: null }, { key: 's2', name: 'S2', node: null }, { key: 's3', name: 'S3', node: null }, { key: 's4', name: 'S4', node: null }] },
  });
`;

test('a side-by-side placement reports the columns that fit in half a row, not the full-row count', () => {
  // The defect: counts were computed at the full row width and printed as fact, while the viewer
  // halved the row — so a page author sized examples for a layout that never rendered.
  const dir = makeProject(WIDE_TWO_BLOCK);

  const side = explainPage(configFor(dir), 'Widget', { heights: [600, 600] });
  assert.equal(side?.placement?.decision, 'side');
  assert.match(side!.placement!.reason, /each block gets 462px/);
  for (const block of side!.blocks) assert.match(block.reason, /1 column × 5 rows/);

  // Short blocks: stacking wins, and the full-row count is then the correct one to report.
  const stacked = explainPage(configFor(dir), 'Widget', { heights: [40, 40] });
  assert.equal(stacked?.placement?.decision, 'stacked');
  assert.match(stacked!.placement!.reason, /the full 952px/);
  for (const block of stacked!.blocks) assert.match(block.reason, /2 columns × 3 rows/);
  rmSync(dir, { recursive: true, force: true });
});

test('without heights, the counts say which row width they assume', () => {
  const dir = makeProject(WIDE_TWO_BLOCK);
  const result = explainPage(configFor(dir), 'Widget', {});
  assert.equal(result?.placement?.decision, 'decided-in-viewer');
  assert.match(result!.placement!.reason, /counts above are for the full 952px row/);
  assert.match(result!.placement!.reason, /462px instead, which can fit fewer columns/);
  rmSync(dir, { recursive: true, force: true });
});
