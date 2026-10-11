import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  COLUMN_MIN_WIDTH,
  MATRIX_LAYOUT,
  REFERENCE_COLUMN_GAP,
  REFERENCE_MIN_COLUMN_WIDTH,
  cellKey,
  gridColumnLimit,
  gridWidthBounds,
  indexCells,
  listGeometry,
  PREVIEW_MAX_WIDTH,
  PROPS_COLUMN_GAP,
  PROPS_MIN_COLUMN_WIDTH,
  choosePlacement,
  presentationBlocks,
  propsColumns,
  referenceColumns,
  remainingStates,
  validateComparison,
} from '../comparison.ts';
import { CATALOG_SPACE } from '../tokens.ts';

const valid = {
  rowLabel: 'Variant',
  columnLabel: 'State',
  rows: [{ key: 'primary', label: 'Primary' }, { key: 'ghost', label: 'Ghost' }],
  columns: [{ key: 'default', label: 'Default' }, { key: 'disabled', label: 'Disabled' }],
  cells: [
    { rowKey: 'primary', columnKey: 'default', node: 'P' },
    { rowKey: 'primary', columnKey: 'disabled', node: 'P-d' },
    { rowKey: 'ghost', columnKey: 'default', node: 'G' },
    { rowKey: 'ghost', columnKey: 'disabled', unavailableReason: 'Ghost has no disabled look' },
  ],
};

test('layout constants match the approved design', () => {
  assert.equal(MATRIX_LAYOUT.columnMaxWidth, 402);
  assert.equal(MATRIX_LAYOUT.rowHeaderWidth, 120);
  assert.equal(MATRIX_LAYOUT.rowMinHeight, 150);
  assert.equal(MATRIX_LAYOUT.cellPadding, 16);
  assert.equal(MATRIX_LAYOUT.cellPadding, CATALOG_SPACE.lg);
  assert.equal(MATRIX_LAYOUT.laptopContentWidth, 1280 - 264 - 2 * 32);
  assert.deepEqual(COLUMN_MIN_WIDTH, { compact: 160, regular: 240, wide: 402 });
});

test('gridColumnLimit derives how many columns fit a 1280px laptop', () => {
  assert.equal(gridColumnLimit('compact'), 5);
  assert.equal(gridColumnLimit('regular'), 3);
  assert.equal(gridColumnLimit('wide'), 2);
});

test('gridWidthBounds depends on column count and specimen size', () => {
  assert.deepEqual(gridWidthBounds(3, 'regular'), { minWidth: 840, maxWidth: 1326 });
  assert.deepEqual(gridWidthBounds(4, 'compact'), { minWidth: 760, maxWidth: 1728 });
});

test('listGeometry balances rows inside one card', () => {
  // Button "Other configurations": 6 regular items on a 1280px laptop -> 3 × 2, no blanks.
  assert.deepEqual(listGeometry(6, 952, 'regular'), { columns: 3, rows: 2, fillers: 0, cellWidth: 316, containerWidth: 950 });
  // Switch states: 4 compact items -> one row.
  assert.deepEqual(listGeometry(4, 952, 'compact'), { columns: 4, rows: 1, fillers: 0, cellWidth: 237, containerWidth: 950 });
  // Banner variants: 5 wide items -> 2 phone-width columns, 3 rows, one blank.
  assert.deepEqual(listGeometry(5, 952, 'wide'), { columns: 2, rows: 3, fillers: 1, cellWidth: 402, containerWidth: 806 });
  // Never wider than 402 per cell, even with room to spare.
  assert.deepEqual(listGeometry(2, 1600, 'compact'), { columns: 2, rows: 1, fillers: 0, cellWidth: 402, containerWidth: 806 });
  // Narrow container falls back to one column, never below the size minimum.
  assert.deepEqual(listGeometry(3, 200, 'regular'), { columns: 1, rows: 3, fillers: 0, cellWidth: 240, containerWidth: 242 });
  assert.deepEqual(listGeometry(0, 952, 'regular'), { columns: 0, rows: 0, fillers: 0, cellWidth: 0, containerWidth: 0 });
});

test('listGeometry respects an explicit column cap, never exceeding it even with room to spare', () => {
  // Baseline, no cap: 6 regular items on a 1280px laptop -> 3 columns (matches the uncapped test above).
  assert.deepEqual(listGeometry(6, 952, 'regular'), { columns: 3, rows: 2, fillers: 0, cellWidth: 316, containerWidth: 950 });
  // Capped to 2: same 6 items -> 2 columns × 3 rows, never 3, even though the width fits 3.
  assert.deepEqual(listGeometry(6, 952, 'regular', 2), { columns: 2, rows: 3, fillers: 0, cellWidth: 402, containerWidth: 806 });
  // A cap higher than what fits the width still drops to fewer columns when width requires it.
  assert.deepEqual(listGeometry(3, 200, 'regular', 5), { columns: 1, rows: 3, fillers: 0, cellWidth: 240, containerWidth: 242 });
  // A cap of 1 always stacks into a single column.
  assert.deepEqual(listGeometry(4, 952, 'compact', 1), { columns: 1, rows: 4, fillers: 0, cellWidth: 402, containerWidth: 404 });
});

test('presentationBlocks propagates an explicit maxColumns onto list blocks, omitting it when not set', () => {
  const base = { id: 'X', path: 'p', description: 'd' };
  const variants = { maxColumns: 3, items: [{ key: 'a', name: 'A', node: 'a' }] };
  const states = { maxColumns: 2, items: [{ key: 'disabled', name: 'Disabled', node: 'd' }] };
  const [variantsBlock, statesBlock] = presentationBlocks({ ...base, variants, states });
  assert.equal(variantsBlock.maxColumns, 3);
  assert.equal(statesBlock.maxColumns, 2);

  const plain = presentationBlocks({ ...base, variants: { items: variants.items } })[0];
  assert.equal('maxColumns' in plain, false, 'uncapped slots never carry a maxColumns key at all');
});

// SectionBlock.tsx imports react-native, so it can't run under `node --test` directly — same
// constraint as the ReferenceDetails.tsx source checks below. `def.previewLayout` is read directly
// in `Preview`'s own 'preview' branch rather than threaded through `PresentationBlock` (this file's
// own `presentationBlocks` output), so these source assertions, not a unit test here, are the
// regression for the "table" layout's full-width/token-gallery exclusion (guided intelligence,
// "Collapsible Preview table").
test('SectionBlock\'s Preview only reaches the table layout after its full-width check, so a token gallery or full-width preview (always widths: \'full\') can never render it', () => {
  const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../SectionBlock.tsx');
  const source = readFileSync(sourcePath, 'utf8');
  const fullWidthCheck = source.indexOf("widths === 'full'");
  const tableLayoutCheck = source.indexOf("layout === 'table'");
  assert.ok(fullWidthCheck >= 0, "Preview must check widths === 'full' explicitly");
  assert.ok(tableLayoutCheck >= 0, "Preview must check layout === 'table' explicitly");
  assert.ok(
    fullWidthCheck < tableLayoutCheck,
    "the widths === 'full' early return must come before the layout === 'table' check, so a full-width preview (component or token gallery) never reaches the table layout",
  );
});

test('SectionBlock\'s table-layout cell reserves the requested width plus the shared cell padding, and an inner width-qualified group — not the padded body — owns render()', () => {
  const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../SectionBlock.tsx');
  const source = readFileSync(sourcePath, 'utf8');

  // The padded cell body shares ComparisonList's own cell padding — it no longer renders edge-to-edge.
  const tableBody = source.match(/tableBody:\s*\{([^}]*)\}/)?.[1];
  assert.ok(tableBody, 'tableBody style declaration not found');
  assert.match(tableBody, /padding:\s*MATRIX_LAYOUT\.cellPadding/, 'tableBody must share the same cell padding ComparisonList uses, not render edge-to-edge');

  // A cell's flex basis reserves the requested width PLUS that padding on both sides, so the padded
  // body still has room to fit the requested width untouched instead of clipping or leaving slack.
  assert.match(
    source,
    /flexBasis:\s*width\s*\+\s*2\s*\*\s*MATRIX_LAYOUT\.cellPadding/,
    'a cell\'s flexBasis must reserve the requested width plus twice the cell padding, so its padded body still fits the requested width untouched',
  );

  // The stable keyed width map survives: one shared `tableCell` style per cell, still keyed by its
  // own width and index.
  assert.match(
    source,
    /key=\{`\$\{width\}-\$\{i\}`\}[^>]*style=\{\[styles\.tableCell/s,
    'each cell must stay keyed by its own width and index, carrying the shared tableCell style',
  );

  // render() is owned by its own inner width-qualified group, nested inside the padded body — not
  // by the padded body/cell itself — so the requested width reaches the live demo untouched.
  assert.match(
    source,
    /<SpecimenSurface[^>]*style=\{styles\.tableBody\}[^>]*>\s*<View\s+role="group"[^>]*aria-label=\{frameLabel\(width\)\}[^>]*>/s,
    'the padded tableBody SpecimenSurface must wrap an inner role="group" View (carrying the width-group aria-label) that owns render(), not render() directly',
  );
});

test('a complete comparison validates cleanly and indexes every cell', () => {
  assert.deepEqual(validateComparison(valid), []);
  const index = indexCells(valid);
  assert.equal(index.size, 4);
  assert.equal(index.get(cellKey('ghost', 'default'))?.node, 'G');
});

test('validateComparison reports structural and fit problems', () => {
  assert.deepEqual(validateComparison({ ...valid, rows: [], cells: [] }), [
    'Comparison needs at least one row and one column.',
  ]);
  const wide = {
    ...valid,
    size: 'wide',
    columns: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }, { key: 'c', label: 'C' }],
    cells: ['primary', 'ghost'].flatMap((r) => ['a', 'b', 'c'].map((c) => ({ rowKey: r, columnKey: c, node: 'x' }))),
  };
  assert.deepEqual(validateComparison(wide), [
    'Grid has 3 columns; at most 2 wide columns fit a 1280px laptop. Swap the axes or use two lists.',
  ]);
  const broken = {
    ...valid,
    rows: [...valid.rows, { key: 'primary', label: 'Dup' }],
    cells: [
      { rowKey: 'primary', columnKey: 'default', node: 'P' },
      { rowKey: 'primary', columnKey: 'default', node: 'P again' },
      { rowKey: 'nope', columnKey: 'default', node: 'X' },
      { rowKey: 'ghost', columnKey: 'nope', node: 'X' },
      { rowKey: 'ghost', columnKey: 'default', node: 'G', unavailableReason: 'both' },
      { rowKey: 'ghost', columnKey: 'disabled' },
    ],
  };
  assert.deepEqual(validateComparison(broken), [
    'Duplicate row key "primary".',
    'Duplicate cell for row "primary" and column "default".',
    'Cell references undeclared row "nope".',
    'Cell references undeclared column "nope".',
    'Cell for row "ghost" and column "default" must provide exactly one of node or unavailableReason.',
    'Cell for row "ghost" and column "disabled" must provide exactly one of node or unavailableReason.',
    'Missing cell for row "primary" and column "disabled".',
  ]);
});

test('remainingStates drops states already shown as grid rows or columns', () => {
  const states = { items: [{ key: 'disabled', name: 'Disabled', node: 'd' }, { key: 'icon-only', name: 'Icon-only', node: 'i' }] };
  assert.equal(remainingStates(undefined, valid), undefined);
  assert.equal(remainingStates(states, undefined), states);
  assert.deepEqual(remainingStates(states, valid)?.items.map((item) => item.key), ['icon-only']);
  assert.equal(remainingStates({ items: [states.items[0]] }, valid), undefined);
});

test('presentationBlocks plans grid, list, grouped, preview, and empty blocks', () => {
  const base = { id: 'X', path: 'p', description: 'd' };
  const variants = { items: [{ key: 'a', name: 'A', node: 'a' }] };
  const wideVariants = { itemsFill: true, items: [{ key: 'a', name: 'A', node: 'a' }] };
  const states = { items: [{ key: 'disabled', name: 'Disabled', node: 'd' }, { key: 'icon', name: 'Icon', node: 'i', fill: true }] };
  const render = () => 'r';
  const summary = (def) => presentationBlocks(def).map((b) => [b.kind, b.title, b.size ?? null]);

  assert.deepEqual(presentationBlocks({ ...base, tokenGallery: true, render }), [{ kind: 'preview', title: 'Tokens', widths: 'full' }]);
  assert.deepEqual(presentationBlocks({ ...base, tokenGallery: true, fullWidthLabel: 'Palette', render }), [{ kind: 'preview', title: 'Palette', widths: 'full' }]);
  assert.deepEqual(presentationBlocks({ ...base, tokenGallery: true }), [{ kind: 'empty', title: 'Tokens', message: 'Nothing to preview.' }]);
  // Token sections: one block holding every section, each with its own label and card.
  const sections = [{ title: 'Semantic', render }, { title: 'Palette', desc: 'raw ramps', wide: true, render }];
  assert.deepEqual(presentationBlocks({ ...base, tokenGallery: true, tokenSections: sections, tokenColumns: 2 }), [
    { kind: 'tokenSections', title: '', sections, columns: 2 },
  ]);
  assert.deepEqual(presentationBlocks({ ...base, tokenGallery: true, tokenSections: sections }), [
    { kind: 'tokenSections', title: '', sections, columns: 1 },
  ]);

  assert.deepEqual(summary({ ...base, variants, states, comparison: valid }), [
    ['grid', 'Variant × State', 'regular'],
    ['list', 'Other configurations', 'regular'],
  ]);
  assert.deepEqual(summary({ ...base, specimenSize: 'compact', comparison: valid }), [['grid', 'Variant × State', 'compact']]);
  assert.deepEqual(summary({ ...base, comparison: { ...valid, size: 'wide' }, specimenSize: 'compact' }), [['grid', 'Variant × State', 'wide']]);
  // A lone block no longer carries an empty "No additional states" sibling.
  assert.deepEqual(summary({ ...base, variants }), [['list', 'Variants', 'regular']]);
  assert.deepEqual(summary({ ...base, variants: wideVariants, states }), [
    ['list', 'Variants', 'wide'],
    ['list', 'States / configurations', 'regular'],
  ]);
  assert.deepEqual(summary({ ...base, variants, specimenSize: 'compact' }), [['list', 'Variants', 'compact']]);
  assert.deepEqual(summary({ ...base, render }), [['preview', 'Preview', null]]);
  // Nothing documented at all: one truthful empty block.
  assert.deepEqual(presentationBlocks(base), [{ kind: 'empty', title: 'Examples', message: 'No examples documented.' }]);
  assert.deepEqual(summary({ ...base, render, hide: { states: true } }), [['preview', 'Preview', null]]);
  assert.deepEqual(summary({ ...base, variants, states, hide: { variants: true } }), [['list', 'States / configurations', 'regular']]);
  assert.deepEqual(presentationBlocks({ ...base, hide: { variants: true, states: true } }), []);
  assert.deepEqual(presentationBlocks({ ...base, hide: { variants: true } }), [], 'hiding a part never adds an empty sentence');
  assert.deepEqual(summary({ ...base, comparison: valid, states: { items: [states.items[0]] } }), [['grid', 'Variant × State', 'regular']]);

  const list = presentationBlocks({ ...base, variants: wideVariants })[0];
  assert.deepEqual(list.items, [{ key: 'a', slot: 'variants', label: 'A', node: 'a', fill: true, surface: undefined, align: undefined }]);
  assert.equal(list.kind === 'list' && list.maxColumns, 3, 'filled examples wrap at most 3 across');
});

test('component previews are phone width by default; token galleries stay full width', () => {
  const base = { id: 'X', path: 'p', description: 'd', render: () => 'r' };
  assert.equal(PREVIEW_MAX_WIDTH, 402);
  assert.deepEqual(presentationBlocks(base)[0], { kind: 'preview', title: 'Preview', widths: [402] });
  assert.deepEqual(presentationBlocks({ ...base, previewWidths: [402, 320] })[0].widths, [402, 320]);
  assert.deepEqual(presentationBlocks(base, { defaultPreviewWidths: 'full' })[0].widths, 'full');
  assert.deepEqual(presentationBlocks({ ...base, previewWidths: [402] }, { defaultPreviewWidths: 'full' })[0].widths, [402]);
  assert.deepEqual(presentationBlocks({ ...base, previewWidths: [500] })[0].widths, [402], 'never wider than a phone');
});

test('states that name their variant become grouped rows', () => {
  const base = { id: 'Loading', path: 'p', description: 'd' };
  const variants = { itemsFill: true, items: [{ key: 'circle', name: 'Circle', node: 'c' }, { key: 'linear', name: 'Linear', node: 'l' }, { key: 'dots', name: 'Dots', node: 'd' }] };
  const states = { itemsFill: true, items: [
    { key: 'small', name: 'Small', node: 's', group: 'circle' },
    { key: 'medium', name: 'Medium', node: 'm', group: 'circle' },
    { key: 'thin', name: 'Thin', node: 't', group: 'linear' },
    { key: 'accent', name: 'Accent colour', node: 'x' },
    { key: 'stray', name: 'Stray', node: 'y', group: 'nope' },
  ] };
  const blocks = presentationBlocks({ ...base, variants, states });
  assert.deepEqual(blocks.map((b) => [b.kind, b.title, b.size ?? null]), [
    ['grouped', 'Variant × configuration', 'regular'],
    ['list', 'Other configurations', 'wide'],
  ]);
  assert.deepEqual(blocks[0].groups.map((g) => [g.key, g.label, g.items.map((i) => i.key)]), [
    ['circle', 'Circle', ['small', 'medium']],
    ['linear', 'Linear', ['thin']],
    ['dots', 'Dots', ['dots']],
  ]);
  assert.deepEqual(blocks[1].items.map((i) => i.key), ['accent', 'stray']);
  // A comparison grid takes precedence over grouping.
  assert.equal(presentationBlocks({ ...base, variants, states, comparison: valid })[0].kind, 'grid');
  // hide.states keeps the plain Variants list.
  assert.deepEqual(presentationBlocks({ ...base, variants, states, hide: { states: true } }).map((b) => b.kind), ['list']);
});

test('choosePlacement keeps the shorter arrangement and prefers stacking', () => {
  const second = { kind: 'list', itemCount: 3, size: 'wide', height: 600 };
  // Dropdown at 1280: one 402px variant (≈600 tall) beside three wide states.
  assert.equal(choosePlacement({ available: 952, gap: 28, first: { kind: 'list', width: 404, height: 600 }, second: { ...second, height: 640 } }), 'side');
  // Same page at 1100: only 340px beside it, narrower than a 402px cell.
  assert.equal(choosePlacement({ available: 772, gap: 28, first: { kind: 'list', width: 404, height: 600 }, second }), 'stacked');
  // A first block that fills the width (grid, grouped, preview) never shares the row.
  assert.equal(choosePlacement({ available: 952, gap: 28, first: { kind: 'grid', width: 952, height: 500 }, second }), 'stacked');
  // Switch at 1280: beside a 402px variant, four compact states wrap to two rows — no real saving.
  assert.equal(choosePlacement({ available: 952, gap: 28, first: { kind: 'list', width: 404, height: 230 }, second: { kind: 'list', itemCount: 4, size: 'compact', height: 230 } }), 'stacked');
  // A column cap participates in the same placement calculation: four measured one-column rows
  // remain four rows beside the first block, instead of being incorrectly predicted as two.
  assert.equal(choosePlacement({ available: 952, gap: 28, first: { kind: 'list', width: 404, height: 230 }, second: { kind: 'list', itemCount: 4, size: 'compact', maxColumns: 1, height: 640 } }), 'side');
  // Two single-row blocks that both fit save a full row and go side by side.
  assert.equal(choosePlacement({ available: 952, gap: 28, first: { kind: 'list', width: 404, height: 230 }, second: { kind: 'list', itemCount: 1, size: 'wide', height: 230 } }), 'side');
  // Only lists reflow predictably beside another block.
  assert.equal(choosePlacement({ available: 952, gap: 28, first: { kind: 'list', width: 404, height: 600 }, second: { kind: 'grid', itemCount: 3, size: 'wide', height: 640 } }), 'stacked');
});

test('propsColumns uses two columns only for 4+ props with room', () => {
  assert.equal(PROPS_MIN_COLUMN_WIDTH, 360);
  assert.equal(PROPS_COLUMN_GAP, CATALOG_SPACE['2xl']);
  assert.equal(propsColumns(9, 910), 2);
  assert.equal(propsColumns(3, 910), 1);
  assert.equal(propsColumns(9, 730), 1);
  assert.equal(propsColumns(4, 752), 2);
  assert.equal(propsColumns(0, 910), 1);
});

test('referenceColumns stacks, doubles, or triples the reference panel from measured width and confirmed composition', () => {
  assert.equal(REFERENCE_MIN_COLUMN_WIDTH, 280);
  assert.equal(REFERENCE_COLUMN_GAP, CATALOG_SPACE['2xl']);
  // Unmeasured (0, before layout settles) always stacks, composition or not.
  assert.equal(referenceColumns(0, false), 1);
  assert.equal(referenceColumns(0, true), 1);
  // Too narrow even for two: AnimatedChevron's own card at the reproduced narrow band.
  assert.equal(referenceColumns(500, false), 1);
  assert.equal(referenceColumns(500, true), 1);
  // Exactly two columns' worth, no composition to show a third.
  const twoColumns = 2 * REFERENCE_MIN_COLUMN_WIDTH + REFERENCE_COLUMN_GAP;
  assert.equal(referenceColumns(twoColumns, false), 2);
  // Composition exists, but only two columns fit: it stays nested, not a separate column.
  assert.equal(referenceColumns(twoColumns, true), 2);
  // Exactly three columns' worth, with confirmed composition: Composition gets its own column.
  const threeColumns = 3 * REFERENCE_MIN_COLUMN_WIDTH + 2 * REFERENCE_COLUMN_GAP;
  assert.equal(referenceColumns(threeColumns, true), 3);
  // One px short of three stays at two.
  assert.equal(referenceColumns(threeColumns - 1, true), 2);
  // No composition never promotes to three, no matter how wide.
  assert.equal(referenceColumns(2000, false), 2);
});

// `referenceColumns`'s own width parameter is documented (above) as the card's INNER width, but
// `ReferenceDetails.tsx` previously measured its outer, padded/bordered card instead, feeding
// `referenceColumns` a width up to ~42px wider than the three columns' actual content budget
// (`CATALOG_LAYOUT.panelPadding` × 2 + the card's 1px border × 2). This pure-math assertion can't
// see that ownership mistake — the component itself is the source of truth for which node's layout
// is measured — so this is a source-level regression, supplementary to it: controller real-host
// geometry checks confirm the rendered effect.
test('ReferenceDetails measures the columns row\'s own inner width, not the padded/bordered card around it', () => {
  const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../ReferenceDetails.tsx');
  const source = readFileSync(sourcePath, 'utf8');
  assert.doesNotMatch(
    source,
    /style=\{styles\.card\}\s*onLayout=\{onLayout\}/,
    'onLayout must not sit on the padded/bordered outer card — that measures an outer width, not the inner content budget referenceColumns expects',
  );
  assert.match(
    source,
    /styles\.columns[^>]*onLayout=\{onLayout\}/s,
    'onLayout must measure the columns row itself, which excludes the card\'s own padding/border',
  );
});

// Controller-reproduced: at 1280px outer width (three-column mode), UpcomingTripCard's
// `TrainArrivalRemainingTime · built-in` composition label is long enough that, with no shrink
// allowance, the role text it shares a `Fact` row with is pushed outside the 280px column. The
// label and its value must be allowed to shrink together — `factLabel` needs its own
// `flexShrink`/`minWidth` contract, the same one `columnStyle`'s `minWidth: 0` already gives the
// column itself.
test('ReferenceDetails\' shared Fact row lets its label shrink (flexShrink: 1, minWidth: 0) instead of forcing the value outside a narrow composition column', () => {
  const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../ReferenceDetails.tsx');
  const source = readFileSync(sourcePath, 'utf8');
  const match = source.match(/factLabel:\s*\{([^}]*)\}/);
  assert.ok(match, 'factLabel style declaration not found');
  const body = match[1];
  assert.match(body, /flexShrink:\s*1/, 'factLabel must declare flexShrink: 1 so it can shrink alongside its value');
  assert.match(body, /minWidth:\s*0/, 'factLabel must declare minWidth: 0 so it can shrink below its intrinsic content width');
});

test('ReferenceDetails stacks each shared Fact label above its left-aligned value', () => {
  const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../ReferenceDetails.tsx');
  const source = readFileSync(sourcePath, 'utf8');
  const fact = source.match(/\bfact:\s*\{([^}]*)\}/)?.[1];
  const value = source.match(/\bfactValue:\s*\{([^}]*)\}/)?.[1];
  assert.ok(fact, 'shared Fact container style declaration not found');
  assert.ok(value, 'shared Fact value style declaration not found');
  assert.match(fact, /flexDirection:\s*'column'/, 'labels and descriptions must stack at every reference width');
  assert.match(fact, /gap:\s*CATALOG_SPACE\.xs/, 'use the existing tight label-to-description spacing token');
  assert.doesNotMatch(fact, /justifyContent:\s*'space-between'/, 'do not distribute vertical space between related text');
  assert.match(value, /textAlign:\s*'left'/, 'descriptions must align with their labels');
  assert.doesNotMatch(value, /\bflex:\s*1\b/, 'stacked values retain their full intrinsic text height');
});

// Controller-reproduced: every composition entry's label unconditionally appended
// "· <relationship>", so a built-in entry (composition's assumed default relationship) read
// redundantly, e.g. "TrainArrivalRemainingTime · built-in". Only built-in's suffix is redundant —
// slot/related still need their own suffix to stay distinguishable from a plain built-in entry.
test('ReferenceDetails\' composition label drops the redundant "· built-in" suffix while keeping it for slot/related, without dropping relationship metadata', () => {
  const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../ReferenceDetails.tsx');
  const source = readFileSync(sourcePath, 'utf8');
  assert.doesNotMatch(
    source,
    /label=\{`\$\{entry\.component\}\s*·\s*\$\{entry\.relationship\}`\}/,
    'label must not unconditionally append "· <relationship>" — built-in then redundantly reads "<Component> · built-in"',
  );
  assert.match(
    source,
    /entry\.relationship\s*===\s*'built-in'/,
    'the label must branch on relationship, omitting the suffix only when it is \'built-in\'',
  );
  assert.match(
    source,
    /\$\{entry\.component\}\s*·\s*\$\{entry\.relationship\}/,
    'slot/related entries must still render their own relationship suffix',
  );
  assert.match(
    source,
    /entry\.role/,
    'the Fact value must still show the composition entry\'s role — relationship metadata stays intact, only the label suffix changes',
  );
});

test('presentationBlocks carries each item\'s own surface override onto its ListItem, alongside fill', () => {
  const base = { id: 'X', path: 'p', description: 'd' };
  const variants = {
    items: [
      { key: 'a', name: 'A', node: 'a', surface: 'white' as const },
      { key: 'b', name: 'B', node: 'b' },
    ],
  };
  const [block] = presentationBlocks({ ...base, variants });
  assert.deepEqual(block.kind === 'list' ? block.items.map((i) => [i.key, i.surface]) : null, [['a', 'white'], ['b', undefined]]);
});

test('presentationBlocks carries a grouped item\'s own surface override the same way a plain list does', () => {
  const base = { id: 'X', path: 'p', description: 'd' };
  const variants = { items: [{ key: 'circle', name: 'Circle', node: 'c' }] };
  const states = { items: [{ key: 'small', name: 'Small', node: 's', group: 'circle', surface: 'neutral' as const }] };
  const [block] = presentationBlocks({ ...base, variants, states });
  assert.equal(block.kind, 'grouped');
  assert.equal(block.kind === 'grouped' ? block.groups[0].items[0].surface : undefined, 'neutral');
});

// Regression: `slotItems`/`groupStates` previously computed `item.fill || slot.itemsFill`, so an
// item's own explicit `fill: false` was silently discarded by an inherited `itemsFill: true` (`false
// || true` is `true`). Nullish (`??`) inheritance fixes it while leaving the omitted case (no
// explicit `fill` at all) exactly as it inherited before.
test('an item\'s own explicit fill: true/false always wins over an inherited itemsFill; omitted still inherits it', () => {
  const base = { id: 'X', path: 'p', description: 'd' };
  const variants = {
    itemsFill: true,
    items: [
      { key: 'explicit-false', name: 'Explicit false', node: 'a', fill: false },
      { key: 'explicit-true', name: 'Explicit true', node: 'b', fill: true },
      { key: 'omitted', name: 'Omitted', node: 'c' },
    ],
  };
  const [block] = presentationBlocks({ ...base, variants });
  assert.equal(block.kind, 'list');
  assert.deepEqual(block.kind === 'list' ? block.items.map((i) => [i.key, i.fill]) : null, [
    ['explicit-false', false],
    ['explicit-true', true],
    ['omitted', true],
  ]);

  // Same precedence inside a grouped row (states grouped under a variant key).
  const groupedVariants = { itemsFill: true, items: [{ key: 'circle', name: 'Circle', node: 'c' }] };
  const groupedStates = {
    itemsFill: true,
    items: [
      { key: 'small', name: 'Small', node: 's', group: 'circle', fill: false },
    ],
  };
  const [groupedBlock] = presentationBlocks({ ...base, variants: groupedVariants, states: groupedStates });
  assert.equal(groupedBlock.kind, 'grouped');
  assert.equal(groupedBlock.kind === 'grouped' ? groupedBlock.groups[0].items[0].fill : undefined, false);
});

// The typed per-specimen `align` override (design's required omitted contract): carried through
// alongside `fill`/`surface`, with no inheritance of its own (unlike `fill`, there is no slot-level
// "itemsAlign" to fall back to) — omitted always just stays undefined.
test('presentationBlocks carries each item\'s own align override onto its ListItem, in list and grouped shapes alike', () => {
  const base = { id: 'X', path: 'p', description: 'd' };
  const variants = {
    items: [
      { key: 'a', name: 'A', node: 'a', align: 'start' as const },
      { key: 'b', name: 'B', node: 'b' },
    ],
  };
  const [block] = presentationBlocks({ ...base, variants });
  assert.equal(block.kind, 'list');
  assert.deepEqual(block.kind === 'list' ? block.items.map((i) => [i.key, i.align]) : null, [['a', 'start'], ['b', undefined]]);

  const groupedVariants = { items: [{ key: 'circle', name: 'Circle', node: 'c' }] };
  const groupedStates = { items: [{ key: 'small', name: 'Small', node: 's', group: 'circle', align: 'end' as const }] };
  const [groupedBlock] = presentationBlocks({ ...base, variants: groupedVariants, states: groupedStates });
  assert.equal(groupedBlock.kind, 'grouped');
  assert.equal(groupedBlock.kind === 'grouped' ? groupedBlock.groups[0].items[0].align : undefined, 'end');
});
