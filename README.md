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
description, previous/next, then the specimens in one of three layouts, then always-visible
**Guidance**, **Quick reference** (source path, accessibility), and **Props**:
- **Grid** — two props that combine freely, from an explicit `comparison` (e.g. Button's
  Variant × State).
- **List** — one axis, in one shared card whose cells wrap into balanced rows.
- **Preview** — free-form `render()` content and token galleries, full width.

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
- `variants: { desc?, align?, itemsFill?, items: [{ key, name, node }] }` — one item per prop enum
  value (e.g. every `variant`). If the component has no `variant`-like prop at all, still include one
  item named `"Default"` showing its plain look — the Variants column should never be empty.
- `states: { desc?, align?, itemsFill?, items: [{ key, name, node }] }` — one item per meaningfully
  distinct boolean state (`loading`, `disabled`, icon-only, …). Fine to omit if there are none.

Every item's `name` is shown as its cell caption (e.g. `"Primary"`, `"Icon-only"`) — use the
actual variant/state value, not a generic label. Omitting `states` shows "No additional states or
configurations documented." — don't invent items just to fill it. Set `itemsFill: true` on a slot whose
items are wide, block-level components (Banner, Card, Toast, InputField) rather than small ones meant
to sit centered (Button, Badge, Pill). Reach for `render()` instead of `variants` only when the
content isn't a simple list of instances (a live demo with local state, a wrapping grid); its output
renders in a full-width Preview card. For a token-gallery section with no component API at all (raw token
data, not a component — see `ColorsGallery`/`SpacingGallery`/`TypographyGallery`), set
`tokenGallery: true` instead of `props`/`a11y`/`states` — `SectionBlock` then renders `render()`'s
output under a "Tokens" label and skips the reference details entirely.

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
