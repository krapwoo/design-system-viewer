# Design System Template

A reusable **React Native / Expo** design-system starter — one token layer feeding a native
component tree, plus a browsable catalog.

Drop it into a new project, rebrand the tokens, and build.

```
design-system-template/
├── tokens/          ← ONE source of truth (colors, spacing, radius, type, shadow). Platform-neutral.
│   ├── palette.ts       raw color scale (0–800 per hue)
│   ├── semantic.ts      role tokens (surface / text / emphasis / shade / border …)
│   ├── scales.ts        spacing · radius · icon-size
│   ├── typography.ts    type scale + font weights
│   ├── shadow.ts        elevation (RN style objects)
│   └── index.ts         barrel
├── icons/           ← shared SVG path DATA + the native renderer
│   ├── paths.ts         platform-neutral icon geometry
│   ├── types.ts         IconName union
│   ├── Icon.native.tsx  react-native-svg renderer
│   └── index.ts         barrel (data + types only)
├── native/          ← React Native / Expo components + catalog
│   ├── components/…     one folder per component (Component.tsx, .types.ts, index.ts)
│   └── catalog/         app-agnostic catalog framework (RN) + CatalogExample.tsx
└── native-preview/  ← dev-only Expo shell for browsing the catalog in a browser (not part
                        of the reusable template — see "Browsing the catalog" below)
```

## Using `@krapwoo/ds-viewer` in your own project

This repository is also the source of the `@krapwoo/ds-viewer` npm package — a CLI and viewer
for browsing *your own* app's components, not this template's. In an existing Expo app:

```bash
npx @krapwoo/ds-viewer init
npm install
```

`init` detects your component folders and token modules and, after you confirm the list it prints
(`--yes` skips the prompt), writes `ds-viewer.config.ts`, a draft `<Export>.catalog.tsx` beside
each detected component (marked "needs examples" — nothing is invented), a `ds-viewer` package
script, a `@krapwoo/ds-viewer` devDependency entry, and a `.ds-viewer/` entry in `.gitignore`. The
`npm install` above is what actually fetches that devDependency — `init` can only add the entry,
not invoke your package manager. Then:

```bash
npm run ds-viewer dev    # opens the catalog in a browser, re-syncing on every file change
npm run ds-viewer sync   # regenerates component/token/page data without starting a server
```

`ds-viewer.config.ts` fields in 0.1: `name`, `components`, `exclude`, `tokens`, `pages`,
`groupOrder` — see `config/index.ts`'s `DsViewerConfig` for each field's exact meaning. Write a
page with `defineCatalogPage()` from `@krapwoo/ds-viewer` (same shape as this template's own
`SectionDef`, minus `id`/`path`/`props`, plus `component`, `group`, and `propNotes`).

The package ships `native/catalog/` as TypeScript source, not pre-built JavaScript — your own
project's `tsc`/Metro compiles it under your own compiler options, the same as any other local file.

## Picking the right component

Several components look alike but solve different problems (InputField vs. SearchField vs.
Dropdown, Toast vs. Banner, Dialog vs. BottomSheet, …). See **[WHEN_TO_USE.md](./WHEN_TO_USE.md)**
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

1. **Palette** — edit `tokens/palette.ts`: swap the six hue scales for your brand's (keep the 0–800
   shape).
2. **Semantic** — in `tokens/semantic.ts`, re-point any role you want to shift (e.g. make `emphasis.info`
   your brand blue). Every component re-themes automatically.
3. **Type** — adjust `tokens/typography.ts` (sizes/weights) and set your font family at the app root.

Nothing else needs touching — components reference roles, not values.

## Using the components

```tsx
import { Button } from '@ds/native/components/Button';
import { Badge } from '@ds/native/components/Badge';

<Button label="Save" variant="primary" onPress={save} />
<Badge variant="positive" label="On time" leadingIcon="check" />
```

## Browsing the catalog

`native/catalog/` is a framework-only package (`CatalogShell`, `SectionBlock`, `PropsTable`, …) —
it has no runnable app of its own. It ships two worked examples, both built the same way (drop
either behind a dev-only route in your Expo app):

- `native/catalog/CatalogExample.tsx` — **"Native App DS Template"**: documents this template's own
  DS components (Button, Card, Banner, …).
- `native/catalog/CatalogFrameworkExample.tsx` — **"Design System DS Catalog"**: documents the
  catalog framework's own eight pieces (`CatalogShell`, `CatalogSidebar`, `CatalogSearchInput`,
  `SectionBlock`, `PropsTable`, `VariantGroup`, `TokenRow`, `DividedStack`) plus its own
  Colors/Spacing/Type Scale token pages (`native/catalog/tokens.ts` — `CATALOG_*`, independent of
  the host app's DS tokens) — a catalog of the catalog tool itself, useful when you're extending the
  framework rather than the DS.

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

```tsx
import { CatalogExample } from '@ds/native/catalog/CatalogExample';
// or: import { CatalogFrameworkExample } from '@ds/native/catalog/CatalogFrameworkExample';
// e.g. render one from a `?ds=1` dev route, mirroring the pattern this template's source project used.
```

For a quick browser preview without a host app, see `native-preview/` — a minimal throwaway Expo
shell (not part of the reusable template) that renders both via `expo start --web`:
- `http://localhost:5181/` → CatalogExample ("Native App DS Template")
- `http://localhost:5181/?catalog=framework` → CatalogFrameworkExample ("Design System DS Catalog")

## Adding a component (the recipe)

Copy the shape of an existing pair, e.g. `native/components/Button/` or `native/components/Badge/`:
- `<Name>.tsx` — `StyleSheet.create`, import tokens from `../../../tokens`, icons from
  `../../../icons/Icon.native`.
- `<Name>.types.ts` — export `<Name>Props` (+ any `<Name>Variant`).
- `index.ts` — re-export.

Then add a `SectionDef` for it (id, path, description, props, a11y, and its content) to
`native/catalog/CatalogExample.tsx`, and to `native/components/index.ts`. `SectionBlock` shows the
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

The token layer (`tokens/`) and icon data (`icons/paths.ts`, `icons/types.ts`) are already
platform-neutral — no React Native or DOM imports. Only `native/` (components + catalog) and the
`Icon.native.tsx` renderer are RN-specific. When you need this design system on another platform
(web, desktop via Tauri/Electron, etc.), that's a translation of `native/` against those same
tokens and icon data — a `web/` (or other) tree was built this way once already for this exact
template and later removed to keep the template single-platform until it's actually needed; ask
for that port again when you're ready rather than maintaining an unused second tree in the meantime.
