/**
 * Catalog-only design tokens — the visual system of the catalog interface itself.
 *
 * Deliberately independent of any host app's design-system tokens (DS_SEMANTIC / DS_PALETTE /
 * DS_SPACING): the catalog documents a design system, it does not consume one. Keeping its chrome
 * on its own tokens means a change to the host app's tokens never restyles the catalog, and this
 * folder can be copied into another app's repo unchanged.
 *
 * Values match the approved Studio Matrix references
 * (docs/design/2026-10-06-catalog-studio-matrix-*.html), with one deliberate exception:
 * `textMuted` stays #666666 because the references' #777777 fails WCAG AA contrast.
 */

export const CATALOG_TYPE = {
  xs: 10,
  tableHeader: 11,
  sm: 12,
  panelHeading: 13,
  md: 14,
  lg: 16,
  brand: 17,
  xl: 20,
  '2xl': 24,
  pageTitle: 28,
  '3xl': 32,
  '4xl': 40,
} as const;

export const CATALOG_SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
} as const;

export const CATALOG_RADIUS = {
  sm: 8,
  control: 9,
  md: 12,
  card: 14,
} as const;

/** Exact chrome measurements from the approved references that are not spacing-scale steps. */
export const CATALOG_LAYOUT = {
  sidebarWidth: 264,
  sidebarPaddingTop: 24,
  sidebarPaddingX: 18,
  mainPaddingTop: 28,
  mainPaddingX: 32,
  controlSize: 44,
  focusRingWidth: 3,
  navItemPaddingY: 8,
  navItemPaddingX: 10,
  panelPadding: 20,
  factPaddingY: 9,
  blockLabelGap: 14,
  blockGap: 28,
} as const;

/** Max width of the main content column. */
export const CATALOG_MAX_CONTENT_WIDTH = 1200;

/** When to reach for each catalog-chrome type size. Rendered in the framework catalog's Type
 *  Scale page. */
export const CATALOG_TYPE_USE: Record<keyof typeof CATALOG_TYPE, string> = {
  xs: 'Sidebar group labels (uppercase); a prop\'s type annotation.',
  tableHeader: 'Grid column headers and list cell captions (uppercase).',
  sm: 'Breadcrumb, catalog caption, block labels, prop names and descriptions.',
  panelHeading: 'Reference-panel headings: Guidance, Quick reference, Props (uppercase).',
  md: 'Default body text: descriptions, nav links, grid row headers, quick-reference rows, the filter field.',
  lg: 'Pager arrows and the filter field\'s clear (×) glyph.',
  brand: 'The app name at the top of the sidebar.',
  xl: 'Reserved — no current consumer.',
  '2xl': 'Reserved — no current consumer.',
  pageTitle: 'The selected page\'s title.',
  '3xl': 'Reserved — no current consumer.',
  '4xl': 'Reserved — no current consumer.',
};

/** When to reach for each catalog-chrome spacing step. Rendered in the framework catalog's
 *  Spacing page. */
export const CATALOG_SPACE_USE: Record<keyof typeof CATALOG_SPACE, string> = {
  xs: 'Tight gap — e.g. between a token\'s rendered value and its use-note.',
  sm: 'Small gap — below the filter field; between a preview frame\'s label and its demo.',
  md: 'Medium gap — between a card\'s contents; token-row divider padding.',
  lg: 'Grid and list cell padding (16px); row gap in scale galleries.',
  xl: 'Preview-card padding; gap between preview frames.',
  '2xl': 'Gap between the reference panel\'s Guidance and Quick reference columns.',
  '3xl': 'Bottom padding of the main column.',
};

export const CATALOG_COLOR = {
  text: '#181818',
  // #666666, not the references' #777777: #777 is 4.14–4.48:1 on this file's surfaces (WCAG AA
  // needs 4.5:1); #666 is 5.3–5.7:1.
  textMuted: '#666666',
  /** Dividers inside grids, lists, props tables, token rows. */
  border: '#e4e4e4',
  /** Sidebar edge, reference card, filter field. */
  borderHairline: '#dddddd',
  /** Grid, list, and preview cards; pager buttons. */
  borderStrong: '#d7d7d7',
  /** Quick-reference row dividers. */
  borderSubtle: '#eeeeee',
  surface: '#ffffff',
  /** Table headers, row headers, cell captions, filter field. */
  surfaceMuted: '#fafafa',
  /** Hover and pressed feedback on nav rows and buttons. */
  surfacePressed: '#f1f3f8',
  pageBackground: '#f6f6f4',
  chip: '#eeeeee',
  /** Active nav label, prop types, scale bars. */
  accent: '#174dc6',
  /** Active nav row background. */
  accentSubtle: '#e9efff',
  /** 3px keyboard focus ring on every catalog control. */
  focusRing: '#c9d7ff',
  code: 'Menlo',
} as const;
