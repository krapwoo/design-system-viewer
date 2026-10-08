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
component's exact props/variants/states as structured data (not prose), see
`native/catalog/manifest.ts`'s `buildComponentManifest()`, also rendered live at the catalog's
"Manifest" page.

## The one rule

**Components consume _semantic_ tokens, never raw hexes or magic numbers.** That is what makes a
rebrand a two-file edit. Read tokens directly: `import { DS_SEMANTIC } from '.../tokens'`.

## Peer dependencies

`react`, `react-native` assumed, plus: `react-native-svg` (icons + LoadingCircle),
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

## What's included

Tokens · Icons (44) · and generic components:
Button · Badge · Divider · LoadingCircle · Card · NestedCard · SectionHeader · Banner · Status ·
FieldContainer · InputField · TextArea · InputClearButton · SearchField · Pill · PillRow ·
SegmentedToggle · UnderlineTabs · Toast · ProgressDots · Shimmer · Collapsible · AnimatedChevron.

Deliberately **not** included (app/overlay-specific, port per project): gesture bottom sheets, nav
bars, modals, and any domain components. They depend on navigation/gesture stacks that vary by app.

## Porting to another platform later

The token layer (`starter-kit/tokens/`) and icon data (`starter-kit/icons/paths.ts`,
`starter-kit/icons/types.ts`) are already platform-neutral — no React Native or DOM imports. Only
`starter-kit/components/` and the `Icon.native.tsx` renderer are RN-specific. When you need this
design system on another platform (web, desktop via Tauri/Electron, etc.), that's a translation of
`starter-kit/components/` against those same tokens and icon data — a `web/` (or other) tree was built this way once already for this exact
template and later removed to keep the template single-platform until it's actually needed; ask
for that port again when you're ready rather than maintaining an unused second tree in the meantime.
