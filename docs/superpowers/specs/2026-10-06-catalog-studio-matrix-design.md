# Catalog Studio Matrix — Approved Design Specification

- **Status:** Approved design and specification (revision 3); revision 2 implemented on `feat/catalog-studio-matrix`; revision 3 implementation not authorized
- **Approved:** 2026-10-06
- **Primary reference (page structure):** `docs/design/2026-10-06-catalog-studio-matrix-reference.html` — SHA-256 `c58fa8a1272517682ab1e4346ba4d806c1f21c57f6280a2ebac8eb93856e90d2`
- **Layouts reference (grid, list, preview; visual system):** `docs/design/2026-10-06-catalog-studio-matrix-layouts-reference.html` — SHA-256 `208864b5403dd18660980df1071e12b88cc6ee798cc272c8f14094c1dadd6ca8`
- **Adaptive reference (revision 3: grouped rows, phone-width previews, placement, Props box, token reference):** `docs/design/2026-10-06-catalog-studio-matrix-adaptive-reference.html` — SHA-256 `46908ada7315c2a46d44a33c2296b73d1dd4aa209892a2ad3ed55072597b8b23`. Its control bar and amber notes are mockup-only; the ★ options are the approved design.

## Outcome

A catalog user selects one page and visually compares that component's meaningful variants and states without scrolling past any other component. Guidance, API facts, and accessibility information sit below the visual comparison and stay visible.

Each page answers these questions in reading order:

1. Which component am I viewing, and what is it for?
2. How do its variants and states look, side by side?
3. When should I use it?
4. What are its key API and accessibility facts?

## Scope contract

### Required

- Show one selected page at a time; never the full component list in the main content.
- A persistent, searchable sidebar.
- Each page has a breadcrumb, title, description, previous and next controls, and a source path.
- Specimens use one of four layouts — **grid**, **grouped rows**, **list**, or **preview** — chosen by the rules below; two blocks are placed side by side or stacked automatically.
- Every grid column and list cell is at most **402px** wide and has **16px padding**.
- Comfortable density only. No density toggle.
- Guidance and Quick reference are always visible. No collapse control.
- Specimens are the real exported components.
- The **whole catalog interface** (both catalogs, every page type) uses the approved visual system below.
- Desktop and laptop screens only.
- Keyboard, screen reader, and focus behavior work on every control.

### Report only

- Components whose data cannot form a truthful grid without new authored combinations.
- Metadata gaps found while mapping pages to layouts.
- Guidance or accessibility prose improvements unrelated to the layout change.

### Prohibited

- A comfortable/compact density toggle.
- Recording or displaying where a component is used, screen names, or navigation steps.
- A compact, mobile, or drawer layout.
- Restyling the documented product components or changing product tokens.
- Catalog-only lookalikes of product components.
- Fabricated grid cells (multiplying `variants` by `states` without authored combinations).
- Hand-editing generated manifests.
- Release or deployment without separate authorization.

## Page structure

### Sidebar

- 264px wide, white, right border `#ddd`, padding 24px top and 18px sides.
- App name (17px, extra bold), catalog caption (12px, secondary gray), filter field.
- Grouped links: uppercase group labels (10px, extra bold, 0.1em tracking); links 14px secondary gray, at least 44px tall.
- Hover: `#f1f3f8` background. Keyboard focus: 3px `#c9d7ff` outline. Active: `#e9efff` background with `#174dc6` bold label.
- The filter narrows the link list only. Zero matches shows "No matches"; the open page does not change.

### Page header

- Breadcrumb `<app name> / <group>` (12px, secondary gray).
- Title (28px, bold), description (14px, secondary gray).
- Previous and next buttons: 44×44px, white, `#d7d7d7` border, 9px radius. They follow sidebar order, do not wrap, and are disabled at the first and last page.

### Visual comparison (one or two blocks)

Each block has an uppercase label (12px, bold, 0.06em tracking) followed by its content.

#### Grid — two props that combine freely

- A table: a 120px row-header column, then one column per value of the column axis.
- Every row × column cell is authored with a real instance, or with an `unavailableReason` when that combination genuinely does not exist.
- Columns grow with the window up to 402px and never shrink below the specimen size minimum.
- Card: white, `#d7d7d7` border, 14px radius; `#e4e4e4` dividers; header row and row headers on `#fafafa`.
- Header text 11px extra bold, 0.04em tracking. Row-header text 14px bold.

#### List — one axis

- **One shared card** in the same style as the grid. Its cells wrap into rows; each cell has its own caption strip (11px extra bold on `#fafafa`, 16px padding, `#e4e4e4` divider below).
- Rows are balanced: use the fewest rows that fit, then spread items evenly across them. Blank cells complete the last row when needed.
- Wide components use fixed 402px cells (phone width); the card then hugs its columns instead of stretching.

#### Grouped rows — configurations that belong to one variant

- One shared card. Each row starts with a 120px row header naming the variant (14px bold on `#fafafa`), followed by that variant's configurations.
- Each cell keeps its own caption strip, because rows do not share column meanings (a circle's size is not a bar's thickness).
- Cells grow up to 402px and never shrink below the specimen size minimum (regular by default). Shorter rows end in blank cells. A card wider than its container scrolls horizontally inside itself.
- Used when at least one `states` item names a variant in `group`. A variant with no grouped configurations shows its own example as its single cell. States without a matching group go to "Other configurations".

#### Preview — free-form content

- One card (white, `#d7d7d7` border, 14px radius, 24px padding).
- **Component previews render at phone width:** each frame is at most 402px wide, left-aligned. A page may add widths with `previewWidths`, e.g. `[402, 320]` for a small phone. With more than one frame, each has a caption (`402 · Default phone`, `320 · Small phone`; 11px extra bold, uppercase, secondary gray). Each frame is its own live instance.
- **Full width:** token galleries, recipes, and the manifest (all `tokenGallery`), and any catalog that passes `defaultPreviewWidths="full"` to CatalogShell (the framework catalog, whose previews are catalog chrome).

### Choosing the layout

**Specimen size** sets the minimum column or cell width:

| Size | Minimum width | Typical components |
|---|---|---|
| Compact | 160px | Badge, Pill, Avatar, Switch, Checkbox, Radio |
| Regular | 240px | Button and most others |
| Wide | 402px, fixed | Banner, Toast, ListItem, Card, InputField, TopNav, Dock |

A section declares `specimenSize`. Without one, full-width (`itemsFill`) slots are wide and everything else is regular.

**Rules:**

1. Use a **grid** when two props combine freely **and** the column axis fits a 1280px laptop (952px content width) without scrolling: at most 5 compact, 3 regular, or 2 wide columns. Put the axis with fewer values in the columns.
2. When configurations belong to one variant each, use **grouped rows**.
3. Otherwise use **lists**: the primary axis first ("Variants"), then the other axis.
4. States or configurations not covered by a grid or grouped rows appear once, in an **"Other configurations"** list below it.
5. Free-form content uses **preview**.
6. A block with nothing to show is omitted. A page with nothing documented at all shows one "No examples documented." block.

**Placement of two blocks** (automatic):

- Blocks start stacked. After both are measured, they move side by side only when that makes the page at least **120px** shorter.
- Only a list may move beside a first block, and only when the first block hugs its content (at most 70% of the content width) and the space beside it keeps the list's minimum cell width (402px for wide).
- The side-by-side height is predicted from the measured stacked heights and the list's balanced rows in the remaining width.
- A width change returns to stacked and decides again. Heights are only recorded while stacked, so the decision never feeds on its own result. Reading and focus order are always first block, then second.
- Examples at 1280px: Dropdown goes side by side; Button, Badge, Banner, Switch, and Loading stay stacked. At 1100px Dropdown stacks (340px beside a 402px variant).

**Classification of the current 47 pages:**

| Layout | Count | Pages |
|---|---|---|
| Grid | 4 | Button (Variant × State, regular), Badge (Tone × Icon, compact), Avatar (Kind × Size, compact), Pill (Selection × State, compact) |
| Grouped rows | 1 | Loading (Circle: Small / Medium / Large; Linear: Thin / Default / Thick; Accent colour in "Other configurations") |
| List | 26 | All other component pages |
| Preview | 16 | SegmentedToggle and UnderlineTabs (402 + 320), BottomSheet, Dialog (402), 8 token pages, 3 recipes, Manifest (full width) |

### Reference details

- **Reference card:** white, `#ddd` border, 12px radius, 20px padding, two columns 32px apart.
  - **Guidance:** `whenToUse`, or "No usage guidance documented."
  - **Quick reference:** Source path, then Accessibility, as rows with `#eee` dividers.
- **Props box:** its own card in the same style, 28px below the reference card.
  - **Two columns, filled across first** (prop 1 left, prop 2 right, then down), 32px apart, when there are **4 or more props** and each column keeps at least **360px**; otherwise one column.
  - In two columns each prop stacks: name (12px bold mono, `?` when optional) and type (10px mono, accent) on one line, then description, then default. Dividers `#e4e4e4` 1px under each prop within its column, none under the last prop of a column.
  - In one column each row keeps name and type in a 140px column with the description beside it.
  - Reading and focus order are the declared prop order.
- **Token galleries** show only a Quick reference card with the Source row.
- Panel headings 13px, bold, uppercase. `hide.props` and `hide.accessibility` remove those parts.

## Visual system

The approved layouts reference defines the visual system for the **entire catalog interface**: shell, sidebar, page header, grids, lists, previews, reference details, props tables, token rows, swatches, scale galleries, and phone frames in both catalogs. Documented product components keep their own design tokens.

### Color

| Role | Value | Notes |
|---|---|---|
| Page background | `#f6f6f4` | |
| Surface | `#ffffff` | Sidebar, cards, cells |
| Muted surface | `#fafafa` | Table headers, row headers, cell captions, filter field |
| Text | `#181818` | |
| Secondary text | `#666666` | The mockup's `#777` fails WCAG AA (4.14–4.48:1); `#666` passes (5.3–5.7:1). User decision. |
| Divider | `#e4e4e4` | Inside grids, lists, props tables, token rows |
| Hairline border | `#dddddd` | Sidebar edge, reference card, filter field |
| Strong border | `#d7d7d7` | Grid, list, and preview cards; pager buttons |
| Subtle divider | `#eeeeee` | Quick-reference rows |
| Hover | `#f1f3f8` | Nav rows and buttons |
| Accent | `#174dc6` | Active nav label, prop types, scale bars |
| Accent background | `#e9efff` | Active nav row |
| Focus ring | `#c9d7ff`, 3px | Every catalog control |

### Type

System font. Sizes: 10 (group labels), 11 (table and cell headers), 12 (breadcrumb, captions, block labels), 13 (panel headings), 14 (body, nav, row headers), 17 (app name), 28 (page title).

### Shape and spacing

- Radius: 8px nav rows, 9px controls and filter field, 12px reference card, 14px grid, list, and preview cards.
- Main content padding: 28px top, 32px sides. Content max width 1200px.
- Cell padding 16px; specimen rows at least 150px tall.

## Data contract

```ts
type SpecimenSize = 'compact' | 'regular' | 'wide';

interface ComparisonAxisItem {
  key: string;
  label: string;
}

interface ComparisonCell {
  rowKey: string;
  columnKey: string;
  node?: React.ReactNode;          // exactly one of node / unavailableReason
  unavailableReason?: string;
  fill?: boolean;
}

interface ComparisonDef {
  rowLabel: string;
  columnLabel: string;
  rows: ComparisonAxisItem[];
  columns: ComparisonAxisItem[];
  cells: ComparisonCell[];
  size?: SpecimenSize;             // defaults to the section's specimenSize, then 'regular'
}
```

`SectionDef` gains `comparison?: ComparisonDef`, `specimenSize?: SpecimenSize`, and `previewWidths?: PreviewWidths`.

```ts
type PreviewWidths = readonly number[] | 'full';   // numbers are capped at 402

interface VariantExample {
  // …existing fields…
  group?: string;   // in `states` only: the `variants` key this configuration belongs to
}
```

`CatalogShell` gains `defaultPreviewWidths?: PreviewWidths` (default `[402]`), passed to every page that does not set `previewWidths`.

Rules:

- Every row × column pair is authored exactly once; cells reference declared keys only.
- A grid whose column count exceeds the laptop limit for its size produces a development warning.
- `states` items whose key matches a grid row or column key are not repeated in "Other configurations".
- `variants` and `states` remain data for the manifest and completeness check.
- `tokenGallery` bypasses grids, grouped rows, and lists, and always previews at full width.
- A grid takes precedence over grouped rows; `hide.states` disables grouping.

## Interaction behavior

| Interaction | Result |
|---|---|
| Select a sidebar link | The main content shows that page; focus moves to its title. |
| Filter | Narrows the sidebar list; the open page stays. |
| Previous / next | Moves one page in sidebar order; disabled at the ends. |
| Refresh or deep link (web) | The page in the URL fragment opens (`#Button`). Unknown fragments open the first page and correct the fragment. |
| Back / forward (web) | Returns to the previous or next visited page. |
| Grid or grouped rows wider than the window | Scrolls horizontally inside the card only. |
| Window resized | Two-block pages return to stacked and choose placement again. |

## States

| Surface | State | Presentation |
|---|---|---|
| Catalog | Initial | First page, unless the URL names another valid page |
| Sidebar | Filtering / no matches | Matching links / "No matches"; page unchanged |
| Grid | Unsupported cell | "Not supported — <reason>" |
| Grid | Missing authored cell | "Missing example" plus a development warning |
| List | Uneven last row | Blank cells in the card style |
| Grouped rows | Shorter row | Blank cells in the card style |
| Page | Block with nothing to show | Omitted |
| Page | Nothing documented | One "No examples documented." block |
| Reference | Missing guidance / props / accessibility | Truthful empty-state wording |

## Accessibility

- Sidebar links expose link semantics; the open page's link carries `aria-current="page"` on web (React Native Web drops `selected` for links). The sidebar is a labeled navigation region.
- Page titles are level-1 headings and receive focus after navigation without page scrolling.
- Grids expose table, row, column-header, row-header, and cell semantics on web.
- Grouped rows: each row's cells form a list labeled "<page>: <variant>"; blank cells are hidden from assistive tech.
- Specimens keep their own interactive semantics; disabled examples are programmatically disabled.
- Every catalog control shows the 3px focus ring and has a target of at least 44×44px.
- All catalog text meets WCAG AA contrast.
- No new motion.

## Fidelity acceptance

Compare production against the three references at a 1280×900 viewport (items 11–12 also at 1100 and 1600).

1. One page in the main content; persistent searchable sidebar.
2. Colors, type sizes, radii, and borders match the visual system tables.
3. Button: 5×3 regular grid, then a 3×2 "Other configurations" list.
4. Badge: 5×4 compact grid. Switch: one-row compact list. Banner: two wide lists of 402px cells, 2 per row.
5. No column or cell wider than 402px; every cell has 16px padding.
6. No density control, collapse control, or usage-location feature.
7. No document-level horizontal scrolling.
8. Keyboard focus, sidebar selection, previous/next, deep links, and back/forward work with no new console errors. The unchanged baseline already logs `react-native-svg` errors from product components (`Icon.native`, `Loading`) on web; those are pre-existing and out of scope.
9. Loading: grouped rows (Circle, Linear) with 3 cells each, specimens centred (bars stretched), then "Other configurations" with Accent colour.
10. SegmentedToggle and UnderlineTabs: frames of 402px and 320px with captions; no empty States block.
11. Dropdown side by side at 1280px and 1600px; stacked at 1100px.
12. Button Props box: two columns filled across first (label, variant / size, showIcon …); one column at 1100px; SegmentedToggle (3 props) one column.
13. Colors: only a Quick reference card with the Source row. Framework catalog previews stay full width.

## Non-goals

- Redesigning the product components.
- Changing the catalog's component inventory or lifecycle claims.
- Usage analytics, adoption tracking, or product-screen documentation.
- Replacing Expo, React Native, or React Native Web.
- A second registry or viewer.

## Design decisions recorded

1. One page at a time replaces the long scrolling document.
2. Primary job: visual comparison of variants and states.
3. Studio navigation combined with comparison content.
4. Columns and cells up to 402px; 16px cell padding.
5. Comfortable density only; reference details always visible.
6. No usage-location recording.
7. Three layouts (grid, list, preview) chosen by specimen size and laptop fit; extended to four with grouped rows in revision 3.
8. One-axis examples share one card with balanced rows.
9. The approved mockup's visual system applies to the whole catalog interface; secondary text stays `#666`.
10. Desktop and laptop only.
11. Pager buttons 44×44px.
12. Configurations that belong to one variant show as grouped rows (revision 3).
13. Component previews are capped at phone width (402px), with optional extra widths such as 320px; token pages, recipes, the manifest, and the framework catalog stay full width (revision 3).
14. Two blocks sit side by side only when that saves at least 120px of page height; empty blocks are omitted (revision 3).
15. Props move to their own box, two columns filled across first when there are 4+ props and room (revision 3).
16. Token pages show the source path in a Quick reference card (revision 3; resolves the spec-versus-reference conflict in favor of the spec).

## Authorization state

- Design and specification: approved by user.
- Implementation: revision 2 implemented and committed locally (`2c485d1`, not pushed); revision 3 not authorized.
- Documentation commit, push, and merge to `krapwoo/design-system-viewer`: authorized by user for revision 2 (PR #2); revision 3 documents are uncommitted.
- Release and deployment: not authorized.
