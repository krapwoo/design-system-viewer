# Catalog Studio Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Plan only. Implementation is **not authorized**.

> **Revision pending (2026-10-06):** User answers to the decisions below — (1)(2) accepted for Button, but the matrix must be re-checked against every component type and its flexibility defined; (3) adopt the mockup's visual design and colors across the entire catalog interface (secondary text stays #666 for AA contrast; product components unchanged); (4) desktop/laptop only — drop the compact layout and drawer; (5) 44×44px accepted. A revised plan supersedes the affected tasks.

**Goal:** Replace the catalog's single long scrolling document with one selected component per page, led by a variant × state comparison matrix and followed by always-visible reference details.

**Architecture:** Two pure, unit-tested modules own the logic: `catalogNavigation.ts` (ordering, filtering, previous/next, URL fragment) and `comparison.ts` (matrix contract, validation, page presentation). Thin React Native components render them: `ComparisonMatrix`, `ReferenceDetails`, a rewritten `SectionBlock` (one page body), a compact `CatalogNavDrawer`, and a rewritten `CatalogShell` that owns the selected page instead of scroll-spy.

**Tech Stack:** Expo 57, React Native 0.86, React Native Web 0.21, TypeScript 6, Node 22 built-in test runner with `--experimental-strip-types` (no new dependency).

**Spec:** `docs/superpowers/specs/2026-10-06-catalog-studio-matrix-design.md`
**Fidelity reference:** `docs/design/2026-10-06-catalog-studio-matrix-reference.html` — SHA-256 `c58fa8a1272517682ab1e4346ba4d806c1f21c57f6280a2ebac8eb93856e90d2`

## Global Constraints

- One selected page in the main content. Never render the full component list in the main column.
- Matrix specimen columns: maximum **402px**; minimum 240px; row-header column 120px.
- Every matrix header and specimen cell: **16px** padding (`CATALOG_SPACE.lg`).
- Specimen rows: minimum height 150px (comfortable density only). No density toggle.
- Guidance and Quick Reference are always visible. No collapse control.
- No usage-location, screen-name, or navigation-step feature.
- Specimens use the real exported components. No catalog-only lookalikes. No fabricated cross-product cells.
- Catalog chrome uses only `native/catalog/tokens.ts`. No product-token imports in chrome.
- Desktop sidebar width: 264px. Compact layout at viewport width ≤ 850px.
- Catalog controls (sidebar rows, pager, Browse) have a touch target of at least 44×44px.
- Browser APIs (`window`, `document`, `history`) run only behind `Platform.OS === 'web'` and a `typeof window !== 'undefined'` guard.
- No commits, pushes, publication, or deployment. The project root is not a Git repository; the plan contains no commit steps.

## Decisions to confirm before Task 3

Each decision changes a small, isolated part of the work. The plan is written for the recommended option.

1. **Button matrix orientation.** Button has 5 variants and 3 states.
   - **Recommended:** variants as rows, states as columns ("Variant × State"). The whole matrix fits at a 1280px viewport.
   - Alternative: variants as columns, like the 3-column reference. It needs horizontal scrolling below a ~1450px viewport.
   - Impact: data only (Task 6).
2. **Button content outside the matrix** (icons, icon-only, full width, sizes).
   - **Recommended:** show them in a second "States / configurations" matrix below the main matrix. States already shown as matrix rows or columns are not repeated.
   - Alternative: drop them from the page. That removes documented behavior from the catalog.
3. **Active sidebar row color.**
   - **Recommended:** existing tokens: `surfacePressed` background, `accent` bold label.
   - Alternative: add `CATALOG_COLOR.accentSubtle = '#e9efff'` to match the reference tint exactly.
4. **Compact navigation.**
   - **Recommended:** a top bar with a "Browse" button that opens the sidebar in a drawer, with a new `CATALOG_COLOR.scrim` backdrop.
   - Alternative: an icon rail. Catalog entries have no icons, so a rail cannot label destinations.
5. **Pager button size.**
   - **Recommended:** 44×44px, to meet the spec's touch-target rule.
   - Alternative: 38×38px, as in the reference.

## Interpretations recorded (no decision needed)

- Guidance shows `whenToUse`. When it is absent, Guidance shows "No usage guidance documented." The description already appears in the page header, so repeating it would duplicate content.
- The page title uses `CATALOG_TYPE['3xl']` (32px). The reference uses 28px, which is not on the catalog type scale.
- Breadcrumb reads `<appName> / <group label>`. Some groups are Tokens, Recipes, and Reference, so "Components / …" would be false for those pages.
- Non-token `render()` sections (live demos, recipes, framework diagrams) render in a full-width "Preview" card. Token galleries keep their `fullWidthLabel ?? 'Tokens'` label and have no reference details.
- The `ComparisonMatrix` interface name in the spec is renamed `ComparisonDef`. The rendering component is named `ComparisonMatrix`. The spec is updated to match.

## File structure

| File | Action | Responsibility |
|---|---|---|
| `native/catalog/catalogNavigation.ts` | Create | Pure ordering, filtering, previous/next, fragment parsing, compact breakpoint. Owns `sortIds`. |
| `native/catalog/comparison.ts` | Create | Pure matrix layout constants, validation, legacy conversion, page presentation plan. |
| `native/catalog/__tests__/catalogNavigation.test.ts` | Create | Unit tests for navigation. |
| `native/catalog/__tests__/comparison.test.ts` | Create | Unit tests for the comparison contract and presentation. |
| `native/catalog/types.ts` | Modify | Add `ComparisonAxisItem`, `ComparisonCell`, `ComparisonDef`, `SectionDef.comparison`; re-export `sortIds`. |
| `native/catalog/ComparisonMatrix.tsx` | Create | Render one `ComparisonDef` as an accessible table. |
| `native/catalog/ReferenceDetails.tsx` | Create | Always-visible Guidance, Quick reference, Props. |
| `native/catalog/SectionBlock.tsx` | Rewrite | One page body: header, pager, presentation blocks, reference details. |
| `native/catalog/CatalogNavDrawer.tsx` | Create | Compact navigation drawer (RN `Modal`). |
| `native/catalog/CatalogSidebar.tsx` | Modify | Select a page instead of scrolling; 264px; active style; `style`/`autoFocusSearch` props. |
| `native/catalog/CatalogSearchInput.tsx` | Modify | Pass through `autoFocus`. |
| `native/catalog/CatalogShell.tsx` | Rewrite | Selected-page state, URL fragment, focus, compact layout. |
| `native/catalog/tokens.ts` | Modify | Add `CATALOG_COLOR.scrim`. |
| `native/catalog/index.ts` | Modify | Export new types. |
| `native/catalog/CatalogExample.tsx` | Modify | Button `comparison`; doc comments. |
| `native/catalog/CatalogFrameworkExample.tsx` | Modify | Truthful Shell/Sidebar/SectionBlock descriptions; demo uses `comparison`. |
| `README.md` | Modify | Replace the long-page and three-column layout description. |
| `native-preview/package.json` | Modify | Add `test:catalog` script. |

---

### Task 0: Preflight and baseline (no product edits)

**Files:** none in the project. Scratch: `$HERMES_SCRATCH/catalog-studio-matrix/` = `/Users/woohopark/.hermes/profiles/app-design/cache/scratch/catalog-studio-matrix/`

- [ ] **Step 1: Snapshot the current catalog for diff review**

```bash
SCRATCH=/Users/woohopark/.hermes/profiles/app-design/cache/scratch/catalog-studio-matrix
mkdir -p "$SCRATCH"
cd /Users/woohopark/HermesProject/Projects/design-system-viewer
cp -R native/catalog "$SCRATCH/catalog-before"
cp README.md "$SCRATCH/README-before.md"
cp native-preview/package.json "$SCRATCH/package-before.json"
```

- [ ] **Step 2: Record the typecheck baseline**

The baseline does not typecheck. Files outside `native-preview/` cannot resolve `react`/`react-native` types, so 245 errors exist before any change. Record the per-file, per-code counts.

```bash
cd /Users/woohopark/HermesProject/Projects/design-system-viewer/native-preview
npx tsc --noEmit -p . 2>&1 | grep "^../native/catalog" | sed -E 's/\(.*error (TS[0-9]+).*/ \1/' | sort | uniq -c > "$SCRATCH/tsc-before.txt"
cat "$SCRATCH/tsc-before.txt"
```

Expected: every code in the list is one of `TS2307 TS2322 TS2875 TS7006 TS7031`.

- [ ] **Step 3: Confirm the preview server**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5181/
```

Expected: `200`. If not, run `cd native-preview && CI=1 npx expo start --web --port 5181` in the background and wait for `Waiting on http://localhost:5181`.

---

### Task 1: Navigation model

**Files:**
- Create: `native/catalog/catalogNavigation.ts`
- Create: `native/catalog/__tests__/catalogNavigation.test.ts`
- Modify: `native/catalog/types.ts:142-149` (move `sortIds` out, re-export it)
- Modify: `native-preview/package.json` (`scripts`)

**Interfaces:**
- Produces: `sortIds`, `orderedIds`, `groupLabelFor`, `neighbors`, `filterGroups`, `hashForId`, `idFromHash`, `isCompactViewport`, `COMPACT_VIEWPORT_MAX_WIDTH` (signatures below).

- [ ] **Step 1: Add the test script**

In `native-preview/package.json`, add to `"scripts"`:

```json
"test:catalog": "node --experimental-strip-types --test '../native/catalog/__tests__/*.test.ts'"
```

- [ ] **Step 2: Write the failing test**

`native/catalog/__tests__/catalogNavigation.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPACT_VIEWPORT_MAX_WIDTH,
  filterGroups,
  groupLabelFor,
  hashForId,
  idFromHash,
  isCompactViewport,
  neighbors,
  orderedIds,
  sortIds,
} from '../catalogNavigation.ts';

const groups = [
  { label: 'Actions', ids: ['Pill', 'Button'] },
  { label: 'Tokens', ids: ['Spacing', 'Colors'] },
];

test('sortIds sorts alphabetically without mutating the input', () => {
  const ids = ['Pill', 'Button'];
  assert.deepEqual(sortIds(ids), ['Button', 'Pill']);
  assert.deepEqual(ids, ['Pill', 'Button']);
});

test('orderedIds follows group order, sorts within groups, dedupes, and drops unavailable ids', () => {
  assert.deepEqual(orderedIds(groups), ['Button', 'Pill', 'Colors', 'Spacing']);
  assert.deepEqual(orderedIds(groups, new Set(['Button', 'Colors', 'Spacing'])), ['Button', 'Colors', 'Spacing']);
  assert.deepEqual(orderedIds([...groups, { label: 'Again', ids: ['Button'] }]), ['Button', 'Pill', 'Colors', 'Spacing']);
});

test('groupLabelFor returns the owning group label', () => {
  assert.equal(groupLabelFor(groups, 'Colors'), 'Tokens');
  assert.equal(groupLabelFor(groups, 'Missing'), undefined);
});

test('neighbors does not wrap at either end', () => {
  const order = ['Button', 'Pill', 'Colors'];
  assert.deepEqual(neighbors(order, 'Button'), { previous: null, next: 'Pill' });
  assert.deepEqual(neighbors(order, 'Pill'), { previous: 'Button', next: 'Colors' });
  assert.deepEqual(neighbors(order, 'Colors'), { previous: 'Pill', next: null });
  assert.deepEqual(neighbors(order, 'Missing'), { previous: null, next: null });
});

test('filterGroups trims, ignores case, sorts, and drops empty groups', () => {
  assert.deepEqual(filterGroups(groups, ''), [
    { label: 'Actions', ids: ['Button', 'Pill'] },
    { label: 'Tokens', ids: ['Colors', 'Spacing'] },
  ]);
  assert.deepEqual(filterGroups(groups, '  BUT '), [{ label: 'Actions', ids: ['Button'] }]);
  assert.deepEqual(filterGroups(groups, 'co'), [{ label: 'Tokens', ids: ['Colors'] }]);
  assert.deepEqual(filterGroups(groups, 'zzz'), []);
});

test('hashForId and idFromHash round-trip and fall back to the first page', () => {
  const order = ['Button', 'Pill'];
  assert.equal(hashForId('Button'), '#Button');
  assert.equal(idFromHash(hashForId('Pill'), order), 'Pill');
  assert.equal(idFromHash('Pill', order), 'Pill');
  assert.equal(idFromHash('#Nope', order), 'Button');
  assert.equal(idFromHash('', order), 'Button');
  assert.equal(idFromHash('#%E0%A4%A', order), 'Button');
  assert.equal(idFromHash('#Button', []), undefined);
});

test('isCompactViewport switches at 850px inclusive', () => {
  assert.equal(COMPACT_VIEWPORT_MAX_WIDTH, 850);
  assert.equal(isCompactViewport(390), true);
  assert.equal(isCompactViewport(850), true);
  assert.equal(isCompactViewport(851), false);
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `cd native-preview && npm run test:catalog`
Expected: FAIL. `Cannot find module '.../native/catalog/catalogNavigation.ts'`.

- [ ] **Step 4: Implement the module**

`native/catalog/catalogNavigation.ts`:

```ts
/**
 * Pure catalog navigation logic — no React or React Native imports, so it runs under Node's test
 * runner. CatalogShell, CatalogSidebar, and SectionBlock all derive page order from here, so the
 * sidebar order, previous/next order, and fragment fallback can never drift apart.
 */
import type { NavGroup } from './types';

/** Viewports at or below this width use the compact top bar + navigation drawer. */
export const COMPACT_VIEWPORT_MAX_WIDTH = 850;

/** THE canonical within-group ordering of section ids. */
export function sortIds<TId extends string>(ids: readonly TId[]): TId[] {
  return ids.slice().sort((a, b) => a.localeCompare(b));
}

/** Every page id in sidebar order: groups in declared order, ids sorted within each group,
 *  first occurrence wins, and ids without a matching section (when `availableIds` is given) are
 *  dropped. */
export function orderedIds<TId extends string>(
  groups: readonly NavGroup<TId>[],
  availableIds?: ReadonlySet<TId>,
): TId[] {
  const seen = new Set<TId>();
  const order: TId[] = [];
  for (const group of groups) {
    for (const id of sortIds(group.ids)) {
      if (seen.has(id)) continue;
      if (availableIds && !availableIds.has(id)) continue;
      seen.add(id);
      order.push(id);
    }
  }
  return order;
}

export function groupLabelFor<TId extends string>(groups: readonly NavGroup<TId>[], id: TId): string | undefined {
  return groups.find((group) => group.ids.includes(id))?.label;
}

/** Previous and next page ids. Never wraps; null marks an unavailable direction. */
export function neighbors<TId extends string>(
  order: readonly TId[],
  id: TId,
): { previous: TId | null; next: TId | null } {
  const index = order.indexOf(id);
  if (index < 0) return { previous: null, next: null };
  return {
    previous: index > 0 ? order[index - 1] : null,
    next: index < order.length - 1 ? order[index + 1] : null,
  };
}

/** Sidebar filter: case-insensitive substring match, sorted ids, empty groups removed. */
export function filterGroups<TId extends string>(groups: readonly NavGroup<TId>[], query: string): NavGroup<TId>[] {
  const q = query.trim().toLowerCase();
  return groups
    .map((group) => ({
      label: group.label,
      ids: sortIds(q ? group.ids.filter((id) => id.toLowerCase().includes(q)) : group.ids),
    }))
    .filter((group) => group.ids.length > 0);
}

export function hashForId(id: string): string {
  return `#${encodeURIComponent(id)}`;
}

/** The page named by a URL fragment, or the first page when the fragment is empty, malformed, or
 *  unknown. Undefined only when there are no pages. */
export function idFromHash<TId extends string>(hash: string, order: readonly TId[]): TId | undefined {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  let decoded = '';
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = '';
  }
  const match = order.find((id) => id === decoded);
  return match ?? order[0];
}

export function isCompactViewport(width: number): boolean {
  return width <= COMPACT_VIEWPORT_MAX_WIDTH;
}
```

- [ ] **Step 5: Move `sortIds` ownership**

In `native/catalog/types.ts`, replace lines 142–149 (the `sortIds` doc comment and function) with:

```ts
/** Canonical within-group ordering — implemented in ./catalogNavigation (pure, unit-tested) and
 *  re-exported here so existing imports keep working. */
export { sortIds } from './catalogNavigation';
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cd native-preview && npm run test:catalog`
Expected: `ℹ pass 7`, `ℹ fail 0`.

---

### Task 2: Comparison contract and page presentation model

**Files:**
- Modify: `native/catalog/types.ts` (add types after `VariantSlot`; add `comparison` to `SectionDef`)
- Create: `native/catalog/comparison.ts`
- Create: `native/catalog/__tests__/comparison.test.ts`

**Interfaces:**
- Consumes: `SectionDef`, `VariantSlot` from `types.ts`.
- Produces: `ComparisonAxisItem`, `ComparisonCell`, `ComparisonDef` types; `MATRIX_LAYOUT`, `matrixWidthBounds(columnCount)`, `cellKey(rowKey, columnKey)`, `indexCells(def)`, `validateComparison(def): string[]`, `slotToComparison(slot, rowLabel)`, `remainingStates(states, comparison)`, `PresentationBlock`, `presentationBlocks(def): PresentationBlock[]`.

- [ ] **Step 1: Add the types**

In `native/catalog/types.ts`, insert after the `VariantSlot` interface:

```ts
/** One row or column heading in a comparison matrix. */
export interface ComparisonAxisItem {
  key: string;
  label: string;
}

/** One explicit row × column specimen. Provide exactly one of `node` (a real instance of the
 *  documented component) or `unavailableReason` (the combination is genuinely unsupported). */
export interface ComparisonCell {
  rowKey: string;
  columnKey: string;
  node?: React.ReactNode;
  unavailableReason?: string;
  /** Stretch this specimen to the cell width (wide block components). @default false */
  fill?: boolean;
}

/** An explicit two-dimensional comparison. Every row × column pair is authored — never inferred
 *  by multiplying `variants` with `states`, because pre-rendered nodes cannot be combined. */
export interface ComparisonDef {
  /** Names the row axis; shown in the corner cell (e.g. "Variant"). */
  rowLabel: string;
  /** Names the column axis (e.g. "State"). */
  columnLabel: string;
  rows: ComparisonAxisItem[];
  columns: ComparisonAxisItem[];
  cells: ComparisonCell[];
  /** Stretch every specimen to the cell width. @default false */
  itemsFill?: boolean;
}
```

In `SectionDef`, add after `states?: VariantSlot;`:

```ts
  /** The page's primary visual comparison. When set, it replaces the Variants presentation, and
   *  any `states` item whose key matches a comparison row or column key is not repeated below it.
   *  `variants`/`states` stay as data for the manifest and completeness check. */
  comparison?: ComparisonDef;
```

- [ ] **Step 2: Write the failing test**

`native/catalog/__tests__/comparison.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATRIX_LAYOUT,
  cellKey,
  indexCells,
  matrixWidthBounds,
  presentationBlocks,
  remainingStates,
  slotToComparison,
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
  assert.equal(MATRIX_LAYOUT.columnMinWidth, 240);
  assert.equal(MATRIX_LAYOUT.rowHeaderWidth, 120);
  assert.equal(MATRIX_LAYOUT.rowMinHeight, 150);
  assert.equal(MATRIX_LAYOUT.cellPadding, 16);
  assert.equal(MATRIX_LAYOUT.cellPadding, CATALOG_SPACE.lg);
});

test('matrixWidthBounds derives table bounds from the column count', () => {
  assert.deepEqual(matrixWidthBounds(3), { minWidth: 840, maxWidth: 1326 });
  assert.deepEqual(matrixWidthBounds(1), { minWidth: 360, maxWidth: 522 });
});

test('a complete comparison validates cleanly and indexes every cell', () => {
  assert.deepEqual(validateComparison(valid), []);
  const index = indexCells(valid);
  assert.equal(index.size, 4);
  assert.equal(index.get(cellKey('ghost', 'default'))?.node, 'G');
});

test('validateComparison reports structural problems', () => {
  assert.deepEqual(validateComparison({ ...valid, rows: [], cells: [] }), [
    'Comparison needs at least one row and one column.',
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

test('slotToComparison turns a single-axis slot into a one-column matrix', () => {
  const slot = { itemsFill: true, items: [{ key: 'a', name: 'A', node: 'a', fill: true }, { key: 'b', name: 'B', node: 'b' }] };
  assert.deepEqual(slotToComparison(slot, 'Variant'), {
    rowLabel: 'Variant',
    columnLabel: 'Example',
    itemsFill: true,
    rows: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
    columns: [{ key: 'example', label: 'Example' }],
    cells: [
      { rowKey: 'a', columnKey: 'example', node: 'a', fill: true },
      { rowKey: 'b', columnKey: 'example', node: 'b', fill: undefined },
    ],
  });
});

test('remainingStates drops states already shown as comparison rows or columns', () => {
  const states = { items: [{ key: 'disabled', name: 'Disabled', node: 'd' }, { key: 'icon-only', name: 'Icon-only', node: 'i' }] };
  assert.equal(remainingStates(undefined, valid), undefined);
  assert.equal(remainingStates(states, undefined), states);
  assert.deepEqual(remainingStates(states, valid)?.items.map((item) => item.key), ['icon-only']);
  assert.equal(remainingStates({ items: [states.items[0]] }, valid), undefined);
});

test('presentationBlocks plans each page shape', () => {
  const base = { id: 'X', path: 'p', description: 'd' };
  const variants = { items: [{ key: 'a', name: 'A', node: 'a' }] };
  const states = { items: [{ key: 'disabled', name: 'Disabled', node: 'd' }, { key: 'icon', name: 'Icon', node: 'i' }] };
  const render = () => 'r';

  assert.deepEqual(presentationBlocks({ ...base, tokenGallery: true, render }), [{ kind: 'preview', title: 'Tokens' }]);
  assert.deepEqual(presentationBlocks({ ...base, tokenGallery: true, fullWidthLabel: 'Palette', render }), [{ kind: 'preview', title: 'Palette' }]);
  assert.deepEqual(presentationBlocks({ ...base, tokenGallery: true }), [{ kind: 'empty', title: 'Tokens', message: 'Nothing to preview.' }]);

  const withComparison = presentationBlocks({ ...base, variants, states, comparison: valid });
  assert.deepEqual(withComparison.map((b) => [b.kind, b.title]), [['matrix', 'Variant × State'], ['matrix', 'States / configurations']]);

  assert.deepEqual(presentationBlocks({ ...base, variants }).map((b) => [b.kind, b.title]), [
    ['matrix', 'Variants'],
    ['empty', 'States / configurations'],
  ]);
  assert.deepEqual(presentationBlocks({ ...base, render }).map((b) => [b.kind, b.title]), [
    ['preview', 'Preview'],
    ['empty', 'States / configurations'],
  ]);
  assert.deepEqual(presentationBlocks(base), [
    { kind: 'empty', title: 'Variants', message: 'No variants documented.' },
    { kind: 'empty', title: 'States / configurations', message: 'No additional states or configurations documented.' },
  ]);
  assert.deepEqual(presentationBlocks({ ...base, render, hide: { states: true } }).map((b) => b.title), ['Preview']);
  assert.deepEqual(presentationBlocks({ ...base, variants, states, hide: { variants: true } }).map((b) => b.title), ['States / configurations']);
  assert.deepEqual(presentationBlocks({ ...base, comparison: { ...valid, cells: valid.cells } , states: { items: [states.items[0]] } }).map((b) => b.title), ['Variant × State']);
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `cd native-preview && npm run test:catalog`
Expected: FAIL. `Cannot find module '.../native/catalog/comparison.ts'`.

- [ ] **Step 4: Implement the module**

`native/catalog/comparison.ts`:

```ts
/**
 * Pure comparison-matrix logic — no React or React Native runtime imports, so it runs under
 * Node's test runner. ComparisonMatrix renders what this module validates; SectionBlock renders
 * the blocks `presentationBlocks` plans.
 */
import type { ComparisonCell, ComparisonDef, SectionDef, VariantSlot } from './types';

/** Approved Studio Matrix geometry. `cellPadding` equals CATALOG_SPACE.lg (asserted in tests). */
export const MATRIX_LAYOUT = {
  rowHeaderWidth: 120,
  columnMinWidth: 240,
  columnMaxWidth: 402,
  cellPadding: 16,
  rowMinHeight: 150,
} as const;

export function matrixWidthBounds(columnCount: number): { minWidth: number; maxWidth: number } {
  const n = Math.max(0, columnCount);
  return {
    minWidth: MATRIX_LAYOUT.rowHeaderWidth + n * MATRIX_LAYOUT.columnMinWidth,
    maxWidth: MATRIX_LAYOUT.rowHeaderWidth + n * MATRIX_LAYOUT.columnMaxWidth,
  };
}

export function cellKey(rowKey: string, columnKey: string): string {
  return `${rowKey}\u0000${columnKey}`;
}

/** First cell wins for a duplicated coordinate (validation reports the duplicate). */
export function indexCells(def: ComparisonDef): Map<string, ComparisonCell> {
  const index = new Map<string, ComparisonCell>();
  for (const cell of def.cells) {
    const key = cellKey(cell.rowKey, cell.columnKey);
    if (!index.has(key)) index.set(key, cell);
  }
  return index;
}

/** Human-readable problems, in a stable order: axis duplicates, then each cell in declaration
 *  order, then missing coordinates in row-major order. Empty when the matrix is complete. */
export function validateComparison(def: ComparisonDef): string[] {
  if (def.rows.length === 0 || def.columns.length === 0) {
    return ['Comparison needs at least one row and one column.'];
  }
  const issues: string[] = [];
  const rowKeys = new Set<string>();
  for (const row of def.rows) {
    if (rowKeys.has(row.key)) issues.push(`Duplicate row key "${row.key}".`);
    rowKeys.add(row.key);
  }
  const columnKeys = new Set<string>();
  for (const column of def.columns) {
    if (columnKeys.has(column.key)) issues.push(`Duplicate column key "${column.key}".`);
    columnKeys.add(column.key);
  }
  const seen = new Set<string>();
  for (const cell of def.cells) {
    const key = cellKey(cell.rowKey, cell.columnKey);
    if (seen.has(key)) {
      issues.push(`Duplicate cell for row "${cell.rowKey}" and column "${cell.columnKey}".`);
      continue;
    }
    seen.add(key);
    if (!rowKeys.has(cell.rowKey)) {
      issues.push(`Cell references undeclared row "${cell.rowKey}".`);
      continue;
    }
    if (!columnKeys.has(cell.columnKey)) {
      issues.push(`Cell references undeclared column "${cell.columnKey}".`);
      continue;
    }
    const hasNode = cell.node !== undefined;
    const hasReason = typeof cell.unavailableReason === 'string' && cell.unavailableReason.length > 0;
    if (hasNode === hasReason) {
      issues.push(`Cell for row "${cell.rowKey}" and column "${cell.columnKey}" must provide exactly one of node or unavailableReason.`);
    }
  }
  for (const rowKey of rowKeys) {
    for (const columnKey of columnKeys) {
      if (!seen.has(cellKey(rowKey, columnKey))) {
        issues.push(`Missing cell for row "${rowKey}" and column "${columnKey}".`);
      }
    }
  }
  return issues;
}

/** A single-axis slot as a one-column matrix: each item becomes a labeled row. */
export function slotToComparison(slot: VariantSlot, rowLabel: string): ComparisonDef {
  return {
    rowLabel,
    columnLabel: 'Example',
    itemsFill: slot.itemsFill,
    rows: slot.items.map((item) => ({ key: item.key, label: item.name })),
    columns: [{ key: 'example', label: 'Example' }],
    cells: slot.items.map((item) => ({ rowKey: item.key, columnKey: 'example', node: item.node, fill: item.fill })),
  };
}

/** `states` minus items whose key is already a comparison row or column. */
export function remainingStates(states: VariantSlot | undefined, comparison: ComparisonDef | undefined): VariantSlot | undefined {
  if (!states) return undefined;
  if (!comparison) return states;
  const covered = new Set([...comparison.rows.map((row) => row.key), ...comparison.columns.map((column) => column.key)]);
  const items = states.items.filter((item) => !covered.has(item.key));
  return items.length > 0 ? { ...states, items } : undefined;
}

export type PresentationBlock =
  | { kind: 'matrix'; title: string; comparison: ComparisonDef }
  | { kind: 'preview'; title: string }
  | { kind: 'empty'; title: string; message: string };

const STATES_TITLE = 'States / configurations';

/** The visual blocks of one page, in reading order. Reference details are not included. */
export function presentationBlocks<TId extends string>(def: SectionDef<TId>): PresentationBlock[] {
  if (def.tokenGallery) {
    const title = def.fullWidthLabel ?? 'Tokens';
    return [def.render ? { kind: 'preview', title } : { kind: 'empty', title, message: 'Nothing to preview.' }];
  }
  const hide = def.hide ?? {};
  const blocks: PresentationBlock[] = [];

  if (!hide.variants) {
    if (def.comparison) {
      blocks.push({ kind: 'matrix', title: `${def.comparison.rowLabel} × ${def.comparison.columnLabel}`, comparison: def.comparison });
    } else if (def.variants) {
      blocks.push({ kind: 'matrix', title: 'Variants', comparison: slotToComparison(def.variants, 'Variant') });
    } else if (def.render) {
      blocks.push({ kind: 'preview', title: 'Preview' });
    } else {
      blocks.push({ kind: 'empty', title: 'Variants', message: 'No variants documented.' });
    }
  }

  if (!hide.states) {
    const states = remainingStates(def.states, def.comparison);
    if (states) {
      blocks.push({ kind: 'matrix', title: STATES_TITLE, comparison: slotToComparison(states, 'State') });
    } else if (!def.comparison && !def.states) {
      blocks.push({ kind: 'empty', title: STATES_TITLE, message: 'No additional states or configurations documented.' });
    }
  }
  return blocks;
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd native-preview && npm run test:catalog`
Expected: `ℹ pass 14`, `ℹ fail 0`.

---

### Task 3: `ComparisonMatrix` and `ReferenceDetails`

**Files:**
- Create: `native/catalog/ComparisonMatrix.tsx`
- Create: `native/catalog/ReferenceDetails.tsx`

**Interfaces:**
- Consumes: `MATRIX_LAYOUT`, `cellKey`, `indexCells`, `matrixWidthBounds`, `validateComparison` (Task 2); `ComparisonDef`, `SectionDef` (Task 2); `PropsTable` (existing, `props: PropDef[]`).
- Produces: `ComparisonMatrix({ def, sectionId }: { def: ComparisonDef; sectionId: string })`; `ReferenceDetails<TId>({ def, stacked }: { def: SectionDef<TId>; stacked?: boolean })`.

These are presentational. They are verified in the Task 7 rendered pass. Pure logic is already tested.

- [ ] **Step 1: Create `ComparisonMatrix.tsx`**

```tsx
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { CATALOG_COLOR, CATALOG_RADIUS, CATALOG_TYPE } from './tokens';
import { MATRIX_LAYOUT, cellKey, indexCells, matrixWidthBounds, validateComparison } from './comparison';
import type { ComparisonDef } from './types';

/**
 * One explicit row × column comparison, rendered as an accessible table. Columns grow with the
 * available width up to MATRIX_LAYOUT.columnMaxWidth (402px) and never shrink below
 * columnMinWidth; when the table is wider than its container it scrolls horizontally inside this
 * region instead of widening the page. Every cell has 16px padding.
 */
export function ComparisonMatrix({ def, sectionId }: { def: ComparisonDef; sectionId: string }) {
  if (__DEV__) {
    for (const issue of validateComparison(def)) console.warn(`[Catalog] ${sectionId}: ${issue}`);
  }
  const cells = indexCells(def);
  const bounds = matrixWidthBounds(def.columns.length);
  const lastColumn = def.columns.length - 1;

  return (
    <ScrollView horizontal style={styles.scroller} contentContainerStyle={styles.scrollContent}>
      <View
        role="table"
        aria-label={`${sectionId}: ${def.rowLabel} by ${def.columnLabel}`}
        style={[styles.table, { minWidth: bounds.minWidth, maxWidth: bounds.maxWidth }]}
      >
        <View role="row" style={styles.row}>
          <View role="columnheader" style={[styles.cell, styles.rowHeader, styles.headerCell]}>
            <Text style={styles.headerText}>{def.rowLabel}</Text>
          </View>
          {def.columns.map((column, ci) => (
            <View
              key={column.key}
              role="columnheader"
              style={[styles.cell, styles.dataColumn, styles.headerCell, ci === lastColumn && styles.lastColumn]}
            >
              <Text style={styles.headerText}>{column.label}</Text>
            </View>
          ))}
        </View>

        {def.rows.map((row, ri) => (
          <View key={row.key} role="row" style={[styles.row, ri === def.rows.length - 1 && styles.lastRow]}>
            <View role="rowheader" style={[styles.cell, styles.rowHeader, styles.bodyRow]}>
              <Text style={styles.rowHeaderText}>{row.label}</Text>
            </View>
            {def.columns.map((column, ci) => {
              const cell = cells.get(cellKey(row.key, column.key));
              const fill = def.itemsFill || cell?.fill;
              return (
                <View
                  key={column.key}
                  role="cell"
                  style={[styles.cell, styles.dataColumn, styles.bodyRow, styles.specimenCell, ci === lastColumn && styles.lastColumn]}
                >
                  {cell?.node !== undefined ? (
                    <View style={fill ? styles.specimenFill : styles.specimen}>{cell.node}</View>
                  ) : (
                    <Text style={styles.unavailable}>
                      {cell?.unavailableReason ? `Not supported — ${cell.unavailableReason}` : 'Missing example'}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
  scrollContent: { flexGrow: 1 },
  table: {
    width: '100%',
    backgroundColor: CATALOG_COLOR.surface,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderHairline,
    borderRadius: CATALOG_RADIUS.md,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: CATALOG_COLOR.border },
  lastRow: { borderBottomWidth: 0 },
  cell: { padding: MATRIX_LAYOUT.cellPadding, borderRightWidth: 1, borderRightColor: CATALOG_COLOR.border },
  lastColumn: { borderRightWidth: 0 },
  rowHeader: {
    width: MATRIX_LAYOUT.rowHeaderWidth,
    flexShrink: 0,
    justifyContent: 'center',
    backgroundColor: CATALOG_COLOR.surfaceMuted,
  },
  dataColumn: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: MATRIX_LAYOUT.columnMinWidth,
    minWidth: MATRIX_LAYOUT.columnMinWidth,
    maxWidth: MATRIX_LAYOUT.columnMaxWidth,
  },
  headerCell: { backgroundColor: CATALOG_COLOR.surfaceMuted },
  bodyRow: { minHeight: MATRIX_LAYOUT.rowMinHeight },
  specimenCell: { alignItems: 'center', justifyContent: 'center' },
  specimen: { alignItems: 'center' },
  specimenFill: { alignSelf: 'stretch' },
  headerText: {
    fontSize: CATALOG_TYPE.xs,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: CATALOG_COLOR.text,
  },
  rowHeaderText: { fontSize: CATALOG_TYPE.sm, fontWeight: '700', color: CATALOG_COLOR.text },
  unavailable: { fontSize: CATALOG_TYPE.sm, fontStyle: 'italic', color: CATALOG_COLOR.textMuted, textAlign: 'center' },
});
```

- [ ] **Step 2: Create `ReferenceDetails.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CATALOG_COLOR, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TYPE } from './tokens';
import { PropsTable } from './PropsTable';
import type { SectionDef } from './types';

// react-native-web reads `aria-level`; React Native's prop types do not declare it.
const HEADING_LEVEL_2 = { 'aria-level': 2 } as Record<string, unknown>;

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

/**
 * Always-visible reference below a page's visual comparison: Guidance (the deciding `whenToUse`
 * sentence), Quick reference (source path, accessibility), then the full Props table. There is no
 * collapse control by design. `def.hide.props` / `def.hide.accessibility` remove those parts.
 */
export function ReferenceDetails<TId extends string>({ def, stacked = false }: { def: SectionDef<TId>; stacked?: boolean }) {
  const hide = def.hide ?? {};
  return (
    <View style={styles.card}>
      <View style={[styles.columns, stacked && styles.columnsStacked]}>
        <View style={styles.column}>
          <Text role="heading" {...HEADING_LEVEL_2} style={styles.heading}>Guidance</Text>
          <Text style={styles.body}>{def.whenToUse ?? 'No usage guidance documented.'}</Text>
        </View>
        <View style={styles.column}>
          <Text role="heading" {...HEADING_LEVEL_2} style={styles.heading}>Quick reference</Text>
          <Fact label="Source" value={def.path} mono />
          {!hide.accessibility && <Fact label="Accessibility" value={def.a11y ?? 'No accessibility notes documented.'} />}
        </View>
      </View>
      {!hide.props && (
        <View style={styles.props}>
          <Text role="heading" {...HEADING_LEVEL_2} style={styles.heading}>Props</Text>
          {def.props && def.props.length > 0 ? (
            <PropsTable props={def.props} />
          ) : (
            <Text style={styles.empty}>This component takes no props.</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CATALOG_COLOR.surface,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderHairline,
    borderRadius: CATALOG_RADIUS.md,
    padding: CATALOG_SPACE.xl,
    gap: CATALOG_SPACE.xl,
  },
  columns: { flexDirection: 'row', gap: CATALOG_SPACE['2xl'] },
  columnsStacked: { flexDirection: 'column', gap: CATALOG_SPACE.xl },
  column: { flex: 1, gap: CATALOG_SPACE.sm },
  heading: {
    fontSize: CATALOG_TYPE.sm,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: CATALOG_COLOR.text,
  },
  body: { fontSize: CATALOG_TYPE.md, lineHeight: 20, color: CATALOG_COLOR.textMuted },
  fact: {
    gap: CATALOG_SPACE.xs,
    paddingVertical: CATALOG_SPACE.sm,
    borderBottomWidth: 1,
    borderBottomColor: CATALOG_COLOR.border,
  },
  factLabel: { fontSize: CATALOG_TYPE.sm, fontWeight: '700', color: CATALOG_COLOR.text },
  factValue: { fontSize: CATALOG_TYPE.sm, lineHeight: 18, color: CATALOG_COLOR.textMuted },
  mono: { fontFamily: CATALOG_COLOR.code },
  props: { gap: CATALOG_SPACE.sm },
  empty: { fontSize: CATALOG_TYPE.sm, fontStyle: 'italic', color: CATALOG_COLOR.textMuted },
});
```

- [ ] **Step 3: Confirm the Metro web bundle still compiles**

Neither file is imported yet. Run `cd native-preview && npm run test:catalog` (expected: still `ℹ pass 14`). Compile checks happen in Task 5, when the files are wired in.

---

### Task 4: `SectionBlock` as one page body

**Files:**
- Rewrite: `native/catalog/SectionBlock.tsx`

**Interfaces:**
- Consumes: `presentationBlocks`, `PresentationBlock` (Task 2); `ComparisonMatrix`, `ReferenceDetails` (Task 3).
- Produces:

```ts
export interface SectionPager<TId extends string> {
  previousId: TId | null;
  nextId: TId | null;
  onNavigate: (id: TId) => void;
}
export function SectionBlock<TId extends string>(props: {
  def: SectionDef<TId>;
  groupLabel?: string;
  breadcrumbRoot?: string;
  pager?: SectionPager<TId>;
  headingRef?: React.Ref<View>;
  headingLevel?: 1 | 2;
  compact?: boolean;
}): React.JSX.Element;
```

- [ ] **Step 1: Replace the file contents**

Keep the existing `STRING_LITERAL_RE` and `checkCompleteness` (current lines 51–82) verbatim. Replace everything else:

```tsx
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CATALOG_TYPE, CATALOG_COLOR, CATALOG_SPACE, CATALOG_RADIUS } from './tokens';
import { ComparisonMatrix } from './ComparisonMatrix';
import { ReferenceDetails } from './ReferenceDetails';
import { presentationBlocks, type PresentationBlock } from './comparison';
import type { SectionDef } from './types';

/* ── keep STRING_LITERAL_RE and checkCompleteness() here, unchanged ── */

export interface SectionPager<TId extends string> {
  previousId: TId | null;
  nextId: TId | null;
  onNavigate: (id: TId) => void;
}

function PagerButton<TId extends string>({
  direction,
  targetId,
  onNavigate,
}: {
  direction: 'previous' | 'next';
  targetId: TId | null;
  onNavigate: (id: TId) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const disabled = targetId == null;
  const label = disabled
    ? direction === 'previous' ? 'No previous page' : 'No next page'
    : `${direction === 'previous' ? 'Previous' : 'Next'}: ${targetId}`;
  return (
    <Pressable
      onPress={() => {
        if (targetId != null) onNavigate(targetId);
      }}
      disabled={disabled}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.pagerButton,
        !disabled && (pressed || hovered) && styles.pagerButtonActive,
        focused && styles.pagerButtonFocused,
        disabled && styles.pagerButtonDisabled,
      ]}
    >
      <Text style={[styles.pagerGlyph, disabled && styles.pagerGlyphDisabled]}>
        {direction === 'previous' ? '←' : '→'}
      </Text>
    </Pressable>
  );
}

function BlockContent<TId extends string>({ block, def }: { block: PresentationBlock; def: SectionDef<TId> }) {
  if (block.kind === 'matrix') return <ComparisonMatrix def={block.comparison} sectionId={def.id} />;
  if (block.kind === 'preview') return <View style={styles.card}>{def.render?.()}</View>;
  return (
    <View style={styles.card}>
      <Text style={styles.emptyText}>{block.message}</Text>
    </View>
  );
}

/**
 * One catalog page: breadcrumb, title, description, previous/next, then the page's visual blocks
 * (an explicit comparison matrix, single-axis matrices built from `variants`/`states`, or a
 * full-width preview for `render()` and token galleries), then always-visible reference details.
 * Works standalone (no pager) inside a host page, as the framework catalog's own demo does.
 */
export function SectionBlock<TId extends string>({
  def,
  groupLabel,
  breadcrumbRoot,
  pager,
  headingRef,
  headingLevel = 1,
  compact = false,
}: {
  def: SectionDef<TId>;
  groupLabel?: string;
  breadcrumbRoot?: string;
  pager?: SectionPager<TId>;
  headingRef?: React.Ref<View>;
  headingLevel?: 1 | 2;
  compact?: boolean;
}) {
  checkCompleteness(def);
  const blocks = presentationBlocks(def);
  // react-native-web reads `aria-level`; React Native's prop types do not declare it.
  const headingLevelProps = { 'aria-level': headingLevel } as Record<string, unknown>;

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          {groupLabel && (
            <Text style={styles.breadcrumb}>{breadcrumbRoot ? `${breadcrumbRoot} / ${groupLabel}` : groupLabel}</Text>
          )}
          <View ref={headingRef} tabIndex={-1} style={styles.headingTarget}>
            <Text role="heading" {...headingLevelProps} style={[styles.title, compact && styles.titleCompact]}>
              {def.id}
            </Text>
          </View>
          <Text style={styles.desc}>{def.description}</Text>
        </View>
        {pager && (
          <View style={styles.pager}>
            <PagerButton direction="previous" targetId={pager.previousId} onNavigate={pager.onNavigate} />
            <PagerButton direction="next" targetId={pager.nextId} onNavigate={pager.onNavigate} />
          </View>
        )}
      </View>

      {blocks.map((block) => (
        <View key={block.title} style={styles.block}>
          <Text style={styles.blockLabel}>{block.title}</Text>
          <BlockContent block={block} def={def} />
        </View>
      ))}

      {!def.tokenGallery && <ReferenceDetails def={def} stacked={compact} />}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: CATALOG_SPACE['2xl'] },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: CATALOG_SPACE.xl },
  headerText: { flex: 1, gap: CATALOG_SPACE.sm },
  breadcrumb: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted },
  headingTarget: { alignSelf: 'flex-start' },
  title: { fontSize: CATALOG_TYPE['3xl'], fontWeight: '800', letterSpacing: -0.5, color: CATALOG_COLOR.text },
  titleCompact: { fontSize: CATALOG_TYPE['2xl'] },
  desc: { fontSize: CATALOG_TYPE.md, lineHeight: 20, color: CATALOG_COLOR.textMuted, maxWidth: 720 },
  pager: { flexDirection: 'row', gap: CATALOG_SPACE.sm, flexShrink: 0 },
  pagerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CATALOG_RADIUS.sm,
    borderWidth: 2,
    borderColor: CATALOG_COLOR.borderHairline,
    backgroundColor: CATALOG_COLOR.surface,
  },
  pagerButtonActive: { backgroundColor: CATALOG_COLOR.surfacePressed },
  pagerButtonFocused: { borderColor: CATALOG_COLOR.accent },
  pagerButtonDisabled: { backgroundColor: CATALOG_COLOR.pageBackground },
  pagerGlyph: { fontSize: CATALOG_TYPE.lg, color: CATALOG_COLOR.text },
  pagerGlyphDisabled: { color: CATALOG_COLOR.textMuted },
  block: { gap: CATALOG_SPACE.sm },
  blockLabel: {
    fontSize: CATALOG_TYPE.sm,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: CATALOG_COLOR.text,
  },
  card: {
    backgroundColor: CATALOG_COLOR.surface,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderHairline,
    borderRadius: CATALOG_RADIUS.md,
    padding: CATALOG_SPACE.xl,
    gap: CATALOG_SPACE.md,
  },
  emptyText: { fontSize: CATALOG_TYPE.sm, fontStyle: 'italic', color: CATALOG_COLOR.textMuted },
});
```

- [ ] **Step 2: Run unit tests**

Run: `cd native-preview && npm run test:catalog`
Expected: `ℹ pass 14`, `ℹ fail 0`.

---

### Task 5: Shell, sidebar, search, and compact drawer

All files in this task are coupled through the selected-page contract. They have **one writer**.

**Files:**
- Modify: `native/catalog/tokens.ts` (`CATALOG_COLOR`)
- Modify: `native/catalog/CatalogSearchInput.tsx`
- Modify: `native/catalog/CatalogSidebar.tsx`
- Create: `native/catalog/CatalogNavDrawer.tsx`
- Rewrite: `native/catalog/CatalogShell.tsx`
- Modify: `native/catalog/index.ts`

**Interfaces:**
- Consumes: `filterGroups`, `orderedIds`, `groupLabelFor`, `neighbors`, `hashForId`, `idFromHash`, `isCompactViewport` (Task 1); `SectionBlock`, `SectionPager` (Task 4).
- Produces: `CatalogShell` (same public props: `appName`, `title`, `groups`, `sections`); `CatalogSidebar` gains `style?: StyleProp<ViewStyle>` and `autoFocusSearch?: boolean`, and `active` becomes `TId | undefined`; `CatalogNavDrawer({ open, onClose, children })`.

- [ ] **Step 1: Add the scrim token**

In `native/catalog/tokens.ts`, inside `CATALOG_COLOR` after `chip`:

```ts
  // Backdrop behind the compact navigation drawer — dims the page without hiding it.
  scrim: 'rgba(0,0,0,0.32)',
```

- [ ] **Step 2: Pass `autoFocus` through the search input**

In `native/catalog/CatalogSearchInput.tsx`, add `autoFocus = false` to the destructured props and `autoFocus?: boolean;` to the props type. Add `autoFocus={autoFocus}` to the `<TextInput>`.

- [ ] **Step 3: Update `CatalogSidebar.tsx`**

1. Replace the imports with:

```tsx
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { CATALOG_TYPE, CATALOG_COLOR, CATALOG_SPACE, CATALOG_RADIUS } from './tokens';
import { filterGroups } from './catalogNavigation';
import type { NavGroup } from './types';
import { CatalogSearchInput } from './CatalogSearchInput';
```

2. In `NavItem`, change the Pressable `style` to:

```tsx
style={({ pressed }) => [
  styles.item,
  active && styles.itemActive,
  (pressed || hovered) && styles.itemPressed,
  focused && styles.itemFocused,
]}
```

3. Replace the `CatalogSidebar` function with:

```tsx
/**
 * Catalog navigation: app name/caption, a filter box, and one link per page, grouped under
 * labeled headings. Selecting a link replaces the main page (CatalogShell owns which page is
 * shown). The filter narrows this list only; it never changes the open page.
 */
export function CatalogSidebar<TId extends string>({
  logo,
  caption,
  groups,
  active,
  onPress,
  style,
  autoFocusSearch = false,
}: {
  logo: string;
  caption: string;
  groups: NavGroup<TId>[];
  active: TId | undefined;
  onPress: (id: TId) => void;
  style?: StyleProp<ViewStyle>;
  autoFocusSearch?: boolean;
}) {
  const [query, setQuery] = useState('');
  const filtered = filterGroups(groups, query);

  return (
    <View role="navigation" aria-label="Catalog pages" style={[styles.sidebar, style]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.logo}>{logo}</Text>
        <Text style={styles.subtitle}>{caption}</Text>

        <CatalogSearchInput value={query} onChangeText={setQuery} placeholder="Filter components…" autoFocus={autoFocusSearch} />

        {filtered.length === 0 && <Text style={styles.empty}>No matches</Text>}
        {filtered.map((group) => (
          <View key={group.label}>
            <View style={styles.groupLabelRow}>
              <Text style={styles.groupLabel}>{group.label}</Text>
            </View>
            {group.ids.map((id) => (
              <NavItem key={id} id={id} active={active === id} onPress={() => onPress(id)} />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
```

4. In `styles`: change `sidebar.width` from `240` to `264`. Replace `item`, `itemPressed`, and `labelActive`, and add `itemActive` and `itemFocused`:

```ts
  item: { minHeight: 44, justifyContent: 'center', borderRadius: CATALOG_RADIUS.sm, borderWidth: 2, borderColor: 'transparent', marginBottom: 2 },
  itemActive: { backgroundColor: CATALOG_COLOR.surfacePressed },
  itemPressed: { backgroundColor: CATALOG_COLOR.surfacePressed },
  itemFocused: { borderColor: CATALOG_COLOR.accent },
  labelActive: { color: CATALOG_COLOR.accent, fontWeight: '700' },
```

- [ ] **Step 4: Create `CatalogNavDrawer.tsx`**

```tsx
import React from 'react';
import { Modal, View, Pressable, StyleSheet } from 'react-native';
import { CATALOG_COLOR } from './tokens';

/**
 * Compact-viewport navigation drawer. Built on React Native's Modal: on web, react-native-web
 * traps focus inside it, closes it on Escape (onRequestClose), and returns focus to the element
 * that opened it; on Android, the back button calls onRequestClose. No animation, so there is
 * nothing to reduce for reduced-motion users.
 */
export function CatalogNavDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.panel} aria-modal accessibilityViewIsModal>
          {children}
        </View>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close navigation"
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  panel: {
    width: 300,
    maxWidth: '85%',
    height: '100%',
    backgroundColor: CATALOG_COLOR.surface,
    borderRightWidth: 1,
    borderRightColor: CATALOG_COLOR.borderHairline,
  },
  backdrop: { flex: 1, backgroundColor: CATALOG_COLOR.scrim },
});
```

- [ ] **Step 5: Rewrite `CatalogShell.tsx`**

```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CATALOG_COLOR, CATALOG_MAX_CONTENT_WIDTH, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TYPE } from './tokens';
import { CatalogSidebar } from './CatalogSidebar';
import { CatalogNavDrawer } from './CatalogNavDrawer';
import { SectionBlock } from './SectionBlock';
import { groupLabelFor, hashForId, idFromHash, isCompactViewport, neighbors, orderedIds } from './catalogNavigation';
import type { NavGroup, SectionDef } from './types';

function isWeb(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

/** Move focus to a page heading after navigation without scrolling the page on web. */
function focusElement(node: View | null): void {
  if (!node) return;
  if (Platform.OS === 'web') {
    (node as unknown as { focus?: (options?: { preventScroll?: boolean }) => void }).focus?.({ preventScroll: true });
    return;
  }
  const handle = findNodeHandle(node);
  if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
}

/** Return the main column to the top for a newly opened page. On web, react-native-web's
 *  ScrollView.scrollTo does not reliably move a nested overflow container, so set scrollTop on
 *  the real scrollable DOM node. */
function resetMainScroll(scrollView: ScrollView | null): void {
  if (!scrollView) return;
  if (Platform.OS === 'web') {
    const node = (scrollView as unknown as { getScrollableNode?: () => HTMLElement | null }).getScrollableNode?.();
    if (node) {
      node.scrollTop = 0;
      return;
    }
  }
  scrollView.scrollTo({ y: 0, animated: false });
}

/**
 * The whole catalog: a persistent, searchable sidebar plus ONE selected page. Selecting a page
 * replaces the main content (no long scrolling document, no scroll-spy). On web the selected page
 * lives in the URL fragment (`#Button`), so refresh, deep links, and back/forward work; unknown
 * fragments fall back to the first page. At ≤850px the sidebar moves into a drawer behind a
 * "Browse" button.
 */
export function CatalogShell<TId extends string>({
  appName,
  title,
  groups,
  sections,
}: {
  /** Short product/app name — the sidebar logo and the breadcrumb root. */
  appName: string;
  /** What this catalog is (e.g. "Component Catalog") — the sidebar caption. */
  title: string;
  groups: NavGroup<TId>[];
  sections: SectionDef<TId>[];
}) {
  const sectionsById = useMemo(() => new Map(sections.map((def) => [def.id, def])), [sections]);
  const order = useMemo(() => orderedIds(groups, new Set(sectionsById.keys())), [groups, sectionsById]);
  const [active, setActive] = useState<TId | undefined>(() =>
    isWeb() ? idFromHash(window.location.hash, order) : order[0],
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { width } = useWindowDimensions();
  const compact = isCompactViewport(width);

  const scrollRef = useRef<ScrollView>(null);
  const headingRef = useRef<View>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const pushHistoryNext = useRef(false);
  const focusHeadingNext = useRef(false);

  const select = useCallback((id: TId) => {
    setDrawerOpen(false);
    if (id === activeRef.current) {
      focusElement(headingRef.current);
      return;
    }
    pushHistoryNext.current = true;
    focusHeadingNext.current = true;
    setActive(id);
  }, []);

  // Back/forward and manual fragment edits.
  useEffect(() => {
    if (!isWeb()) return;
    const onHashChange = () => {
      const id = idFromHash(window.location.hash, order);
      if (id !== undefined && id !== activeRef.current) {
        focusHeadingNext.current = true;
        setActive(id);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [order]);

  // After every page change: sync the fragment, return to the top, and move focus when the user
  // navigated (never on first load).
  useEffect(() => {
    if (active === undefined) return;
    const push = pushHistoryNext.current;
    const focus = focusHeadingNext.current;
    pushHistoryNext.current = false;
    focusHeadingNext.current = false;
    if (isWeb()) {
      const expected = hashForId(active);
      if (window.location.hash !== expected) {
        if (push) window.location.hash = expected;
        else window.history.replaceState(null, '', expected);
      }
    }
    resetMainScroll(scrollRef.current);
    if (focus) focusElement(headingRef.current);
  }, [active]);

  const activeDef = active !== undefined ? sectionsById.get(active) : undefined;
  const sidebarProps = { logo: appName, caption: title, groups, active, onPress: select };

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        {!compact && <CatalogSidebar {...sidebarProps} />}

        <View style={styles.mainColumn}>
          {compact && (
            <View style={styles.compactBar}>
              <Text style={styles.compactTitle} numberOfLines={1}>{appName}</Text>
              <Pressable
                onPress={() => setDrawerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Browse catalog pages"
                aria-expanded={drawerOpen}
                style={({ pressed }) => [styles.browseButton, pressed && styles.browseButtonPressed]}
              >
                <Text style={styles.browseLabel}>Browse</Text>
              </Pressable>
            </View>
          )}

          <ScrollView
            ref={scrollRef}
            style={styles.main}
            contentContainerStyle={[styles.mainContent, compact && styles.mainContentCompact]}
          >
            {activeDef ? (
              <SectionBlock
                key={activeDef.id}
                def={activeDef}
                groupLabel={groupLabelFor(groups, activeDef.id)}
                breadcrumbRoot={appName}
                pager={{ ...neighbors(order, activeDef.id), onNavigate: select }}
                headingRef={headingRef}
                compact={compact}
              />
            ) : (
              <Text style={styles.empty}>No catalog pages are available.</Text>
            )}
          </ScrollView>
        </View>

        {compact && (
          <CatalogNavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            <CatalogSidebar {...sidebarProps} style={styles.drawerSidebar} autoFocusSearch />
          </CatalogNavDrawer>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: CATALOG_COLOR.pageBackground },
  mainColumn: { flex: 1, minWidth: 0 },
  compactBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: CATALOG_SPACE.md,
    paddingHorizontal: CATALOG_SPACE.lg,
    paddingVertical: CATALOG_SPACE.sm,
    backgroundColor: CATALOG_COLOR.surface,
    borderBottomWidth: 1,
    borderBottomColor: CATALOG_COLOR.borderHairline,
  },
  compactTitle: { flex: 1, fontSize: CATALOG_TYPE.lg, fontWeight: '700', color: CATALOG_COLOR.text },
  browseButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: CATALOG_SPACE.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CATALOG_RADIUS.sm,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderHairline,
    backgroundColor: CATALOG_COLOR.surface,
  },
  browseButtonPressed: { backgroundColor: CATALOG_COLOR.surfacePressed },
  browseLabel: { fontSize: CATALOG_TYPE.md, fontWeight: '600', color: CATALOG_COLOR.text },
  main: { flex: 1 },
  mainContent: {
    width: '100%',
    maxWidth: CATALOG_MAX_CONTENT_WIDTH,
    paddingHorizontal: CATALOG_SPACE['2xl'],
    paddingTop: CATALOG_SPACE['2xl'],
    paddingBottom: CATALOG_SPACE['3xl'],
  },
  mainContentCompact: { paddingHorizontal: CATALOG_SPACE.lg, paddingTop: CATALOG_SPACE.xl },
  drawerSidebar: { position: 'relative', top: 0, width: '100%', height: '100%', borderRightWidth: 0 },
  empty: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.textMuted },
});
```

- [ ] **Step 6: Export the new public types**

In `native/catalog/index.ts`, replace the `types` export line with:

```ts
export type { PropDef, SectionDef, NavGroup, ComparisonDef, ComparisonCell, ComparisonAxisItem } from './types';
```

- [ ] **Step 7: Run unit tests and confirm the web bundle compiles**

```bash
cd native-preview && npm run test:catalog
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5181/
```

Expected: `ℹ pass 14`, `ℹ fail 0`, `200`. Then load `http://localhost:5181/` in the controlled browser. Expected: Button page renders and there is no red-box or Metro bundling error.

- [ ] **Step 8: Typecheck delta**

```bash
cd native-preview
npx tsc --noEmit -p . 2>&1 | grep "^../native/catalog" | sed -E 's/\(.*error (TS[0-9]+).*/ \1/' | sort | uniq -c > "$SCRATCH/tsc-after.txt"
npx tsc --noEmit -p . 2>&1 | grep "^../native/catalog" | grep -v -E "TS2307|TS2322|TS2875|TS7006|TS7031" || echo "no new error classes"
```

Expected: `no new error classes`. Any other code in a touched or new file blocks the task. Count changes in the five allowed codes are expected, because new files hit the same pre-existing module-resolution failure.

---

### Task 6: Button comparison, framework catalog truth, and README

**Files:**
- Modify: `native/catalog/CatalogExample.tsx` (header comment lines 1–21; Button section ~line 997; `CatalogExample` comment ~line 2770)
- Modify: `native/catalog/CatalogFrameworkExample.tsx` (lines 138–149, 166–196, 271–296)
- Modify: `README.md` (lines 68–106 and 116–135)

**Interfaces:**
- Consumes: `ComparisonDef` (Task 2); `SectionBlock` `headingLevel` prop (Task 4).

- [ ] **Step 1: Add the Button comparison**

In `CatalogExample.tsx`, add `import type { ButtonVariant } from '../components/Button';` after the `'../components'` import (the barrel `../components` does not re-export it). After the `demo` StyleSheet, add:

```tsx
// Button's explicit Variant × State comparison. Every cell is a real <Button> with exactly the
// props its row and column name. `white` keeps the dark backdrop its variant requires.
const BUTTON_VARIANT_ROWS: { key: ButtonVariant; label: string }[] = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'tertiary', label: 'Tertiary' },
  { key: 'white', label: 'White' },
  { key: 'ghost', label: 'Ghost' },
];
const BUTTON_STATE_COLUMNS = [
  { key: 'default', label: 'Default' },
  { key: 'disabled', label: 'Disabled' },
  { key: 'loading', label: 'Loading' },
] as const;

function buttonSpecimen(variant: ButtonVariant, state: (typeof BUTTON_STATE_COLUMNS)[number]['key']) {
  const button = (
    <Button
      label="Continue"
      variant={variant}
      disabled={state === 'disabled'}
      loading={state === 'loading'}
      onPress={() => {}}
    />
  );
  return variant === 'white' ? <View style={demo.darkBackdrop}>{button}</View> : button;
}
```

In the Button `SectionDef`, add after `states: { … },`:

```tsx
    comparison: {
      rowLabel: 'Variant',
      columnLabel: 'State',
      rows: BUTTON_VARIANT_ROWS.map(({ key, label }) => ({ key, label })),
      columns: BUTTON_STATE_COLUMNS.map(({ key, label }) => ({ key, label })),
      cells: BUTTON_VARIANT_ROWS.flatMap((row) =>
        BUTTON_STATE_COLUMNS.map((column) => ({
          rowKey: row.key,
          columnKey: column.key,
          node: buttonSpecimen(row.key, column.key),
        })),
      ),
    },
```

Keep `variants` and `states` unchanged. They still feed the manifest and the completeness check, and `states` items `loading`/`disabled` are hidden on the page because they match comparison columns.

- [ ] **Step 2: Correct catalog prose in `CatalogExample.tsx`**

- Header comment, line 9–10: replace "which owns all the layout, scrolling, filtering, and scroll-spy" with "which owns navigation, filtering, and showing one selected page at a time".
- Comment above `export function CatalogExample()`: replace "CatalogShell owns layout, scrolling, filtering, and scroll-spy" with "CatalogShell owns navigation, filtering, and the one-page layout".

- [ ] **Step 3: Update `CatalogFrameworkExample.tsx`**

1. In `ShellDiagram`, change `<Text style={demo.diagramPageTitle}>Component Catalog</Text>` to `<Text style={demo.diagramPageTitle}>Pill</Text>` (the diagram's active nav item, shown as the one open page).
2. In `mockSectionDef`, add after `states`:

```tsx
  comparison: {
    rowLabel: 'Variant',
    columnLabel: 'State',
    rows: [{ key: 'a', label: 'A (default)' }, { key: 'b', label: 'B' }],
    columns: [{ key: 'default', label: 'Default' }, { key: 'disabled', label: 'Disabled' }],
    cells: [
      { rowKey: 'a', columnKey: 'default', node: <Text style={demo.mockText}>A</Text> },
      { rowKey: 'a', columnKey: 'disabled', node: <Text style={demo.mockText}>A, disabled</Text> },
      { rowKey: 'b', columnKey: 'default', node: <Text style={demo.mockText}>B</Text> },
      { rowKey: 'b', columnKey: 'disabled', unavailableReason: 'B has no disabled look' },
    ],
  },
```

3. Change `SectionBlockDemo` to `return <SectionBlock def={mockSectionDef} headingLevel={2} />;`
4. Replace the three `description` strings:

```ts
// CatalogShell
'The whole catalog — a persistent, searchable sidebar plus one selected page. Selecting a page replaces the main content; on web the page is kept in the URL fragment (#Button) so refresh, deep links, and back/forward work. At 850px and below, the sidebar moves into a drawer behind a Browse button. You\'re reading a live CatalogShell right now.'
// CatalogSidebar
'Catalog navigation: logo/caption, a filter box, and grouped links, one per page. Selecting a link opens that page; the filter narrows this list only and never changes the open page. Used internally by CatalogShell (and inside its compact drawer).'
// SectionBlock
'One catalog page: breadcrumb, title, description, previous/next, then the visual comparison — an explicit `comparison` matrix (rows × columns of real instances, columns up to 402px, 16px cell padding), or single-axis matrices built from `variants`/`states`, or a full-width preview for `render()` and token galleries — then always-visible Guidance, Quick reference, and Props. `hide` removes specific parts. The demo below is a standalone SectionBlock with a mock comparison, including one genuinely unsupported cell.'
```

- [ ] **Step 4: Update `README.md`**

1. Replace the paragraph block from "`SectionBlock` renders one of two fixed layouts:" through "…like `ColorsGallery`'s own two swatch groups." (lines 81–95) with:

```markdown
  Each catalog shows **one page at a time**: a persistent, searchable sidebar and the selected
  page. On web the page is kept in the URL fragment (`#Button`). At 850px and below, the sidebar
  moves into a drawer behind a **Browse** button. `SectionBlock` renders one page: breadcrumb,
  title, description, previous/next, then the visual comparison, then always-visible
  **Guidance**, **Quick reference** (source path, accessibility), and **Props**. The visual
  comparison is, in priority order: an explicit `comparison` matrix; single-axis matrices built
  from `variants` and `states`; a full-width **Preview** for `render()`; or a **Tokens** gallery
  for `tokenGallery` sections. Matrix columns grow up to 402px and every cell has 16px padding.
```

2. In "Adding a component (the recipe)", replace "`SectionBlock` always shows four sections — Variants, States, Props, Accessibility — so give it whichever of these two fields actually apply:" with:

```markdown
`SectionBlock` shows the visual comparison first, then Guidance, Quick reference, and Props. For
the comparison, give it whichever of these fields actually apply:
- `comparison: { rowLabel, columnLabel, rows, columns, cells }` — the preferred form when two
  axes genuinely combine (e.g. Button's Variant × State). Author every row × column cell with a
  real instance, or an `unavailableReason` when that combination is genuinely unsupported. Never
  multiply `variants` by `states` to fill it. `states` items whose key matches a row or column key
  are not repeated below the matrix.
```

Keep the existing `variants`/`states` bullets after this new bullet.

- [ ] **Step 5: Run unit tests and reload the catalog**

```bash
cd native-preview && npm run test:catalog
```

Expected: `ℹ pass 14`, `ℹ fail 0`. Reload `http://localhost:5181/#Button` and `http://localhost:5181/?catalog=framework#SectionBlock`. Expected: both render, and there are no `[Catalog]` validation warnings in the console.

---

### Task 7: Verification and durable evidence

**Files:**
- Create: `docs/design/evidence/2026-10-06-studio-matrix/` (screenshots)
- Create: `docs/design/evidence/2026-10-06-studio-matrix/VERIFICATION.md`

Use the controlled browser against `http://localhost:5181`. Measure with `js()`; do not judge geometry by eye. Record console errors after every row.

- [ ] **Step 1: Run the rendered matrix**

| # | Viewport | Route / action | Pass criteria |
|---|---|---|---|
| R1 | 1280×900 | `/#Button` | Exactly one `h1`, text `Button`. One `[role=table]` with 6 rows × 4 columns, including headers. Every `[role=columnheader]`/`[role=cell]` has computed padding `16px` on all sides. Every data column ≤ 402px wide. `document.documentElement.scrollWidth <= innerWidth`. A second "States / configurations" table does not contain the row labels `Loading` or `Disabled`. |
| R2 | 1600×900 | `/#Badge` | Legacy single-axis matrix. Data column width is exactly 402px (cap reached). Guidance and Quick reference are visible with no toggle. |
| R3 | 1280×900 | `/#Colors` | Token gallery under a "Tokens" label. No matrix. No reference details card. |
| R4 | 1280×900 | `/#SavedTrips` | "Preview" card renders the recipe; it is interactive (switch Map/List once). |
| R5 | 1280×900 | Type `but` in the filter, then `zzz` | `but` shows only Button and ButtonGroup. `zzz` shows "No matches". The open page stays the same in both cases. |
| R6 | 1280×900 | `/#Button`, then the last page in order (`/#Manifest`) | Previous is disabled on Button. Next is disabled on Manifest. Previous/Next elsewhere moves exactly one page in sidebar order. |
| R7 | 1280×900 | Load `/#Badge`; load `/#Nope`; click Card, then press browser Back | Badge opens directly. `#Nope` opens Button and the fragment becomes `#Button`. Back returns to the previous page and the sidebar active row follows. |
| R8 | 1280×900 | Tab to a sidebar row, press Enter | The new page opens. `document.activeElement` is the heading wrapper of the new page. Focus outline is visible on sidebar rows and pager buttons. |
| R9 | 390×844 | `/#Button` | Compact bar with Browse (≥44×44). Matrix scrolls horizontally inside its region. `scrollWidth <= innerWidth`. Guidance and Quick reference are stacked. |
| R10 | 390×844 | Browse → Escape; Browse → select Card | Escape closes the drawer and returns focus to Browse. Selecting Card closes the drawer, opens Card, and focuses its heading. |
| R11 | 1280×900 | `/?catalog=framework#SectionBlock` | The framework catalog loads. The demo shows a 2×2 comparison with one "Not supported — B has no disabled look" cell. No nested `h1` (the demo heading is `h2`). |
| R12 | all rows | — | Zero console errors. No `[Catalog]` warnings except pre-existing completeness warnings, which are listed in VERIFICATION.md. |

- [ ] **Step 2: Store durable evidence**

Save one screenshot each for R1, R2, R3, R9, R10 (drawer open), and R11 into `docs/design/evidence/2026-10-06-studio-matrix/`. Save one side-by-side composite of the reference (`docs/design/2026-10-06-catalog-studio-matrix-reference.html` at 1280×900) and R1. Record each file's `shasum -a 256` in `VERIFICATION.md` with the row results, the tsc delta from Task 5 Step 8, and the unit test totals.

- [ ] **Step 3: Diff for review**

```bash
cd /Users/woohopark/HermesProject/Projects/design-system-viewer
diff -ruN "$SCRATCH/catalog-before" native/catalog > "$SCRATCH/catalog.diff" || true
diff -u "$SCRATCH/README-before.md" README.md >> "$SCRATCH/catalog.diff" || true
diff -u "$SCRATCH/package-before.json" native-preview/package.json >> "$SCRATCH/catalog.diff" || true
shasum -a 256 "$SCRATCH/catalog.diff"
```

---

### Task 8: Independent review of the frozen result

**Trigger:** new catalog information architecture across shell, sidebar, and page renderer, with web history and focus behavior.

- [ ] **Step 1: Freeze the candidate.** Copy the changed files, `catalog.diff`, the spec, the plan, and `VERIFICATION.md` into `$SCRATCH/review-packet/`. Record SHA-256s.
- [ ] **Step 2: One fresh, read-only Claude Opus review** through `/Users/woohopark/.hermes/scripts/claude_guarded_run.py` with `HERMES_HOME=/Users/woohopark/.hermes/profiles/app-design`, role `read_only`, tools `Read`, `Grep`, `Glob` only. Ask for spec conformance, accessibility, and truthful-specimen findings, classified Critical, Important, or Minor.
- [ ] **Step 3: One correction pass** for Critical and Important findings only. Re-run the affected rows of Task 7. Re-review only if blocking findings changed the reviewed result.

---

## Spec coverage check

| Spec requirement | Task |
|---|---|
| One selected page; no full list in main content | 5 |
| Persistent searchable sidebar, 264px, "No matches" | 1, 5 |
| Title, description, breadcrumb, source path, previous/next (disabled at ends) | 1, 3, 4 |
| Matrix primary; columns ≤ 402px; 16px cell padding; comfortable only | 2, 3 |
| Reference details always visible, no collapse | 3, 4 |
| Explicit comparison contract; validation warnings; no fabricated cells | 2, 3, 6 |
| Legacy truthful single-axis fallback | 2 |
| Token galleries and previews keep truthful presentation | 2, 4 |
| Deep link, invalid fallback, back/forward | 1, 5 |
| Focus to heading after navigation; keyboard and visible focus | 4, 5 |
| Compact layout: drawer, contained matrix overflow, stacked reference | 5 |
| Semantic table headers; 44×44 controls; no new motion | 3, 4, 5 |
| No usage-location feature; no density toggle | Global constraints; R1–R2 checks |
| Fidelity acceptance with durable evidence | 7 |

## Estimates (agent time)

| Task | Estimate |
|---|---|
| 0 Preflight | 10 min |
| 1 Navigation model | 25 min |
| 2 Comparison model | 40 min |
| 3 Matrix + reference | 35 min |
| 4 Page body | 30 min |
| 5 Shell, sidebar, drawer | 60 min |
| 6 Button, framework catalog, README | 30 min |
| 7 Verification + evidence | 45 min |
| 8 Review + one correction pass | 45 min |
| **Total** | **≈5.5 hours** active; first useful checkpoint (Button page renders) after Task 5, ≈3.3 hours in |

## Report-only findings

- `npx tsc` fails before any change (245 errors), because `native/` cannot resolve `react`/`react-native` types from outside `native-preview/`. Fixing the TypeScript resolution is out of scope; Task 5 uses a no-new-error-class delta instead.
- `buildComponentManifest()` does not include `comparison` data. The manifest still describes `variants`/`states` truthfully.
- Most components keep the legacy single-axis presentation until someone authors an explicit `comparison` for them. Only Button and the framework demo get one in this plan.

## Separate authorizations (none granted)

1. Implementation of this plan.
2. Initializing Git in the project and committing.
3. Pushing or opening a pull request.
4. Publishing or deploying the catalog.
