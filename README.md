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

**In CI, run `doctor --render --ci`:**

```bash
npx ds-viewer doctor --render --ci
```

Plain `doctor` reads your page files; `--render` also opens every page in a headless browser, which
is the only way to catch a long title painting under the ← → pager, an example cut off by its
cell, or an anatomy picture whose pins have drifted from its specimen. `init` writes the GitHub
Action with this step when your project has `puppeteer` (see [`doctor --render`](#doctor---render));
without it the workflow runs plain `doctor --ci` and says so. `init` never adds `puppeteer` itself,
since ds-viewer doesn't install a browser, but prints a one-line recommendation to
`npm install --save-dev puppeteer` when the project lacks it. In CI (`CI` set) the browser runs
with `--no-sandbox`.

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
and bundled into the preview workspace), `components`, `exclude`, `tokens`, `pages`, `groupOrder`, `patternGroups`, `partGroups`, `usage` (optional — a path to a usage data file, see
[Usage data](#usage-data)), `starterKit` (new-project only —
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

Three checks cover three different things, and none substitutes for another: `npm test` covers
pure logic and source assertions; `npm run test:render` renders catalog components into jsdom
through react-native-web and covers component structure (which element wraps what); `npm run
check:catalog` is the only one that sees geometry, because jsdom has no layout engine —
`getBoundingClientRect()` returns zeros there. A layout or alignment claim must be verified in a
browser, with `check:catalog`, never in a renderer test.

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
description, previous/next, then the specimens, then a **Notes and API ›** link that opens the
reference details in the same side panel a family member uses: **Guidance** and **Quick
reference** (source path, accessibility, and — when the page has any — **Composition** and the
derived **"also used by"** inverse of it), then **Props** in their own box
(two columns, filled across first, when there are 4+ props and room). A page with nothing to put
there has no link. Token pages keep a short Quick reference with the source path inline. Guidance, Quick reference, and — only for a page with
confirmed `composedOf` entries — Composition lay out from the reference card's own measured inner
width, not viewport width alone: three columns side by side only when there's confirmed composition
*and* the card is wide enough for all three (Composition gets its own column only then; otherwise
it stays nested under Quick reference, as it always has), two when there's room for Guidance and
Quick reference side by side, or one stacked column — in full document order, nothing dropped —
when the card is too narrow even for two. A Composition name becomes a real link whenever it
resolves to a real catalog address (a page, a family member, or either one's alias — the same
resolution a family member's own "Uses" line already uses); an unresolvable name stays honest plain
text. "Also used by" is derived, never authored, the ordinary-page counterpart of a family member's
own line of the same name (see "Family pages" below): nothing renders when nothing else uses the
page. The specimens use one of four layouts:
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

### Source reference

A page's `navigation` field is `'browse'` (the default — omit it) or `'reference'`:

```tsx
export default defineCatalogPage({
  id: 'ButtonSource', description: 'The native declaration behind Button.',
  navigation: 'reference',
  // ...
});
```

A `'reference'` page keeps every one of its addresses — its own id, its aliases, and (on a family
page) every member's own id/alias — fully routable; `navigation` only ever removes it from the
sidebar, the pager, and the hash fallback's own browse sequence. A family page's members inherit
their own page's `navigation`; there's no separate per-member field. The moment any page in the
catalog opts in, the sidebar grows a quiet **Source reference** entry: a catalog-wide search over
every registered page's and member's own id, title, detected component export, alias, and source
path — never a page-local member search, and never a second, hand-maintained registry (it's
derived from the same `SectionDef[]`/`FamilyDef` every other part of the viewer already reads). A
legacy catalog with no `'reference'` page keeps its present sidebar and page set, unchanged.
Selecting a result opens its real page (and, for a member, focuses it directly) and offers a real
`Back to <origin>` return link to wherever that selection actually started from — any page, not
only another reference destination. Every other already-true reference fact (a Composition name,
a derived "also used by" user, a family member's own `related`/anatomy name) becomes the same kind
of real, canonical, focused-return link once it resolves. Only loading a reference page's own URL
directly, with no recorded origin, offers `Browse catalog` to the first ordinary browsing page
instead of inventing one that was never visited; a catalog with no browsable page at all offers
neither.

Resolution for the Source reference picker, and for every Composition/"also used by"/`related`/
anatomy name across the whole catalog (see "Browsing the catalog" above and "Family pages" below),
shares one rule: an exact registered page id, member id, or alias always wins; only when none of
those claim the name does a unique, detected component export resolve it instead — letting a name
find an ordinary page whose own id differs from its component (e.g. a `PillButton` page whose
component export is `Button`). A component name shared by more than one page or member is
ambiguous and is never guessed; an unknown name stays plain, honest text rather than a dead link.

## Adding a component (the recipe)

Copy the shape of an existing pair, e.g. `starter-kit/components/Button/` or `starter-kit/components/Badge/`:
- `<Name>.tsx` — `StyleSheet.create`, import tokens from `../../tokens`, icons from
  `../../icons/Icon.native`.
- `<Name>.types.ts` — export `<Name>Props` (+ any `<Name>Variant`).
- `index.ts` — re-export.

Then add a `<Name>.catalog.tsx` file next to it, written with `defineCatalogPage()` (description,
a11y, and its content — `id`/`path`/`props` are derived, never authored), and export it from
`src/ds/components/index.ts` the same way its siblings are. `SectionBlock` shows the
specimens first, then a "Notes and API ›" side panel holding Guidance, Quick reference, and Props. Give it whichever of these fields
actually apply:
- `notes: string[]` — page-level notes, listed as a "Notes" entry in the page's Quick reference (in its Notes and API panel)
  (for facts about the source that aren't part of the description, guidance or accessibility).
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
  `Experiences` (full flows) alongside them. Pages sort A–Z by their displayed title (falling back
  to their id when they have none; an exact tie breaks on id) inside each group, regardless of how
  many groups you have. Avoid splitting `Components` into finer categories such as "Actions" or
  "Status" purely to browse by — that makes readers guess where a component lives; search and A–Z
  already find it. A distinct semantic group (Tokens vs. Components vs. Patterns) is a different
  decision from that, since it changes what the reader expects to find there.
- **Sidebar categories (`sidebarParent`).** When several pages belong together (a "Buttons"
  overview and the button pages it introduces), list them as a small tree instead of one long A–Z
  run. Give each child `sidebarParent: '<parent page id>'`:

  ```tsx
  // Buttons.catalog.tsx — the category page, an ordinary page
  export default defineCatalogPage({ id: 'Buttons', group: 'Components', description: 'Every button in the app, and when to use each.', /* ... */ });

  // PrimaryButton.catalog.tsx
  export default defineCatalogPage({ id: 'PrimaryButton', group: 'Components', sidebarParent: 'Buttons', /* ... */ });
  ```

  In the sidebar the children sit under "Buttons", indented, sorted by title, joined to it by thin
  connector lines. They keep their own addresses, and selecting one highlights that child, not the
  parent. The filter finds children (their parent row shows above a match; a match on the parent
  itself shows all of its children), and the ← → pager follows what the sidebar shows: the parent,
  then its children, then the next page. Screen readers hear each parent's children as a list
  named "<parent title> pages".

  One level only, and the parent must be a page id in the **same group** that has no
  `sidebarParent` of its own. An unknown parent, a parent in another group, a parent that is
  itself nested, a page naming itself, and a parent that is not listed in the sidebar (a
  `navigation: 'reference'` page) are `doctor` errors (`sidebar-parent-invalid`), and show
  in the viewer's development console; the page then simply stays at its own place in the list.
  Keep it for real categories: it replaces A–Z browsing for the pages it covers, so the category
  page should say what the children are and link readers onward.
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
  name; set `title: 'Control heights'` for the heading, sidebar and search. Pages now sort by this
  title, not the id — so "Control heights" sorts under "C", not under whatever the id starts with.
- **Point token pages at their token file.** A token page has no component, so its Source would be
  the page file; set `source: 'src/design-system/tokens.ts'` (project-relative) instead.
- **Parts and empty pages.** `doctor` warns about a page that is only a built-in part of one other
  page (`part-own-page`) and about a page that shows nothing (`nothing-to-show`); see the rule list
  under `doctor`. To keep such a page on purpose, set `standalone: '<why>'`, for example
  `standalone: 'Not a part of GitFileCard; it draws its own counts.'`. The reason must be non-blank
  and is only a note in the source — the viewer ignores it. Token pages and
  `navigation: 'reference'` pages are never checked, and family and group pages are never checked
  for `part-own-page` (`nothing-to-show` does check them, see below). Both checks count `composedOf` written on a
  family or group member as well as on a page.
- **Coverage only counts the component's own options.** `doctor`'s `option-not-covered` checks
  string-literal unions declared in the component's own folder or a token folder. A union
  declared in another component's folder, such as a shared `IconName`, is that component's
  options, so a Banner page never needs one example per icon.

### Overview-page building blocks

A category overview page (the page a sidebar category opens; see **Sidebar categories** above) is
an ordinary page with a `render()`. Two blocks exported from `@krapwoo/ds-viewer` draw its
opening, in the viewer's own tokens:

- **`CountStrip`** is a row of 2–6 stats, `items={[{ label, value, sub? }]}`: the label small and
  uppercase, the value large, the optional `sub` a muted caption. The cells share the row equally
  and wrap onto the next row on a narrow page (each is at least 150px wide). Fewer than 2 or more
  than 6 still render, with a development warning.
- **`WarningBanner`** is a titled note in the viewer's amber attention colours:
  `<WarningBanner title="…">body</WarningBanner>`. `tone="info"` switches it to the accent blue.
  The body is a string (styled for you) or your own elements. It has no dismiss control, and it
  is a `role="note"` named by its title, not an alert, so it does not interrupt a screen reader.

```tsx
import { CountStrip, WarningBanner, defineCatalogPage } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  id: 'Buttons', group: 'Components', description: 'Where to start with buttons.', standalone: 'A category page.',
  render: () => (
    <>
      <WarningBanner title="One primary per surface">A screen has one primary Button.</WarningBanner>
      <CountStrip items={[{ label: 'Pages', value: 2 }, { label: 'Variants', value: 5, sub: 'primary to ghost' }]} />
      {/* each child page's specimen, then its name as a link, as in starter-kit/pages/Buttons.catalog.tsx */}
    </>
  ),
});
```

The starter kit's [Buttons page](starter-kit/pages/Buttons.catalog.tsx) is the worked example: it
uses both blocks and sits above the Button and ButtonGroup pages, which name it as their
`sidebarParent`.

### Usage data

Set `usage` in `ds-viewer.config.ts` to a JSON file your project generates, and every page whose
component appears in it gets an **Appears in** block after its specimens (and inside each family or
group member that has usage):

```ts
export default defineConfig({
  // …
  usage: 'build/usage.json', // relative to the project root
});
```

The block reads **Files that use it · N** and lists each use as `file:line`; past eight files the
list collapses behind **Show all N**. A page without usage shows no block, and a project without a `usage` field is
unchanged.

**File format, version 1:**

```json
{
  "version": 1,
  "areas": ["Chat", "Bots"],
  "components": {
    "ChatBubble": {
      "area": "Chat",
      "uses": [{ "area": "Bots", "file": "BotRoomView.swift", "line": 152 }]
    }
  }
}
```

- `version` must be `1`. `areas` (optional) is the display order for areas. Area names are free text.
- Each key under `components` is a page id, a page's `component`, a family or group member id, or
  a member's `component`. `area` is the component's home area. `uses` may be empty; each use needs
  an `area` and a `file`, and may have a `line` (a whole number from 1).
- Fields it doesn't know are ignored, so a generator can add its own.

`sync` and `dev` read the file. A missing file, malformed JSON or a wrong shape prints a warning
that names the problem and shows no usage; the file is all-or-nothing, so one bad entry ignores
the rest. The result is written to `.ds-viewer/generated/usage.json`. `doctor` reports a key that
matches nothing in the catalog as `usage-unknown-page` (usually a renamed component). `dev` watches
the usage file too, so regenerating it updates the open catalog without a restart. (Changing the
`usage` path in `ds-viewer.config.ts` is picked up by the config watcher, but `dev` only starts
watching a new folder for it on its next start.)

### Overview page

With a [usage file](#usage-data), the sidebar gets an **Overview** entry above every group, and the
page behind it (`#ds-viewer-overview`) maps the catalog for designers. Without usage data the entry
does not exist and the address is "Page not found", so a catalog that has no `usage` field is
unchanged.

The page is a grid with a card for every page that has something to show: a live,
scaled-down copy of its first specimen (the first variant, else the first state, comparison cell
or `render()` output; for a family or group page, its first part with a specimen), its title, a
usage line such as "17 uses · 7 areas" or "52 uses · Settings only". Cards are grouped by home
area (the usage entry's `area`; `areas` order first, then alphabetical, and alphabetical by title
within a group), and a page with no usage goes to a final **Other** group. The chips filter by
home area. Token pages, pages with nothing to show and reference-only pages get no card.
A token page is one defined with `tokenDefinition` or `tokenSections`, or a `tokenGallery` page in
a sidebar group labelled **Tokens**; a `tokenGallery` page anywhere else (a full-width pattern
screen, say) gets its card. A thumbnail lays the specimen out at its page's first
`previewWidths` entry and on the surface the page gives it, so it looks as it does on the page.
Every card is the same height, in every group and filter: a title takes up to two lines (then
ends in an ellipsis; the full title is still the link's name) and the room for both is always
kept, so a card with a short title is no shorter.

Activating a card opens that page like a sidebar link; Back returns to the Overview with its
area filter. A card has one tab stop, its title link; clicking anywhere else on the card opens
the same page. An old `#ds-viewer-overview/usage` bookmark (from when the page had a Usage tab)
still opens the Overview. Thumbnails are decoration: hidden from assistive technology, never
focusable or clickable, and on the web mounted only when near the visible part of the page. Nothing animates.

### Parts

A page built from other components shows them on the page itself, as a **Parts** block, while those
components keep their own pages. The block lists the page's `composedOf` entries whose `relationship`
is `built-in` or `slot` (`related` entries stay in the side panel's Composition list only), in the
order declared. It sits after the specimens and before **Appears in**. A page with no such entry
shows no block.

An entry that resolves to another page (by page id, component, member id or alias, the same way the
Composition links resolve) is a card like the Overview's: a live, non-interactive thumbnail of that
page's first specimen, the page's title, and the entry's `role` as its one-line caption. Activating
it opens that page as the Composition link does (Back returns; for a family member it opens at that
member). All cards in a block are the same height and wrap to the width. An entry that does not
resolve is a plain row with its name and `role`, so nothing declared is hidden. The side panel's
Composition list is unchanged.

Each card shows a number badge over the top-left of its thumbnail, in the style of an anatomy pin,
and the card's accessible name starts with it (“Part 3, …”). It is the number the component has in
the page's anatomy, if the anatomy names it as an `other` item, so the pin, the legend row and the
card agree; a component only the Parts block mentions takes the next number after the anatomy's.
Numbering is described under `anatomy` in “Family pages”. A plain row, which has no page to open,
has no number.

On a family page the block follows the members and adds the whole's `composedOf` entries
(duplicates dropped; the first declaration wins), leaving out any entry that is already a member of
the page. Because the page already has a **Parts** section for its members, the block is titled
**Uses these components** there (a family with no Parts section keeps **Parts**). The block is a
labelled region with a heading, each card has one tab stop, and nothing animates.

**Only components are parts.** A style, layout or behavior a page applies (say a hit-target
modifier) is not a part of it. Set `partGroups` in `ds-viewer.config.ts` to the sidebar groups whose
pages are components (e.g. `partGroups: ['Components']`, compared case-insensitively). An entry that
resolves to a page in any other group is then left out of the Parts block and gets no number; an
entry that resolves to no page stays a plain row; the side panel's Composition list still lists
every entry. An anatomy `other` item naming a page outside those groups keeps its pin and legend
row, unnumbered (the dashed ↗ pin), so nothing authored disappears. `partGroups` must be an array
of group names, otherwise a warning is printed and it is ignored. Absent, every group counts.

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

Every family page shows a one-line "Family page." explainer under its description, so a reader
knows its parts are separate components, unlike variants.

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
- **`title`** gives a member a human name, with the same meaning as a page's `title`: the member's
  heading, its entry in the anatomy legend and part lists, the label of the Uses, Also used by and
  Related links that point at it, and what search shows (search also matches the title, besides the
  id and aliases). Without one, the id shows, as before. The id stays the member's address and the
  name on its code line: a titled member's line reads `<id> · <component> · <source>`. A member's
  `title` must not be blank (`doctor`: `family-invalid`). A family's whole is named by the page's
  own `title`.
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
  component documented elsewhere, is numbered like a part (below), shows a small ↗ on its pin, and
  links only when the name resolves to a real catalog address. With six items or fewer the legend
  sits beside `picture`; with more it goes below it in up to three columns, each group placed in
  the currently shortest column so the columns end nearly level (a group never splits). Mark
  `picture` with `<AnatomyPin member="ThatMemberId" />` (its number and style come from the page,
  so `picture` never hardcodes one) or `<AnatomyPin other="ThatComponent" />`.

  **Numbering used components.** A component that has its own page and that this page uses is shown
  as a part: it takes the next number after the page's own top-level parts, and the same number
  appears on its anatomy pin (with a small ↗, marking that it opens its own page), on its legend
  row and on its card in the Parts block. The numbers continue the top-level sequence in this
  order: the page's own parts (unchanged — `1`, `2`, `3`…), then the `other` items in the order
  they first appear in the legend groups, then the components that appear only in the Parts block,
  in Parts-block order. A name has one number however it is written: an `other` item and a Parts
  entry that name the same component — by page id, `component`, member id or alias — share it. A
  page with no `other` items and no Parts block numbers exactly as before. With `partGroups` set, a
  page outside those groups is not numbered and keeps the plain unnumbered ↗ marker, as before, and
  so does an `other` name that resolves to no page at all: no number and no link. A pin's accessible name
  says what it does and names the destination page by its title, e.g. “Part 3, opens Bot request
  header”; a numbered legend name link is announced as “Part 3, BotRequestHeader”.

  **Width** (web only; native keeps the measured picture). The picture is laid out at the width the
  page's specimens use: the first entry of the page's `previewWidths`, else of the catalog's
  `defaultPreviewWidths` (for a family, the whole member's first; for a group member's own
  `anatomy`, that member's). The frame adds a 30px margin on each side, so the specimen sits
  centred, as in the variant cells. Wrap the specimen in `AnatomySpecimen`: it takes the preview width and the
  variant cells' own centring (pass the same `fill`/`align` the matching variant item uses). Pass
  the pins as its `pins`: they go in a 30px column on the specimen's own right edge, right beside
  a small specimen and in the right margin for a full-width one. Inside that column, place each
  pin as before (`position: 'absolute', right: 0, top: y`, with `top` from the specimen's top).
  With no preview width (neither the page nor the catalog sets one) the picture keeps its measured
  width, and on web `AnatomySpecimen` adds that same 30px gutter on both sides of the specimen when
  it has pins, so the pins stay inside the picture column instead of overlapping the legend.

  Beside the legend, the picture takes half the box, centred vertically, and the legend the other
  half. When half the box is narrower than the preview width plus 108px (the two 30px margins and the
  stage's 24px padding on each side), the legend goes below instead, so the picture keeps its real width. In a window narrower than the picture, the picture
  scrolls inside its own box, never the page. Without a preview width (none on the page and no catalog default) the picture
  keeps its measured width and the layout above.

  A single-component page can set `anatomy` too: it is drawn as the first box after the page head,
  as on a family page. With no members, its parts are only the `other` items, numbered `1`, `2`,
  `3`…
  A group page shows no Parts block: its members' `composedOf` stays in each member's side panel,
  and only a member's own `anatomy` numbers the components it uses.
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
- **"Also used by …"** is derived, never authored — there is no field for it anywhere. It's the
  inverse of the "Uses …" line above: if some other page or member's own `composedOf` names this
  one with `relationship: 'built-in'`, that's already a declaration that the other one uses it;
  `buildCatalogSections` inverts every such declaration across the whole catalog and shows the
  result as a short line below the member's specimens (joining the same line as its source path),
  so the same relationship never has to be authored a second time from this end. Only `'built-in'`
  counts — `'slot'` and `'related'` never produce a line. A user that is this member's own parent,
  the page's own whole, the member itself, or any other member of the same family page is excluded:
  that edge is the family tree already, not a second user. One user shows as `Also used by X
  (role)` (role omitted when empty); two or three as `Also used by X, Y and Z`, with no roles —
  they bloat the line; more than three as `Also used by X, Y and Z +N more`, with `+N more` as
  plain text. A user that resolves to a real catalog address links the same way a
  `related`/`composedOf` name does; otherwise it shows as plain text. Nothing renders when nothing
  else uses the member — the overwhelming majority of them.
- **`notShown`** (page-level) is a short "Not shown in the browser: …" line under the page head,
  for behavior a web catalog can't demonstrate (a timer, a native gesture). A member's own
  `notShown` works the same way, under its specimens. Like `aliases`, the page-level field only
  takes effect on a page with `members`.
- **Notes and API.** A member's notes, "Uses …" line, guidance, accessibility, props and
  reference excerpt open in one shared side panel (a modal dialog on the right, full width at
  768px and narrower) from a "Notes and API" link under the member — Esc, the × button or a click outside closes
  it and returns focus to the link; a member with nothing to show has no link.
- **`apiLabel`** (default `'API'`) renames the disclosure's reference-excerpt part for a host app
  that generates one (e.g. `'Swift API'`) — never hardcode a specific language's wording. Also
  only takes effect on a page with `members`.
- Every component-bound member (one with `component` set) wants a real `whenToUse`, a real `a11y`,
  and at least one specimen, the same as a normal page's component — `doctor` checks each one.
  See `viewer-host/viewer-pages/FamilyPage.catalog.tsx` in this repo for a complete, worked example.

### Group pages

A page can also document several unrelated-but-adjacent components on one page — e.g. two SwiftUI
button styles used together on one screen, or the handful of request-card bodies a switch statement
picks between — with no single "whole" that owns the others. Give it `members` with **no `whole`
and no `sections`** (both omitted, not just empty):

```tsx
export default defineCatalogPage({
  id: 'OnboardingButtons', group: 'Components', description: 'Two separate button styles used together on onboarding screens.',
  members: [
    { id: 'OnboardingPrimaryButtonStyle', source: 'Onboarding.swift:172', fidelity: 'replicated', relationship: 'Style', description: '...', whenToUse: '...', a11y: '...', variants: { items: [/* ... */] } },
    { id: 'OnboardingSecondaryButtonStyle', source: 'Onboarding.swift:298', fidelity: 'replicated', relationship: 'Style', description: '...', whenToUse: '...', a11y: '...', variants: { items: [/* ... */] } },
  ],
});
```

Every group page shows a one-line "Group page." explainer under its description, so a reader knows
the members are separate components with their own APIs, unlike variants.

**Group vs. family:** reach for a family when the members genuinely compose one thing (a view and
its own subviews) — the page then opens with that thing's own specimens, before its parts. Reach
for a group when the members are independently meaningful and would otherwise each get their own
tiny page with nothing to compare them against; a group page shows every member's own section with
no shared "whole" and no Compare block (layout B) — just the page head, a jump row, then each
top-level member's own section in authored order.

- **Shape.** `sections` and page-level `anatomy` are never used on a group page — `doctor`'s
  `family-invalid` rule reports either one if present. Every member keeps its full `CatalogMember`
  shape (the same fields a family member has).
- **Top-level vs. nested.** A member whose `parent` names another member *on the same page* is one
  of that member's own parts, nested underneath it; a member with no `parent`, or whose `parent`
  names a member defined on a *different* page (see "External parts" below), is **top-level**. The
  jump row lists exactly the top-level members, in authored order, each as a chip linking to its
  own address; its muted qualifier is "Part N of `<Family>`" when the member is an external part,
  "+k parts" when it has its own nested parts on this page, or nothing.
- **Embedded families.** A top-level member with parts of its own on the page may carry its own
  `anatomy` (`CatalogMember.anatomy` — the same `{ picture, groups }` shape a family's page-level
  `anatomy` has, but scoped to that one member's own descendants). Its parts number independently of
  every other top-level member's: `1`, `2`, … among siblings, then `1.1`, `1.2`, … for children —
  the same rule a family uses under its own whole, just re-anchored per top-level member instead of
  once per page. `doctor`'s `group-anatomy-member` rule reports an embedded anatomy item naming
  anything other than that member's own descendant.
- **External parts.** A family's own `inWhole` section may list a member id that is defined on a
  group page instead of its own `members`, as long as that member's own `parent` equals the
  family's whole — an *external part*. The family's outline numbers it exactly like an own part (the
  same number shows on both pages); on the family page its row shows that number, its name, and a
  "Details on `<group title>`" link to the member's own address, with no specimens or duplicated
  description. On the group page, that member's own section heading shows "Part N of `<Family>`",
  linking back to the family page. An id that no page defines at all is reported by
  `family-invalid` ("not a member of this page"); an id that is defined but doesn't resolve to
  exactly one group-page member with a matching parent (defined on several pages, on a page that
  isn't a group page, or with a different `parent`) is reported by `doctor`'s
  `family-external-part` rule. Listing the same external id in two sections, or twice in one, is a
  `family-invalid` "in more than one section" error.
- **Routing, search, aliases.** A group page's own id and `aliases` resolve to the page, exactly
  like a family's; every member id and alias on a group page resolves to that page with that member
  focused, exactly like a family member's does (a member id or alias equal to its own page's id
  could never be addressed, so `family-invalid` reports it). The sidebar, pager and search list the group page
  once (its own title) — members are reachable by address and search, never as separate sidebar
  rows, the same convention a family's own members already follow.
- No whole, no Compare block, no `relatedPages`/`composedOf`-at-the-page-level concept of its own
  (a non-empty `relatedPages` on a group page is reported by `family-invalid` as unused) —
  everything else (fidelity badges, `whenToUse`/`a11y`, `composedOf`'s own "Uses …" line, derived
  "Also used by", `notShown`, `apiLabel`) works exactly the same as it does for a family member, see
  above. See `viewer-host/viewer-pages/GroupPage.catalog.tsx` in this repo for a worked example,
  including an embedded family and an external part of a small fixture family page.

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
  A spring can also be written the way SwiftUI source writes it, so a SwiftUI token needs no
  hand conversion. `spring` takes `{ response, dampingFraction }` (`.spring(response:dampingFraction:)`)
  or `{ duration, bounce? }` (`.spring(duration:bounce:)`, `bounce` defaults to `0`) in place of
  stiffness/damping/mass; the stiffness/damping/mass form is unchanged. Both are converted to the
  stiffness/damping physics with a mass of 1: `stiffness = (2π / response)²` and
  `damping = 4π · dampingFraction / response`, where `duration/bounce` means `response = duration`
  and `dampingFraction = 1 − bounce` (`1 / (1 + bounce)` for a negative `bounce`). The curve
  matches SwiftUI's spring model; the moment `Animated.spring` decides it has settled may differ
  slightly from SwiftUI's. A `response`/`duration` of 0 or less, a negative `dampingFraction`, or a
  `bounce` outside −1 (exclusive) to 1 throws a `RangeError` rather than animating something the
  source can't mean. This is checked while rendering, so a bad value throws (reaching an error
  boundary) whatever the reduce-motion setting. Other fields in the object, such as
  `overshootClamping` or the rest thresholds, are passed on to `Animated.spring` as written. A
  `dampingFraction` of `0` (`bounce: 1`) is converted as written (`damping: 0`), but
  `Animated.spring` on web refuses a damping of 0 ("Damping value must be greater than 0"); a
  value just above 0 is accepted and oscillates for a very long time. So the specimen cuts any
  spring play off after 5 seconds (`MOTION_SPRING_MAX_MS`) and places the dot at the end:
  ```tsx
  <MotionSpecimen kind="spring" spring={{ response: 0.5, dampingFraction: 0.7 }} />
  <MotionSpecimen kind="spring" spring={{ duration: 0.5, bounce: 0.3 }} />
  ```
- **`TokenDetails`** keeps a token's source and usage text off its tile. It renders a
  **Details ›** link and, when pressed, the same side panel **Notes and API ›** uses. Give it the
  token's `title` (the panel heading, and the link's accessible name: "Details for 8pt") and
  whichever of these you know: `kicker` (e.g. "Corner radius"), `expression` (the token's source
  expression), `source` (one `path:line`), `usages` (every `path:line` or file name — listed in
  full under "Used at N sites", never cut to "+N more"; a long list scrolls inside the panel),
  `usageSummary` (text for when only an aggregate is known), and `children` for anything extra,
  shown last. Only one token's panel is open at a time, and nothing in a panel is mounted until it
  opens. The built-in `tokenDefinition` pages add it for you:
  ```tsx
  <TokenRow use="Card corners" notePlacement="right" action={<TokenDetails title="8pt" kicker="Corner radius" source="Radius.swift:12" usages={sites} />}>
    <View style={{ width: 56, height: 36, borderRadius: 8, backgroundColor: DS_COLOR.accent }} />
  </TokenRow>
  ```
  `TokenTile` and `TokenRow` both take an `action` slot after their note for it.

### `tokenDefinition`

An opt-in, structured alternative to `render`/`tokenGallery`/`tokenSections` for a token page's
*real entries* — name, value, provenance, source — instead of a hand-built preview. Omitting it
leaves every existing page exactly as it was; nothing here changes unless a page opts in.

```tsx
import { defineCatalogPage, type TokenDefinition } from '@krapwoo/ds-viewer';

const COLORS: TokenDefinition = {
  kind: 'colors',
  sections: [
    {
      id: 'semantic', title: 'Semantic',
      entries: [
        { id: 'brand', name: 'Brand', kind: 'colors', value: { provenance: 'named', resolution: { status: 'resolved', value: { color: DS_SEMANTIC.brand } } } },
      ],
    },
  ],
};

export default defineCatalogPage({ group: 'Tokens', description: 'Semantic and palette colors.', tokenDefinition: COLORS });
```

- **Eight kinds**, each with one fixed canonical title: `colors` → Colors, `typography` →
  Typography, `spacing` → Spacing, `radius` → Radius, `dimensions` → Dimensions, `shadows` →
  Shadows, `opacity` → Opacity, `motion` → Motion. Omit the page's own `title` to get it for free;
  an explicit `title` must match (`doctor`'s `token-definition-title-conflict`, below).
- **The runtime import is the value authority, not `tokens.json`.** An entry's `value` is whatever
  real literal/import you give it at the call site — this is not a reader of your build's
  `tokens.json`/token-scan output. That's also why a static check (`doctor`) can only ever read an
  entry's literal metadata, never its real value — see "Static honesty" below.
- **Provenance, resolution and `named` are three independent things**, and every entry shows its
  own provenance as a plain muted caption (never a badge/pill): `'named'` ("Named token") is a real
  exported design-system token; `'inline'` ("Inline value") is a one-off literal with no shared
  name; `'platform'` ("Platform-provided") means the real value comes from the OS at runtime, not a
  literal this catalog can read; `'unresolved-finding'` ("Unresolved finding") is a real,
  source-backed literal/expression found in code with no shipped design token behind it yet.
  `resolution` is separate: `{ status: 'resolved', value }` when there's a real sample to draw, or
  `{ status: 'unresolved', reason, expression? }` with the real reason (and, when one exists, the
  real source expression) a human would read at the call site — never a fabricated sample or an
  invented classification. `named: true` says a `'platform'`/`'unresolved-finding'` value is *also*
  exposed through a real named token (shown as "Platform-provided · named token"); omit it for
  `'named'`/`'inline'` provenance, which already say so by themselves. When every entry in a
  section shares the same provenance/named pair, it's shown once for the whole section instead of
  repeating on every entry.
- **`expression` and `usages` on an entry.** Both are optional and authored only, never inferred:
  `expression` is the token's source expression (shown in monospace under "Expression"), and
  `usages` is every call site as `path:line` (listed in full under "Used at N sites", never cut to
  "+N more"). For a light/dark pair, an expression that is the same on both sides is shown once,
  one that differs is shown as "Expression (light)" and "Expression (dark)", and the two sides'
  `usages` are listed together, each site once.
- **A tile shows only its value; the rest is behind "Details ›".** An entry's provenance (when it
  isn't already shown once for the section), `source`, `expression`, `usages` and `role` (the usage text) are not printed
  under its tile or row. They open from a **Details ›** link on that entry, named "Details for
  `<name>`", in the same side panel as **Notes and API ›** (see `TokenDetails`, above). An
  entry's `note`, an unresolved value's `reason` and `expression`, and a motion entry's native
  expression are about the value itself and stay on the tile. An entry with nothing to put in the
  panel (no `source`, `expression`, `usages` or `role`, and provenance already shown for the section) has no link. A
  light/dark pair has one link, named by the shared name, whose panel covers both sides.
- **Appearances and scoped ids.** A color entry's `appearance: 'light' | 'dark'` renders an
  independent sample — not a global color-scheme context; omit it for a color with one appearance.
  An entry's `id` only needs to be unique *within its own section* — the same id may recur in a
  different section of the same page (e.g. two scoped "Palette" cards), which is the same
  `TokenSection.id` precedent token galleries already use.
- **Groups inside a section.** A section may add `groups: [{ id, title, desc?, entries }]` — each
  renders under its own sub-heading, after the section's own entries, in the same grid the section
  itself uses. A group id is unique within its own section; an entry id is unique within its own
  group, a separate scope from the section's own entries and every other group. The section-level
  provenance consolidation (above) considers the section's own entries *and* every one of its
  groups together, so a shared provenance/named pair is still shown only once for the whole section.
- **The category jump row.** A page with more than one section opens with one chip per section —
  its title plus how many entries it holds (its own, plus every group's) — so "Attention" might
  read "Attention, 3 values". Each chip scrolls that section into view; a single-section page shows
  no jump row, since there's nothing to jump between.
- **Light/dark pairing.** Within one entries list (a section's own, or one group's), two `colors`
  entries sharing the same `name` — one `appearance: 'light'`, the other `'dark'` — render as a
  single swatch: a split chip (light half left, dark half right), the bare shared name once, and
  `<light value> · <dark value>` as the value line. An entry with no matching opposite appearance
  (or a third same-named entry once both appearances are already paired) renders exactly as any
  other unpaired entry.
- **Motion's `native-expression` kind is a real limit, not a gap:** a SwiftUI
  `.spring(duration:bounce:)`/`.spring(response:dampingFraction:)` (or any other conditional/
  symbolic value) is shown as its own real text, never converted into a guessed
  stiffness/damping/mass spring — a `tokenDefinition` entry carries the expression as text, not
  its numbers. To replay a SwiftUI spring, give `MotionSpecimen` the numbers themselves
  (`{ response, dampingFraction }` or `{ duration, bounce }`, above).
- **Conflicts.** `tokenDefinition` replaces, and so conflicts with, an explicit `render`,
  `tokenGallery`, `tokenSections`, or `members` (a family page) on the same page — remove one of
  them. These, and an explicit `title` that disagrees with the kind's canonical title, are always
  `doctor` errors (`token-definition-conflict`, `token-definition-title-conflict`), independent of
  `doctor.strict`. A duplicate section id, a duplicate group id within a section, or a duplicate
  entry id within one section or one group, is `token-definition-duplicate-id` (also always an
  error) — the same id may still recur in a different section/group/the section's own entries.
- **One page per kind.** Two or more pages declaring the same literal `tokenDefinition.kind` each
  get a `token-definition-duplicate-kind` error naming the other page(s) — a page with no
  `tokenDefinition` is never involved. Give one of them its own kind, or merge them into one page.
- **Aliases.** A `tokenDefinition` page's own `aliases` resolve to the page, the same way a family
  page's `aliases` already do. A section's own `aliases` resolve to the page too, with that section
  scrolled into view. Every one of these joins the catalog's existing alias-collision check
  (`family-invalid`) — an alias must still name exactly one thing, catalog-wide.
- **Static honesty.** `npx ds-viewer doctor` reads a `tokenDefinition`'s `kind` and each section's
  `id`/`title`/`desc`/`wide`/entry `id`s — and, the same way, each group's own `id`/`title`/entry
  `id`s — the same literal-only way it reads every other page field — it never imports or executes a
  page file, so it can never see a real `value`. When a section's (or a group's) own `entries` isn't
  a literal array (an imported/computed list), or contains an entry whose own `id` isn't a literal,
  that list's ids are read on a best-effort basis and the summary lists it as a section with
  runtime-only entries (not statically validated). That is the normal case when values are imported
  from your own token modules, so it is informational: it never fails `--ci` and `doctor.strict`
  does not promote it. Literal sections still get every check. A `tokenDefinition` whose own
  `kind`/`sections` metadata isn't literal at all makes the whole page not statically checkable —
  reported only as the existing `page-not-checkable` warning, never a separate
  `tokenDefinition`-specific one.
- **Migration.** A legacy `render`/`tokenGallery`/`tokenSections` token page keeps working
  unchanged — `tokenDefinition` is additive, never required. To convert one, remove `render`/
  `tokenSections` and author the same data as `tokenDefinition`'s entries instead.

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

- `--json` prints the same report as stable, versioned data: `{ version: 1, summary: { errors, warnings, hints?, components, withExamples, unboundExamples }, update: null, issues: [{ id, severity, page?, file?, line?, message, fix }] }`. `update` is always `null` in this release (filled in starting 0.4's update check); `file` is always relative to the project root. `line` is populated for a `page-parse-error` found by typechecking a page file (see below), and always `undefined` for every other issue id — threading a real position through every rule is future work.
- `--ci` exits 1 only when an error was found — a warning or a hint alone never fails CI, and `--ci` never makes a network call.
- `doctor.strict: true` in `ds-viewer.config.ts` promotes every warning to an error, for both the summary counts and `--ci`'s exit code. A `hint` (below) is never promoted.
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
  - `comparison-hides-variants` — a page (or family/group member) authors both `variants` and a
    `comparison` grid, and the variants' `axis` is neither of the grid's axes (`rowLabel` /
    `columnLabel`, compared trimmed and case-insensitively). The grid replaces the Variants list, so
    those variants are not shown on the page (only the first is still used as the Overview
    thumbnail); the grid only borrows `variants.axis` as its heading when it names one of its own
    axes, and otherwise keeps its `rowLabel × columnLabel` title. Fold the variants into the grid,
    move them to a member of their own, set the axis to one the grid has, or remove them if they
    are only there for the thumbnail. A page with `hide: { variants: true }` is not checked.
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
  - `part-own-page` — a standalone page for a component that exactly one other page declares in
    `composedOf` as `relationship: 'built-in'`, and that page doesn't list it as a member. Fold it
    into that page's family, or record why it isn't part of it with `standalone`. A component built
    into two or more pages is exempt, and `'slot'`/`'related'` entries never count. Pages in a pattern
    group (example screens built from components) never count as the whole: by default the group
    named `Patterns`; set `patternGroups` in `ds-viewer.config.ts` to name your own (e.g.
    `patternGroups: ['Screens']`).
  - `nothing-to-show` — a page with no variants, states, `render` or comparison and no token
    content (`previewWidths` alone doesn't count; it only sizes `render`). A family or group page
    (`members`) is flagged only when the page and every member have none; one member with a
    specimen is enough to clear it. The
    message names the pages that list it in `composedOf` — on the page or on one of its members —
    or says only pattern pages use it, or that nothing does. Add a specimen, list it as a
    documentation-only part of a page that uses it, or remove the page (record why in your own
    docs); `standalone` (above) still opts a page out on purpose. A page
    whose specimens can't be read literally is never reported. A component page with no specimens
    usually also gets `component-no-examples` (unless the component is documented elsewhere, on
    another page or as a family member); the two say different things (no examples vs. no reason to
    be its own page) and clear together once it has a specimen.
  - `usage-unknown-page` — a key in the usage file (see [Usage data](#usage-data)) that matches no
    page id, page `component`, family or group member id, member `component`, or detected
    component, so its usage is never shown. Rename the key or remove it.
  - `standalone-reason-empty` — `standalone` is blank, so it records no reason and opts nothing out.
  - `style-as-part` (warning) — a member that is a style, not a part, where it would be numbered
    as one: a family member in an `inWhole: true` section, or a group member whose `parent` is on
    the page. It is read from `relationship` (`Style` or `Modifier`, any case), which always
    counts, or from an id or component ending in `Style` or `Modifier`, which counts only for a
    member with no `component` or with `fidelity: 'documentation-only'` (a real component such as
    `QuantityModifier` is a part). A style has no area of its own: give it a page of its own and
    name it in `relatedPages` **on a family page** (the only page that renders the Related list).
  - `related-pages-unused` (warning) — `relatedPages` is non-empty on a page without `members`.
    Only a family page renders the Related list, so nothing would show. Give the page `members`, or
    name the related page in `composedOf`. A group page reports the same mistake as an error.
  - `anatomy-no-picture` (warning) — an anatomy the viewer draws (a standalone or family page's, or a
    top-level group member's) whose groups list at least one part a reader should be able to see, and no
    `picture`. A part counts unless its member is `fidelity: 'documentation-only'` (the dashed "no
    area of its own" pin); an `{ other }` item counts, and a `{ member }` the page can't resolve is
    not counted. Draw the whole with `AnatomySpecimen` and pin the parts with `AnatomyPin`. If the
    parts really never share one frame, write `picture: null`: an explicit `null` is a deliberate
    opt-out and stays quiet (leaving `picture` out, or `undefined`, does not). A `picture` written
    as a shorthand property is read through its same-file `const`; an anatomy with a spread
    (`{ ...shared, groups }`) is skipped, as the picture may come from the spread.
  - `anatomy-picture-not-specimen` (warning) — an anatomy `picture` (on the same anatomies) whose
    root element is not `AnatomySpecimen`, so it is not drawn at the page's phone width, centred
    like the variant cells, with its pins beside it. A same-file component whose own root is
    `AnatomySpecimen` passes (otherwise the message names `<Picture> (renders <View>)`), and so
    does a plain wrapper (`View`, a fragment) whose only drawn child is `AnatomySpecimen`: through
    further single-child wrappers, JSX comments, a `{specimen}` const, or the `{children}` of a
    same-file wrapper component. A root doctor can't read statically (an imported component, a call,
    a conditional) is skipped, never guessed at.

  **Hints** are a third severity, below a warning. They are printed, listed in `--json`
  (`severity: 'hint'`) and counted on their own (`summary.hints`, present only when there are
  some), and they never fail `--ci` and are never promoted by `doctor.strict`:

  - `grid-empty-cell` — a list block with an odd item count (3, 5, …) that the default 952px
    content width lays out two across, where `specimenSize: 'regular'` would fit it three across
    with no new empty cell. Measured with the same list maths `explain` reports, not the browser.
    `specimenSize` applies to the whole page or member, not to the one block. A block with an
    explicit `maxColumns`, a page or member with exactly two blocks (the viewer may seat them side
    by side), and a page that imports a device frame (`PhoneFrame`,
    `OverlayDemo`, `PhoneScreen`, `BoundedOverlayViewport`, whose examples need a phone-wide cell
    on purpose), are left alone.
  - `heading-breaks-word` — found by [`doctor --render`](#doctor---render), not by reading the page.

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

### Common mistakes

Each of these is caught by `doctor`. The worked example for the anatomy ones is
[`starter-kit/pages/TripCard.catalog.tsx`](starter-kit/pages/TripCard.catalog.tsx).

| Guard | What it catches | The fix |
| --- | --- | --- |
| `style-as-part` | A style or modifier listed as a numbered part of a family or group. | Give it its own page and name it in `relatedPages` on a family page (the TripCard page does this for `Shadow` and `Radius`). |
| `related-pages-unused` | `relatedPages` on a page with no `members`, which renders nothing. | Make it a family page, or name the page in `composedOf`. |
| `anatomy-no-picture` | An anatomy that lists parts to look at but has no `picture`. | Draw the whole with `AnatomySpecimen` and pin the parts with `AnatomyPin`; `picture: null` says there is deliberately none. |
| `anatomy-picture-not-specimen` | A `picture` that isn't drawn by `AnatomySpecimen`, so it ignores the page's width and centring. | Make `AnatomySpecimen` the picture's root (a plain wrapper around it is fine). |
| `anatomy-picture-geometry` (`--render`) | A specimen off-centre, a pin far from the specimen, a pin cut off by the picture area, or a pin over the side-by-side legend. | Pass the pins in `AnatomySpecimen`'s `pins` prop at `position: 'absolute', right: 0`, as TripCard does. |
| `sidebar-parent-invalid` (error) | A `sidebarParent` that names an unknown page, a page in another group, a page that is itself nested, the page itself, or a page that is not listed in the sidebar (`navigation: 'reference'`). | Name a page in the same group that is listed in the sidebar and has no `sidebarParent` of its own, or remove the field. |
| `grid-empty-cell` (hint) | An odd number of items two across, leaving an empty cell. | Set `specimenSize: 'regular'`, or add or remove one item. |
| `specimen-text-illegible` (`--render`) | Sample text drawn for the other appearance: near-white text on a light cell, or near-black text on a dark one (under 1.5:1). Faint platform colours (placeholder grey, a yellow warning glyph) are left alone. | Set the item's `surface` (`'dark'` for light-on-dark components), or give the sample text a colour that follows the scheme. |
| `heading-breaks-word` (hint, `--render`) | A page heading that the browser splits in the middle of a word. | Give the page a human `title`. |
| `page-head-overlap` (`--render`) | A heading painted under the ← → pager. | Let the heading wrap or truncate in its own column. |

For a token page, keep each tile to its value and specimen and put the source and usage in
**Details ›** (`TokenDetails`): see the [Radius page](starter-kit/pages/Radius.catalog.tsx). The
[Motion page](starter-kit/pages/Motion.catalog.tsx) shows a SwiftUI-style spring through
`MotionSpecimen`'s `{ response, dampingFraction }` form.

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
- `specimen-text-illegible` (warning): content drawn for one appearance sitting on the other's
  background — near-white text on a light cell, or near-black text on a dark one — at under
  **1.5:1**. Only extreme, colourless text counts (near-white: luminance 0.8 or more; near-black:
  0.05 or less; no more than 24 between colour channels), so faint platform colours such as iOS
  tertiary label grey, system yellow, muted counts and disabled text are left alone. The check
  walks up from each visible text node through its ancestors, laying every translucent background
  over what is beneath it (up to the page, on white if nothing is opaque), so a translucent
  panel is measured as the colour it really is. When something that is not the text's ancestor
  paints behind it (an `ImageBackground`'s image, or an absolutely positioned scrim or photo
  beside the text) the colour behind it is unknown, so that text is skipped. It reports the worst
  text in each cell, once (the ratio is rounded down, so it never reads as the 1.5 limit):
  `Text 'Card content' in 'SectionCard' · Dark is dark text on a dark background (1.2:1)`. Fix it by setting the item's `surface`
  (`'dark'`, `'white'`, `'neutral'`), or by giving the sample text a colour that follows the scheme.
  Not measured: text that is hidden on purpose (`opacity: 0`, `visibility: hidden`, transparent
  text, zero size, or positioned outside its cell), text inside an image, `svg` or `canvas`, text
  in a disabled control (`disabled` / `aria-disabled`, which WCAG exempts), and text over a
  gradient or image, including one a sibling paints behind it (no single colour to measure). Variants and states cards and comparison grids
  are checked; a free-form `render()` preview is not.
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
- `anatomy-picture-geometry` (warning): measured at the default 1280 width on each anatomy
  picture drawn with `AnatomySpecimen`: the specimen's horizontal centre more than 6px off the
  centre of its stage (not checked when the stage scrolls sideways), or a pin more than 48px past
  the specimen's pin side, on the wrong side of it, above or below it, or overlapping the legend
  column. Every pin in the stage is measured, whether it came through `pins` or was placed in the
  specimen's children (right-to-left text mirrors the pin side). Each pin is one finding: the
  small ↗ badge a pin carries when it opens a page is not measured. Pins beside the specimen are
  judged as a column: a column taller than the specimen is fine when its centre lines up with the
  specimen's. A pin that extends past the stage's box is reported as cut off (`AnatomySpecimen`
  makes its block as tall as the pin column on the web, so that only happens with a custom
  picture). The legend check only runs when the legend sits beside the picture. A picture with no `AnatomySpecimen` has nothing to measure here;
  `anatomy-picture-not-specimen` reports it.
- `heading-breaks-word` (hint): measured at 800px with the heading check. The page heading breaks
  inside a word: an unbroken run (a Swift type name, say) wider than its column, so the browser
  splits it mid-word. A heading that wraps between words, or breaks at a hyphen, is fine. Give the
  page a human `title`. Breaks where a browser may legitimately break (after a space, hyphen, `/`,
  `—`, `–`, a zero-width space, and between CJK characters) are fine. It is a hint, so it never
  fails `--ci`. A title that cannot wrap at all surfaces as `page-head-overlap`; one that wraps
  mid-word, as this hint.
- `render-unavailable` / `render-failed` (errors): no browser, or the catalog didn't start.

It needs `puppeteer` in your project (`npm install --save-dev puppeteer`); ds-viewer doesn't
install a browser. When the `CI` environment variable is set, the browser is launched with
`--no-sandbox` (GitHub's Ubuntu runners restrict the user namespaces Chrome's sandbox needs);
on your own machine the sandbox stays on. It takes about two minutes for 50 pages — plus a moment per page for the
narrow-viewport heading pass — and works with `--json` (progress
goes to stderr), `--ci` and `doctor.strict`, so CI can run `npx ds-viewer doctor --render --ci` — the step to run on every pull request, and the one the GitHub Action `init` writes runs whenever your project has `puppeteer`.

It starts its own catalog on the first free port from 5181. `--port <n>` pins it instead, which
you want when something else already holds that range — another project's catalog, or a second
`dev`. The check cannot tell a stranger's server on its port from its own, so a collision reports
that server's pages as your project's failures.

It starts its own `dev` server, with `--no-update-endpoint` and its own generated directory
(`.ds-viewer-render/`, gitignored by `init` alongside `.ds-viewer/`; every generated directory also
holds its own `.gitignore` containing `*`, so a project initialised earlier never sees them as
untracked). Nothing it generates touches the workspace a running `dev` owns, so you can run it beside a catalog you already have open and
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

On a family or group page the specimens live on the members, so `explain` also prints a **Members**
section with each member's own blocks (a member with no specimens says so), and `--json` carries
the same under `members`, keyed by member id, in the same shape as `blocks`. Member counts are for
the full 1280px row. A member with two blocks may be placed side by side in the viewer (half the
row each), so `explain` lists it under `memberPlacement` as "decided in the viewer" and prints that
under the member; nested numbered parts are also indented in the viewer, so treat a member's counts
as an upper bound. The page's own `blocks` and `group` outline are unchanged.

`explain --all` records the same per-member blocks under each page's `members`, and `layout-diff`
compares them (`member "Gallery": "States / configurations" at full width: 4×1 → 2×2`). The
snapshot carries `membersRecorded: true`; members are compared only when both snapshots do, and a
page without `members` in a marked snapshot counts as having none (so a page that loses or gains
all its members is reported). A snapshot written before members were recorded is not marked, so a
diff against it skips members instead of reporting every member as new.

### The `AGENTS.md` section and GitHub Action

`npx @krapwoo/ds-viewer init` (either path) appends a short section to `AGENTS.md` between
`<!-- ds-viewer:start v1 -->`/`<!-- ds-viewer:end -->` markers — creating the file if it doesn't
exist — telling an AI working on the project to update a page alongside its component, bind
examples to props, never invent grid cells or groups, and run `doctor`/`explain` before finishing.
It also writes `.github/workflows/ds-viewer.yml`, a SHA-pinned Action that installs dependencies
(picking `npm ci`, `pnpm install --frozen-lockfile`, or `yarn install --immutable` from whichever
lockfile the project has at that moment) and then runs `npx ds-viewer doctor --render --ci` on every
pull request when `node -e "require.resolve('puppeteer')"` succeeds (run through the package
manager's own runner, `pnpm exec node` or `yarn node`, so Yarn Plug'n'Play resolves it), and plain `npx ds-viewer doctor --ci`
(with a one-line note) when it doesn't. `init` doesn't add `puppeteer`, since ds-viewer never installs a
browser; it prints a one-line recommendation to `npm install --save-dev puppeteer` only when the project doesn't already have it. Both are written once; re-running `init` adds
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
