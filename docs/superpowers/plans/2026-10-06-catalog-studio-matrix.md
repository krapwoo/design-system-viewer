# Catalog Studio Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Plan (revision 2). Implementation is **not authorized**.

**Goal:** Replace the catalog's long scrolling document with one selected page at a time. Each page shows its specimens as a grid, a list, or a preview, then always-visible reference details. The whole catalog interface adopts the approved visual system.

**Architecture:** Three pure, unit-tested modules own the logic: `tokens.ts` (visual system), `catalogNavigation.ts` (ordering, filtering, previous/next, URL fragment), and `comparison.ts` (layout constants, grid validation, list geometry, page plan). Thin React Native components render them: `ComparisonGrid`, `ComparisonList`, `ReferenceDetails`, a rewritten `SectionBlock` (one page), and a rewritten `CatalogShell` that owns the selected page instead of scroll-spy.

**Tech Stack:** Expo 57, React Native 0.86, React Native Web 0.21, TypeScript 6, Node 22 built-in test runner with `--experimental-strip-types` (no new dependency).

**Spec:** `docs/superpowers/specs/2026-10-06-catalog-studio-matrix-design.md` (revision 2)
**References:**
- Page structure: `docs/design/2026-10-06-catalog-studio-matrix-reference.html` — SHA-256 `c58fa8a1272517682ab1e4346ba4d806c1f21c57f6280a2ebac8eb93856e90d2`
- Layouts and visual system: `docs/design/2026-10-06-catalog-studio-matrix-layouts-reference.html` — SHA-256 `208864b5403dd18660980df1071e12b88cc6ee798cc272c8f14094c1dadd6ca8`

## Global Constraints

- One selected page in the main content. Never render the full component list in the main column.
- Three layouts only: grid, list, preview. Grid columns and list cells are at most **402px** wide, including their 1px divider.
- Every grid cell and list cell has **16px** padding. Specimen rows are at least 150px tall. No density toggle.
- Specimen size minimums: compact 160px, regular 240px, wide 402px (fixed).
- A grid's column axis must fit a 1280px laptop: at most 5 compact, 3 regular, or 2 wide columns.
- Guidance and Quick reference are always visible. No collapse control.
- No usage-location, screen-name, or navigation-step feature.
- Specimens use the real exported components. No catalog-only lookalikes. No fabricated grid cells.
- Catalog chrome uses only `native/catalog/tokens.ts`. No product-token imports in chrome. Product components and product tokens do not change.
- Secondary text is `#666666`, not the references' `#777777` (WCAG AA).
- Desktop and laptop only: no compact layout, drawer, or mobile breakpoint.
- Sidebar 264px. Catalog controls (sidebar rows, pager, filter field) are at least 44px tall; pager buttons 44×44px.
- Browser APIs (`window`, `document`, `history`) run only behind `Platform.OS === 'web'` and a `typeof window !== 'undefined'` guard.
- Commits, pushes, PRs, and deployment each need separate authorization. Commit steps below run only when commit authority is granted.

## Interpretations recorded (no decision needed)

- Guidance shows `whenToUse`, or "No usage guidance documented." The description already appears in the page header.
- Breadcrumb reads `<appName> / <group label>`, because some groups are Tokens, Recipes, and Reference.
- Non-token `render()` sections render in a full-width "Preview" card. Token galleries keep their `fullWidthLabel ?? 'Tokens'` label and have no reference details.
- The active sidebar link uses `aria-current="page"` on web. React Native Web drops `accessibilityState.selected` for links (observed in the rehearsal).
- The page title is 28px (`CATALOG_TYPE.pageTitle`), added to the catalog type scale to match the approved references.
- The unchanged baseline already logs `react-native-svg` errors from product components (`Icon.native`, `Loading`) on web. Console checks count only new errors.

## Rehearsal (plan code already exercised)

All code in this plan was applied to a scratch copy of the repository and run before the plan was written. That copy is not durable evidence; Task 8 repeats the checks in the real repository.

- Unit tests: 17 of 17 pass.
- `tsc` delta: no new error codes against the baseline (`TS2307 TS2322 TS2875 TS7006 TS7031`).
- Rendered at 1280×900: Button 5×3 grid (277px columns) plus a 3×2 list (316px cells); Badge 5×4 grid (208px); Pill 2×4 grid; Avatar 3×3 grid plus a one-item list; Switch one-row list (237px); Banner two 2-per-row lists (402px). No document-level horizontal scroll on any page.
- Behavior: `#Nope` falls back to Button and corrects the fragment; Previous is disabled on the first page and Next on the last; the filter narrows the sidebar without changing the page and shows "No matches"; clicking Card pushes `#Card` and focuses its heading; Back returns; focus ring 3px `#c9d7ff`; sidebar rows and pager 44px.
- Defects found and fixed in this plan's code: a pager prop-name mismatch in `CatalogShell`, list cells measuring 403px, and a missing selected-link state.

## File structure

| File | Action | Responsibility |
|---|---|---|
| `native/catalog/tokens.ts` | Rewrite | Approved visual system: colors, type, radius, layout measurements. |
| `native/catalog/catalogNavigation.ts` | Create | Pure ordering, filtering, previous/next, fragment parsing. Owns `sortIds`. |
| `native/catalog/comparison.ts` | Create | Pure layout constants, grid validation, list geometry, page plan. |
| `native/catalog/__tests__/tokens.test.ts` | Create | Visual-system values and contrast. |
| `native/catalog/__tests__/catalogNavigation.test.ts` | Create | Navigation. |
| `native/catalog/__tests__/comparison.test.ts` | Create | Layout, validation, geometry, page plan. |
| `native/catalog/types.ts` | Modify | `SpecimenSize`, `ComparisonAxisItem`, `ComparisonCell`, `ComparisonDef`; `SectionDef.comparison` and `.specimenSize`; re-export `sortIds`. |
| `native/catalog/ComparisonGrid.tsx` | Create | Render one grid as an accessible table. |
| `native/catalog/ComparisonList.tsx` | Create | Render one axis in one shared card with balanced rows. |
| `native/catalog/ReferenceDetails.tsx` | Create | Always-visible Guidance, Quick reference, Props. |
| `native/catalog/SectionBlock.tsx` | Rewrite | One page: header, pager, layout blocks, reference details. |
| `native/catalog/CatalogSidebar.tsx` | Rewrite | Select a page instead of scrolling; visual system; current-page semantics. |
| `native/catalog/CatalogShell.tsx` | Rewrite | Selected-page state, URL fragment, history, focus. |
| `native/catalog/CatalogSearchInput.tsx` | Modify | 44px field, visual system, focus ring. |
| `native/catalog/index.ts` | Modify | Export new components, types, and tokens. |
| `native/catalog/CatalogExample.tsx` | Modify | Button, Badge, Avatar, Pill grids; compact sizes; prose. |
| `native/catalog/CatalogFrameworkExample.tsx` | Modify | Truthful descriptions; demo grid; `h2` demo heading. |
| `README.md` | Modify | One-page catalog and three layouts. |
| `native-preview/package.json` | Modify | `test:catalog` script. |

Unchanged on purpose: `PropsTable`, `TokenRow`, `Swatch`, `SpacingScaleGallery`, `TypeScaleGallery`, `PhoneFrame`, `VariantGroup`, `DividedStack`, `manifest.ts`. They already read the catalog tokens, so the new token values restyle them.

---

### Task 0: Preflight and baseline (no product edits)

**Files:** none. Scratch: `SCRATCH=/Users/woohopark/.hermes/profiles/app-design/cache/scratch/catalog-studio-matrix`

- [ ] **Step 1: Branch from the current target**

```bash
cd /Users/woohopark/HermesProject/Projects/design-system-viewer
git fetch origin main
git status --porcelain=v1 -uall    # expected: empty
git switch -c feat/catalog-studio-matrix origin/main
```

- [ ] **Step 2: Record the typecheck baseline**

Files under `native/` cannot resolve `react`/`react-native` types from `native-preview/`, so the baseline already has errors. Record the counts by code.

```bash
SCRATCH=/Users/woohopark/.hermes/profiles/app-design/cache/scratch/catalog-studio-matrix
mkdir -p "$SCRATCH"
cd native-preview
npx tsc --noEmit -p . 2>&1 | grep "^../native/catalog" | grep -o "error TS[0-9]*" | sort | uniq -c > "$SCRATCH/tsc-before.txt"
cat "$SCRATCH/tsc-before.txt"
```

Expected codes: `TS2307 TS2322 TS2875 TS7006 TS7031` only.

- [ ] **Step 3: Confirm the preview server**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5181/
```

Expected: `200`. If not, run `cd native-preview && CI=1 npx expo start --web --port 5181` in the background and wait for `Waiting on http://localhost:5181`. In CI mode Metro does not reload; restart the server after edits before any rendered check.

---

### Task 1: Visual system tokens and the test script

**Files:**
- Modify: `native-preview/package.json` (`scripts`)
- Create: `native/catalog/__tests__/tokens.test.ts`
- Rewrite: `native/catalog/tokens.ts`

**Interfaces:**
- Produces: `CATALOG_TYPE` (adds `tableHeader`, `panelHeading`, `brand`, `pageTitle`), `CATALOG_SPACE` (unchanged values), `CATALOG_RADIUS` (`sm`, `control`, `md`, `card`), `CATALOG_LAYOUT`, `CATALOG_MAX_CONTENT_WIDTH`, `CATALOG_TYPE_USE`, `CATALOG_SPACE_USE`, `CATALOG_COLOR` (adds `borderStrong`, `borderSubtle`, `accentSubtle`, `focusRing`). Every existing key keeps its name.

- [ ] **Step 1: Add the test script**

Apply:

```diff
--- a/native-preview/package.json
+++ b/native-preview/package.json
@@ -20,7 +20,8 @@
     "start": "expo start",
     "android": "expo start --android",
     "ios": "expo start --ios",
-    "web": "expo start --web"
+    "web": "expo start --web",
+    "test:catalog": "node --experimental-strip-types --test '../native/catalog/__tests__/*.test.ts'"
   },
   "private": true
 }
```

- [ ] **Step 2: Write the failing test** — `native/catalog/__tests__/tokens.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_TYPE, CATALOG_TYPE_USE } from '../tokens.ts';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('colors match the approved visual system', () => {
  assert.deepEqual(
    { ...CATALOG_COLOR },
    {
      text: '#181818',
      textMuted: '#666666',
      border: '#e4e4e4',
      borderHairline: '#dddddd',
      borderStrong: '#d7d7d7',
      borderSubtle: '#eeeeee',
      surface: '#ffffff',
      surfaceMuted: '#fafafa',
      surfacePressed: '#f1f3f8',
      pageBackground: '#f6f6f4',
      chip: '#eeeeee',
      accent: '#174dc6',
      accentSubtle: '#e9efff',
      focusRing: '#c9d7ff',
      code: 'Menlo',
    },
  );
});

test('type, radius, and layout values match the approved references', () => {
  assert.equal(CATALOG_TYPE.xs, 10);
  assert.equal(CATALOG_TYPE.tableHeader, 11);
  assert.equal(CATALOG_TYPE.sm, 12);
  assert.equal(CATALOG_TYPE.panelHeading, 13);
  assert.equal(CATALOG_TYPE.md, 14);
  assert.equal(CATALOG_TYPE.brand, 17);
  assert.equal(CATALOG_TYPE.pageTitle, 28);
  assert.deepEqual({ ...CATALOG_RADIUS }, { sm: 8, control: 9, md: 12, card: 14 });
  assert.equal(CATALOG_LAYOUT.sidebarWidth, 264);
  assert.equal(CATALOG_LAYOUT.controlSize, 44);
  assert.deepEqual(Object.keys(CATALOG_TYPE_USE).sort(), Object.keys(CATALOG_TYPE).sort());
});

test('text colors meet WCAG AA on every catalog surface', () => {
  const surfaces = [CATALOG_COLOR.surface, CATALOG_COLOR.surfaceMuted, CATALOG_COLOR.pageBackground, CATALOG_COLOR.surfacePressed, CATALOG_COLOR.chip];
  for (const background of surfaces) {
    assert.ok(contrast(CATALOG_COLOR.text, background) >= 4.5, `text on ${background}`);
    assert.ok(contrast(CATALOG_COLOR.textMuted, background) >= 4.5, `textMuted on ${background}`);
    assert.ok(contrast(CATALOG_COLOR.accent, background) >= 4.5, `accent on ${background}`);
  }
  assert.ok(contrast(CATALOG_COLOR.accent, CATALOG_COLOR.accentSubtle) >= 4.5, 'active nav label');
  assert.ok(contrast('#777777', CATALOG_COLOR.pageBackground) < 4.5, 'the reference gray really fails');
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `cd native-preview && npm run test:catalog`
Expected: FAIL — `SyntaxError: The requested module '../tokens.ts' does not provide an export named 'CATALOG_LAYOUT'`.

- [ ] **Step 4: Replace `native/catalog/tokens.ts`**

```ts
/**
 * Catalog-only design tokens — the visual system of the catalog interface itself.
 *
 * Deliberately independent of any host app's design-system tokens (DS_SEMANTIC / DS_PALETTE /
 * DS_SPACING): the catalog documents a design system, it does not consume one. Keeping its chrome
 * on its own tokens means a change to the host app's tokens never restyles the catalog, and this
 * folder can be copied into another app's repo unchanged.
 *
 * Values match the approved Studio Matrix references
 * (docs/design/2026-10-06-catalog-studio-matrix-*.html), with one deliberate exception:
 * `textMuted` stays #666666 because the references' #777777 fails WCAG AA contrast.
 */

export const CATALOG_TYPE = {
  xs: 10,
  tableHeader: 11,
  sm: 12,
  panelHeading: 13,
  md: 14,
  lg: 16,
  brand: 17,
  xl: 20,
  '2xl': 24,
  pageTitle: 28,
  '3xl': 32,
  '4xl': 40,
} as const;

export const CATALOG_SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
} as const;

export const CATALOG_RADIUS = {
  sm: 8,
  control: 9,
  md: 12,
  card: 14,
} as const;

/** Exact chrome measurements from the approved references that are not spacing-scale steps. */
export const CATALOG_LAYOUT = {
  sidebarWidth: 264,
  sidebarPaddingTop: 24,
  sidebarPaddingX: 18,
  mainPaddingTop: 28,
  mainPaddingX: 32,
  controlSize: 44,
  focusRingWidth: 3,
  navItemPaddingY: 8,
  navItemPaddingX: 10,
  panelPadding: 20,
  factPaddingY: 9,
  blockLabelGap: 14,
  blockGap: 28,
} as const;

/** Max width of the main content column. */
export const CATALOG_MAX_CONTENT_WIDTH = 1200;

/** When to reach for each catalog-chrome type size. Rendered in the framework catalog's Type
 *  Scale page. */
export const CATALOG_TYPE_USE: Record<keyof typeof CATALOG_TYPE, string> = {
  xs: 'Sidebar group labels (uppercase); a prop\'s type annotation.',
  tableHeader: 'Grid column headers and list cell captions (uppercase).',
  sm: 'Breadcrumb, catalog caption, block labels, prop names and descriptions.',
  panelHeading: 'Reference-panel headings: Guidance, Quick reference, Props (uppercase).',
  md: 'Default body text: descriptions, nav links, grid row headers, quick-reference rows, the filter field.',
  lg: 'Pager arrows and the filter field\'s clear (×) glyph.',
  brand: 'The app name at the top of the sidebar.',
  xl: 'Reserved — no current consumer.',
  '2xl': 'Reserved — no current consumer.',
  pageTitle: 'The selected page\'s title.',
  '3xl': 'Reserved — no current consumer.',
  '4xl': 'Reserved — no current consumer.',
};

/** When to reach for each catalog-chrome spacing step. Rendered in the framework catalog's
 *  Spacing page. */
export const CATALOG_SPACE_USE: Record<keyof typeof CATALOG_SPACE, string> = {
  xs: 'Tight gap — e.g. between a token\'s rendered value and its use-note.',
  sm: 'Small gap — between a block label and its card; between pager buttons.',
  md: 'Medium gap — between a card\'s contents; token-row divider padding.',
  lg: 'Grid and list cell padding (16px); row gap in scale galleries.',
  xl: 'Preview-card padding; gap between reference-panel sections.',
  '2xl': 'Gap between the page\'s blocks; gap between reference-panel columns.',
  '3xl': 'Bottom padding of the main column.',
};

export const CATALOG_COLOR = {
  text: '#181818',
  // #666666, not the references' #777777: #777 is 4.14–4.48:1 on this file's surfaces (WCAG AA
  // needs 4.5:1); #666 is 5.3–5.7:1.
  textMuted: '#666666',
  /** Dividers inside grids, lists, props tables, token rows. */
  border: '#e4e4e4',
  /** Sidebar edge, reference card, filter field. */
  borderHairline: '#dddddd',
  /** Grid, list, and preview cards; pager buttons. */
  borderStrong: '#d7d7d7',
  /** Quick-reference row dividers. */
  borderSubtle: '#eeeeee',
  surface: '#ffffff',
  /** Table headers, row headers, cell captions, filter field. */
  surfaceMuted: '#fafafa',
  /** Hover and pressed feedback on nav rows and buttons. */
  surfacePressed: '#f1f3f8',
  pageBackground: '#f6f6f4',
  chip: '#eeeeee',
  /** Active nav label, prop types, scale bars. */
  accent: '#174dc6',
  /** Active nav row background. */
  accentSubtle: '#e9efff',
  /** 3px keyboard focus ring on every catalog control. */
  focusRing: '#c9d7ff',
  code: 'Menlo',
} as const;
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd native-preview && npm run test:catalog`
Expected: `ℹ pass 3`, `ℹ fail 0`.

- [ ] **Step 6: Commit (only with commit authority)**

```bash
git add native-preview/package.json native/catalog/tokens.ts native/catalog/__tests__/tokens.test.ts
git commit -m "feat(catalog): adopt the Studio Matrix visual system tokens"
```

---

### Task 2: Navigation model

**Files:**
- Create: `native/catalog/__tests__/catalogNavigation.test.ts`
- Create: `native/catalog/catalogNavigation.ts`
- Modify: `native/catalog/types.ts` (move `sortIds` out, re-export it)

**Interfaces:**
- Produces: `sortIds(ids)`, `orderedIds(groups, availableIds?)`, `groupLabelFor(groups, id)`, `neighbors(order, id) → { previous, next }`, `filterGroups(groups, query)`, `hashForId(id)`, `idFromHash(hash, order)`.

- [ ] **Step 1: Write the failing test** — `native/catalog/__tests__/catalogNavigation.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterGroups, groupLabelFor, hashForId, idFromHash, neighbors, orderedIds, sortIds } from '../catalogNavigation.ts';

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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd native-preview && npm run test:catalog`
Expected: FAIL — `Cannot find module '../catalogNavigation.ts'`.

- [ ] **Step 3: Create `native/catalog/catalogNavigation.ts`**

```ts
/**
 * Pure catalog navigation logic — no React or React Native imports, so it runs under Node's test
 * runner. CatalogShell, CatalogSidebar, and SectionBlock all derive page order from here, so the
 * sidebar order, previous/next order, and fragment fallback can never drift apart.
 */
import type { NavGroup } from './types';

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
```

- [ ] **Step 4: Move `sortIds` ownership**

In `native/catalog/types.ts`, replace the final `sortIds` doc comment and function (from `/** THE canonical within-group ordering` to the end of the file) with:

```ts
/** Canonical within-group ordering — implemented in ./catalogNavigation (pure, unit-tested) and
 *  re-exported here so existing imports keep working. */
export { sortIds } from './catalogNavigation';
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd native-preview && npm run test:catalog`
Expected: `ℹ pass 9`, `ℹ fail 0`.

- [ ] **Step 6: Commit (only with commit authority)**

```bash
git add native/catalog/catalogNavigation.ts native/catalog/__tests__/catalogNavigation.test.ts native/catalog/types.ts
git commit -m "feat(catalog): add a pure navigation model"
```

---

### Task 3: Layout contract and page plan

**Files:**
- Create: `native/catalog/__tests__/comparison.test.ts`
- Create: `native/catalog/comparison.ts`
- Rewrite: `native/catalog/types.ts`

**Interfaces:**
- Consumes: `CATALOG_SPACE` (Task 1) in the test only.
- Produces: `MATRIX_LAYOUT`, `COLUMN_MIN_WIDTH`, `gridColumnLimit(size)`, `gridWidthBounds(columnCount, size)`, `listGeometry(itemCount, availableWidth, size) → { columns, rows, fillers, cellWidth, containerWidth }`, `cellKey`, `indexCells`, `validateComparison(def) → string[]`, `remainingStates`, `slotSize`, `presentationBlocks(def) → PresentationBlock[]`, types `ListItem`, `PresentationBlock`. In `types.ts`: `SpecimenSize`, `ComparisonAxisItem`, `ComparisonCell`, `ComparisonDef`, `SectionDef.comparison`, `SectionDef.specimenSize`.

- [ ] **Step 1: Write the failing test** — `native/catalog/__tests__/comparison.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLUMN_MIN_WIDTH,
  MATRIX_LAYOUT,
  cellKey,
  gridColumnLimit,
  gridWidthBounds,
  indexCells,
  listGeometry,
  presentationBlocks,
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

test('presentationBlocks plans grid, list, preview, and empty blocks', () => {
  const base = { id: 'X', path: 'p', description: 'd' };
  const variants = { items: [{ key: 'a', name: 'A', node: 'a' }] };
  const wideVariants = { itemsFill: true, items: [{ key: 'a', name: 'A', node: 'a' }] };
  const states = { items: [{ key: 'disabled', name: 'Disabled', node: 'd' }, { key: 'icon', name: 'Icon', node: 'i', fill: true }] };
  const render = () => 'r';
  const summary = (def) => presentationBlocks(def).map((b) => [b.kind, b.title, b.size ?? null]);

  assert.deepEqual(presentationBlocks({ ...base, tokenGallery: true, render }), [{ kind: 'preview', title: 'Tokens' }]);
  assert.deepEqual(presentationBlocks({ ...base, tokenGallery: true, fullWidthLabel: 'Palette', render }), [{ kind: 'preview', title: 'Palette' }]);
  assert.deepEqual(presentationBlocks({ ...base, tokenGallery: true }), [{ kind: 'empty', title: 'Tokens', message: 'Nothing to preview.' }]);

  assert.deepEqual(summary({ ...base, variants, states, comparison: valid }), [
    ['grid', 'Variant × State', 'regular'],
    ['list', 'Other configurations', 'regular'],
  ]);
  assert.deepEqual(summary({ ...base, specimenSize: 'compact', comparison: valid }), [['grid', 'Variant × State', 'compact']]);
  assert.deepEqual(summary({ ...base, comparison: { ...valid, size: 'wide' }, specimenSize: 'compact' }), [['grid', 'Variant × State', 'wide']]);
  assert.deepEqual(summary({ ...base, variants }), [
    ['list', 'Variants', 'regular'],
    ['empty', 'States / configurations', null],
  ]);
  assert.deepEqual(summary({ ...base, variants: wideVariants, states }), [
    ['list', 'Variants', 'wide'],
    ['list', 'States / configurations', 'regular'],
  ]);
  assert.deepEqual(summary({ ...base, variants, specimenSize: 'compact' }).slice(0, 1), [['list', 'Variants', 'compact']]);
  assert.deepEqual(summary({ ...base, render }), [
    ['preview', 'Preview', null],
    ['empty', 'States / configurations', null],
  ]);
  assert.deepEqual(presentationBlocks(base), [
    { kind: 'empty', title: 'Variants', message: 'No variants documented.' },
    { kind: 'empty', title: 'States / configurations', message: 'No additional states or configurations documented.' },
  ]);
  assert.deepEqual(summary({ ...base, render, hide: { states: true } }), [['preview', 'Preview', null]]);
  assert.deepEqual(summary({ ...base, variants, states, hide: { variants: true } }), [['list', 'States / configurations', 'regular']]);
  assert.deepEqual(summary({ ...base, comparison: valid, states: { items: [states.items[0]] } }), [['grid', 'Variant × State', 'regular']]);

  const list = presentationBlocks({ ...base, variants: wideVariants })[0];
  assert.deepEqual(list.items, [{ key: 'a', label: 'A', node: 'a', fill: true }]);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd native-preview && npm run test:catalog`
Expected: FAIL — `Cannot find module '../comparison.ts'`.

- [ ] **Step 3: Create `native/catalog/comparison.ts`**

```ts
/**
 * Pure page-layout logic for catalog specimens — no React or React Native runtime imports, so it
 * runs under Node's test runner. A page shows its specimens in one of three layouts:
 *   • grid    — two props that combine freely (rows × columns table);
 *   • list    — one axis, in ONE shared card whose cells wrap into balanced rows;
 *   • preview — free-form content (live demos, token galleries, recipes) at full width.
 * ComparisonGrid and ComparisonList render what this module plans and measures.
 */
import type { ComparisonDef, SectionDef, SpecimenSize, VariantSlot } from './types';

/** Approved geometry. `cellPadding` equals CATALOG_SPACE.lg (asserted in tests). The laptop
 *  content width is a 1280px viewport minus the 264px sidebar and 32px side padding. */
export const MATRIX_LAYOUT = {
  rowHeaderWidth: 120,
  columnMaxWidth: 402,
  cellPadding: 16,
  rowMinHeight: 150,
  laptopContentWidth: 952,
} as const;

/** Smallest column or cell width per specimen size. Wide specimens are fixed at phone width. */
export const COLUMN_MIN_WIDTH: Record<SpecimenSize, number> = { compact: 160, regular: 240, wide: 402 };

/** How many grid columns fit beside the row header on a 1280px laptop without scrolling. */
export function gridColumnLimit(size: SpecimenSize): number {
  return Math.floor((MATRIX_LAYOUT.laptopContentWidth - MATRIX_LAYOUT.rowHeaderWidth) / COLUMN_MIN_WIDTH[size]);
}

export function gridWidthBounds(columnCount: number, size: SpecimenSize): { minWidth: number; maxWidth: number } {
  const n = Math.max(0, columnCount);
  return {
    minWidth: MATRIX_LAYOUT.rowHeaderWidth + n * COLUMN_MIN_WIDTH[size],
    maxWidth: MATRIX_LAYOUT.rowHeaderWidth + n * MATRIX_LAYOUT.columnMaxWidth,
  };
}

export interface ListGeometry {
  columns: number;
  rows: number;
  fillers: number;
  cellWidth: number;
  containerWidth: number;
}

/** Balanced wrapping for a one-axis list inside a single bordered card (1px outer border). Each
 *  cell's 1px divider sits inside its own width, so no cell is ever wider than 402px. Uses as few
 *  rows as fit, then spreads items evenly across them so a short last row leaves as little empty
 *  space as possible. `fillers` blank cells complete the last row. */
export function listGeometry(itemCount: number, availableWidth: number, size: SpecimenSize): ListGeometry {
  if (itemCount <= 0) return { columns: 0, rows: 0, fillers: 0, cellWidth: 0, containerWidth: 0 };
  const inner = Math.max(0, availableWidth - 2);
  const min = COLUMN_MIN_WIDTH[size];
  const maxColumns = Math.max(1, Math.min(itemCount, Math.floor(inner / min)));
  const rows = Math.ceil(itemCount / maxColumns);
  const columns = Math.ceil(itemCount / rows);
  const fitted = Math.floor(inner / columns);
  const cellWidth = size === 'wide' ? MATRIX_LAYOUT.columnMaxWidth : Math.max(min, Math.min(MATRIX_LAYOUT.columnMaxWidth, fitted));
  return {
    columns,
    rows,
    fillers: rows * columns - itemCount,
    cellWidth,
    containerWidth: columns * cellWidth + 2,
  };
}

export function cellKey(rowKey: string, columnKey: string): string {
  return `${rowKey}\u0000${columnKey}`;
}

export function indexCells(def: ComparisonDef): Map<string, ComparisonDef['cells'][number]> {
  const index = new Map<string, ComparisonDef['cells'][number]>();
  for (const cell of def.cells) {
    const key = cellKey(cell.rowKey, cell.columnKey);
    if (!index.has(key)) index.set(key, cell);
  }
  return index;
}

/** Human-readable problems in a stable order: axis duplicates, column fit, each cell in
 *  declaration order, then missing coordinates in row-major order. Empty when valid. */
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
  const size = def.size ?? 'regular';
  const limit = gridColumnLimit(size);
  if (columnKeys.size > limit) {
    issues.push(`Grid has ${columnKeys.size} columns; at most ${limit} ${size} columns fit a 1280px laptop. Swap the axes or use two lists.`);
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

/** `states` minus items whose key is already a grid row or column. */
export function remainingStates(states: VariantSlot | undefined, comparison: ComparisonDef | undefined): VariantSlot | undefined {
  if (!states) return undefined;
  if (!comparison) return states;
  const covered = new Set([...comparison.rows.map((row) => row.key), ...comparison.columns.map((column) => column.key)]);
  const items = states.items.filter((item) => !covered.has(item.key));
  return items.length > 0 ? { ...states, items } : undefined;
}

export interface ListItem {
  key: string;
  label: string;
  node: unknown;
  fill?: boolean;
}

export type PresentationBlock =
  | { kind: 'grid'; title: string; size: SpecimenSize; comparison: ComparisonDef }
  | { kind: 'list'; title: string; size: SpecimenSize; items: ListItem[] }
  | { kind: 'preview'; title: string }
  | { kind: 'empty'; title: string; message: string };

/** Specimen size for a one-axis slot: the section's explicit size, else wide for full-width
 *  (itemsFill) slots, else regular. */
export function slotSize<TId extends string>(def: SectionDef<TId>, slot: VariantSlot): SpecimenSize {
  return def.specimenSize ?? (slot.itemsFill ? 'wide' : 'regular');
}

function slotItems(slot: VariantSlot): ListItem[] {
  return slot.items.map((item) => ({ key: item.key, label: item.name, node: item.node, fill: item.fill || slot.itemsFill }));
}

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
      blocks.push({
        kind: 'grid',
        title: `${def.comparison.rowLabel} × ${def.comparison.columnLabel}`,
        size: def.comparison.size ?? def.specimenSize ?? 'regular',
        comparison: def.comparison,
      });
    } else if (def.variants) {
      blocks.push({ kind: 'list', title: 'Variants', size: slotSize(def, def.variants), items: slotItems(def.variants) });
    } else if (def.render) {
      blocks.push({ kind: 'preview', title: 'Preview' });
    } else {
      blocks.push({ kind: 'empty', title: 'Variants', message: 'No variants documented.' });
    }
  }

  if (!hide.states) {
    const states = remainingStates(def.states, def.comparison);
    if (states) {
      blocks.push({
        kind: 'list',
        title: def.comparison ? 'Other configurations' : 'States / configurations',
        size: slotSize(def, states),
        items: slotItems(states),
      });
    } else if (!def.comparison && !def.states) {
      blocks.push({ kind: 'empty', title: 'States / configurations', message: 'No additional states or configurations documented.' });
    }
  }
  return blocks;
}
```

- [ ] **Step 4: Replace `native/catalog/types.ts`**

The new file keeps every existing doc comment and field. It adds the layout types before `SectionDef`, adds `comparison` and `specimenSize` before `hide`, says "sidebar and page navigation" instead of "sidebar/scroll-spy", and keeps the `sortIds` re-export from Task 2.

```ts
import type React from 'react';

/** One documented prop of a component, shown in its Props table. */
export interface PropDef {
  name: string;
  /** TypeScript type, kept short/readable (e.g. `'primary' | 'secondary'`, `() => void`). */
  type: string;
  /** True when the prop has no `?` in the interface — the caller must pass it. */
  required?: boolean;
  /** The value actually used when the component destructures a default for this prop. */
  default?: string;
  desc: string;
}

/** One individual example inside a variant/state cluster — e.g. one Button instance. */
export interface VariantExample {
  /** React key; keep stable and unique within its group. */
  key: string;
  /** Shown as a small caption under this item — the actual variant/state value it demonstrates
   *  (e.g. "Primary", "Icon-only"), not a generic label like "Example 1". */
  name: string;
  node: React.ReactNode;
  /** Stretch *this item's* wrapper to the row's full width, instead of shrinking to its own content
   *  width — for a single wide-format instance (e.g. a `fullWidth` Button) sitting among otherwise
   *  compact, centered siblings in the same slot. Without this, a `fullWidth`/stretch-based prop on
   *  the instance itself has nothing to stretch into — its wrapper still shrinks to content, so the
   *  instance renders at its natural size regardless of the prop. Independent of the slot's own
   *  `itemsFill` (which applies to every item uniformly); this is a per-item override. @default false */
  fill?: boolean;
  /** Which real prop value(s) this instance demonstrates, e.g. `{ variant: 'primary' }` or
   *  `{ size: 'large', disabled: true }` — mirrors the actual props passed to `node`. Optional and
   *  additive: SectionBlock only cross-checks a section's enum props against this metadata once at
   *  least one item in that section has started tagging them, so annotating is opt-in/gradual rather
   *  than an all-or-nothing migration. Once a section opts in, SectionBlock warns (dev console) about
   *  any enum value from `SectionDef.props` that no tagged item covers — the mechanical version of
   *  the completeness policy documented on `states` below. */
  props?: Record<string, unknown>;
}

/** The content of the "Variants" or "States / Configurations" column — every value of a single prop's
 *  enum, or every distinct boolean/flag state, as individual instances. */
export interface VariantSlot {
  /** @default 'center' */
  align?: 'center' | 'left';
  /** When true, each item stretches to fill the available width instead of shrinking to its own
   *  content width — for wide block-level components (Banner, Card, Toast, InputField) rather than
   *  small instances meant to sit centered (Button, Badge, Pill). @default false */
  itemsFill?: boolean;
  items: VariantExample[];
}

/** Width class for a page's specimens: compact (min 160px), regular (min 240px), or wide (fixed
 *  402px, phone width). Sets grid column and list cell widths. */
export type SpecimenSize = 'compact' | 'regular' | 'wide';

/** One row or column heading in a grid. */
export interface ComparisonAxisItem {
  key: string;
  label: string;
}

/** One authored row × column specimen. Provide exactly one of `node` (a real instance of the
 *  documented component) or `unavailableReason` (the combination genuinely does not exist). */
export interface ComparisonCell {
  rowKey: string;
  columnKey: string;
  node?: React.ReactNode;
  unavailableReason?: string;
  /** Stretch this specimen to the cell width. @default false */
  fill?: boolean;
}

/** A grid of two props that combine freely. Every row × column pair is authored — never inferred
 *  by multiplying `variants` with `states`, because pre-rendered nodes cannot be combined. */
export interface ComparisonDef {
  /** Names the row axis; shown in the corner cell (e.g. "Variant"). */
  rowLabel: string;
  /** Names the column axis (e.g. "State"). */
  columnLabel: string;
  rows: ComparisonAxisItem[];
  columns: ComparisonAxisItem[];
  cells: ComparisonCell[];
  /** Defaults to the section's `specimenSize`, then 'regular'. */
  size?: SpecimenSize;
}

/** One entry in the catalog — a documented component or token group. `TId` is the app's own
 *  union of section ids (e.g. `'Button' | 'Card' | ...'`), so the sidebar and page navigation stay
 *  typed to the app's real section list without this file needing to know what they are. */
export interface SectionDef<TId extends string = string> {
  id: TId;
  description: string;
  path: string;
  /** One sentence disambiguating this component from its closest look-alike(s) — the deciding
   *  question a reader (human or AI) would otherwise have to guess at when two components could
   *  plausibly fit the same spot (InputField vs SearchField vs Dropdown, Toast vs Banner, …). Omit
   *  for components with no real look-alike. Keep it to the one sentence that actually decides —
   *  the full reasoning lives in the repo's WHEN_TO_USE.md; this is a pointer, not a copy of it. */
  whenToUse?: string;
  /** The component's real prop interface, shown as a table above the live examples. Token/token-group
   *  sections (Colors, Spacing, etc.) have no component props, so this is omitted for those. */
  props?: PropDef[];
  /** What's actually true about this component's accessibility behavior, grounded in its source —
   *  not a generic disclaimer. Say plainly when a component has no explicit handling beyond the
   *  host element's default semantics, rather than inventing coverage that isn't there. */
  a11y?: string;
  /** Every value of the component's primary enum prop (e.g. `variant`), as individual instances —
   *  **including whichever value that prop defaults to** (e.g. Button's Variants starts with
   *  "Primary" since `variant` defaults to `'primary'`; Card's single instance is named "Default"
   *  since it has no enum at all). Never skip the default on the assumption it's obvious from source.
   *  SectionBlock always renders a "Variants" column — omit this and it shows "No variants
   *  documented." instead of just not appearing, so every section has the same fixed shape. If
   *  neither this nor `render` is set, that's what shows; if `render` is set instead, its output
   *  fills this column (for content that isn't a simple list of instances — see `render` below). */
  variants?: VariantSlot;
  /** Every meaningfully distinct boolean/flag state (`loading`, `disabled`, icon-only, …) **and** any
   *  other optional, prop-driven configuration worth showing that isn't the primary enum (an optional
   *  content slot like Banner's `action`/`link`, a structural mode like its status-row layout, …) — the
   *  column is titled "States / Configurations" precisely because not everything that belongs here is
   *  a strict boolean toggle. Two rules, checked against the component's real prop interface (not just
   *  whichever states come to mind):
   *  1. **No real prop left undemonstrated** — every prop that visibly changes the component's look
   *     needs at least one instance somewhere in the section (here or in `variants`). A prop that
   *     only ever appears in the Props table, with no live example anywhere, is a documentation gap.
   *  2. **Show both sides of a toggle, not just the special one** — when a state is one half of a
   *     binary look (icon-only vs. icon+text, disabled vs. enabled, expanded vs. collapsed), include
   *     *both* instances here rather than assuming the reader will cross-reference `variants` for the
   *     baseline. The States / Configurations column should read on its own.
   *  3. **Duplication across columns is fine, and often correct** — don't withhold an instance from
   *     here merely because the same configuration already appears in `variants` (or vice versa). Each
   *     column should be independently complete: a reader looking only at States / Configurations
   *     shouldn't have to flip to Variants (or back) to see the full picture.
   *  4. **A continuous prop (`size: number`, a colour string, …) has no fixed enum to sweep — show an
   *     explicit small / medium / large (or similarly-spaced) trio anyway, and label the one that
   *     matches the component's own default as "Medium" or "Default", even if that same default
   *     value already appears, unlabeled, somewhere else in the section (e.g. an unsized instance in
   *     `variants`). An instance the reader can't identify as "this is what a smaller/larger one looks
   *     like" doesn't count as demonstrating the range — this is the same rule as #3, but continuous
   *     props are exactly where it's easiest to skip a middle value because "the default is shown
   *     elsewhere anyway."
   *  SectionBlock always renders a "States / Configurations" column; omit this and it shows "No
   *  additional states or configurations documented." instead of just not appearing. */
  states?: VariantSlot;
  /** Escape hatch for "Variants" column content that isn't a simple list of instances — token
   *  galleries, live interactive demos with local state, structure diagrams, wrapping grids. Ignored
   *  when `variants` is set. */
  render?: () => React.ReactNode;
  /** Marks this as a token-gallery section (raw token data, not a component with its own API) —
   *  SectionBlock skips the States/Configurations, Props, and Accessibility columns entirely (there's
   *  no component behavior to document) and renders a single column titled "Tokens" instead of
   *  "Variants". */
  tokenGallery?: boolean;
  /** Overrides the `tokenGallery` column's label (default `'Tokens'`) — e.g. `'Preview'` for a page
   *  that's a composed, realistic usage example rather than a list of raw token values. Ignored
   *  unless `tokenGallery` is also set. */
  fullWidthLabel?: string;
  /** Hide specific cards entirely for this section, rather than showing an empty-state placeholder
   *  sentence ("No additional states or configurations documented.", etc.) — for a catalog whose
   *  sections genuinely have no meaningful states/props/accessibility story to tell (e.g. a
   *  framework's own building-block pages). Hidden columns free up the row's width for whatever
   *  remains; if only one column is left standing, it fills the whole row, the same way a
   *  `tokenGallery` section does. */
  /** A grid of two props that combine freely. When set, it replaces the Variants list, and any
   *  `states` item whose key matches a grid row or column key is not repeated below it.
   *  `variants`/`states` stay as data for the manifest and completeness check. */
  comparison?: ComparisonDef;
  /** Width class for this page's specimens. Without it, full-width (`itemsFill`) slots are 'wide'
   *  and everything else is 'regular'. */
  specimenSize?: SpecimenSize;
  hide?: {
    variants?: boolean;
    states?: boolean;
    props?: boolean;
    accessibility?: boolean;
  };
}

/** A labeled group of section ids in the sidebar (e.g. "Components" vs "Tokens"). */
export interface NavGroup<TId extends string = string> {
  label: string;
  ids: readonly TId[];
}

/** Canonical within-group ordering — implemented in ./catalogNavigation (pure, unit-tested) and
 *  re-exported here so existing imports keep working. */
export { sortIds } from './catalogNavigation';
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd native-preview && npm run test:catalog`
Expected: `ℹ pass 17`, `ℹ fail 0`.

- [ ] **Step 6: Commit (only with commit authority)**

```bash
git add native/catalog/comparison.ts native/catalog/__tests__/comparison.test.ts native/catalog/types.ts
git commit -m "feat(catalog): add the grid/list/preview layout contract"
```

---

### Task 4: `ComparisonGrid`, `ComparisonList`, and `ReferenceDetails`

**Files:**
- Create: `native/catalog/ComparisonGrid.tsx`
- Create: `native/catalog/ComparisonList.tsx`
- Create: `native/catalog/ReferenceDetails.tsx`

**Interfaces:**
- Consumes: Task 1 tokens; Task 3 `MATRIX_LAYOUT`, `COLUMN_MIN_WIDTH`, `gridWidthBounds`, `indexCells`, `cellKey`, `validateComparison`, `listGeometry`, `ListItem`; existing `PropsTable`.
- Produces: `ComparisonGrid({ def, size, sectionId })`, `ComparisonList({ items, size, label })`, `ReferenceDetails({ def })`.

These are thin renderers over unit-tested logic. Their behavior is verified in the rendered matrix (Task 8).

- [ ] **Step 1: Create `native/catalog/ComparisonGrid.tsx`**

```tsx
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { CATALOG_COLOR, CATALOG_RADIUS, CATALOG_TYPE } from './tokens';
import { COLUMN_MIN_WIDTH, MATRIX_LAYOUT, cellKey, gridWidthBounds, indexCells, validateComparison } from './comparison';
import type { ComparisonDef, SpecimenSize } from './types';

/**
 * A grid of two props that combine freely, rendered as an accessible table inside one card.
 * Columns grow with the window up to 402px and never shrink below the specimen size's minimum;
 * a grid wider than its container scrolls horizontally inside the card, never the page.
 */
export function ComparisonGrid({ def, size, sectionId }: { def: ComparisonDef; size: SpecimenSize; sectionId: string }) {
  if (__DEV__) {
    for (const issue of validateComparison({ ...def, size })) console.warn(`[Catalog] ${sectionId}: ${issue}`);
  }
  const cells = indexCells(def);
  const bounds = gridWidthBounds(def.columns.length, size);
  const column = {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: COLUMN_MIN_WIDTH[size],
    minWidth: COLUMN_MIN_WIDTH[size],
    maxWidth: MATRIX_LAYOUT.columnMaxWidth,
  };
  const lastColumn = def.columns.length - 1;

  return (
    <ScrollView horizontal style={styles.scroller} contentContainerStyle={styles.scrollContent}>
      <View
        role="table"
        aria-label={`${sectionId}: ${def.rowLabel} by ${def.columnLabel}`}
        style={[styles.card, { minWidth: bounds.minWidth, maxWidth: bounds.maxWidth }]}
      >
        <View role="row" style={styles.row}>
          <View role="columnheader" style={[styles.cell, styles.rowHeader, styles.headerCell]}>
            <Text style={styles.headerText}>{def.rowLabel}</Text>
          </View>
          {def.columns.map((c, ci) => (
            <View key={c.key} role="columnheader" style={[styles.cell, column, styles.headerCell, ci === lastColumn && styles.lastColumn]}>
              <Text style={styles.headerText}>{c.label}</Text>
            </View>
          ))}
        </View>
        {def.rows.map((row, ri) => (
          <View key={row.key} role="row" style={[styles.row, ri === def.rows.length - 1 && styles.lastRow]}>
            <View role="rowheader" style={[styles.cell, styles.rowHeader, styles.bodyRow]}>
              <Text style={styles.rowHeaderText}>{row.label}</Text>
            </View>
            {def.columns.map((c, ci) => {
              const cell = cells.get(cellKey(row.key, c.key));
              return (
                <View key={c.key} role="cell" style={[styles.cell, column, styles.bodyRow, styles.specimenCell, ci === lastColumn && styles.lastColumn]}>
                  {cell?.node !== undefined ? (
                    <View style={cell.fill ? styles.fill : styles.center}>{cell.node}</View>
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
  card: {
    width: '100%',
    backgroundColor: CATALOG_COLOR.surface,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    borderRadius: CATALOG_RADIUS.card,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: CATALOG_COLOR.border },
  lastRow: { borderBottomWidth: 0 },
  cell: { padding: MATRIX_LAYOUT.cellPadding, borderRightWidth: 1, borderRightColor: CATALOG_COLOR.border },
  lastColumn: { borderRightWidth: 0 },
  rowHeader: { width: MATRIX_LAYOUT.rowHeaderWidth, flexShrink: 0, justifyContent: 'center', backgroundColor: CATALOG_COLOR.surfaceMuted },
  headerCell: { backgroundColor: CATALOG_COLOR.surfaceMuted, justifyContent: 'center' },
  bodyRow: { minHeight: MATRIX_LAYOUT.rowMinHeight },
  specimenCell: { alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center' },
  fill: { alignSelf: 'stretch' },
  headerText: { fontSize: CATALOG_TYPE.tableHeader, fontWeight: '800', letterSpacing: 0.44, color: CATALOG_COLOR.text },
  rowHeaderText: { fontSize: CATALOG_TYPE.md, fontWeight: '700', color: CATALOG_COLOR.text },
  unavailable: { fontSize: CATALOG_TYPE.sm, fontStyle: 'italic', textAlign: 'center', color: CATALOG_COLOR.textMuted },
});
```

- [ ] **Step 2: Create `native/catalog/ComparisonList.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { CATALOG_COLOR, CATALOG_RADIUS, CATALOG_TYPE } from './tokens';
import { MATRIX_LAYOUT, listGeometry, type ListItem } from './comparison';
import type { SpecimenSize } from './types';

/**
 * One-axis examples inside ONE shared card. Cells wrap into balanced rows (listGeometry); each cell
 * has its own caption strip so labels stay attached when rows wrap. Blank cells complete an uneven
 * last row. Wide specimens use fixed 402px cells and the card hugs its columns.
 */
export function ComparisonList({ items, size, label }: { items: ListItem[]; size: SpecimenSize; label: string }) {
  const [available, setAvailable] = useState<number>(MATRIX_LAYOUT.laptopContentWidth);
  const geometry = listGeometry(items.length, available, size);
  const onLayout = (event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    if (width > 0 && width !== available) setAvailable(width);
  };

  const slots: (ListItem | null)[] = [...items, ...Array.from({ length: geometry.fillers }, () => null)];
  const rows: (ListItem | null)[][] = [];
  for (let r = 0; r < geometry.rows; r += 1) rows.push(slots.slice(r * geometry.columns, (r + 1) * geometry.columns));

  return (
    <View onLayout={onLayout}>
      <View role="list" aria-label={label} style={[styles.card, { width: geometry.containerWidth }]}>
        {rows.map((row, ri) => (
          <View key={ri} style={[styles.row, ri === rows.length - 1 && styles.lastRow]}>
            {row.map((item, ci) => {
              const last = ci === row.length - 1;
              // border-box: a non-last cell's 1px right divider sits inside its width.
              const width = geometry.cellWidth;
              if (!item) {
                return (
                  <View key={`blank-${ci}`} aria-hidden style={[styles.cell, { width }, last && styles.lastColumn]}>
                    <View style={styles.caption}>
                      <Text style={styles.captionText}> </Text>
                    </View>
                    <View style={styles.specimen} />
                  </View>
                );
              }
              return (
                <View key={item.key} role="listitem" style={[styles.cell, { width }, last && styles.lastColumn]}>
                  <View style={styles.caption}>
                    <Text style={styles.captionText}>{item.label}</Text>
                  </View>
                  <View style={styles.specimen}>
                    <View style={item.fill ? styles.fill : styles.center}>{item.node as React.ReactNode}</View>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CATALOG_COLOR.surface,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    borderRadius: CATALOG_RADIUS.card,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: CATALOG_COLOR.border },
  lastRow: { borderBottomWidth: 0 },
  cell: { borderRightWidth: 1, borderRightColor: CATALOG_COLOR.border },
  lastColumn: { borderRightWidth: 0 },
  caption: {
    padding: MATRIX_LAYOUT.cellPadding,
    backgroundColor: CATALOG_COLOR.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: CATALOG_COLOR.border,
  },
  captionText: { fontSize: CATALOG_TYPE.tableHeader, fontWeight: '800', letterSpacing: 0.44, color: CATALOG_COLOR.text },
  specimen: {
    flexGrow: 1,
    minHeight: MATRIX_LAYOUT.rowMinHeight,
    padding: MATRIX_LAYOUT.cellPadding,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { alignItems: 'center' },
  fill: { alignSelf: 'stretch' },
});
```

- [ ] **Step 3: Create `native/catalog/ReferenceDetails.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TYPE } from './tokens';
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
 * Always-visible reference below a page's specimens: Guidance, Quick reference (source path,
 * accessibility), then the full Props table. No collapse control by design.
 */
export function ReferenceDetails<TId extends string>({ def }: { def: SectionDef<TId> }) {
  const hide = def.hide ?? {};
  return (
    <View style={styles.card}>
      <View style={styles.columns}>
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
    padding: CATALOG_LAYOUT.panelPadding,
    gap: CATALOG_SPACE.xl,
  },
  columns: { flexDirection: 'row', gap: CATALOG_SPACE['2xl'] },
  column: { flex: 1 },
  heading: {
    fontSize: CATALOG_TYPE.panelHeading,
    fontWeight: '700',
    letterSpacing: 0.52,
    textTransform: 'uppercase',
    color: CATALOG_COLOR.text,
    marginBottom: 10,
  },
  body: { fontSize: CATALOG_TYPE.md, lineHeight: 20, color: CATALOG_COLOR.textMuted },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: CATALOG_SPACE.lg,
    paddingVertical: CATALOG_LAYOUT.factPaddingY,
    borderBottomWidth: 1,
    borderBottomColor: CATALOG_COLOR.borderSubtle,
  },
  factLabel: { fontSize: CATALOG_TYPE.md, fontWeight: '700', color: CATALOG_COLOR.text },
  factValue: { flex: 1, fontSize: CATALOG_TYPE.md, lineHeight: 20, textAlign: 'right', color: CATALOG_COLOR.textMuted },
  mono: { fontFamily: CATALOG_COLOR.code },
  props: { gap: CATALOG_SPACE.sm },
  empty: { fontSize: CATALOG_TYPE.sm, fontStyle: 'italic', color: CATALOG_COLOR.textMuted },
});
```

- [ ] **Step 4: Confirm no new typecheck error classes**

```bash
cd native-preview
npx tsc --noEmit -p . 2>&1 | grep "^../native/catalog" | grep -o "error TS[0-9]*" | sort -u
```

Expected: a subset of `TS2307 TS2322 TS2875 TS7006 TS7031`. The new files add only `TS2307`/`TS2875` (unresolved `react`/`react-native`), like every existing catalog file. Any other code is a real error: fix it before continuing.

- [ ] **Step 5: Commit (only with commit authority)**

```bash
git add native/catalog/ComparisonGrid.tsx native/catalog/ComparisonList.tsx native/catalog/ReferenceDetails.tsx
git commit -m "feat(catalog): add grid, list, and reference-detail renderers"
```

---

### Task 5: `SectionBlock` as one page

**Files:**
- Rewrite: `native/catalog/SectionBlock.tsx`

**Interfaces:**
- Consumes: Task 3 `presentationBlocks`, `PresentationBlock`; Task 4 components.
- Produces: `SectionBlock({ def, groupLabel?, breadcrumbRoot?, pager?, headingRef?, headingLevel? })` and `SectionPager<TId> = { previousId: TId | null; nextId: TId | null; onNavigate(id) }`.

The completeness check (`STRING_LITERAL_RE`, `checkCompleteness`) is kept byte-for-byte from the current file.

- [ ] **Step 1: Replace `native/catalog/SectionBlock.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_SPACE, CATALOG_TYPE } from './tokens';
import { ComparisonGrid } from './ComparisonGrid';
import { ComparisonList } from './ComparisonList';
import { ReferenceDetails } from './ReferenceDetails';
import { presentationBlocks, type PresentationBlock } from './comparison';
import type { SectionDef } from './types';

// Matches a quoted-string-literal union type, e.g. "'primary' | 'secondary' | 'tertiary'" — anything
// else (string, boolean, IconName, () => void, …) has no fixed enum to sweep and is skipped.
const STRING_LITERAL_RE = /'([^']+)'/g;

/** Opt-in completeness check (rule 4 of the policy documented on `SectionDef.states`): once a
 *  section has at least one `VariantExample.props`-tagged item, warn about any enum value from
 *  `def.props` that no tagged item (across Variants + States) actually demonstrates. Sections that
 *  haven't started tagging are skipped entirely — annotating is gradual, not all-or-nothing. */
function checkCompleteness<TId extends string>(def: SectionDef<TId>): void {
  if (!def.props) return;
  const items = [...(def.variants?.items ?? []), ...(def.states?.items ?? [])];
  const tagged = items.filter((item) => item.props);
  if (tagged.length === 0) return;

  for (const prop of def.props) {
    const literals = prop.type.match(STRING_LITERAL_RE);
    if (!literals || literals.length < 2) continue; // not a multi-value enum
    const values = literals.map((s) => s.slice(1, -1));
    const covered = new Set(
      tagged
        .map((item) => item.props?.[prop.name])
        .filter((v): v is string => typeof v === 'string'),
    );
    const missing = values.filter((v) => !covered.has(v));
    if (missing.length > 0) {
      console.warn(
        `[Catalog] ${def.id}: prop "${prop.name}" has no tagged example for value(s) ${missing.map((v) => `"${v}"`).join(', ')} — ` +
          `add { props: { ${prop.name}: '${missing[0]}' } } to whichever VariantExample already demonstrates it, or add a new one.`,
      );
    }
  }
}

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
        focused && styles.focusRing,
        disabled && styles.pagerButtonDisabled,
      ]}
    >
      <Text style={[styles.pagerGlyph, disabled && styles.pagerGlyphDisabled]}>{direction === 'previous' ? '←' : '→'}</Text>
    </Pressable>
  );
}

function BlockContent<TId extends string>({ block, def }: { block: PresentationBlock; def: SectionDef<TId> }) {
  switch (block.kind) {
    case 'grid':
      return <ComparisonGrid def={block.comparison} size={block.size} sectionId={def.id} />;
    case 'list':
      return <ComparisonList items={block.items} size={block.size} label={`${def.id}: ${block.title}`} />;
    case 'preview':
      return <View style={styles.previewCard}>{def.render?.()}</View>;
    default:
      return (
        <View style={styles.previewCard}>
          <Text style={styles.emptyText}>{block.message}</Text>
        </View>
      );
  }
}

/**
 * One catalog page: breadcrumb, title, description, previous/next, then one or two specimen
 * blocks (grid, list, or preview), then always-visible reference details (not for token
 * galleries). Works standalone without a pager inside a host page, as the framework catalog's
 * own SectionBlock demo does.
 */
export function SectionBlock<TId extends string>({
  def,
  groupLabel,
  breadcrumbRoot,
  pager,
  headingRef,
  headingLevel = 1,
}: {
  def: SectionDef<TId>;
  groupLabel?: string;
  breadcrumbRoot?: string;
  pager?: SectionPager<TId>;
  headingRef?: React.Ref<View>;
  headingLevel?: 1 | 2;
}) {
  checkCompleteness(def);
  const blocks = presentationBlocks(def);
  // react-native-web reads `aria-level`; React Native's prop types do not declare it.
  const headingLevelProps = { 'aria-level': headingLevel } as Record<string, unknown>;

  return (
    <View>
      {groupLabel && (
        <Text style={styles.breadcrumb}>{breadcrumbRoot ? `${breadcrumbRoot} / ${groupLabel}` : groupLabel}</Text>
      )}
      <View style={styles.titlebar}>
        <View style={styles.titleText}>
          <View ref={headingRef} tabIndex={-1} style={styles.headingTarget}>
            <Text role="heading" {...headingLevelProps} style={styles.title}>{def.id}</Text>
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

      {!def.tokenGallery && <ReferenceDetails def={def} />}
    </View>
  );
}

const styles = StyleSheet.create({
  breadcrumb: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted },
  titlebar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: CATALOG_SPACE.xl,
    marginTop: 14,
    marginBottom: CATALOG_SPACE.xl,
  },
  titleText: { flex: 1 },
  headingTarget: { alignSelf: 'flex-start' },
  title: { fontSize: CATALOG_TYPE.pageTitle, fontWeight: '700', color: CATALOG_COLOR.text, marginBottom: 5 },
  desc: { fontSize: CATALOG_TYPE.md, lineHeight: 20, color: CATALOG_COLOR.textMuted, maxWidth: 700 },
  pager: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  pagerButton: {
    width: CATALOG_LAYOUT.controlSize,
    height: CATALOG_LAYOUT.controlSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CATALOG_RADIUS.control,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    backgroundColor: CATALOG_COLOR.surface,
  },
  pagerButtonActive: { backgroundColor: CATALOG_COLOR.surfacePressed },
  pagerButtonDisabled: { backgroundColor: CATALOG_COLOR.pageBackground },
  focusRing: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing },
  pagerGlyph: { fontSize: CATALOG_TYPE.lg, color: CATALOG_COLOR.text },
  pagerGlyphDisabled: { color: CATALOG_COLOR.textMuted },
  block: { marginBottom: CATALOG_LAYOUT.blockGap },
  blockLabel: {
    fontSize: CATALOG_TYPE.sm,
    fontWeight: '700',
    letterSpacing: 0.72,
    textTransform: 'uppercase',
    color: CATALOG_COLOR.text,
    marginBottom: CATALOG_LAYOUT.blockLabelGap,
  },
  previewCard: {
    backgroundColor: CATALOG_COLOR.surface,
    borderWidth: 1,
    borderColor: CATALOG_COLOR.borderStrong,
    borderRadius: CATALOG_RADIUS.card,
    padding: CATALOG_SPACE.xl,
    gap: CATALOG_SPACE.md,
  },
  emptyText: { fontSize: CATALOG_TYPE.sm, fontStyle: 'italic', color: CATALOG_COLOR.textMuted },
});
```

- [ ] **Step 2: Confirm no new typecheck error classes** (same command and expectation as Task 4 Step 4).

- [ ] **Step 3: Commit (only with commit authority)**

```bash
git add native/catalog/SectionBlock.tsx
git commit -m "feat(catalog): render one catalog page per SectionBlock"
```

---

### Task 6: Shell, sidebar, filter field, and exports

**Files:**
- Rewrite: `native/catalog/CatalogShell.tsx`
- Rewrite: `native/catalog/CatalogSidebar.tsx`
- Modify: `native/catalog/CatalogSearchInput.tsx`
- Modify: `native/catalog/index.ts`

**Interfaces:**
- Consumes: Task 2 `orderedIds`, `groupLabelFor`, `neighbors`, `hashForId`, `idFromHash`, `filterGroups`; Task 5 `SectionBlock` and `SectionPager` (`previousId`/`nextId` — not `previous`/`next`).
- Produces: `CatalogShell({ appName, title, groups, sections })` — props unchanged; `CatalogSidebar({ logo, caption, groups, active, onPress })`.

- [ ] **Step 1: Replace `native/catalog/CatalogShell.tsx`**

```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, ScrollView, StyleSheet, Text, View, findNodeHandle } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_MAX_CONTENT_WIDTH, CATALOG_SPACE, CATALOG_TYPE } from './tokens';
import { CatalogSidebar } from './CatalogSidebar';
import { SectionBlock } from './SectionBlock';
import { groupLabelFor, hashForId, idFromHash, neighbors, orderedIds } from './catalogNavigation';
import type { NavGroup, SectionDef } from './types';

function isWeb(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

/** Move focus to a page title after navigation without scrolling the page on web. */
function focusElement(node: View | null): void {
  if (!node) return;
  if (Platform.OS === 'web') {
    (node as unknown as { focus?: (options?: { preventScroll?: boolean }) => void }).focus?.({ preventScroll: true });
    return;
  }
  const handle = findNodeHandle(node);
  if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
}

/** Return the main column to the top. On web, react-native-web's ScrollView.scrollTo does not
 *  reliably move a nested overflow container, so set scrollTop on the real DOM node. */
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
 * replaces the main content (no long scrolling document, no scroll-spy). On web the page lives in
 * the URL fragment (`#Button`), so refresh, deep links, and back/forward work; unknown fragments
 * open the first page. Desktop and laptop screens only.
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

  const scrollRef = useRef<ScrollView>(null);
  const headingRef = useRef<View>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const pushHistoryNext = useRef(false);
  const focusHeadingNext = useRef(false);

  const select = useCallback((id: TId) => {
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

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <CatalogSidebar logo={appName} caption={title} groups={groups} active={active} onPress={select} />
        <ScrollView ref={scrollRef} style={styles.main} contentContainerStyle={styles.mainContent}>
          {activeDef ? (
            <SectionBlock
              key={activeDef.id}
              def={activeDef}
              groupLabel={groupLabelFor(groups, activeDef.id)}
              breadcrumbRoot={appName}
              pager={{
                previousId: neighbors(order, activeDef.id).previous,
                nextId: neighbors(order, activeDef.id).next,
                onNavigate: select,
              }}
              headingRef={headingRef}
            />
          ) : (
            <Text style={styles.empty}>No catalog pages are available.</Text>
          )}
        </ScrollView>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: CATALOG_COLOR.pageBackground },
  main: { flex: 1 },
  mainContent: {
    width: '100%',
    maxWidth: CATALOG_MAX_CONTENT_WIDTH,
    paddingTop: CATALOG_LAYOUT.mainPaddingTop,
    paddingHorizontal: CATALOG_LAYOUT.mainPaddingX,
    paddingBottom: CATALOG_SPACE['3xl'],
  },
  empty: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.textMuted },
});
```

- [ ] **Step 2: Replace `native/catalog/CatalogSidebar.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { CATALOG_COLOR, CATALOG_LAYOUT, CATALOG_RADIUS, CATALOG_TYPE } from './tokens';
import { filterGroups } from './catalogNavigation';
import type { NavGroup } from './types';
import { CatalogSearchInput } from './CatalogSearchInput';

/** One nav link. Hover via onHoverIn/onHoverOut (react-native-web fires them; native never does);
 *  keyboard focus draws the catalog focus ring because react-native-web removes the browser's. */
function NavItem<TId extends string>({ id, active, onPress }: { id: TId; active: boolean; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      // react-native-web drops `selected` for links; aria-current is the web semantic for the open page.
      aria-current={active ? 'page' : undefined}
      style={({ pressed }) => [
        styles.item,
        (pressed || hovered) && styles.itemHover,
        active && styles.itemActive,
        focused && styles.focusRing,
      ]}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{id}</Text>
    </Pressable>
  );
}

/**
 * Catalog navigation: app name, caption, a filter field, and one link per page under grouped
 * headings. Selecting a link opens that page (CatalogShell owns which page is shown). The filter
 * narrows this list only and never changes the open page.
 */
export function CatalogSidebar<TId extends string>({
  logo,
  caption,
  groups,
  active,
  onPress,
}: {
  logo: string;
  caption: string;
  groups: NavGroup<TId>[];
  active: TId | undefined;
  onPress: (id: TId) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = filterGroups(groups, query);

  return (
    <View role="navigation" aria-label="Catalog pages" style={styles.sidebar}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.logo}>{logo}</Text>
        <Text style={styles.subtitle}>{caption}</Text>

        <CatalogSearchInput value={query} onChangeText={setQuery} placeholder="Filter components…" />

        {filtered.length === 0 && <Text style={styles.empty}>No matches</Text>}
        {filtered.map((group) => (
          <View key={group.label}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            {group.ids.map((id) => (
              <NavItem key={id} id={id} active={active === id} onPress={() => onPress(id)} />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: CATALOG_LAYOUT.sidebarWidth,
    backgroundColor: CATALOG_COLOR.surface,
    borderRightWidth: 1,
    borderRightColor: CATALOG_COLOR.borderHairline,
  },
  scroll: { flex: 1 },
  content: {
    paddingTop: CATALOG_LAYOUT.sidebarPaddingTop,
    paddingHorizontal: CATALOG_LAYOUT.sidebarPaddingX,
    paddingBottom: CATALOG_LAYOUT.sidebarPaddingTop,
  },
  logo: { fontSize: CATALOG_TYPE.brand, fontWeight: '800', color: CATALOG_COLOR.text },
  subtitle: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted, marginTop: 2, marginBottom: 20 },
  empty: { fontSize: CATALOG_TYPE.sm, color: CATALOG_COLOR.textMuted, paddingHorizontal: CATALOG_LAYOUT.navItemPaddingX, paddingVertical: 8 },
  groupLabel: {
    fontSize: CATALOG_TYPE.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: CATALOG_COLOR.text,
    marginTop: 22,
    marginBottom: 7,
    marginHorizontal: 8,
  },
  item: {
    minHeight: CATALOG_LAYOUT.controlSize,
    justifyContent: 'center',
    paddingVertical: CATALOG_LAYOUT.navItemPaddingY,
    paddingHorizontal: CATALOG_LAYOUT.navItemPaddingX,
    borderRadius: CATALOG_RADIUS.sm,
  },
  itemHover: { backgroundColor: CATALOG_COLOR.surfacePressed },
  itemActive: { backgroundColor: CATALOG_COLOR.accentSubtle },
  focusRing: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing },
  label: { fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.textMuted },
  labelActive: { color: CATALOG_COLOR.accent, fontWeight: '700' },
});
```

- [ ] **Step 3: Restyle `native/catalog/CatalogSearchInput.tsx`**

Apply:

```diff
--- a/native/catalog/CatalogSearchInput.tsx
+++ b/native/catalog/CatalogSearchInput.tsx
@@ -1,6 +1,6 @@
 import { useState } from 'react';
 import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
-import { CATALOG_TYPE, CATALOG_COLOR, CATALOG_SPACE, CATALOG_RADIUS } from './tokens';
+import { CATALOG_TYPE, CATALOG_COLOR, CATALOG_SPACE, CATALOG_RADIUS, CATALOG_LAYOUT } from './tokens';

 /**
  * Plain search input for filtering the catalog's own sidebar nav. Deliberately built from bare
@@ -17,8 +17,8 @@
   onChangeText: (text: string) => void;
   placeholder: string;
 }) {
-  // Focus darkens the box border — react-native-web resets the browser's default input focus ring,
-  // so the box has to draw its own indicator.
+  // Focus draws the catalog focus ring — react-native-web resets the browser's default input focus
+  // ring, so the box has to draw its own indicator.
   const [focused, setFocused] = useState(false);
   const [clearFocused, setClearFocused] = useState(false);
   // Hover via onHoverIn/Out, not the style callback's `hovered` — same reasoning as NavItem: this
@@ -63,11 +63,11 @@
 const styles = StyleSheet.create({
   box: {
     flexDirection: 'row', alignItems: 'center', gap: CATALOG_SPACE.xs,
-    borderWidth: 1, borderColor: CATALOG_COLOR.border, borderRadius: CATALOG_RADIUS.sm,
-    paddingHorizontal: 10, height: 36, marginBottom: CATALOG_SPACE.sm,
-    backgroundColor: CATALOG_COLOR.surface,
+    borderWidth: 1, borderColor: CATALOG_COLOR.borderHairline, borderRadius: CATALOG_RADIUS.control,
+    paddingHorizontal: 10, height: CATALOG_LAYOUT.controlSize, marginBottom: CATALOG_SPACE.sm,
+    backgroundColor: CATALOG_COLOR.surfaceMuted,
   },
-  boxFocused: { borderColor: CATALOG_COLOR.text },
+  boxFocused: { outlineWidth: CATALOG_LAYOUT.focusRingWidth, outlineStyle: 'solid', outlineColor: CATALOG_COLOR.focusRing },
   input: { flex: 1, fontSize: CATALOG_TYPE.md, color: CATALOG_COLOR.text, padding: 0 },
   clearButton: { borderRadius: CATALOG_RADIUS.sm },
   clearButtonActive: { backgroundColor: CATALOG_COLOR.surfacePressed },
```

- [ ] **Step 4: Update `native/catalog/index.ts`**

Apply:

```diff
--- a/native/catalog/index.ts
+++ b/native/catalog/index.ts
@@ -16,6 +16,9 @@
 export { CatalogSidebar } from './CatalogSidebar';
 export { CatalogSearchInput } from './CatalogSearchInput';
 export { SectionBlock } from './SectionBlock';
+export { ComparisonGrid } from './ComparisonGrid';
+export { ComparisonList } from './ComparisonList';
+export { ReferenceDetails } from './ReferenceDetails';
 export { PropsTable } from './PropsTable';
 export { VariantGroup } from './VariantGroup';
 export { TokenRow } from './TokenRow';
@@ -26,7 +29,7 @@
 export { TypeScaleGallery } from './TypeScaleGallery';
 export { buildComponentManifest } from './manifest';
 export type { ComponentManifestEntry, ManifestExample } from './manifest';
-export type { PropDef, SectionDef, NavGroup } from './types';
+export type { PropDef, SectionDef, NavGroup, SpecimenSize, ComparisonDef, ComparisonCell, ComparisonAxisItem } from './types';
 export {
   CATALOG_TYPE,
   CATALOG_TYPE_USE,
@@ -34,4 +37,6 @@
   CATALOG_SPACE_USE,
   CATALOG_RADIUS,
   CATALOG_COLOR,
+  CATALOG_LAYOUT,
+  CATALOG_MAX_CONTENT_WIDTH,
 } from './tokens';
```

- [ ] **Step 5: Run the tests and the typecheck delta**

Run: `cd native-preview && npm run test:catalog` — expected `ℹ pass 17`, `ℹ fail 0`. Then repeat Task 4 Step 4 — expected no new error codes.

- [ ] **Step 6: Restart the preview and smoke-test**

Restart the 5181 server, then open `http://localhost:5181/#Button`. Expected: the sidebar, one Button page, a 5×3 grid, and no red error overlay.

- [ ] **Step 7: Commit (only with commit authority)**

```bash
git add native/catalog/CatalogShell.tsx native/catalog/CatalogSidebar.tsx native/catalog/CatalogSearchInput.tsx native/catalog/index.ts
git commit -m "feat(catalog): show one selected page with a searchable sidebar"
```

---

### Task 7: Catalog content, framework catalog, and README

**Files:**
- Modify: `native/catalog/CatalogExample.tsx`
- Modify: `native/catalog/CatalogFrameworkExample.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `ComparisonDef`, `SectionDef.specimenSize` (Task 3); `SectionBlock` `headingLevel` (Task 5).

Content changes:
- Grids authored cell by cell: Button (Variant × State, 5×3), Badge (Tone × Icon, 5×4, compact), Avatar (Kind × Size, 3×3, compact), Pill (Selection × State, 2×4, compact). `variants` and `states` stay unchanged for the manifest and completeness check.
- `specimenSize: 'compact'` on Badge, Avatar, Pill, Switch, Checkbox, and Radio. Wide pages already set `itemsFill`, so they default to `wide`.
- Scroll-spy prose replaced in both catalogs; the framework demo gains a 2×2 grid with one genuinely unsupported cell and renders its heading as `h2`.

- [ ] **Step 1: Apply the `CatalogExample.tsx` change**

```diff
--- a/native/catalog/CatalogExample.tsx
+++ b/native/catalog/CatalogExample.tsx
@@ -7,7 +7,7 @@
  * `variants` list — one item per variant/state, laid out by SectionBlock itself — or a freeform
  * `render()` for content that isn't a simple list, e.g. token galleries) plus a `NavGroup[]` (how
  * those sections bucket in the sidebar), then hands both to a single `<CatalogShell />`, which owns
- * all the layout, scrolling, filtering, and scroll-spy.
+ * navigation, filtering, and showing one selected page at a time.
  *
  * Everything the catalog documents comes from `../components`; every token value it renders as data
  * comes from `../../tokens`. The framework itself (CatalogShell, SectionBlock, PropsTable, …) knows
@@ -107,7 +107,9 @@
 import { SpacingScaleGallery } from './SpacingScaleGallery';
 import { TypeScaleGallery } from './TypeScaleGallery';
 import { buildComponentManifest } from './manifest';
-import type { NavGroup, SectionDef } from './types';
+import type { ComparisonDef, NavGroup, SectionDef } from './types';
+import type { ButtonVariant } from '../components/Button';
+import type { BadgeVariant } from '../components/Badge';

 // Layout chrome for the live examples. Uses the real DS spacing scale for gaps; the components being
 // documented bring their own token-driven styling. Defined up top (not near its call sites further
@@ -216,10 +218,147 @@
   manifestBox: { maxHeight: 480, overflow: 'hidden' },
   manifestText: { ...DS_TYPOGRAPHY.bodyXs, fontFamily: 'Menlo', color: DS_SEMANTIC.text.regular },
 });
+
+// ── Grid comparisons ────────────────────────────────────────────────────────────────────────────
+// Each grid cell is a real instance with exactly the props its row and column name. Never build
+// these by multiplying `variants` with `states` — those are pre-rendered nodes and cannot combine.
+
+function grid(
+  rowLabel: string,
+  columnLabel: string,
+  rows: { key: string; label: string }[],
+  columns: { key: string; label: string }[],
+  cell: (row: string, column: string) => React.ReactNode,
+  size?: ComparisonDef['size'],
+): ComparisonDef {
+  return {
+    rowLabel,
+    columnLabel,
+    rows,
+    columns,
+    cells: rows.flatMap((row) => columns.map((column) => ({ rowKey: row.key, columnKey: column.key, node: cell(row.key, column.key) }))),
+    size,
+  };
+}
+
+// Button: Variant × State. `white` keeps the dark backdrop its variant requires.
+const BUTTON_COMPARISON = grid(
+  'Variant',
+  'State',
+  [
+    { key: 'primary', label: 'Primary' },
+    { key: 'secondary', label: 'Secondary' },
+    { key: 'tertiary', label: 'Tertiary' },
+    { key: 'white', label: 'White' },
+    { key: 'ghost', label: 'Ghost' },
+  ],
+  [
+    { key: 'default', label: 'Default' },
+    { key: 'disabled', label: 'Disabled' },
+    { key: 'loading', label: 'Loading' },
+  ],
+  (row, column) => {
+    const button = (
+      <Button
+        label="Continue"
+        variant={row as ButtonVariant}
+        disabled={column === 'disabled'}
+        loading={column === 'loading'}
+        onPress={() => {}}
+      />
+    );
+    return row === 'white' ? <View style={demo.darkBackdrop}>{button}</View> : button;
+  },
+);

+// Badge: Tone × Icon layout. One icon per tone, matching the Variants examples.
+const BADGE_TONES: { key: BadgeVariant; label: string; text: string; icon: React.ComponentProps<typeof Badge>['leadingIcon'] }[] = [
+  { key: 'neutral', label: 'Neutral', text: 'Local', icon: 'pin' },
+  { key: 'info', label: 'Info', text: 'Notice', icon: 'info-circle' },
+  { key: 'positive', label: 'Positive', text: 'On time', icon: 'circle-check' },
+  { key: 'warning', label: 'Warning', text: 'Delayed', icon: 'triangle-alert' },
+  { key: 'negative', label: 'Negative', text: 'Suspended', icon: 'circle-slash' },
+];
+const BADGE_COMPARISON = grid(
+  'Tone',
+  'Icon',
+  BADGE_TONES.map(({ key, label }) => ({ key, label })),
+  [
+    { key: 'label-only', label: 'Label only' },
+    { key: 'leading-icon', label: 'Leading icon' },
+    { key: 'trailing-icon', label: 'Trailing icon' },
+    { key: 'icon-only', label: 'Icon-only' },
+  ],
+  (row, column) => {
+    const tone = BADGE_TONES.find((t) => t.key === row)!;
+    if (column === 'icon-only') return <Badge variant={tone.key} leadingIcon={tone.icon} accessibilityLabel={tone.text} />;
+    return (
+      <Badge
+        variant={tone.key}
+        label={tone.text}
+        leadingIcon={column === 'leading-icon' ? tone.icon : undefined}
+        trailingIcon={column === 'trailing-icon' ? tone.icon : undefined}
+      />
+    );
+  },
+  'compact',
+);
+
+// Avatar: content Kind × Size (Avatar's `size` is continuous; 24 / 40 default / 64 is the sweep).
+const AVATAR_COMPARISON = grid(
+  'Kind',
+  'Size',
+  [
+    { key: 'image', label: 'Image' },
+    { key: 'icon', label: 'Icon' },
+    { key: 'initials', label: 'Initials fallback' },
+  ],
+  [
+    { key: 'small', label: 'Small · 24' },
+    { key: 'medium', label: 'Medium · 40 (default)' },
+    { key: 'large', label: 'Large · 64' },
+  ],
+  (row, column) => {
+    const size = column === 'small' ? 24 : column === 'large' ? 64 : 40;
+    if (row === 'image') return <Avatar imageUrl="https://i.pravatar.cc/100" accessibilityLabel="Jordan Lee" size={size} />;
+    if (row === 'icon') return <Avatar iconName="users" accessibilityLabel="Guest" size={size} />;
+    return <Avatar initials="JL" accessibilityLabel="Jordan Lee" size={size} />;
+  },
+  'compact',
+);
+
+// Pill: Selection × State.
+const PILL_COMPARISON = grid(
+  'Selection',
+  'State',
+  [
+    { key: 'selected', label: 'Selected' },
+    { key: 'not-selected', label: 'Not selected' },
+  ],
+  [
+    { key: 'icon-text', label: 'Icon + Text' },
+    { key: 'icon-only', label: 'Icon-only' },
+    { key: 'disabled', label: 'Disabled' },
+    { key: 'loading', label: 'Loading' },
+  ],
+  (row, column) => (
+    <Pill
+      label="Home"
+      variant={row === 'selected' ? 'selected' : 'not_selected'}
+      iconName="home"
+      showText={column !== 'icon-only'}
+      accessibilityLabel="Home"
+      disabled={column === 'disabled'}
+      loading={column === 'loading'}
+      onPress={() => {}}
+    />
+  ),
+  'compact',
+);
+
 // ─── Section-id union ─────────────────────────────────────────────────────────
 // One string literal per documented section. Threaded through CatalogShell/CatalogSidebar as `TId`
-// so the sidebar nav + scroll-spy stay typed to this exact set.
+// so the sidebar nav and page navigation stay typed to this exact set.
 type SectionId =
   | 'Button'
   | 'ButtonGroup'
@@ -996,6 +1135,7 @@
   {
     id: 'Button',
     path: 'native/components/Button',
+    comparison: BUTTON_COMPARISON,
     description:
       'The primary tap target. Five visual weights, three sizes, optional leading/trailing icon, plus loading and icon-only modes.',
     whenToUse: 'An action — something happens on tap. For a tappable chip that just flips a persistent selected state, use Pill instead.',
@@ -1064,6 +1204,8 @@
   {
     id: 'Pill',
     path: 'native/components/Pill',
+    specimenSize: 'compact',
+    comparison: PILL_COMPARISON,
     description: 'A compact selectable chip — selected/unselected states with an optional leading icon.',
     whenToUse: "A selection toggle, not an action — tapping it flips a persistent selected state. If tapping it should instead make something happen, use Button.",
     a11y: 'Pressable with accessibilityLabel; an icon-only pill (showText={false}) needs an explicit accessibilityLabel so it is announced.',
@@ -1398,6 +1540,8 @@
   {
     id: 'Badge',
     path: 'native/components/Badge',
+    specimenSize: 'compact',
+    comparison: BADGE_COMPARISON,
     description: 'A small status chip — five semantic variants, with optional leading/trailing icons or icon-only.',
     whenToUse: "Read-only and inline, not tappable — for one row's data point. For a tappable chip with a selected state, use Pill; for a message about the whole screen, use Toast or Banner.",
     a11y: 'A plain View with text; the label carries the meaning, so avoid encoding status by color alone.',
@@ -1440,6 +1584,8 @@
   {
     id: 'Avatar',
     path: 'native/components/Avatar',
+    specimenSize: 'compact',
+    comparison: AVATAR_COMPARISON,
     description: 'A circular image, or an initials fallback on a solid fill when there\'s no image (or it fails to load).',
     a11y: 'Renders with accessibilityRole="image"; pass accessibilityLabel for a meaningful name, otherwise it falls back to the initials text.',
     props: [
@@ -1649,6 +1795,7 @@
   {
     id: 'Switch',
     path: 'native/components/Switch',
+    specimenSize: 'compact',
     description: 'A boolean on/off toggle. The thumb slides and the track crossfades colour, sharing SegmentedToggle/UnderlineTabs\' own slide-animation hook for a consistent motion feel.',
     whenToUse: 'A setting that takes effect immediately, no separate save step. For recording a fact a future action (like a form submit) will act on, use Checkbox; for one-of-many exclusive selection, use Radio.',
     a11y: 'Renders a Pressable with accessibilityRole="switch" and accessibilityState.checked — pass accessibilityLabel to say what it controls.',
@@ -1676,6 +1823,7 @@
   {
     id: 'Checkbox',
     path: 'native/components/Checkbox',
+    specimenSize: 'compact',
     description: 'A square selection control — the box fills with the accent colour and a checkmark when checked.',
     whenToUse: 'An independent on/off fact about this one item — any number can be checked at once. For a setting that takes effect immediately, use Switch; for one-of-many exclusive selection, use Radio.',
     a11y: 'Renders a Pressable with accessibilityRole="checkbox" and accessibilityState.checked; the optional label doubles as its accessibilityLabel.',
@@ -1700,6 +1848,7 @@
   {
     id: 'Radio',
     path: 'native/components/Radio',
+    specimenSize: 'compact',
     description: 'A single circular selection control — a filled dot appears in the ring when selected. A group of mutually-exclusive Radios is just multiple instances sharing one selected value in the consumer.',
     whenToUse: 'One selection from a mutually-exclusive set — checking one should un-check another. For an independent on/off fact, use Checkbox; for a setting that takes effect immediately, use Switch.',
     a11y: 'Renders a Pressable with accessibilityRole="radio" and accessibilityState.selected; the optional label doubles as its accessibilityLabel.',
@@ -2769,7 +2918,7 @@

 /**
  * The whole design-system catalog for this template, ready to drop into an Expo app (e.g. render it
- * from a dev-only route). CatalogShell owns layout, scrolling, filtering, and scroll-spy — this file
+ * from a dev-only route). CatalogShell owns navigation, filtering, and the one-page layout — this file
  * only supplies the data.
  */
 export function CatalogExample() {
```

- [ ] **Step 2: Apply the `CatalogFrameworkExample.tsx` change**

```diff
--- a/native/catalog/CatalogFrameworkExample.tsx
+++ b/native/catalog/CatalogFrameworkExample.tsx
@@ -140,7 +140,7 @@
     <View style={demo.diagramFrame}>
       <SidebarSwatch />
       <View style={demo.diagramMainCol}>
-        <Text style={demo.diagramPageTitle}>Component Catalog</Text>
+        <Text style={demo.diagramPageTitle}>Pill</Text>
         <View style={demo.diagramBlock} />
         <View style={demo.diagramBlock} />
       </View>
@@ -187,12 +187,26 @@
     items: [
       { key: 'default', name: 'Default', node: <Text style={demo.mockText}>(the component's live example goes here)</Text> },
       { key: 'disabled', name: 'Disabled', node: <Text style={demo.mockText}>(a disabled instance)</Text> },
+    ],
+  },
+  // Two props that combine freely become a grid. Every cell is authored; B genuinely has no
+  // disabled look, so that cell says so instead of faking one.
+  comparison: {
+    rowLabel: 'Variant',
+    columnLabel: 'State',
+    rows: [{ key: 'a', label: 'A (default)' }, { key: 'b', label: 'B' }],
+    columns: [{ key: 'default', label: 'Default' }, { key: 'disabled', label: 'Disabled' }],
+    cells: [
+      { rowKey: 'a', columnKey: 'default', node: <Text style={demo.mockText}>A</Text> },
+      { rowKey: 'a', columnKey: 'disabled', node: <Text style={demo.mockText}>A, disabled</Text> },
+      { rowKey: 'b', columnKey: 'default', node: <Text style={demo.mockText}>B</Text> },
+      { rowKey: 'b', columnKey: 'disabled', unavailableReason: 'B has no disabled look' },
     ],
   },
 };

 function SectionBlockDemo() {
-  return <SectionBlock def={mockSectionDef} />;
+  return <SectionBlock def={mockSectionDef} headingLevel={2} />;
 }

 function PropsTableDemo() {
@@ -270,14 +284,14 @@
   {
     id: 'CatalogShell',
     path: 'native/catalog/CatalogShell.tsx',
-    description: 'The whole catalog page — sticky sidebar + scrollable main column with scroll-spy. Hand it your sections and groups; it owns layout, scrolling, filtering, and each section\'s own columns. You\'re reading a live CatalogShell right now — this page and the Native App DS Template catalog are both one.',
+    description: 'The whole catalog — a persistent, searchable sidebar plus one selected page. Selecting a page replaces the main content; on web the page is kept in the URL fragment (#Button) so refresh, deep links, and back/forward work. Desktop and laptop screens only. You\'re reading a live CatalogShell right now.',
     hide: { states: true, props: true, accessibility: true },
     render: () => <ShellDiagram />,
   },
   {
     id: 'CatalogSidebar',
     path: 'native/catalog/CatalogSidebar.tsx',
-    description: 'Sticky sidebar: logo/caption, a filter box, and grouped nav links with scroll-spy highlighting. Used internally by CatalogShell — you\'d reach for it directly only to build a custom shell. The filter narrows the jump-list only; every section still renders on the page below it, unfiltered.',
+    description: 'Catalog navigation: app name, caption, a filter box, and grouped links, one per page. Selecting a link opens that page; the filter narrows this list only and never changes the open page. Used internally by CatalogShell.',
     hide: { states: true, props: true, accessibility: true },
     render: () => <SidebarDiagram />,
   },
@@ -291,7 +305,7 @@
   {
     id: 'SectionBlock',
     path: 'native/catalog/SectionBlock.tsx',
-    description: 'One documented component: title, description, file path, then either a single "Tokens" column (for `tokenGallery` sections — raw token data with no component API to document, like Colors/Spacing/Type Scale below) or up to three columns — Variants, States / Configurations, and Props+Accessibility — in that order. "States / Configurations" isn\'t only strict boolean toggles (disabled, loading) — it also covers optional content slots and structural modes that aren\'t the primary enum, so the name doesn\'t overclaim. A column with nothing to show still renders by default, with a plain sentence saying so; pass `hide` to remove specific columns entirely instead of blanking them out — every section in this catalog does exactly that (`hide: { states, props, accessibility }`), which is why you\'re seeing only a Variants column here. The live example below is a full, un-hidden SectionBlock documenting a mock component with real variants/states/props/a11y — the default shape when nothing is hidden.',
+    description: 'One catalog page: breadcrumb, title, description, previous/next, then the specimens in one of three layouts — a grid (two props that combine freely, from `comparison`), a list (one axis, in one shared card), or a full-width preview (`render()` and token galleries) — then always-visible Guidance, Quick reference, and Props. Columns and cells are at most 402px wide with 16px padding. The demo below is a standalone SectionBlock with a mock grid, including one genuinely unsupported cell.',
     hide: { states: true, props: true, accessibility: true },
     render: () => <SectionBlockDemo />,
   },
```

- [ ] **Step 3: Apply the `README.md` change**

````diff
--- a/README.md
+++ b/README.md
@@ -78,22 +78,23 @@
   `SectionBlock`, `PropsTable`, `VariantGroup`, `TokenRow`, `DividedStack`) plus its own
   Colors/Spacing/Type Scale token pages (`native/catalog/tokens.ts` — `CATALOG_*`, independent of
   the host app's DS tokens) — a catalog of the catalog tool itself, useful when you're extending the
-  framework rather than the DS. `SectionBlock` renders one of two fixed layouts: a component section
-  (title, description, file path, then three 512px columns — Variants, States, and a combined
-  Props+Accessibility column — in that order, every time, even for a section with nothing to put in
-  one of them, which shows a plain sentence like "No additional states documented." instead of just
-  omitting the column) or a `tokenGallery` section (a single "Tokens" column only — Colors/Spacing/
-  Type Scale below are raw token data, not a component with its own states/props/accessibility to
-  document, so those columns are skipped entirely rather than padded with "nothing to show" text).
-  Whichever column is tallest sets the row's height, and every other column's card stretches to
-  match, so every column's bottom edge lands flush; the same gap value is used both between columns
-  and between Props and Accessibility within the third. Every individual variant/state item is
-  captioned with its own `name` (e.g. "Primary", "Icon-only") so it's clear which value each instance
-  demonstrates. `VariantGroup`/`DividedStack` aren't used by either layout (each slot gets its own
-  card, so there's no in-card divider to draw) — they're still exported building blocks for a
-  `render()` that needs an inline sub-heading or a divided list, like `ColorsGallery`'s own two
-  swatch groups.
+  framework rather than the DS.

+Each catalog shows **one page at a time**: a persistent, searchable sidebar and the selected page.
+On web the page is kept in the URL fragment (`#Button`), so refresh, deep links, and back/forward
+work. Desktop and laptop screens only. `SectionBlock` renders one page: breadcrumb, title,
+description, previous/next, then the specimens in one of three layouts, then always-visible
+**Guidance**, **Quick reference** (source path, accessibility), and **Props**:
+- **Grid** — two props that combine freely, from an explicit `comparison` (e.g. Button's
+  Variant × State).
+- **List** — one axis, in one shared card whose cells wrap into balanced rows.
+- **Preview** — free-form `render()` content and token galleries, full width.
+
+Grid columns and list cells are at most 402px wide with 16px padding. A page's `specimenSize`
+(`compact` 160px, `regular` 240px, `wide` 402px) sets the minimum width; full-width (`itemsFill`)
+slots default to `wide`. The catalog's own look comes from `native/catalog/tokens.ts`, never from
+the host app's tokens.
+
 ```tsx
 import { CatalogExample } from '@ds/native/catalog/CatalogExample';
 // or: import { CatalogFrameworkExample } from '@ds/native/catalog/CatalogFrameworkExample';
@@ -114,25 +115,31 @@
 - `index.ts` — re-export.

 Then add a `SectionDef` for it (id, path, description, props, a11y, and its content) to
-`native/catalog/CatalogExample.tsx`, and to `native/components/index.ts`. `SectionBlock` always shows
-four sections — Variants, States, Props, Accessibility — so give it whichever of these two fields
+`native/catalog/CatalogExample.tsx`, and to `native/components/index.ts`. `SectionBlock` shows the
+specimens first, then Guidance, Quick reference, and Props. Give it whichever of these fields
 actually apply:
+- `comparison: { rowLabel, columnLabel, rows, columns, cells, size? }` — when two props genuinely
+  combine. Author every row × column cell with a real instance, or an `unavailableReason` when that
+  combination does not exist. Never multiply `variants` by `states` to fill it. Keep the column axis
+  within what fits a 1280px laptop: 5 compact, 3 regular, or 2 wide columns. `states` items whose
+  key matches a row or column key are not repeated below the grid.
+- `specimenSize: 'compact' | 'regular' | 'wide'` — the page's specimen width class.
 - `variants: { desc?, align?, itemsFill?, items: [{ key, name, node }] }` — one item per prop enum
   value (e.g. every `variant`). If the component has no `variant`-like prop at all, still include one
   item named `"Default"` showing its plain look — the Variants column should never be empty.
 - `states: { desc?, align?, itemsFill?, items: [{ key, name, node }] }` — one item per meaningfully
   distinct boolean state (`loading`, `disabled`, icon-only, …). Fine to omit if there are none.

-Every item's `name` is shown as a small caption under it (e.g. `"Primary"`, `"Icon-only"`) — use the
-actual variant/state value, not a generic label. Omitting `states` shows "No additional states
-documented." — don't invent items just to fill the column. Set `itemsFill: true` on a slot whose
+Every item's `name` is shown as its cell caption (e.g. `"Primary"`, `"Icon-only"`) — use the
+actual variant/state value, not a generic label. Omitting `states` shows "No additional states or
+configurations documented." — don't invent items just to fill it. Set `itemsFill: true` on a slot whose
 items are wide, block-level components (Banner, Card, Toast, InputField) rather than small ones meant
 to sit centered (Button, Badge, Pill). Reach for `render()` instead of `variants` only when the
 content isn't a simple list of instances (a live demo with local state, a wrapping grid); its output
-fills the Variants column as-is. For a token-gallery section with no component API at all (raw token
+renders in a full-width Preview card. For a token-gallery section with no component API at all (raw token
 data, not a component — see `ColorsGallery`/`SpacingGallery`/`TypographyGallery`), set
-`tokenGallery: true` instead of `props`/`a11y`/`states` — `SectionBlock` then renders a single
-"Tokens" column around `render()`'s output and skips States/Props/Accessibility entirely.
+`tokenGallery: true` instead of `props`/`a11y`/`states` — `SectionBlock` then renders `render()`'s
+output under a "Tokens" label and skips the reference details entirely.

 ## What's included

````

Save each of the three patches above to a file and run `git apply --check <file>`, then `git apply <file>`. If a check fails because the file changed, re-apply the same content by hand. Do not overwrite newer work.

- [ ] **Step 4: Run tests, the typecheck delta, and a smoke test**

Run `npm run test:catalog` (expected `ℹ pass 17`) and the Task 4 Step 4 delta (no new codes). Restart the preview, then load `http://localhost:5181/#Badge` and `http://localhost:5181/?catalog=framework#SectionBlock`. Expected: both render with no `[Catalog]` validation warnings in the Metro log.

- [ ] **Step 5: Commit (only with commit authority)**

```bash
git add native/catalog/CatalogExample.tsx native/catalog/CatalogFrameworkExample.tsx README.md
git commit -m "feat(catalog): author grids and document the one-page catalog"
```

---

### Task 8: Rendered verification and durable evidence

**Files:**
- Create: `docs/design/evidence/2026-10-06-studio-matrix/` (screenshots)
- Create: `docs/design/evidence/2026-10-06-studio-matrix/VERIFICATION.md`

Use the controlled browser against `http://localhost:5181` at **1280×900** unless stated. Measure with `js()`; do not judge geometry by eye. Read the Metro log after every row.

- [ ] **Step 1: Run the rendered matrix**

| # | Viewport | Route / action | Pass criteria |
|---|---|---|---|
| R1 | 1280×900 | `/#Button` | One `[aria-level="1"]`, text `Button`. One `[role=table]`: 6 rows × 4 columns, cells 277px (±1). Every `[role=cell]`/`[role=columnheader]` padding 16px. A list labeled "Other configurations": 6 items, 3 per row, cells 316px. It does not contain Loading or Disabled. `scrollWidth <= innerWidth`. |
| R2 | 1280×900 | `/#Badge`, `/#Pill`, `/#Avatar` | Badge 6×5 table rows/cols including headers, cells 208px. Pill 3×5. Avatar 4×4, then a one-item "Other configurations" list (Custom colour). No "Missing example" text. |
| R3 | 1280×900 | `/#Switch`, `/#Banner` | Switch: states list of 4 in one row, 237px cells. Banner: two lists, cells exactly 402px, 2 per row, 3 rows, one blank cell. |
| R4 | 1600×900 | `/#Button` | Grid columns ≤ 402px. List cells ≤ 402px. Content column ≤ 1200px. |
| R5 | 1280×900 | `/#Colors`, `/#SavedTrips` | Colors: a "Tokens" block, no table, no reference card. SavedTrips: a "Preview" card; switching Map/List once works. |
| R6 | 1280×900 | Filter `but`, then `zzz` | `but` shows Button, ButtonGroup, InputClearButton. `zzz` shows "No matches". The open page is unchanged in both. |
| R7 | 1280×900 | First page, then `/#Manifest` | Previous reads "No previous page" with `aria-disabled=true` on the first page. Next is disabled on Manifest. Elsewhere each moves one page in sidebar order. |
| R8 | 1280×900 | `/#Badge`; `/#Nope`; click Card, then Back | Badge opens directly. `#Nope` opens the first page and the fragment is corrected. Card pushes `#Card` and focuses its heading. Back returns, and `[aria-current=page]` follows. |
| R9 | 1280×900 | Tab through sidebar rows and pager | Focus ring 3px `rgb(201, 215, 255)`. Sidebar rows ≥ 44px tall; pager buttons 44×44; filter field 44px tall. |
| R10 | 1280×900 | Visual system | Page background `#f6f6f4`; sidebar 264px wide with a `#dddddd` right border; active row `#e9efff` with a `#174dc6` bold label; grid and list cards with a `#d7d7d7` border and 14px radius; reference card with a 12px radius; title 28px. |
| R11 | 1280×900 | `/?catalog=framework#SectionBlock` | One `h1`. The demo heading is `h2`. One table with "Not supported — B has no disabled look". |
| R12 | all rows | Metro log | No new errors. Only the baseline `react-native-svg` errors (`Icon.native`, `Loading`) appear; list them in VERIFICATION.md. No `[Catalog]` warnings except pre-existing completeness warnings, also listed. |

- [ ] **Step 2: Store durable evidence**

Save screenshots for R1, R2 (Badge), R3 (Banner), R5 (Colors), R10, and R11 into `docs/design/evidence/2026-10-06-studio-matrix/`. Also save one side-by-side composite: the layouts reference at 1280×900 next to R1. Record each file's `shasum -a 256` in `VERIFICATION.md` with the row results, the tsc delta, and the unit test totals.

- [ ] **Step 3: Commit (only with commit authority)**

```bash
git add docs/design/evidence/2026-10-06-studio-matrix
git commit -m "docs(catalog): record Studio Matrix verification evidence"
```

---

### Task 9: Independent review of the frozen result

**Trigger:** a new information architecture across the shell, sidebar, and page renderer, plus web history and focus behavior.

- [ ] **Step 1: Freeze the candidate.** Record `git rev-parse HEAD` and `git diff --stat origin/main...HEAD`.
- [ ] **Step 2: One fresh, read-only Claude Opus review** through `/Users/woohopark/.hermes/scripts/claude_guarded_run.py` with `HERMES_HOME=/Users/woohopark/.hermes/profiles/app-design`, role `read_only`, tools `Read`, `Grep`, `Glob` only. Provide the spec, this plan, `git diff origin/main...HEAD`, and `VERIFICATION.md`. Ask for spec conformance, accessibility, and truthful-specimen findings, classified Critical, Important, or Minor.
- [ ] **Step 3: One correction pass** for Critical and Important findings only. Re-run the affected Task 8 rows. Re-review only if blocking findings changed the reviewed result.

---

## Spec coverage check

| Spec requirement | Task |
|---|---|
| One selected page; no full list in main content | 6 |
| Persistent searchable sidebar, 264px, "No matches" | 2, 6 |
| Breadcrumb, title, description, source path, previous/next (disabled at ends) | 2, 4, 5 |
| Grid, list, preview chosen by specimen size and laptop fit | 3, 4, 5, 7 |
| Columns and cells ≤ 402px; 16px padding; comfortable only | 3, 4 |
| One shared list card with balanced rows | 3, 4 |
| Reference details always visible, no collapse | 4, 5 |
| Authored grids; validation warnings; no fabricated cells | 3, 4, 7 |
| Whole-catalog visual system; `#666` secondary text | 1, 4, 5, 6 |
| Deep link, invalid fallback, back/forward | 2, 6 |
| Focus to heading after navigation; focus ring; 44px controls | 5, 6 |
| Table semantics; current-page link semantics; no new motion | 4, 6 |
| Desktop and laptop only | Global constraints |
| No usage-location feature; no density toggle | Global constraints; R1 |
| Fidelity acceptance with durable evidence | 8 |

## Estimates (agent time)

| Task | Estimate |
|---|---|
| 0 Preflight | 10 min |
| 1 Tokens | 15 min |
| 2 Navigation | 15 min |
| 3 Layout contract | 20 min |
| 4 Grid, list, reference | 20 min |
| 5 Page | 15 min |
| 6 Shell, sidebar, filter | 25 min |
| 7 Content and README | 25 min |
| 8 Verification and evidence | 45 min |
| 9 Review and one correction pass | 45 min |
| **Total** | **≈4 hours** active. First useful checkpoint (Button page renders) after Task 6, ≈2 hours in. |

## Report-only findings

- `npx tsc` fails before any change because `native/` cannot resolve `react`/`react-native` types from `native-preview/`. Fixing that is out of scope; tasks use a no-new-error-code delta instead.
- The unchanged catalog logs `react-native-svg` errors from product components on web (`Icon.native`, `Loading`). Product components are out of scope.
- `buildComponentManifest()` does not include `comparison` or `specimenSize`. The manifest still describes `variants`/`states` truthfully.
- The framework catalog does not document the three new renderers (`ComparisonGrid`, `ComparisonList`, `ReferenceDetails`). Adding pages for them would expand scope.
- Only Button, Badge, Avatar, and Pill get grids. Loading stays two lists because its size props differ by variant.

## Separate authorizations (none granted)

1. Implementation of this plan.
2. Commits on the feature branch.
3. Pushing or opening a pull request.
4. Merging.
5. Publishing or deploying the catalog.
