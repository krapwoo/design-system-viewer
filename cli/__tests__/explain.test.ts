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
  // One Variants specimen 600px tall in a 462px column: taller than it is wide, so it leaves an
  // empty strip the States block fills. That is what earns the split under the stack-by-default
  // rule — the same arithmetic `choosePlacement`'s own tests use.
  assert.equal(explainPage(configFor(dir), 'Widget', { heights: [600, 120] })?.placement?.decision, 'side');

  // The same page with a short first block earns nothing: a single specimen wider than it is tall
  // leaves no strip, and the two States items need two rows in half a row. Stacked is the default.
  assert.equal(explainPage(configFor(dir), 'Widget', { heights: [300, 120] })?.placement?.decision, 'stacked');
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

const ONE_TALL_TWO_BLOCK = `
  import { defineCatalogPage } from '@krapwoo/ds-viewer';
  export default defineCatalogPage({
    component: 'Widget', group: 'Components', description: 'x',
    specimenSize: 'wide',
    variants: { items: [{ key: 'v0', name: 'V0', node: null }] },
    states: { items: [{ key: 's0', name: 'S0', node: null }] },
  });
`;

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

  // Five wide specimens per block no longer share a row at any height — halving turns three rows
  // into five and draws every banner-width specimen at 462px. A tall single specimen still does,
  // so that is the shape this reporting test drives.
  const stackedTall = explainPage(configFor(dir), 'Widget', { heights: [600, 600] });
  assert.equal(stackedTall?.placement?.decision, 'stacked');

  const singleDir = makeProject(ONE_TALL_TWO_BLOCK);
  const side = explainPage(configFor(singleDir), 'Widget', { heights: [700, 120] });
  assert.equal(side?.placement?.decision, 'side');
  assert.match(side!.placement!.reason, /each block gets 462px/);
  assert.match(side!.blocks[0].reason, /1 column × 1 row/);
  rmSync(singleDir, { recursive: true, force: true });

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

// #63 A10: `explain <group page>` prints title, each top-level member with its qualifier, nested
// parts with numbers — net-new output (a group page's real content never reaches `blocks`).
test('explainPage prints a group page\'s outline: top-level members with their qualifier, and nested numbered parts', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      id: 'Widgets', group: 'Components', description: 'A group.',
      members: [
        { id: 'Top1', component: 'Widget', source: 'a.swift:1', fidelity: 'replicated', relationship: 'Top', description: 'd' },
        { id: 'Top1Part', source: 'a.swift:2', fidelity: 'documentation-only', relationship: 'Part', parent: 'Top1', description: 'd' },
        { id: 'Top1Grand', source: 'a.swift:3', fidelity: 'documentation-only', relationship: 'Grand', parent: 'Top1Part', description: 'd' },
        { id: 'Top2', source: 'b.swift:1', fidelity: 'documentation-only', relationship: 'Top', description: 'd' },
      ],
    });
  `);
  const result = explainPage(configFor(dir), 'Widgets');
  assert.equal(result?.pageId, 'Widgets');
  assert.deepEqual(result?.blocks, []);
  assert.deepEqual(result?.group?.topLevel.find((t) => t.id === 'Top1'), {
    id: 'Top1', qualifier: 'Widget',
    parts: [{ number: '1', id: 'Top1Part' }, { number: '1.1', id: 'Top1Grand' }],
  });
  assert.deepEqual(result?.group?.topLevel.find((t) => t.id === 'Top2'), { id: 'Top2', qualifier: 'documentation-only', parts: [] });
  const text = formatExplain(result!);
  assert.match(text, /Widgets/);
  assert.match(text, /Top1 \(Widget\)/);
  assert.match(text, /^\s*1\. Top1Part$/m);
  assert.match(text, /^\s*1\.1\. Top1Grand$/m);
  assert.match(text, /Top2 \(documentation-only\)/);
  rmSync(dir, { recursive: true, force: true });
});

// `explain` covers a family or group page's members: each member's own blocks, keyed by member id,
// in the same shape as a page's blocks — so a layout audit sees their specimen grids.
const GROUP_WITH_SPECIMENS = `
  import { defineCatalogPage } from '@krapwoo/ds-viewer';
  export default defineCatalogPage({
    id: 'Widgets', group: 'Components', description: 'A group.',
    members: [
      {
        id: 'Gallery', component: 'Widget', source: 'a.swift:1', fidelity: 'replicated', relationship: 'Top', description: 'd', specimenSize: 'compact',
        states: { items: [
          { key: 'a', name: 'A', node: null }, { key: 'b', name: 'B', node: null },
          { key: 'c', name: 'C', node: null }, { key: 'd', name: 'D', node: null },
        ] },
      },
      {
        id: 'Matrix', source: 'b.swift:1', fidelity: 'replicated', relationship: 'Top', description: 'd',
        comparison: {
          rowLabel: 'Shape', columnLabel: 'Pose',
          rows: [{ key: 'r1', label: 'R1' }, { key: 'r2', label: 'R2' }],
          columns: [{ key: 'c1', label: 'C1' }, { key: 'c2', label: 'C2' }, { key: 'c3', label: 'C3' }],
          cells: [],
        },
      },
      { id: 'Bare', source: 'c.swift:1', fidelity: 'documentation-only', relationship: 'Top', description: 'd' },
    ],
  });
`;

test('explainPage reports each group member\'s own blocks, keyed by member id', () => {
  const dir = makeProject(GROUP_WITH_SPECIMENS);
  const result = explainPage(configFor(dir), 'Widgets');
  assert.deepEqual(result?.blocks, [], 'the page-level blocks stay as they were');
  assert.ok(result?.group, 'the group outline stays as it was');
  assert.deepEqual(Object.keys(result!.members!), ['Gallery', 'Matrix', 'Bare']);
  const gallery = result!.members!.Gallery;
  assert.equal(gallery[0].kind, 'list');
  assert.match(gallery[0].reason, /4 items \(compact\) → 4 columns × 1 row\./);
  const matrix = result!.members!.Matrix;
  assert.equal(matrix[0].kind, 'grid');
  assert.match(matrix[0].reason, /2 rows × 3 columns \(regular\); 3 of 3 max regular columns used — fits/);
  assert.deepEqual(result!.members!.Bare, [], 'a member with no specimens has no blocks');
  rmSync(dir, { recursive: true, force: true });
});

test('explainPage reports a family page\'s members too, and leaves its page-level fields alone', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({
      id: 'Family', group: 'Components', description: 'A family.', whole: 'Whole',
      members: [
        { id: 'Whole', component: 'Widget', source: 'a.swift:1', fidelity: 'replicated', relationship: 'Whole', description: 'd',
          variants: { items: [{ key: 'a', name: 'A', node: null }, { key: 'b', name: 'B', node: null }] } },
        { id: 'Part', source: 'a.swift:2', fidelity: 'replicated', relationship: 'Part', parent: 'Whole', description: 'd',
          states: { items: [{ key: 's', name: 'S', node: null }] } },
      ],
      sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['Part'] }],
    });
  `);
  const result = explainPage(configFor(dir), 'Family');
  assert.deepEqual(Object.keys(result!.members!), ['Whole', 'Part']);
  assert.match(result!.members!.Whole[0].reason, /2 items/);
  assert.match(result!.members!.Part[0].reason, /1 items \(regular\)/);
  assert.equal(result!.blocks[0].kind, 'empty', 'the page-level blocks are what they were: a family page has no page-level specimens');
  // JSON keeps member ids as keys, in order.
  assert.deepEqual(Object.keys(JSON.parse(JSON.stringify(result)).members), ['Whole', 'Part']);
  rmSync(dir, { recursive: true, force: true });
});

test('a page without members has no members field at all', () => {
  const dir = makeProject(`
    import { defineCatalogPage } from '@krapwoo/ds-viewer';
    export default defineCatalogPage({ component: 'Widget', group: 'Components', description: 'x', states: { items: [{ key: 'a', name: 'A', node: null }] } });
  `);
  assert.equal('members' in explainPage(configFor(dir), 'Widget')!, false);
  rmSync(dir, { recursive: true, force: true });
});

test('formatExplain lists each member\'s blocks under a Members heading, for a group and a family page', () => {
  const dir = makeProject(GROUP_WITH_SPECIMENS);
  const text = formatExplain(explainPage(configFor(dir), 'Widgets')!);
  assert.match(text, /^Gallery \(Widget\)$/m, 'the group outline is still printed');
  assert.match(text, /^Members$/m);
  assert.match(text, /^ {2}Gallery\n {4}States \/ configurations\n {6}4 items \(compact\) → 4 columns × 1 row\./m);
  assert.match(text, /^ {2}Matrix\n {4}Shape × Pose\n {6}2 rows × 3 columns/m);
  assert.match(text, /^ {2}Bare\n {4}No specimens\.$/m);
  rmSync(dir, { recursive: true, force: true });
});

// A member with both a variants and a states list: the viewer's `Blocks` may put the two side by
// side at runtime (half the row each), so its full-row counts are not stated as fact.
const GROUP_WITH_TWO_BLOCK_MEMBER = `
  import { defineCatalogPage } from '@krapwoo/ds-viewer';
  export default defineCatalogPage({
    id: 'Widgets', group: 'Components', description: 'A group.',
    members: [
      {
        id: 'Both', source: 'a.swift:1', fidelity: 'replicated', relationship: 'Top', description: 'd', specimenSize: 'compact',
        variants: { axis: 'Size', items: [{ key: 's', name: 'S', node: null }, { key: 'm', name: 'M', node: null }] },
        states: { axis: 'Tone', items: [{ key: 'a', name: 'A', node: null }, { key: 'b', name: 'B', node: null }] },
      },
      {
        id: 'One', source: 'b.swift:1', fidelity: 'replicated', relationship: 'Top', description: 'd', specimenSize: 'compact',
        states: { items: [{ key: 'a', name: 'A', node: null }] },
      },
    ],
  });
`;

test('explainPage flags a two-block member as decided in the viewer, and only that member', () => {
  const dir = makeProject(GROUP_WITH_TWO_BLOCK_MEMBER);
  const result = explainPage(configFor(dir), 'Widgets');
  assert.deepEqual(Object.keys(result!.memberPlacement!), ['Both']);
  assert.equal(result!.memberPlacement!.Both.decision, 'decided-in-viewer');
  assert.match(result!.memberPlacement!.Both.reason, /full 952px row; side by side each block gets 462px/);
  assert.equal(result!.members!.Both.length, 2, 'the members shape itself is unchanged');
  const human = formatExplain(result!);
  assert.match(human, /^ {4}Placement: Side-by-side placement depends/m);
  assert.equal(human.match(/Placement:/g)?.length, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('explainPage titles a member\'s blocks by their axis, as the viewer does', () => {
  const dir = makeProject(GROUP_WITH_TWO_BLOCK_MEMBER);
  const result = explainPage(configFor(dir), 'Widgets');
  assert.deepEqual(result!.members!.Both.map((b) => b.title), ['Size', 'Tone']);
  assert.deepEqual(result!.members!.One.map((b) => b.title), ['States / configurations']);
  rmSync(dir, { recursive: true, force: true });
});
