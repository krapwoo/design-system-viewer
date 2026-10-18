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
npm run ds-viewer explain --all   # every page's geometry as JSON, to diff across versions
npm run ds-viewer layout-diff before.json after.json   # what an upgrade changed about your layout
```

### Seeing what an upgrade changes

Layout rules live in this package and reach your catalog on `update`, while your page files never
change. So a new version can reshape a page with nothing in your repository to explain it. Snapshot
before and after, and the change becomes something you can read:

```
npx ds-viewer explain --all > before.json   # on the version you have
# ...upgrade...
npx ds-viewer explain --all > after.json
npx ds-viewer layout-diff before.json after.json
```

```
0.6.11 → 0.7.0, measured at 952px

Layout changes on 3 pages: Banner, EmptyState, Shimmer.

Banner
  its two blocks can no longer share a row
```

The snapshot holds what can be decided without a browser: each block's kind and minimum width;
list blocks add specimen size, item count, and column×row geometry at full and half width, while
token-section blocks add section count and their responsive column×row geometry. For a two-block
page, `sideEligible` records every gate known before measurement: both blocks must keep their minimum
width and both must still fit one row at half width. Eligibility is not the outcome — placement also
weighs a single tall specimen and the height actually saved, and neither is knowable without measuring
a real render.

Snapshots taken at different widths refuse to compare, since geometry at 952px and 1112px
legitimately differs and diffing them would report changes that never happened.

Only one `dev` serves a project at a time. A second one refuses, naming the port the first is on,
because both would generate into the same `.ds-viewer/` and overwrite each other's files — the
loser then serves a workspace that no longer describes it, which Expo reports as an unresolvable
`main` field rather than as a second server. To run two deliberately, give one its own directory
with `--workspace-dir .ds-viewer-second`. A lock left behind by a crashed `dev` never blocks the
next one.

`.ds-viewer/` belongs to the running server, and it repairs it. If something outside the server
deletes the generated files while it is serving, it says so and writes them back, rather than
leaving Expo to report an unresolvable `main` field — which names your project's `package.json`, a
file that is fine and that you never touched:

```
Something outside this server deleted package.json, app.json, tsconfig.json, metro.config.js,
entry.tsx from .ds-viewer/. Rewriting them — your project is fine, this is the catalog's own
generated workspace. If the catalog looks broken, reload the page.
Restarting Metro so the catalog picks the files back up — the page reloads itself in a few seconds.
```

Metro is restarted as part of the repair, because rewriting the files is not enough on its own: it
keeps serving the module map it cached before they went missing, and answers every request with
`Unable to resolve "expo" from "entry.tsx"` until it starts again. The server stays up and the page
reloads itself.

The repair is capped at five per run: if something is deleting continuously, repairing forever
would only hide it, so past the cap the server stops and keeps reporting. If you ever see that
message, what else was running at the time would be useful on
[issue #41](https://github.com/krapwoo/design-system-viewer/issues/41) — the cause is not yet
identified.

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

The viewer's own building blocks (`CatalogShell`, `SectionBlock`, `ComparisonGrid`, the catalog's
own colours and type, …) are documented in a separate catalog for people working on ds-viewer
itself, so the starter kit's catalog shows only what a project using the kit gets:

```bash
npm run viewer:dev       # opens viewer-host/, the DS Viewer internals catalog (not shipped)
```

`check:catalog`, `check:doctor` and `check:types` cover both catalogs.

## Contributing

Found a bug or an improvement while using ds-viewer in your app? Open an issue or a pull request:
[CONTRIBUTING.md](CONTRIBUTING.md) explains how to try a change in your own app before opening
one, and what every pull request needs.

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
Quick reference with the source path. Guidance, Quick reference, and — only for a page with
confirmed `composedOf` entries — Composition lay out from the reference card's own measured inner
width, not viewport width alone: three columns side by side only when there's confirmed composition
*and* the card is wide enough for all three (Composition gets its own column only then; otherwise
it stays nested under Quick reference, as it always has), two when there's room for Guidance and
Quick reference side by side, or one stacked column — in full document order, nothing dropped —
when the card is too narrow even for two. The specimens use one of four layouts:
- **Grid** — two props that combine freely, from an explicit `comparison` (e.g. Button's
  Variant × State).
- **Grouped rows** — one row per variant holding that variant's own configurations (e.g.
  Loading's circle sizes and linear thicknesses), when `states` items name a variant in `group`.
- **List** — one axis, in one shared card whose cells wrap into balanced rows.
- **Preview** — `render()` content. Component previews render at phone width (402px), optionally
  with more widths such as a 320px small phone; token galleries and catalog chrome stay full width.

When a page has two blocks, the catalog places them side by side — the row split into two equal
columns, each block filling its own — if both keep their minimum width there and it makes the page
at least 120px shorter (e.g. Dropdown); otherwise they stack, each filling the whole row. A block
with nothing to show is omitted.

Every card fills the column it is given, and its columns or cells share that width equally: a
two-column grid is as wide as a five-column one, and a two-item list is as wide as a six-item one.
Phone width (402px, 370px of content) caps the specimen inside a cell, not the cell. A page's
`specimenSize` (`compact` 160px, `regular` 240px, `wide` 402px) sets the minimum column width — a
card narrower than its minimum scrolls inside itself rather than squeezing its cells. Full-width
(`itemsFill`) slots default to `wide`. The catalog's own look comes from `native/catalog/tokens.ts`,
never from the host app's tokens.

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
- `specimenSize: 'compact' | 'regular' | 'wide' | 'page'` — the page's specimen width class. `'page'`
  is for components wider than a phone (a whole screen layout, a catalog page): cells are at least
  512px and share the row, with no 402px cap.
- `specimenSurface: 'auto' | 'neutral' | 'white' | 'dark' | 'transparent'` — the fill of each
  example's cell (list, grouped and grid cells, and a non-token `render()` preview). Defaults to
  `'auto'`: after the page draws, a cell turns light gray only when its own example would vanish
  against white (its largest coloured box is near-white with no visible border, like a white card,
  sheet or neutral banner; a shadow alone doesn't count). Neighbouring examples keep a white cell,
  and most pages need nothing. Override it when the guess is wrong: `'neutral'` makes every example
  cell gray, `'white'` or `'transparent'` keeps them all white, and `'dark'` checks a light
  component on a dark fill. Detection runs in the browser viewer; elsewhere cells stay white.
  Token galleries and sections are never filled.
- A `variants`/`states` item's own `fill`/`surface`/`align` — override the page's `specimenSurface`
  (above), stretch just *this* item's wrapper to the row's full width, or change how its content
  aligns inside that wrapper, for one instance that needs any of the three independently of its
  siblings (e.g. a single `fullWidth` Button among otherwise compact, centered ones, or one
  white-on-white example that needs its own gray backing even though the page's guess is right for
  every other item). Omit any of them to inherit the slot's/page's own default: `fill` inherits the
  slot's `itemsFill` (an explicit `fill: false` still overrides an inherited `itemsFill: true`), and
  `align` defaults to centered, or to a stretched, full-width fill specimen's own content when
  `fill` is set — a capped-width `fill` specimen that still wants centering (e.g. a phone-frame
  preview) sets `align: 'center'` explicitly. The same `fill`/`surface`/`align` fields exist on each
  authored `comparison` cell too, independently per cell, for exactly the same reasons.
- `variants`/`states`' own `maxColumns: 1 | 2 | 3 | 4 | 5` — caps how many columns that slot's list
  ever wraps into (e.g. a 3-item size scale that should always read as one row of exactly 3, never
  more just because a laptop is wide). A narrow window still drops below the cap when it has to —
  `maxColumns` only ever lowers the natural, width-based column count, never raises it.
- `group` on a `states` item — the `variants` key it belongs to (a size that only exists for one
  variant). Grouped states render one row per variant; ungrouped ones go to "Other configurations".
- `composedOf: [{ component, role, relationship }]` — what this component is built from or
  composed with, shown in Composition (its own column when space permits, otherwise under Quick reference). `relationship` is
  `'built-in'` for a component that's part of this one's own implementation — always rendered, or
  rendered only for some of its variants/states (e.g. Toast is built from a Banner),
  `'slot'` for an optional caller-supplied child (e.g. a `leadingIcon`
  prop), or `'related'` for a component commonly used alongside this one without either containing
  the other. `component` should be a real component or page id: while you browse the catalog in
  development, an unknown name logs a `[Catalog]` warning in the browser console. `doctor` doesn't
  check it, and it never fails a build — e.g.
  `composedOf: [{ component: 'Icon', role: 'Leading glyph', relationship: 'slot' }]`.
- `BoundedOverlayViewport` — wrap one demo whose own modal/sheet/portal would otherwise escape its
  card and cover the whole catalog page (React Native Web's `Modal` portals into `document.body`;
  no wrapper or `overflow: hidden` gives it a different boundary). Opt in per item, never per page:
  ```tsx
  import { BoundedOverlayViewport, comparisonCellItemKey } from '@krapwoo/ds-viewer';

  { key: 'full-height', name: 'Full height', node: (
    <BoundedOverlayViewport pageId="Sheet" slot="states" itemKey="full-height" width={360} height={600}>
      <MyOverlayDemo />
    </BoundedOverlayViewport>
  ) }
  ```
  Here `MyOverlayDemo` is your existing stateful wrapper around the real component, not a viewer
  export. `itemKey` is that item's own `VariantExample.key` for a `variants`/`states` item, or
  `comparisonCellItemKey(rowKey, columnKey)` (import it — never join the two keys yourself; a plain
  `${rowKey}:${columnKey}` is ambiguous whenever either key already contains a colon) for a
  `comparison` cell. `width` is only a maximum — the stage still shrinks to whatever its real
  owning cell actually has at a narrower width — and `height` is the child document's exact usable
  height, never renegotiated; both must be finite and strictly positive or the specimen shows an
  honest "This example is unavailable right now." instead of an iframe sized to a meaningless
  bound. Browser-only: it opens a same-origin child document that boots this catalog's own app
  entry/module/provider tree, so the wrapped demo's overlay opens inside that document's own
  viewport instead of the outer page's `document.body`; the two documents stay independently
  owned, with no shared memory or provider identity between them. On a native runtime, and inside
  the one child document that the address itself selects, `children` render inline with no
  boundary — never read either case as native containment parity.
- `previewWidths: [402, 320]` — extra preview widths for a `render()` page (each capped at 402).
  Add a second width only when the component looks different there (labels truncate, a row
  wraps); otherwise it's the same picture twice. Leave it out by default.
- **`PhoneFrame`** — wrap a demo that is a whole screen or opens an overlay (a sheet, a dialog, a
  toast sliding in, a dropdown's picker) in `<PhoneFrame>`. It is a real device: the demo lays out
  in an iPhone SE viewport (375 × 667 points), scaled down only when its cell is narrower. In the
  browser viewer it opens that example in its own device-sized document, so overlays that portal
  to the page (React Native's `Modal`) open inside the phone, not over the catalog.
- **`OverlayDemo`** — a phone with a catalog button that opens an overlay. Children get
  `{ open, close }`; keep the overlay mounted and drive its own `visible` from `open`, so its
  animations play. `keepTrigger` makes the button a toggle; `triggerLabel` can follow the state;
  `initiallyOpen` starts it open.
  ```tsx
  <OverlayDemo triggerLabel="Open sheet">
    {({ open, close }) => (
      <BottomSheet visible={open} onDismiss={close} footer={<Dock><Button label="Confirm" onPress={close} /></Dock>}>
        …
      </BottomSheet>
    )}
  </OverlayDemo>
  ```
- **`PhoneScreen`** — a whole app screen inside a `PhoneFrame`: `header` stays at the top,
  `footer` at the phone's bottom, and the children scroll between them instead of pushing the
  footer off the screen. `floating` is a layer over the top for toasts (position its content
  yourself); `bodyWrapper` puts your own surface around the scrolling body.
  ```tsx
  <PhoneFrame>
    <PhoneScreen header={<TopNav title="Saved trips" />} footer={<Dock>…</Dock>}>…</PhoneScreen>
  </PhoneFrame>
  ```
- Full-width (`itemsFill`) variants and states wrap at most **3** across; set `maxColumns` to
  change that. A filled example that keeps its own fixed width is centred in its cell.
  Default to one preview; add a second width only when a narrower (or wider) viewport actually
  changes something worth comparing — wrapping, truncation, or reflow — not just to show the same,
  identically-laid-out content twice. `CatalogShell`'s `defaultPreviewWidths="full"` keeps a
  catalog's previews full width.
- `previewLayout: 'table'` — opt in to one shared, bordered card for a `render()` page's widths,
  instead of the default `'frames'` (one bordered frame per width, side by side; unchanged unless
  you set this). Each width keeps its own caption and stays an independent, stateful live instance
  either way — `'table'` only changes how they're grouped visually. Widths that don't fit the
  available space side by side wrap to stacked columns, each still captioned, rather than scrolling
  or shrinking below their requested size. Has no effect on a `'full'` preview width (catalog
  chrome) or a token gallery — those always render as `'frames'`.
- `variants: { desc?, align?, itemsFill?, items: [{ key, name, node }] }` — one item per prop enum
  value (e.g. every `variant`). If the component has no `variant`-like prop at all, still include one
  item named `"Default"` showing its plain look — a page that documents its component through a
  `variants` list should never leave that column empty. This doesn't mean every page must use
  `variants`: a page that reaches for `render()` instead (see below) has no Variants column to fill
  in the first place.
- `states: { desc?, align?, itemsFill?, items: [{ key, name, node }] }` — one item per meaningfully
  distinct boolean state (`loading`, `disabled`, icon-only, …). Fine to omit if there are none.

Every item's `name` is shown as its cell caption (e.g. `"Primary"`, `"Icon-only"`) — use the
actual variant/state value, not a generic label. Omit `states` when there are none — the page simply
shows no States block; don't invent items just to fill it. Avoid a static prop matrix (a `states`
item, or a `comparison` cell, for every combination) when two configurations only actually look
different mid-transition and render identically at rest, or when the "closed" side of a toggle is
just a redundant blank cell next to its "open" counterpart — show that behavior with one interactive
example instead, with its own working toggle, rather than several now-identical static ones. Set
`itemsFill: true` on a slot whose items are wide, block-level components (Banner, Card, Toast,
InputField) rather than small ones meant to sit centered (Button, Badge, Pill).

A `variants`/`states` item's `node` can be a plain instance, or a small stateful wrapper component
(its own `useState` and all) that renders the real component live — a toggle demo for a
`Collapsible`, say. That local state belongs to the item's own node, not to the page; it doesn't by
itself mean the page needs `render()`. Reach for `render()` instead of `variants`/`states` only for a
genuine custom composition that doesn't fit a list of independent instances at all — several demos
sharing one measured layout, a wrapping grid, a token gallery — not merely because an item has local
state. `render()`'s output renders in a Preview card (phone width for components). For a
token-gallery section with no component API at all (raw token
data, not a component — see `ColorsGallery`/`SpacingGallery`/`TypographyGallery`), set
`tokenGallery: true` instead of `props`/`a11y`/`states` — `SectionBlock` then renders `render()`'s
output full width under a "Tokens" label and shows only a Quick reference card with the source
path. For anything beyond a single list of tokens, use the token-page layouts below.

### Organising the catalog

- **`group`/`groupOrder` accept any semantic category you want** — not just `Tokens` and
  `Components`. A page's `group` is a plain string shown as its sidebar section label;
  `groupOrder` (e.g. `['Tokens', 'Components', 'Patterns', 'Recipes', 'Experiences']`) only
  controls which order those sections appear in, top to bottom — any group not listed sorts
  alphabetically after the ones that are. The starter kit uses `Tokens`, then every
  component under `Components`, then `Patterns` (whole screens built from the kit, such as
  SavedTrips) and `Reference` (the generated manifest). A larger catalog might add `Recipes` or
  `Experiences` (full flows) alongside them. Pages sort A–Z inside each group regardless of how
  many groups you have. Avoid splitting `Components` into finer categories such as "Actions" or
  "Status" purely to browse by — that makes readers guess where a component lives; search and A–Z
  already find it. A distinct semantic group (Tokens vs. Components vs. Patterns) is a different
  decision from that, since it changes what the reader expects to find there.
- **Wide components at 3 columns.** Give block-level components (Banner, Card, Toast,
  InputField) `specimenSize: 'regular'`, so Variants and States sit 3 across on a laptop
  (about 316px each). `'wide'` (2 columns, phone width) is only for pages where the full phone
  width is what you're checking, such as truncation or full-screen sheets. 4 columns is too narrow
  for these components.
- **Mark OS components.** When a component is, or contains, a native platform control rather than
  a custom one (a native date picker, iOS Liquid Glass), set `osComponent: 'full'` or
  `'partial'`. The page shows an "OS component" or "Partly OS component" badge under its title;
  say in `description` which part is native and how it differs on web, where the native part
  usually can't render. Custom replacements styled after a platform control (a custom switch or
  spinner) are not OS components.
- **Readable titles.** The page id is its address (`#ControlHeights`) and comes from the file
  name; set `title: 'Control heights'` for the heading, sidebar and search. Pages still sort by id.
- **Point token pages at their token file.** A token page has no component, so its Source would be
  the page file; set `source: 'src/design-system/tokens.ts'` (project-relative) instead.
- **Coverage only counts the component's own options.** `doctor`'s `option-not-covered` checks
  string-literal unions declared in the component's own folder or a token folder. A union
  declared in another component's folder, such as a shared `IconName`, is that component's
  options, so a Banner page never needs one example per icon.

### Family pages

A page can document a family of related declarations — a view and its internal parts, or a
pattern and the pieces it's built from — on one page instead of scattering them across separate
catalog pages, each member getting its own address and search entry. Give it `members`, `whole`
and `sections` instead of `component`/`whenToUse`/`a11y`/specimens, which live on the members (the
whole is a member too):

```tsx
export default defineCatalogPage({
  id: 'Toast', group: 'Patterns', description: 'How a Toast is assembled from a Banner.',
  whole: 'Toast',
  sections: [
    { label: 'Parts', kind: 'blocks', inWhole: true, members: ['ToastBanner'] },
    // deprecated shape — don't copy this; name a related component in `relatedPages` instead (below).
    { label: 'Related', kind: 'blocks', inWhole: false, members: ['ToastStandaloneBanner'] },
  ],
  members: [
    { id: 'Toast', source: 'components/Toast/Toast.tsx:1', fidelity: 'documentation-only', relationship: 'Main pattern', description: '...' },
    {
      id: 'ToastBanner', component: 'Banner', parent: 'Toast',
      source: 'components/Banner/Banner.tsx:28', fidelity: 'replicated', relationship: 'Anatomy', description: '...',
      whenToUse: '...', a11y: '...', variants: { items: [/* ... */] },
    },
    {
      id: 'ToastStandaloneBanner', source: 'components/Banner/Banner.tsx:28', fidelity: 'documentation-only', relationship: 'Related',
      related: 'Wraps ToastBanner directly when a notice should stay until dismissed.', description: '...', aliases: ['BannerStandalone'],
    },
  ],
});
```

- **`whole`** is a member id, and must equal the page's own `id`. It renders first, with no header
  of its own (the page title already names it) and no number.
- **`sections`** (`{ label, kind: 'blocks' | 'list', inWhole, members }`) group the rest: `blocks`
  renders each member as its own full block (specimens and all); `list` renders one card of folded
  rows, each a toggle that expands in place. `inWhole` sections render under the page's one
  "Parts" label; the rest render under its one "Related" label — the only two section labels the
  page ever shows; each section's own `label` stays in the data (for the anatomy legend and your
  own reference) but is never rendered. Numbering follows each member's own `parent` (below), not
  this ordering. A non-`inWhole` section is **deprecated**: it still works, but `doctor`'s
  `deprecated-related-section` now warns about it — give the member its own catalog page and name
  it in `relatedPages` instead of documenting it inline here. Under `doctor.strict`, this warning
  becomes an error, so a consumer with existing non-`inWhole` sections sees red CI on upgrade until
  they migrate.
- **`relatedPages`** (`{ page, note? }[]`) names other catalog pages at the bottom of this page,
  under the same "Related" heading, after any deprecated sections. Each row is the named page's own
  id, linked when it resolves to a real catalog address — a page id, another family's member id, or
  a family page's own alias or one of its members' aliases — and shown as plain text, never a dead link, when it doesn't
  (`doctor` reports an unresolvable or self-naming entry either way), then its `note`, when
  authored — no specimens, disclosure, source line, number, or pin. A page with neither
  `relatedPages` nor a non-`inWhole` section renders no "Related" heading at all.
- **`parent`** nests a member under another (e.g. a subview under its view). A top-level part (an
  `inWhole` member whose `parent` is the whole, or who has no `parent` at all) is numbered `1`,
  `2`, `3`… in the order it's first listed across `sections`; a child takes its parent's number
  plus `.1`, `.2`, … the same way. A Related member (outside every `inWhole` section) gets no
  number at all.
- **`anatomy`** (page-level) is the first box after the page head, labeled “Anatomy” like the
  specimen grids: `{ picture, groups }`, where each group is
  `{ label, items: [{ member, description } | { other, description }] }`. A `member` item names one
  of this page's own members (not the whole); it shows that member's Part number, or no pin at all
  when the member sits outside every `inWhole` section — such a row reserves no gutter for the pin
  it doesn't have, its name starting flush at the row's own left edge; an `other` item names a
  component documented elsewhere, shows an unnumbered ↗ pin, and links only when the name
  resolves to a real catalog address. With six items or fewer the legend sits beside `picture`;
  with more it goes below it in up to three columns, each group placed in the currently shortest
  column so the columns end nearly level (a group never splits). Mark `picture` with
  `<AnatomyPin member="ThatMemberId" />` (its number and style come from the page, so `picture`
  never hardcodes one) or `<AnatomyPin other="ThatComponent" />`.
- **`axis`** on a `variants` or `states` slot names the one property that grid varies (e.g.
  `'Expression'`) and shows as the grid's label. Family pages hide the generic block labels, so
  give each grid an `axis` there.
- **`fidelity`** (`'replicated' | 'approximated' | 'documentation-only'`) shows as a small badge.
  Use `'documentation-only'` for a member with no rendered specimen (no native counterpart to show,
  or nothing meaningfully different to render).
- **`related`** is a short sentence for a member outside the whole (e.g. "Wraps X directly …");
  another member's name inside it becomes a link to that member's own address. **`aliases`** (on a
  member, or on the page itself) resolve old/retired ids to the right address, for both routing and
  search — on the page itself, this only takes effect when the page also has `members`; it's
  accepted but unused on a normal (single-component) page.
- **`composedOf`** on a member — same shape and meaning as the page-level field above — shows as
  one "Uses …" line inside the member's own disclosure, after any notes. A name links when it
  resolves to a real catalog address (a page, another member, or an alias — in this family or any
  other), otherwise it shows in code; an unknown name logs a `[Catalog]` warning the same way the
  page-level field's does.
- **`notShown`** (page-level) is a short "Not shown in the browser: …" line under the page head,
  for behavior a web catalog can't demonstrate (a timer, a native gesture). A member's own
  `notShown` works the same way, under its specimens. Like `aliases`, the page-level field only
  takes effect on a page with `members`.
- **`apiLabel`** (default `'API'`) renames the disclosure's reference-excerpt part for a host app
  that generates one (e.g. `'Swift API'`) — never hardcode a specific language's wording. Also
  only takes effect on a page with `members`.
- Every component-bound member (one with `component` set) wants a real `whenToUse`, a real `a11y`,
  and at least one specimen, the same as a normal page's component — `doctor` checks each one.
  See `viewer-host/viewer-pages/FamilyPage.catalog.tsx` in this repo for a complete, worked example.

### Token pages

A token page shows each token at its real value with its role. Pick the layout by the token's
shape:

| Token shape | Layout | Example |
|---|---|---|
| Small, self-contained preview (radius, shadow, control height, a single colour) | `TokenGrid` of `TokenTile`s: equal tiles in as many columns as fit | Radius, Shadow, ControlHeights |
| Narrow sample with a long note (icon size, spacing) | `TokenRow` with `notePlacement="right"`: one line per token | IconSizes |
| Several kinds of token on one page | `tokenSections`: one titled card per kind | Colors (semantic vs palette) |
| A scale with families (type) | `tokenSections` with `tokenColumns: 2` or `3`, one section per family | Typography (label, body, emphasis…) |
| A duration/easing or spring value | `MotionSpecimen` next to the token's value | Motion (duration, easing, spring) |

- **`tokenSections: [{ title, desc?, wide?, render }]`** replaces `render`. Each section is its
  own titled card. Keep different kinds of token in different sections, never mixed: semantic roles
  apart from raw palette ramps, each type family apart.
- **`tokenColumns: 1 | 2 | 3`** places sections side by side. Use 2–3 for narrow sections (type
  families); the page drops a column rather than squeeze a section under 280px. `wide: true`
  gives a section its own full row, for wide content such as palette ramps.
- **Show each token's role, not its category.** The note says where or why the token is used, in
  that order of preference: the token file's own comments, then a usage scan of the code (name the
  main components and how many files use it, and say so when a token is unused). Never invent
  advice, and never write a generic category such as "Regular reading text" when the name and
  value already say it. If there's nothing grounded to say, leave the note out.
- **Label each sample with its name and real value** (`bodyMd · 16/22 · 400`, `medium · 12px`).
  Use realistic sample text from the product, short enough to fit its column at the largest size.
- **`MotionSpecimen`** demonstrates a duration/easing or spring token as a real, bounded
  start-to-end slide — a dot travels a fixed track once when it mounts, with a named Replay button
  to play it again. Give it `kind: 'timing'` with `duration` (and optionally a real `Easing`
  function, e.g. `Easing.bezier(...DS_MOTION_EASING.standard)`) for a duration/easing token, or
  `kind: 'spring'` with a `spring` config shaped for `Animated.spring` (e.g. `DS_MOTION_SPRING`) for
  a spring token. It respects the platform's reduce-motion preference automatically — with it on,
  every play (including the initial one) shows the end state immediately instead of animating, so
  it never needs its own per-page reduce-motion handling:
  ```tsx
  <MotionSpecimen kind="timing" duration={DS_MOTION_DURATION.base} easing={Easing.bezier(...DS_MOTION_EASING.standard)} />
  <MotionSpecimen kind="spring" spring={DS_MOTION_SPRING} />
  ```
  A spring's `valueRange` says which domain its `spring` config's rest thresholds are scaled for,
  so the specimen animates the same domain the real config does rather than always normalizing to
  0–1. `'distance'` (default) is for a config tuned for pixel-space points, e.g. a `BottomSheet`'s
  snap-point spring — the `Animated.Value` animates directly from `0` to the track's pixel
  distance. `'unit'` is for a config whose production value is a normalized 0-to-1 progress or
  blend factor — the `Animated.Value` animates `0` to `1` and is interpolated to the pixel
  distance; `'distance'`'s pixel-scale thresholds would otherwise end a unit-valued spring before
  it ever moves:
  ```tsx
  <MotionSpecimen kind="spring" spring={UNIT_SPRING_CONFIG} valueRange="unit" />
  ```

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
- Three further rules are conservative source-backed *suggestions*, warnings by default
  (the existing `doctor.strict` option still promotes them), never authoritative over what a page authors:
  - `missing-composition-suggestion` — a component's own real JSX source evidence names another
    known component its page's `composedOf` doesn't. The message states only that candidate's
    `component`/`file`/`line`, never an invented role or relationship; add it to `composedOf`
    yourself if it reflects real composition, or leave it as-is if it's incidental.
  - `degenerate-grid-axis` — an authored `comparison` grid's row or column axis has exactly one
    item, so it reads as a one-axis list rather than a real two-axis matrix. Never rewrites the
    grid; an intentional single-value axis is left exactly as authored.
  - `missing-working-preview` — a component has a controlled value/change pair (`value`/`onChange`,
    or `x`/`onXChange`) but every example that renders it passes a fixed value with no working
    callback. Add `intentionalStaticPreview: { reason: '...' }` to the page to suppress it when the
    static examples are deliberate.
  - `preview-only-component-page` — a component page's only examples are a free-form `render()`
    preview, so nothing is named and the checks above have no example to read. Give the page
    `variants` (and `states`, where they differ) naming each real configuration. Token galleries
    and a declared `intentionalStaticPreview` are exempt; `render()` stays right for a token
    gallery or a whole-page layout.
  - `internal-prop-unknown` — `internalProps` names something that is not a prop of the component,
    so the exemption it was written for is not in effect. Correct the spelling or delete the entry.
  - `deprecated-related-section` — a family page still documents one or more members inline in a
    non-`inWhole` section, naming every one of them so you can act without opening the file. Give
    each its own catalog page and name it in the family's `relatedPages` list instead; the section
    keeps working until you do.

  The catalog also warns at render time when a page under-declares the width its examples need.
  A `PhoneFrame` given a cell narrower than the 375px device scales the whole phone down, and its
  own body text shrinks with it, so it reports the page, the example and the cell:

      [Catalog] BottomSheet (variants/content-only) is shown at 75% of device size: its cell is
      283px, narrower than the 375px device. Declare a larger specimenSize so the example keeps
      the width it is used at.

  `check:catalog` fails on any `[Catalog]` warning, so this is caught in CI. The threshold is 95%,
  not 100%: a regular cell leaves 370px for a 375px device, and warning about a reduction nobody
  can see would only train you to ignore the warning. Where the scaling *is* the subject — a page
  documenting that a narrow cell shrinks the device rather than reflowing it — write
  `<PhoneFrame intentionalScale>` in that example, so the exemption is visible where the decision
  was made.

  A page's `internalProps: { size: 'why' }` exempts a named prop from `option-not-covered` — for
  plumbing a parent passes (a layout size, an internal surface kind) rather than a value the
  reader picks. It needs a reason per prop, so the exemption is a visible declaration in the page;
  when the reader really does choose the value, tag an example with `props` instead.
  The analyzer follows supported aliases and resolved exports, but uncertain wrappers or
  dynamically-constructed references remain uncheckable rather than being guessed at. A
  declared `intentionalStaticPreview` is taken as the author's own call, not independently
  verified; only a real browser check confirms actual behavior.
- `overlay-without-device-frame` (warning) — the component imports React Native's `Modal`, which
  opens over the whole catalog page on the web, but its page imports no `PhoneFrame`,
  `OverlayDemo`, `PhoneScreen` or `BoundedOverlayViewport`. Conservative: it can't see
  `import * as RN`, a re-exported `Modal`, or a Modal opened by a sub-component.

### `doctor --render`

`npx ds-viewer doctor --render` also starts the viewer, opens every page in a headless browser,
and adds what only a real render shows:

- `render-error` / `render-no-heading` (errors): a console error, or a page that didn't render.
- `render-layout` (warning): an example wider than its cell (the viewer's own check), with the
  page and file. `render-catalog-warning` (warning): any other `[Catalog]` warning, reported once.
- `identical-variants` (warning): two examples in the same card whose specimens render identically,
  so the difference their names claim isn't visible — usually a cell too narrow to show it, or a
  prop that was never wired up. The fingerprint reads each specimen's whole subtree (including a
  PhoneFrame's child document and a field's value) but not the caption carrying the variant's own
  name, so two examples differing only in colour are not reported.
- `specimen-clipped` (warning): an example in a list card painting past the left or right of its
  cell, where it is cut off rather than contained. Content the specimen holds itself is not
  reported — anything inside something that scrolls (`auto`/`scroll`, so the reader can reach it)
  or clips (`hidden`/`clip`) is treated as the specimen's own containment. That last one is a
  trade-off worth knowing: a full-width component clipping its own corners hides a genuinely
  too-narrow cell from this rule, so `hidden` buys quiet for carousels and shimmer sweeps at the
  cost of that case. Only horizontal crossings in `role=list` cells are measured — a cell's width
  is what the page allocates, while its height grows with content, and matrix (`ComparisonGrid`)
  cells are not visited at all. Usually fixed with a wider `specimenSize`, by stacking the blocks so
  the example gets the full row, or by dropping `itemsFill` from a small instance that should sit
  centered.
- `page-head-overlap` (error): something is painting on top of a page's own heading. This is the
  one check measured at **800x600** — Puppeteer's default viewport, and so the size a smoke check
  judges your catalog at — because the overlap it catches does not appear at 1280 at all: a page
  title that is a single unbroken identifier (a long Swift type name, say) has no break
  opportunity for the browser to use, so it keeps its full intrinsic width and paints past its own
  column into the previous/next buttons. It measures every leaf element carrying text, clips each
  rect to any ancestor that scrolls or clips (so something scrolled out of view is not reported as
  covering anything), and reports a pair only when it overlaps the heading by more than 1px in
  both directions, so a shared edge between neighbours is not a finding. Only the heading is
  checked: specimens legitimately stack text, and reporting those would bury the one overlap that
  is always a defect.
- `render-unavailable` / `render-failed` (errors): no browser, or the catalog didn't start.

It needs `puppeteer` in your project (`npm install --save-dev puppeteer`); ds-viewer doesn't
install a browser. It takes about two minutes for 50 pages — plus a moment per page for the
narrow-viewport heading pass — and works with `--json` (progress
goes to stderr), `--ci` and `doctor.strict`, so CI can run `npx ds-viewer doctor --render --ci`.

It starts its own catalog on the first free port from 5181. `--port <n>` pins it instead, which
you want when something else already holds that range — another project's catalog, or a second
`dev`. The check cannot tell a stranger's server on its port from its own, so a collision reports
that server's pages as your project's failures.

It starts its own `dev` server, with `--no-update-endpoint` and its own generated directory
(`.ds-viewer-render/`, gitignored by `init` alongside `.ds-viewer/`). Nothing it generates touches
the workspace a running `dev` owns, so you can run it beside a catalog you already have open and
that catalog is unaffected — including its update page's actions.
It stops the viewer it started, including on Ctrl-C (exit codes 130, 143 or 129 for SIGINT,
SIGTERM or SIGHUP). On Windows it stops the viewer with `taskkill`; that path is unit-tested, not
run on a real Windows machine.

## Known gaps

- The viewer's own dev-mode console warnings only cover `duplicate-page-id` (design §4's "the same rules appear as development warnings naming the page" — scoped to that one rule in 0.3). Bound-axis drift (`bound-option-removed`, `bound-axis-prop-removed`) has no viewer-side warning yet; `npx ds-viewer doctor` (and its `--ci` workflow) is the only place that catches it today.

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

## Updating

The sidebar footer always shows the installed version ("DS Viewer 0.4.5") and opens the update
page (`#ds-viewer-update`). With no newer version known, that page says which situation you're in —
on the latest version, automatic checks off, or npm unreachable — and offers **Check now** (asks npm
right away, even with automatic checks off) and a **Check for updates automatically** switch. The
switch saves your own choice for this project on this computer (in your user settings folder, not in
the project), overriding the project's `updateCheck` for you only; `DS_VIEWER_NO_UPDATE_CHECK=1`
(CI) still wins over both. `doctor` follows the same setting.

When a new version is published, the footer turns into "Update available · 0.5.0" — a banner too,
for a major version, dismissible per version. Either opens the same page, which then shows what would
change and one **Update now** button:

```
0.4.0 → 0.5.0  Minor
You're on 0.4.0. Released 2 days ago.

What's new
  •  Faster sync for large kits
  •  New Tabs component in the starter kit

Files that would change
  package.json               version
  package-lock.json          version

[ Update now ]  or run npx ds-viewer update
```

**Update now** asks the running `dev` process to apply the same steps `update` runs below, over a
local endpoint that only ever answers the viewer's own page (random port, a per-run secret, exact
origin match). The secret itself is baked into the generated viewer bundle alongside it — it's the
endpoint's own Host and exact-Origin checks, not the secret being unguessable, that stop any other
web page from using it. The viewer restarts itself on the new version and reloads automatically;
nothing is committed.

If any file the update would touch has uncommitted changes, the panel refuses and names them —
there's no override in the viewer; commit or stash first, or use `update --force` below. Outside a
git repository, every file is treated as not dirty (there's nothing to check).

### `npx ds-viewer update`

```
npx ds-viewer update              # shows the plan, asks to confirm, then updates
npx ds-viewer update --dry-run    # shows the plan and stops
npx ds-viewer update --yes        # skip the confirmation prompt
npx ds-viewer update --force      # update even with uncommitted changes in a planned file
```

Downloads the target version, runs its own `migrate --from <your version>`, upgrades with
whichever package manager your lockfile names, re-runs `migrate` for real, then `doctor`. Changes
are left uncommitted — review them like any other change.

The upgrade keeps the package in whichever section your `package.json` already declares it in,
rather than always writing a devDependency.

If that spec is a local one — `file:`, `link:`, `workspace:`, `portal:`, or a bare path — `update`
refuses and tells you how to proceed, because installing a published version would replace the
checkout your project deliberately points at. The catalog would keep running while no longer
reflecting the source you are editing, which is hard to notice. `--force` does not override this:
it exists for uncommitted files, not for changing where the package comes from. The update page's
**Update now** refuses the same way, reporting it as a failed install step.

### `npx ds-viewer migrate --from <version>`

Runs every migration introduced after `<version>` — `update` calls this for you; run it directly
only to catch up a project that upgraded its `package.json` some other way. `--dry-run` reports the
changes without writing them; `--json` for the machine-readable version. 0.4 ships this framework
with an empty migration list — it introduces no breaking change of its own.

### `npx ds-viewer kit diff <Component>`

Starter-kit files are copied once by `init` and never touched again — not even by `update`, which
only ever counts how many differ from the version you're installing. `kit diff <Component>` shows
your copy against the installed kit's, as a plain diff:

```
npx ds-viewer kit diff Button
--- components/Button/Button.catalog.tsx (installed kit)
+++ components/Button/Button.catalog.tsx (yours)
  ...
```

Set `starterKit.root` in `ds-viewer.config.ts` if you moved the kit after `init --new` wrote it
(default `src/ds`); a config from before 0.4 with no `root` field still works — it's inferred from
your first `components` glob.

### Updating: known limits

- **Updating needs the network.** If npm doesn't answer within 20 seconds, the update page shows
  "Couldn’t prepare the update" and nothing changes. It doesn't fall back to npm's cache, because
  the install that follows would need the network anyway.
- **A console error while installing is expected.** While npm replaces the package, Metro briefly
  reports that it can't resolve `@krapwoo/ds-viewer`. The update page keeps going, and the viewer
  restarts on the new version.
- **Windows hasn't been tested on a real machine yet.** Package-manager commands run through a
  shell on Windows (needed for `npm.cmd`), and this is covered by unit tests only.

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
