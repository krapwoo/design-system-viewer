import type React from 'react';

/** One documented prop of a component, shown in its Props table. */
export interface PropDef {
  name: string;
  /** TypeScript type, kept short/readable (e.g. `'primary' | 'secondary'`, `() => void`). */
  type: string;
  /** True when the prop has no `?` in the interface — the caller must pass it. */
  required?: boolean;
  /** The value actually used when the component destructures a default for this prop. */
  default?: string;
  desc: string;
}

/** One individual example inside a variant/state cluster — e.g. one Button instance. */
export interface VariantExample {
  /** React key; keep stable and unique within its group. */
  key: string;
  /** Shown as a small caption under this item — the actual variant/state value it demonstrates
   *  (e.g. "Primary", "Icon-only"), not a generic label like "Example 1". */
  name: string;
  node: React.ReactNode;
  /** Stretch *this item's* wrapper to the row's full width, instead of shrinking to its own content
   *  width — for a single wide-format instance (e.g. a `fullWidth` Button) sitting among otherwise
   *  compact, centered siblings in the same slot. Without this, a `fullWidth`/stretch-based prop on
   *  the instance itself has nothing to stretch into — its wrapper still shrinks to content, so the
   *  instance renders at its natural size regardless of the prop. Independent of the slot's own
   *  `itemsFill` (which applies to every item uniformly); this is a per-item override. @default false */
  fill?: boolean;
  /** Which real prop value(s) this instance demonstrates, e.g. `{ variant: 'primary' }` or
   *  `{ size: 'large', disabled: true }` — mirrors the actual props passed to `node`. Optional and
   *  additive: SectionBlock only cross-checks a section's enum props against this metadata once at
   *  least one item in that section has started tagging them, so annotating is opt-in/gradual rather
   *  than an all-or-nothing migration. Once a section opts in, SectionBlock warns (dev console) about
   *  any enum value from `SectionDef.props` that no tagged item covers — the mechanical version of
   *  the completeness policy documented on `states` below. */
  props?: Record<string, unknown>;
  /** In `states` only: the `variants` item key this configuration belongs to (e.g. a size that
   *  exists only for the circle variant). When any state names a variant, the page shows one row
   *  per variant with its own configurations instead of separate Variants and States lists. */
  group?: string;
}

/** The content of the "Variants" or "States / Configurations" column — every value of a single prop's
 *  enum, or every distinct boolean/flag state, as individual instances. */
export interface VariantSlot {
  /** When true, each item stretches to fill the available width instead of shrinking to its own
   *  content width — for wide block-level components (Banner, Card, Toast, InputField) rather than
   *  small instances meant to sit centered (Button, Badge, Pill). @default false */
  itemsFill?: boolean;
  items: VariantExample[];
}

/** Width class for a page's specimens: compact (min 160px), regular (min 240px), or wide (fixed
 *  402px, phone width). Sets grid column and list cell widths. */
export type SpecimenSize = 'compact' | 'regular' | 'wide';

/** Widths for a component preview: one or more phone widths (each capped at 402px), or 'full' for
 *  content that is not a phone component (catalog chrome, token galleries). */
export type PreviewWidths = readonly number[] | 'full';

/** One row or column heading in a grid. */
export interface ComparisonAxisItem {
  key: string;
  label: string;
}

/** A grid axis's rows or columns: a plain list of items (today's shape, unchanged), or items bound
 *  to a real prop so `doctor` can check each item's key against that prop's actual options (design
 *  §4 "Binding examples to props"). Only a prop typed as a string-literal union can be bound —
 *  binding any other prop is a `doctor` error, never a runtime check here (the viewer renders a
 *  bound and an unbound axis identically; see `native/catalog/comparison.ts`'s `axisItems`). */
export type GridAxis = readonly ComparisonAxisItem[] | { prop: string; items: readonly ComparisonAxisItem[] };

/** One authored row × column specimen. Provide exactly one of `node` (a real instance of the
 *  documented component) or `unavailableReason` (the combination genuinely does not exist). */
export interface ComparisonCell {
  rowKey: string;
  columnKey: string;
  node?: React.ReactNode;
  unavailableReason?: string;
  /** Stretch this specimen to the cell width. @default false */
  fill?: boolean;
}

/** A grid of two props that combine freely. Every row × column pair is authored — never inferred
 *  by multiplying `variants` with `states`, because pre-rendered nodes cannot be combined. */
export interface ComparisonDef {
  /** Names the row axis; shown in the corner cell (e.g. "Variant"). */
  rowLabel: string;
  /** Names the column axis (e.g. "State"). */
  columnLabel: string;
  rows: GridAxis;
  columns: GridAxis;
  cells: ComparisonCell[];
  /** Defaults to the section's `specimenSize`, then 'regular'. */
  size?: SpecimenSize;
}

/** One entry in the catalog — a documented component or token group. `TId` is the app's own
 *  union of section ids (e.g. `'Button' | 'Card' | ...'`), so the sidebar and page navigation stay
 *  typed to the app's real section list without this file needing to know what they are. */
export interface SectionDef<TId extends string = string> {
  id: TId;
  /** Display name for the heading, sidebar and search (e.g. "Control heights"). Defaults to `id`,
   *  which stays the page's address (`#ControlHeights`) and its name in `explain`. */
  title?: string;
  /** Marks a component that is, or contains, a native platform control rather than a custom one:
   *  `'full'` shows an "OS component" badge under the title, `'partial'` "Partly OS component".
   *  Say in `description` which part is native and how it differs on web. */
  osComponent?: 'full' | 'partial';
  description: string;
  path: string;
  /** One sentence disambiguating this component from its closest look-alike(s) — the deciding
   *  question a reader (human or AI) would otherwise have to guess at when two components could
   *  plausibly fit the same spot (InputField vs SearchField vs Dropdown, Toast vs Banner, …). Omit
   *  for components with no real look-alike. Keep it to the one sentence that actually decides —
   *  the full reasoning lives in the repo's WHEN_TO_USE.md; this is a pointer, not a copy of it. */
  whenToUse?: string;
  /** The component's real prop interface, shown as a table above the live examples. Token/token-group
   *  sections (Colors, Spacing, etc.) have no component props, so this is omitted for those. */
  props?: PropDef[];
  /** What's actually true about this component's accessibility behavior, grounded in its source —
   *  not a generic disclaimer. Say plainly when a component has no explicit handling beyond the
   *  host element's default semantics, rather than inventing coverage that isn't there. */
  a11y?: string;
  /** Every value of the component's primary enum prop (e.g. `variant`), as individual instances —
   *  **including whichever value that prop defaults to** (e.g. Button's Variants starts with
   *  "Primary" since `variant` defaults to `'primary'`; Card's single instance is named "Default"
   *  since it has no enum at all). Never skip the default on the assumption it's obvious from source.
   *  Omit it when there are none: the page simply shows no Variants block (a page with nothing
   *  documented at all shows one "No examples documented." block). If `render` is set instead,
   *  its output is the page's Preview (for content that isn't a simple list of instances — see
   *  `render` below). */
  variants?: VariantSlot;
  /** Every meaningfully distinct boolean/flag state (`loading`, `disabled`, icon-only, …) **and** any
   *  other optional, prop-driven configuration worth showing that isn't the primary enum (an optional
   *  content slot like Banner's `action`/`link`, a structural mode like its status-row layout, …) — the
   *  column is titled "States / Configurations" precisely because not everything that belongs here is
   *  a strict boolean toggle. Two rules, checked against the component's real prop interface (not just
   *  whichever states come to mind):
   *  1. **No real prop left undemonstrated** — every prop that visibly changes the component's look
   *     needs at least one instance somewhere in the section (here or in `variants`). A prop that
   *     only ever appears in the Props table, with no live example anywhere, is a documentation gap.
   *  2. **Show both sides of a toggle, not just the special one** — when a state is one half of a
   *     binary look (icon-only vs. icon+text, disabled vs. enabled, expanded vs. collapsed), include
   *     *both* instances here rather than assuming the reader will cross-reference `variants` for the
   *     baseline. The States / Configurations column should read on its own.
   *  3. **Duplication across columns is fine, and often correct** — don't withhold an instance from
   *     here merely because the same configuration already appears in `variants` (or vice versa). Each
   *     column should be independently complete: a reader looking only at States / Configurations
   *     shouldn't have to flip to Variants (or back) to see the full picture.
   *  4. **A continuous prop (`size: number`, a colour string, …) has no fixed enum to sweep — show an
   *     explicit small / medium / large (or similarly-spaced) trio anyway, and label the one that
   *     matches the component's own default as "Medium" or "Default", even if that same default
   *     value already appears, unlabeled, somewhere else in the section (e.g. an unsized instance in
   *     `variants`). An instance the reader can't identify as "this is what a smaller/larger one looks
   *     like" doesn't count as demonstrating the range — this is the same rule as #3, but continuous
   *     props are exactly where it's easiest to skip a middle value because "the default is shown
   *     elsewhere anyway."
   *  Omit this when there are none — the page then shows no States block; never invent items to
   *  fill it. Give an item `group` (a `variants` key) when it only exists for that variant. */
  states?: VariantSlot;
  /** Escape hatch for content that isn't a simple list of instances — token galleries, live
   *  interactive demos with local state, structure diagrams, wrapping grids. Rendered as the page's
   *  Preview (phone width for components; see `previewWidths`). Ignored when `variants` is set. */
  render?: () => React.ReactNode;
  /** Marks this as a token-gallery section (raw token data, not a component with its own API) —
   *  SectionBlock renders `render()` full width under a "Tokens" label, skips the States /
   *  configurations list, and shows only a Quick reference card with the source path (there's no
   *  component behavior to document). */
  tokenGallery?: boolean;
  /** Token pages with more than one kind of token: one titled card per section (e.g. "Semantic"
   *  and "Palette", or "Body" and "Title"), instead of a single "Tokens" card. When set, `render`
   *  is not used and the page counts as a token gallery. See `TokenSection`. */
  tokenSections?: TokenSection[];
  /** How many sections sit side by side (1–3, default 1). Narrow sections such as type families
   *  use 2–3; the page drops columns rather than squeeze a section under 280px. A section with
   *  `wide: true` always takes a full row. */
  tokenColumns?: 1 | 2 | 3;
  /** Overrides the `tokenGallery` block's label (default `'Tokens'`) — e.g. `'Preview'` for a page
   *  that's a composed, realistic usage example rather than a list of raw token values. Ignored
   *  unless `tokenGallery` is also set. */
  fullWidthLabel?: string;
  /** A grid of two props that combine freely. When set, it replaces the Variants list, and any
   *  `states` item whose key matches a grid row or column key is not repeated below it.
   *  `variants`/`states` stay as data for the manifest and completeness check. */
  comparison?: ComparisonDef;
  /** Width class for this page's specimens. Without it, full-width (`itemsFill`) slots are 'wide'
   *  and everything else is 'regular'. */
  specimenSize?: SpecimenSize;
  /** Widths for this page's `render()` preview, e.g. `[402, 320]` to add a small-phone example.
   *  Defaults to the catalog's default (CatalogShell `defaultPreviewWidths`), else `[402]`. */
  previewWidths?: PreviewWidths;
  /** Remove specific parts of the page — for sections with no meaningful states, props, or
   *  accessibility story (e.g. a framework's own building-block pages). `variants` removes the
   *  first specimen block (grid, Variants list, or Preview); `states` removes the States /
   *  configurations (or "Other configurations") list; `props` and `accessibility` remove those
   *  parts of the reference panel. */
  hide?: {
    variants?: boolean;
    states?: boolean;
    props?: boolean;
    accessibility?: boolean;
  };
}

/** A labeled group of section ids in the sidebar (e.g. "Components" vs "Tokens"). */
export interface NavGroup<TId extends string = string> {
  label: string;
  ids: readonly TId[];
}

/** Design §5 "Update check"/"Viewer notice" — the generated entry file (Task 17) imports this
 *  shape directly from `.ds-viewer/update.json`; `null` when no update is known (disabled,
 *  offline, or genuinely up to date — the viewer treats all three identically). */
export interface UpdateNotice {
  current: string;
  latest: string;
  breaking: boolean;
  summary: string[];
  releasedAt?: string;
}

/** One titled card on a token page (`SectionDef.tokenSections`). */
export interface TokenSection {
  /** The kind of token this card holds, e.g. "Semantic colours", "Palette", "Body". */
  title: string;
  /** One line under the title: what this kind of token is for. */
  desc?: string;
  /** Take a full row even when the page sets `tokenColumns` (e.g. palette ramps). */
  wide?: boolean;
  render: () => React.ReactNode;
}
