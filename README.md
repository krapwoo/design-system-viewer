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
  framework rather than the DS. `SectionBlock` renders one of two fixed layouts: a component section
  (title, description, file path, then three 512px columns — Variants, States, and a combined
  Props+Accessibility column — in that order, every time, even for a section with nothing to put in
  one of them, which shows a plain sentence like "No additional states documented." instead of just
  omitting the column) or a `tokenGallery` section (a single "Tokens" column only — Colors/Spacing/
  Type Scale below are raw token data, not a component with its own states/props/accessibility to
  document, so those columns are skipped entirely rather than padded with "nothing to show" text).
  Whichever column is tallest sets the row's height, and every other column's card stretches to
  match, so every column's bottom edge lands flush; the same gap value is used both between columns
  and between Props and Accessibility within the third. Every individual variant/state item is
  captioned with its own `name` (e.g. "Primary", "Icon-only") so it's clear which value each instance
  demonstrates. `VariantGroup`/`DividedStack` aren't used by either layout (each slot gets its own
  card, so there's no in-card divider to draw) — they're still exported building blocks for a
  `render()` that needs an inline sub-heading or a divided list, like `ColorsGallery`'s own two
  swatch groups.

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
`native/catalog/CatalogExample.tsx`, and to `native/components/index.ts`. `SectionBlock` always shows
four sections — Variants, States, Props, Accessibility — so give it whichever of these two fields
actually apply:
- `variants: { desc?, align?, itemsFill?, items: [{ key, name, node }] }` — one item per prop enum
  value (e.g. every `variant`). If the component has no `variant`-like prop at all, still include one
  item named `"Default"` showing its plain look — the Variants column should never be empty.
- `states: { desc?, align?, itemsFill?, items: [{ key, name, node }] }` — one item per meaningfully
  distinct boolean state (`loading`, `disabled`, icon-only, …). Fine to omit if there are none.

Every item's `name` is shown as a small caption under it (e.g. `"Primary"`, `"Icon-only"`) — use the
actual variant/state value, not a generic label. Omitting `states` shows "No additional states
documented." — don't invent items just to fill the column. Set `itemsFill: true` on a slot whose
items are wide, block-level components (Banner, Card, Toast, InputField) rather than small ones meant
to sit centered (Button, Badge, Pill). Reach for `render()` instead of `variants` only when the
content isn't a simple list of instances (a live demo with local state, a wrapping grid); its output
fills the Variants column as-is. For a token-gallery section with no component API at all (raw token
data, not a component — see `ColorsGallery`/`SpacingGallery`/`TypographyGallery`), set
`tokenGallery: true` instead of `props`/`a11y`/`states` — `SectionBlock` then renders a single
"Tokens" column around `render()`'s output and skips States/Props/Accessibility entirely.

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
