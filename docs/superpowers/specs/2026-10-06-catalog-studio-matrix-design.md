# Catalog Studio Matrix — Approved Design Specification

- **Status:** Approved design and specification; implementation not authorized
- **Approved:** 2026-10-06
- **Reference:** `docs/design/2026-10-06-catalog-studio-matrix-reference.html`
- **Reference SHA-256:** `c58fa8a1272517682ab1e4346ba4d806c1f21c57f6280a2ebac8eb93856e90d2`

## Outcome

A catalog user can select one component, open a dedicated page for it, and visually compare its meaningful variants and states without scrolling through every other component. Guidance, API facts, and accessibility information remain visible below the visual comparison but do not compete with it.

The page answers these questions in reading order:

1. Which component am I viewing, and what is it for?
2. How do its variants differ across meaningful states?
3. When should I use it?
4. What are its key API and accessibility facts?

## Scope contract

### Required

- Replace the single long catalog document with one selected section/page at a time.
- Preserve a persistent, searchable component-and-token sidebar.
- Give each component a dedicated title, description, category breadcrumb, source path, previous control, and next control.
- Make the variant-by-state comparison matrix the primary page content.
- Allow each comparison column to grow responsively up to **402px**.
- Apply **16px padding** to every matrix header and specimen cell.
- Use the approved comfortable density only; provide no density toggle.
- Keep Guidance and Quick Reference visible by default with no collapse control.
- Preserve truthful component specimens from the real exported components.
- Preserve token-gallery and composed-example pages without forcing them into a false component matrix.
- Maintain keyboard, touch, screen-reader, responsive, and reduced-motion behavior.

### Report only

- Existing catalog records whose current specimens cannot truthfully form a two-dimensional matrix without new explicit combinations.
- Existing component metadata gaps discovered while mapping records to the new page contract.
- Opportunities to improve component-specific guidance or accessibility prose that are unrelated to the layout conversion.

### Prohibited

- Reintroducing the full component list into the main scrolling content.
- A comfortable/compact density toggle.
- Recording or displaying where a component is used, screen names, or navigation steps.
- Reconstructing product components with catalog-only lookalikes.
- Hand-editing generated manifests.
- Changing product design tokens or component behavior to make the catalog layout easier.
- Commit, push, publication, deployment, or release without separate authorization.

## Approved information architecture

### Persistent sidebar

- Width at desktop: **264px**.
- Contains catalog identity, subtitle, component search, grouped destinations, and the active destination.
- Search filters destinations only; it does not filter specimen cells.
- Selecting a destination replaces the main page content rather than scrolling the main document.
- “No matches” remains an explicit sidebar state.
- Groups and ordering continue to derive from the canonical `NavGroup[]` data and `sortIds()` helper.

### Component page header

- Breadcrumb: category and current component.
- Component title and short description.
- Previous and next controls follow the canonical ordered destination list.
- At the first or last destination, the unavailable direction is disabled rather than wrapping.
- The source path remains available in Quick Reference rather than taking visual priority above the comparison.

### Comparison matrix

- The upper-left cell names the row axis, normally `State` or `Configuration`.
- Columns represent the primary visual variant axis.
- Rows represent meaningful states or configurations.
- Each data cell renders an explicit, real specimen for that exact row-and-column combination.
- Column width: responsive, with a practical minimum based on the specimen and an absolute maximum of **402px**.
- Row-label column may remain narrower than specimen columns.
- Every header and specimen cell uses **16px padding**.
- Comfortable row height is the only density. The reference uses a 150px minimum specimen-row height; production may grow beyond it when real content requires more space.
- Cells must never clip their specimen. Wide matrices scroll horizontally inside the matrix region rather than expanding the document width.
- Empty combinations render a concise unavailable marker only when that combination is genuinely unsupported. Do not fabricate a specimen.

### Reference details

- Guidance and Quick Reference appear immediately below the matrix.
- They are expanded by default and cannot be collapsed.
- Guidance contains `whenToUse` when present; otherwise it contains the component description or a truthful empty state.
- Quick Reference contains the most important API and accessibility facts, including source path.
- Full prop detail may remain in the existing `PropsTable`; the approved layout does not require every prop row to appear in the initial viewport.
- No usage-location or screen-path metadata is collected or displayed.

### Token and pattern destinations

- Token galleries remain dedicated single-page galleries driven by their current render functions.
- Composed examples remain dedicated preview pages.
- These pages reuse the same sidebar and page header but replace the matrix with their truthful full-width presentation.

## Data contract

The current `SectionDef` stores separate pre-rendered `variants` and `states`; those nodes cannot be safely cross-multiplied. Production must add an explicit comparison contract rather than guessing combinations.

Recommended additive shape:

```ts
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
  itemsFill?: boolean;
}
```

Add `comparison?: ComparisonDef` to `SectionDef`. (Renamed from `ComparisonMatrix` during planning so the rendering component can use that name.)

Rules:

- Every cell key pair must be unique.
- Every cell must reference declared row and column keys.
- Duplicate, missing, or undeclared cell coordinates produce a development warning.
- A component with only variants uses one `Default` row.
- A component with only states uses one `Default` column.
- Existing `variants`, `states`, and `render` remain valid during migration and serve as a truthful fallback until an explicit comparison is authored.
- `tokenGallery` continues to bypass the comparison contract.

## Component and file responsibilities

| Responsibility | Existing source | Production direction |
|---|---|---|
| Catalog selection and page ownership | `native/catalog/CatalogShell.tsx` | Replace scroll-spy/offset ownership with selected destination state and one-page rendering. |
| Navigation, search, active state | `native/catalog/CatalogSidebar.tsx` | Reuse grouped filtering; selection changes the current page instead of invoking `scrollTo`. |
| Component header and reference details | `native/catalog/SectionBlock.tsx` | Refactor into page-level presentation or split into focused `CatalogPageHeader`, `ComparisonMatrix`, and `ReferenceDetails` units. |
| Component metadata | `native/catalog/types.ts` | Add the explicit comparison contract without removing current fields during migration. |
| Props | `native/catalog/PropsTable.tsx` | Reuse. |
| Catalog visual system | `native/catalog/tokens.ts` | Reuse existing type, color, spacing, and radius tokens. Add no product-token dependency. |
| Catalog inventory | `CatalogExample.tsx` and `CatalogFrameworkExample.tsx` | Continue as canonical record sources; add explicit matrices only where truthful combinations exist. |

## Interaction behavior

| Interaction | Required result |
|---|---|
| Select sidebar destination | Replace the main content with that destination and move focus to its page heading. |
| Search | Filter sidebar destinations while preserving the active page. |
| Search returns zero results | Show `No matches`; do not clear or replace the active page. |
| Previous/next | Navigate through the same canonical order used by the sidebar. |
| Browser refresh/deep link | On web, preserve the selected destination in a stable URL fragment or equivalent client-side route. Invalid IDs fall back to the first valid destination. |
| Keyboard navigation | Sidebar links and previous/next controls expose visible focus and activate with standard keyboard semantics. |
| Horizontal overflow | Scroll only the matrix region; no document-level horizontal overflow. |

## Responsive behavior

### Desktop

- Persistent 264px sidebar.
- Main page uses comfortable spacing and available width.
- Matrix columns share available space and stop growing at 402px.
- Guidance and Quick Reference form two columns.

### Compact viewport

- Sidebar collapses to a narrow navigation rail or an accessible drawer while retaining search access.
- Matrix remains structurally intact and scrolls horizontally when necessary.
- Guidance and Quick Reference stack vertically.
- Previous/next controls remain reachable without overlapping the title.
- No specimen is scaled down merely to fit the viewport.

## States

| Surface | State | Presentation |
|---|---|---|
| Catalog | Initial | First valid destination selected. |
| Sidebar | Filtering | Matching grouped destinations only. |
| Sidebar | Empty search | `No matches`, active page unchanged. |
| Page | Invalid deep link | First valid destination with corrected active state. |
| Matrix | Explicit comparison | Full row/column grid. |
| Matrix | Legacy record | Truthful single-axis fallback from existing variants/states; no invented cross-product. |
| Matrix | Unsupported cell | Concise unavailable marker with a real reason. |
| Reference | Missing guidance | Component description or truthful `No guidance documented.` message. |
| Reference | Missing props/a11y | Existing truthful empty-state wording. |

## Accessibility

- Sidebar destinations keep link semantics and selected state.
- The page title receives programmatic focus after destination changes without triggering unexpected page scrolling.
- The matrix exposes row and column headers semantically on web; native receives equivalent accessible labels for each specimen cell.
- Specimen controls keep their real interactive semantics. Catalog chrome must not intercept their focus or gestures.
- Disabled examples remain programmatically disabled where the production component supports it, not merely visually faded.
- Focus indicators use the catalog accent and remain visible against white and muted surfaces.
- Touch targets for catalog controls are at least 44×44px.
- No new motion is required. Existing component motion continues to respect its own reduced-motion behavior.

## Token mapping

- Page background: `CATALOG_COLOR.pageBackground`.
- Sidebar and reference surfaces: `CATALOG_COLOR.surface`.
- Matrix or specimen surfaces: `CATALOG_COLOR.surface` or `surfaceMuted` according to current catalog hierarchy.
- Borders: `CATALOG_COLOR.border` / `borderHairline`.
- Active and focus emphasis: `CATALOG_COLOR.accent`.
- Matrix cell padding: `CATALOG_SPACE.lg` (**16px**).
- Reference spacing: existing `CATALOG_SPACE` steps; no arbitrary tighter spacing.
- Typography: existing `CATALOG_TYPE` scale.

## Fidelity acceptance

Compare production against the approved reference at equivalent content and default state.

Required checks:

1. Only one selected component or token destination appears in the main content.
2. Desktop sidebar remains persistent and searchable.
3. The visual comparison precedes reference details.
4. Matrix specimen columns never exceed 402px.
5. Every matrix cell has 16px internal padding.
6. Comfortable density is fixed; no density control exists.
7. Guidance and Quick Reference are visible by default and have no collapse control.
8. No “Used in,” screen-name, or navigation-step feature exists.
9. Matrix overflow is contained; the document has no horizontal overflow.
10. Keyboard focus, sidebar selection, previous/next navigation, and specimen interaction work without console errors.

Rendered verification must cover desktop and compact widths, at least one component with several variants/states, one single-axis component, one token gallery, sidebar search with and without matches, keyboard focus, horizontal overflow, and console health.

## Non-goals

- Redesigning the product components themselves.
- Changing the catalog’s component inventory or lifecycle claims.
- Adding usage analytics, component adoption tracking, or product-screen documentation.
- Replacing Expo, React Native, or React Native Web.
- Creating a second registry or viewer.

## Design decisions recorded

1. One component per page replaces the all-components scrolling document.
2. The primary job is visual comparison of variants and states.
3. The approved direction combines Studio navigation with a matrix canvas.
4. Matrix columns grow up to 402px and all cells use 16px padding.
5. Comfortable density is fixed; no density toggle.
6. Reference details are always visible and not collapsible.
7. Component usage locations and navigation steps are explicitly excluded.

## Authorization state

- Design direction: **approved by user**.
- Production specification: **awaiting user review**.
- Implementation: **not authorized**.
- Commit/push/publication/deployment: **not authorized**.
