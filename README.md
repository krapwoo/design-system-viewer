# Design System Template

A reusable **React Native / Expo** design-system starter — one token layer feeding a native
component tree, plus a browsable catalog.

Drop it into a new project, rebrand the tokens, and build.

```
design-system-template/
├── starter-kit/     ← the starter kit: copied, never imported, into a new project by `init --new`
│   ├── tokens/          ONE source of truth (colors, spacing, radius, type, shadow). Platform-neutral.
│   ├── icons/           shared SVG path data + the native (react-native-svg) renderer
│   ├── components/…     one folder per component: Component.tsx, .types.ts, index.ts, and a
│   │                    finished Component.catalog.tsx documenting it
│   ├── pages/           standalone pages (token galleries, Icons, recipes, Manifest)
│   └── WHEN_TO_USE.md   the deciding question behind every pair of similar components
├── native/catalog/  ← the viewer itself — app-agnostic, ships in the published package
└── kit-host/        ← this repo's own view of the starter kit; depends on this package via
                        `file:..`; `npm run kit:dev` opens it (not part of the published package —
                        see "Developing this repository" below)
```

## Using `@krapwoo/ds-viewer` in your own project

**New project:**

```bash
npx @krapwoo/ds-viewer init --new
npm install
npm run ds-viewer dev
```

`init --new` checks Expo/Node/package requirements, installs `react-native-svg` and
`react-native-safe-area-context` if your project doesn't have them yet (via `expo install`), then
copies the starter kit above into `src/ds/` — pass `--kit-root <path>` to put it somewhere else.
Every component already has a finished example page; `ds-viewer dev` opens the catalog immediately
with no further authoring needed. Running `init --new` again only adds whatever is still missing —
it never overwrites a file you've already edited.

**Existing project:**

```bash
npx @krapwoo/ds-viewer init --existing
npm install
```

`init --existing` detects your component folders and token modules and, after you confirm the list
it prints (`--yes` skips the prompt), writes `ds-viewer.config.ts`, a draft
`<Export>.catalog.tsx` beside each detected component (marked "needs examples" — nothing is
invented), a `ds-viewer` package script, a `@krapwoo/ds-viewer` devDependency entry, and a
`.ds-viewer/` entry in `.gitignore`.

Running `npx @krapwoo/ds-viewer init` with neither `--new` nor `--existing` asks which one you
want, interactively. `init --yes` alone (no `--new`/`--existing`) skips that question and sets up
an existing project instead — the same default `--yes` always had in 0.1, so a script that already
calls `init --yes` keeps working unchanged. The `npm install` above is what actually fetches the
devDependency `init` added — `init` can only add the entry, not invoke your package manager.

Either way, then:

```bash
npm run ds-viewer dev    # opens the catalog in a browser, re-syncing on every file change
npm run ds-viewer sync   # regenerates component/token/page data without starting a server
npm run ds-viewer doctor   # checks every page for drift and coverage gaps (--json, --ci)
npm run ds-viewer explain <Page>   # prints why a page's specimens are laid out the way they are
```

`ds-viewer.config.ts` fields: `name`, `logo` (optional — a path to an image asset, shown in the
sidebar beside the name, or in place of it for a wide wordmark; validated at `sync`/`dev` time
and bundled into the preview workspace), `components`, `exclude`, `tokens`, `pages`, `groupOrder`, `starterKit` (new-project only —
records the kit's version), `updateCheck`, `doctor` — see `config/index.ts`'s `DsViewerConfig` for
each field's exact meaning. Write a page with `defineCatalogPage()` from `@krapwoo/ds-viewer` (same
shape as a `SectionDef`, minus `id`/`path`/`props`, plus `component`, `group`, and `propNotes`).

`logo`'s own shape decides how it renders, not a separate setting: a roughly square or modestly
wide image appears as a small mark beside the name; one more than twice as wide as it is tall
replaces the name entirely as a wordmark. A missing file just warns and falls back to the name
only. Use PNG if your project transforms SVG imports into components (Metro would otherwise try to
bundle the logo as a React component, not an image).

The package ships `native/catalog/` as TypeScript source, not pre-built JavaScript — your own
project's `tsc`/Metro compiles it under your own compiler options, the same as any other local file.

## Developing this repository

This repository views its own starter kit the same way a real user would: `kit-host/` is a small
Expo project that depends on `@krapwoo/ds-viewer` via `file:..` and points its `ds-viewer.config.ts`
at `../starter-kit/`. From the repo root:

```bash
npm run kit:dev          # builds the CLI, then opens the starter kit's own catalog
npm run check:catalog    # the same headless check CI runs — every page, zero console errors
```

`kit-host/` also hosts `viewer-pages/` — standalone catalog pages (not shipped in the package)
documenting the viewer framework's own pieces (`CatalogShell`, `SectionBlock`, `ComparisonGrid`,
…), shown under a "Viewer" group alongside the starter kit's own pages.

## Picking the right component

Several components look alike but solve different problems (InputField vs. SearchField vs.
Dropdown, Toast vs. Banner, Dialog vs. BottomSheet, …). See **[WHEN_TO_USE.md](./starter-kit/WHEN_TO_USE.md)**
for the deciding question behind each pair before reaching for the closest-looking one. For a
component's exact props as structured data (not prose), see `@krapwoo/ds-viewer/generated` (built
live by `sync` from source), also rendered live at the catalog's "Manifest" page.

## The one rule

**Components consume _semantic_ tokens, never raw hexes or magic numbers.** That is what makes a
rebrand a two-file edit. Read tokens directly: `import { DS_SEMANTIC } from '.../tokens'`.

## Peer dependencies

`react`, `react-native` assumed, plus: `react-native-svg` (icons + Loading's circle variant),
`react-native-safe-area-context` (catalog shell only — not required by the components themselves).

## Rebranding (make it yours)

1. **Palette** — edit `starter-kit/tokens/palette.ts`: swap the six hue scales for your brand's (keep the 0–800
   shape).
2. **Semantic** — in `starter-kit/tokens/semantic.ts`, re-point any role you want to shift (e.g. make `emphasis.info`
   your brand blue). Every component re-themes automatically.
3. **Type** — adjust `starter-kit/tokens/typography.ts` (sizes/weights) and set your font family at the app root.

Nothing else needs touching — components reference roles, not values.

## Using the components

```tsx
import { Button } from './src/ds/components/Button';   // after `init --new` (default --kit-root)
import { Badge } from './src/ds/components/Badge';

<Button label="Save" variant="primary" onPress={save} />
<Badge variant="positive" label="On time" leadingIcon="check" />
```

## Browsing the catalog

`native/catalog/` is a framework-only package (`CatalogShell`, `SectionBlock`, `PropsTable`, …) —
it has no runnable app of its own and no hand-assembled example anymore. A page is just a
`*.catalog.tsx` file next to its component (or a standalone one for tokens/recipes), written with
`defineCatalogPage()`; `ds-viewer dev` discovers them, generates their props tables from your real
component source, and serves the whole thing as one app you never have to add a route for.

Each catalog shows **one page at a time**: a persistent, searchable sidebar and the selected page.
On web the page is kept in the URL fragment (`#Button`), so refresh, deep links, and back/forward
work. Desktop and laptop screens only. `SectionBlock` renders one page: breadcrumb, title,
description, previous/next, then the specimens, then always-visible
**Guidance** and **Quick reference** (source path, accessibility), then **Props** in their own box
(two columns, filled across first, when there are 4+ props and room). Token pages show only
Quick reference with the source path. The specimens use one of four layouts:
- **Grid** — two props that combine freely, from an explicit `comparison` (e.g. Button's
  Variant × State).
- **Grouped rows** — one row per variant holding that variant's own configurations (e.g.
  Loading's circle sizes and linear thicknesses), when `states` items name a variant in `group`.
- **List** — one axis, in one shared card whose cells wrap into balanced rows.
- **Preview** — `render()` content. Component previews render at phone width (402px), optionally
  with more widths such as a 320px small phone; token galleries and catalog chrome stay full width.

When a page has two blocks, the catalog places them side by side if that makes the page at least
120px shorter (e.g. Dropdown), and stacks them otherwise. A block with nothing to show is omitted.

Grid columns and list cells are at most 402px wide with 16px padding. A page's `specimenSize`
(`compact` 160px, `regular` 240px, `wide` 402px) sets the minimum width; full-width (`itemsFill`)
slots default to `wide`. The catalog's own look comes from `native/catalog/tokens.ts`, never from
the host app's tokens.

## Adding a component (the recipe)

Copy the shape of an existing pair, e.g. `starter-kit/components/Button/` or `starter-kit/components/Badge/`:
- `<Name>.tsx` — `StyleSheet.create`, import tokens from `../../tokens`, icons from
  `../../icons/Icon.native`.
- `<Name>.types.ts` — export `<Name>Props` (+ any `<Name>Variant`).
- `index.ts` — re-export.

Then add a `<Name>.catalog.tsx` file next to it, written with `defineCatalogPage()` (description,
a11y, and its content — `id`/`path`/`props` are derived, never authored), and export it from
`src/ds/components/index.ts` the same way its siblings are. `SectionBlock` shows the
specimens first, then Guidance, Quick reference, and Props. Give it whichever of these fields
actually apply:
- `comparison: { rowLabel, columnLabel, rows, columns, cells, size? }` — when two props genuinely
  combine. Author every row × column cell with a real instance, or an `unavailableReason` when that
  combination does not exist. Never multiply `variants` by `states` to fill it. Keep the column axis
  within what fits a 1280px laptop: 5 compact, 3 regular, or 2 wide columns. `states` items whose
  key matches a row or column key are not repeated below the grid.
- `specimenSize: 'compact' | 'regular' | 'wide'` — the page's specimen width class.
- `group` on a `states` item — the `variants` key it belongs to (a size that only exists for one
  variant). Grouped states render one row per variant; ungrouped ones go to "Other configurations".
- `previewWidths: [402, 320]` — extra preview widths for a `render()` page (each capped at 402).
  `CatalogShell`'s `defaultPreviewWidths="full"` keeps a catalog's previews full width.
- `variants: { desc?, align?, itemsFill?, items: [{ key, name, node }] }` — one item per prop enum
  value (e.g. every `variant`). If the component has no `variant`-like prop at all, still include one
  item named `"Default"` showing its plain look — the Variants column should never be empty.
- `states: { desc?, align?, itemsFill?, items: [{ key, name, node }] }` — one item per meaningfully
  distinct boolean state (`loading`, `disabled`, icon-only, …). Fine to omit if there are none.

Every item's `name` is shown as its cell caption (e.g. `"Primary"`, `"Icon-only"`) — use the
actual variant/state value, not a generic label. Omit `states` when there are none — the page simply
shows no States block; don't invent items just to fill it. Set `itemsFill: true` on a slot whose
items are wide, block-level components (Banner, Card, Toast, InputField) rather than small ones meant
to sit centered (Button, Badge, Pill). Reach for `render()` instead of `variants` only when the
content isn't a simple list of instances (a live demo with local state, a wrapping grid); its output
renders in a Preview card (phone width for components). For a token-gallery section with no component API at all (raw token
data, not a component — see `ColorsGallery`/`SpacingGallery`/`TypographyGallery`), set
`tokenGallery: true` instead of `props`/`a11y`/`states` — `SectionBlock` then renders `render()`'s
output full width under a "Tokens" label and shows only a Quick reference card with the source
path.

## Keeping the catalog current

### Binding examples to props

A grid's row or column axis can name the real prop it demonstrates:

```tsx
import { defineCatalogPage, grid } from '@krapwoo/ds-viewer';

comparison: grid(
  'Variant', 'State',
  { prop: 'variant', items: [
    { key: 'primary', label: 'Primary' },
    { key: 'ghost', label: 'Ghost' },
  ] },
  [{ key: 'default', label: 'Default' }, { key: 'disabled', label: 'Disabled' }],
  (row, column) => <Button variant={row} disabled={column === 'disabled'} onPress={() => {}} />,
),
```

Only a prop typed as a string-literal union (2 or more options) can be bound this way; each item's
`key` must then be a real option of that prop. An axis that doesn't name a single real prop (e.g.
"which of three optional props is set," or a continuous `number`) stays a plain array of
`{ key, label }` — just as valid, and never flagged by `doctor`. `variants`/`states` list items use
the existing `props` tag (`{ key: 'ghost', props: { variant: 'ghost' }, node: ... }`) the same way.
Binding is what lets `doctor` tell you precisely when a renamed or removed option leaves a stale
example behind, instead of you finding out by reading the diff.

### `npx ds-viewer doctor`

Reads every page with the TypeScript compiler — it never imports a page file or runs app code.
Human output is grouped by page, each issue with a one-line fix:

```
Button
  [error] bound-option-removed: The row "outline" is bound to "variant", which no longer has that option.
    Fix: Delete this row, or update its key to a current option of "variant".

0 errors, 1 warning — 38 components (37 with examples), 2 unbound examples.
```

- `--json` prints the same report as stable, versioned data: `{ version: 1, summary: { errors, warnings, components, withExamples, unboundExamples }, update: null, issues: [{ id, severity, page?, file?, line?, message, fix }] }`. `update` is always `null` in this release (filled in starting 0.4's update check); `file` is always relative to the project root. `line` is populated for a `page-parse-error` found by typechecking a page file (see below), and always `undefined` for every other issue id — threading a real position through every rule is future work.
- `--ci` exits 1 only when an error was found — a warning alone never fails CI, and `--ci` never makes a network call.
- `doctor.strict: true` in `ds-viewer.config.ts` promotes every warning to an error, for both the summary counts and `--ci`'s exit code.
- A page whose layout data (`specimenSize`, `group`, grid `rows`/`columns`, list items' `key`/`name`/`props`/`group`, `propNotes` keys) isn't a literal — written as something other than a literal value, array, object, or a same-file `const` reference — gets one "page not statically checkable" warning. A page file that fails to parse *or typecheck* is `page-parse-error` instead: every page file is also run through the TypeScript type checker (the same way a component file already is), so a genuine syntax or type error in a page is reported with its line.

### `npx ds-viewer explain <Page>`

Prints each layout decision with its reason, using the exact same pure functions the catalog itself
renders with:

```
Button
Grid (Variant × State)
  5 rows × 3 columns (regular); 3 of 3 max regular columns used — fits a 1280px laptop.
```

Side-by-side placement depends on a real measured height, so by default `explain` reports it as
"decided in the viewer." Pass `--heights <firstBlockPx>,<secondBlockPx>` to check that decision here
too, assuming a 1280px laptop (952px content width) the same way `doctor`'s own column-limit check
does. `--json` is available on `explain` as well.

### The `AGENTS.md` section and GitHub Action

`npx @krapwoo/ds-viewer init` (either path) appends a short section to `AGENTS.md` between
`<!-- ds-viewer:start v1 -->`/`<!-- ds-viewer:end -->` markers — creating the file if it doesn't
exist — telling an AI working on the project to update a page alongside its component, bind
examples to props, never invent grid cells or groups, and run `doctor`/`explain` before finishing.
It also writes `.github/workflows/ds-viewer.yml`, a SHA-pinned Action that installs dependencies
(picking `npm ci`, `pnpm install --frozen-lockfile`, or `yarn install --immutable` from whichever
lockfile the project has at that moment) and then runs `npx ds-viewer doctor --ci` on every pull
request. Both are written once; re-running `init` adds
either one only if it's missing (an `AGENTS.md` without the start marker counts as missing the
section, even if the file already has other content) and never touches anything outside its own
markers or its own file.

## What's included

Tokens · Icons (45) · and generic components:
AnimatedChevron · Avatar · Badge · Banner · BottomSheet · Button · ButtonGroup · Card · Checkbox ·
Dialog · Divider · Dock · Dropdown · EmptyState · FieldContainer · InputClearButton · InputField ·
List · ListItem · Loading · Pill · PillRow · ProgressDots · Radio · SearchField · SectionHeader ·
SegmentedToggle · Shimmer · Surface · Switch · TextArea · Toast · Tooltip · TopNav · UnderlineTabs.

Deliberately **not** included: any domain-specific component. Everything here depends only on
generic navigation/gesture stacks (`BottomSheet`, `Dialog`, `Dock`, `TopNav` are included) — what's
left out is app content, not app chrome.

## Porting to another platform later

The token layer (`starter-kit/tokens/`) and icon data (`starter-kit/icons/paths.ts`,
`starter-kit/icons/types.ts`) are already platform-neutral — no React Native or DOM imports. Only
`starter-kit/components/` and the `Icon.native.tsx` renderer are RN-specific. When you need this
design system on another platform (web, desktop via Tauri/Electron, etc.), that's a translation of
`starter-kit/components/` against those same tokens and icon data — a `web/` (or other) tree was built this way once already for this exact
template and later removed to keep the template single-platform until it's actually needed; ask
for that port again when you're ready rather than maintaining an unused second tree in the meantime.
