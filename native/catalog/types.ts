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
}

/** The content of the "Variants" or "States / Configurations" column — every value of a single prop's
 *  enum, or every distinct boolean/flag state, as individual instances. */
export interface VariantSlot {
  /** @default 'center' */
  align?: 'center' | 'left';
  /** When true, each item stretches to fill the available width instead of shrinking to its own
   *  content width — for wide block-level components (Banner, Card, Toast, InputField) rather than
   *  small instances meant to sit centered (Button, Badge, Pill). @default false */
  itemsFill?: boolean;
  items: VariantExample[];
}

/** One entry in the catalog — a documented component or token group. `TId` is the app's own
 *  union of section ids (e.g. `'Button' | 'Card' | ...'`), so the sidebar/scroll-spy stay typed
 *  to the app's real section list without this file needing to know what they are. */
export interface SectionDef<TId extends string = string> {
  id: TId;
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
   *  SectionBlock always renders a "Variants" column — omit this and it shows "No variants
   *  documented." instead of just not appearing, so every section has the same fixed shape. If
   *  neither this nor `render` is set, that's what shows; if `render` is set instead, its output
   *  fills this column (for content that isn't a simple list of instances — see `render` below). */
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
   *  SectionBlock always renders a "States / Configurations" column; omit this and it shows "No
   *  additional states or configurations documented." instead of just not appearing. */
  states?: VariantSlot;
  /** Escape hatch for "Variants" column content that isn't a simple list of instances — token
   *  galleries, live interactive demos with local state, structure diagrams, wrapping grids. Ignored
   *  when `variants` is set. */
  render?: () => React.ReactNode;
  /** Marks this as a token-gallery section (raw token data, not a component with its own API) —
   *  SectionBlock skips the States/Configurations, Props, and Accessibility columns entirely (there's
   *  no component behavior to document) and renders a single column titled "Tokens" instead of
   *  "Variants". */
  tokenGallery?: boolean;
  /** Overrides the `tokenGallery` column's label (default `'Tokens'`) — e.g. `'Preview'` for a page
   *  that's a composed, realistic usage example rather than a list of raw token values. Ignored
   *  unless `tokenGallery` is also set. */
  fullWidthLabel?: string;
  /** Hide specific cards entirely for this section, rather than showing an empty-state placeholder
   *  sentence ("No additional states or configurations documented.", etc.) — for a catalog whose
   *  sections genuinely have no meaningful states/props/accessibility story to tell (e.g. a
   *  framework's own building-block pages). Hidden columns free up the row's width for whatever
   *  remains; if only one column is left standing, it fills the whole row, the same way a
   *  `tokenGallery` section does. */
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

/** THE canonical within-group ordering of section ids — every place that walks a group's ids
 *  (the sidebar's link list, the main column's render order, scroll-spy's offset scan) MUST order
 *  them through this one helper. A previous bug came from exactly this sort being written out
 *  independently in two of those places and drifting: the sidebar's visual order disagreed with
 *  the main column's actual render order, so clicking a link scrolled to the wrong section. */
export function sortIds<TId extends string>(ids: readonly TId[]): TId[] {
  return ids.slice().sort((a, b) => a.localeCompare(b));
}
