# Catalog Studio Matrix — Approved Design Specification

- **Status:** Approved design and specification (revision 2); implementation not authorized
- **Approved:** 2026-10-06
- **Primary reference (page structure):** `docs/design/2026-10-06-catalog-studio-matrix-reference.html` — SHA-256 `c58fa8a1272517682ab1e4346ba4d806c1f21c57f6280a2ebac8eb93856e90d2`
- **Layouts reference (grid, list, preview; visual system):** `docs/design/2026-10-06-catalog-studio-matrix-layouts-reference.html` — SHA-256 `208864b5403dd18660980df1071e12b88cc6ee798cc272c8f14094c1dadd6ca8`

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
- Specimens use one of three layouts — **grid**, **list**, or **preview** — chosen by the rules below.
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

#### Preview — free-form content

- Live interactive demos, token galleries, recipes, and the manifest render in one full-width card (white, `#d7d7d7` border, 14px radius, 24px padding).

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
2. Otherwise use **lists**: the primary axis first ("Variants"), then the other axis.
3. States or configurations not covered by a grid appear once, in an **"Other configurations"** list below it.
4. Free-form content uses **preview**.

**Classification of the current 47 pages:**

| Layout | Count | Pages |
|---|---|---|
| Grid | 4 | Button (Variant × State, regular), Badge (Tone × Icon, compact), Avatar (Kind × Size, compact), Pill (Selection × State, compact) |
| List | 27 | All other component pages, including Loading (its size props differ by variant, so it stays two lists) |
| Preview | 16 | SegmentedToggle, UnderlineTabs, BottomSheet, Dialog, 8 token pages, 3 recipes, Manifest |

### Reference details

- One white card, `#ddd` border, 12px radius, 20px padding, two columns 32px apart.
- **Guidance:** `whenToUse`, or "No usage guidance documented."
- **Quick reference:** Source path, then Accessibility, as rows with `#eee` dividers.
- **Props:** the full props table below the two columns.
- Panel headings 13px, bold, uppercase. Hidden for token galleries; `hide.props` and `hide.accessibility` remove those parts.

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

`SectionDef` gains `comparison?: ComparisonDef` and `specimenSize?: SpecimenSize`.

Rules:

- Every row × column pair is authored exactly once; cells reference declared keys only.
- A grid whose column count exceeds the laptop limit for its size produces a development warning.
- `states` items whose key matches a grid row or column key are not repeated in "Other configurations".
- `variants` and `states` remain data for the manifest and completeness check.
- `tokenGallery` bypasses grids and lists.

## Interaction behavior

| Interaction | Result |
|---|---|
| Select a sidebar link | The main content shows that page; focus moves to its title. |
| Filter | Narrows the sidebar list; the open page stays. |
| Previous / next | Moves one page in sidebar order; disabled at the ends. |
| Refresh or deep link (web) | The page in the URL fragment opens (`#Button`). Unknown fragments open the first page and correct the fragment. |
| Back / forward (web) | Returns to the previous or next visited page. |
| Grid wider than the window | Scrolls horizontally inside the grid card only. |

## States

| Surface | State | Presentation |
|---|---|---|
| Catalog | Initial | First page, unless the URL names another valid page |
| Sidebar | Filtering / no matches | Matching links / "No matches"; page unchanged |
| Grid | Unsupported cell | "Not supported — <reason>" |
| Grid | Missing authored cell | "Missing example" plus a development warning |
| List | Uneven last row | Blank cells in the card style |
| Reference | Missing guidance / props / accessibility | Truthful empty-state wording |

## Accessibility

- Sidebar links expose link semantics; the open page's link carries `aria-current="page"` on web (React Native Web drops `selected` for links). The sidebar is a labeled navigation region.
- Page titles are level-1 headings and receive focus after navigation without page scrolling.
- Grids expose table, row, column-header, row-header, and cell semantics on web.
- Specimens keep their own interactive semantics; disabled examples are programmatically disabled.
- Every catalog control shows the 3px focus ring and has a target of at least 44×44px.
- All catalog text meets WCAG AA contrast.
- No new motion.

## Fidelity acceptance

Compare production against both references at a 1280×900 viewport.

1. One page in the main content; persistent searchable sidebar.
2. Colors, type sizes, radii, and borders match the visual system tables.
3. Button: 5×3 regular grid, then a 3×2 "Other configurations" list.
4. Badge: 5×4 compact grid. Switch: one-row compact list. Banner: two wide lists of 402px cells, 2 per row.
5. No column or cell wider than 402px; every cell has 16px padding.
6. No density control, collapse control, or usage-location feature.
7. No document-level horizontal scrolling.
8. Keyboard focus, sidebar selection, previous/next, deep links, and back/forward work with no new console errors. The unchanged baseline already logs `react-native-svg` errors from product components (`Icon.native`, `Loading`) on web; those are pre-existing and out of scope.

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
7. Three layouts (grid, list, preview) chosen by specimen size and laptop fit.
8. One-axis examples share one card with balanced rows.
9. The approved mockup's visual system applies to the whole catalog interface; secondary text stays `#666`.
10. Desktop and laptop only.
11. Pager buttons 44×44px.

## Authorization state

- Design and specification: approved by user.
- Implementation: not authorized.
- Documentation commit, push, and merge to `krapwoo/design-system-viewer`: authorized by user.
- Release and deployment: not authorized.
