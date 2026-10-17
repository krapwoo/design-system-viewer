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

/** Owner decision 2026-10-11: only 10, 12, 14, 16, 18, 24, 28, 32 and 40. Named roles share a
 *  step (tableHeader and panelHeading are 12, brand is 18). */
export const CATALOG_TYPE = {
  xs: 10,
  tableHeader: 12,
  sm: 12,
  panelHeading: 12,
  md: 14,
  lg: 16,
  brand: 18,
  xl: 18,
  '2xl': 24,
  pageTitle: 28,
  '3xl': 32,
  '4xl': 40,
} as const;

export const CATALOG_FONT = { code: 'Menlo, monospace' } as const;

/** The catalog's fixed set of typography roles, each a complete `fontSize`/`fontWeight`/
 *  `lineHeight` (plus `letterSpacing`/`textTransform`/`fontFamily` where the role needs them)
 *  built on `CATALOG_TYPE`. Every catalog-chrome text style spreads one of these rather than
 *  setting its own typography properties directly (enforced by
 *  `__tests__/textRoles.test.ts`). */
export const CATALOG_TEXT = {
  pageTitle: { fontSize: CATALOG_TYPE.pageTitle, fontWeight: '700', lineHeight: 34 },
  heading1: { fontSize: CATALOG_TYPE['2xl'], fontWeight: '700', lineHeight: 30 },
  heading2: { fontSize: CATALOG_TYPE.xl, fontWeight: '700', lineHeight: 24 },
  heading3: { fontSize: CATALOG_TYPE.lg, fontWeight: '700', lineHeight: 22 },
  icon: { fontSize: CATALOG_TYPE.lg, fontWeight: '400', lineHeight: 22 },
  body: { fontSize: CATALOG_TYPE.md, fontWeight: '400', lineHeight: 20 },
  bodyStrong: { fontSize: CATALOG_TYPE.md, fontWeight: '700', lineHeight: 20 },
  caption: { fontSize: CATALOG_TYPE.sm, fontWeight: '400', lineHeight: 18 },
  captionStrong: { fontSize: CATALOG_TYPE.sm, fontWeight: '700', lineHeight: 18 },
  label: { fontSize: CATALOG_TYPE.sm, fontWeight: '700', lineHeight: 18, letterSpacing: 0.72, textTransform: 'uppercase' },
  micro: { fontSize: CATALOG_TYPE.xs, fontWeight: '400', lineHeight: 14 },
  microLabel: { fontSize: CATALOG_TYPE.xs, fontWeight: '700', lineHeight: 14, letterSpacing: 0.6, textTransform: 'uppercase' },
  code: { fontSize: CATALOG_TYPE.md, fontWeight: '400', lineHeight: 20, fontFamily: CATALOG_FONT.code },
  codeSmall: { fontSize: CATALOG_TYPE.sm, fontWeight: '400', lineHeight: 18, fontFamily: CATALOG_FONT.code },
  codeSmallStrong: { fontSize: CATALOG_TYPE.sm, fontWeight: '700', lineHeight: 18, fontFamily: CATALOG_FONT.code },
  codeMicro: { fontSize: CATALOG_TYPE.xs, fontWeight: '400', lineHeight: 14, fontFamily: CATALOG_FONT.code },
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
  /** Sidebar logo header (design `docs/design/2026-10-08-ds-viewer-sidebar-logo-approved.html`,
   *  "C · Adaptive", approved 2026-10-08) — see `native/catalog/logoLayout.ts`. */
  logoMark: 32,
  logoWordmarkHeight: 28,
  logoCaptionGap: 6,
  /** Max width of the update page's content column (approved mockup: direction "C · Update
   *  page", content at most 512px) — independent of `CATALOG_MAX_CONTENT_WIDTH` (1200px), which
   *  is every other page's column width. */
  updateContentMaxWidth: 512,
} as const;

/** Max width of the main content column. */
export const CATALOG_MAX_CONTENT_WIDTH = 1200;

/** When to reach for each catalog-chrome type size. Rendered in the framework catalog's Type
 *  Scale page. Every size is now consumed through a `CATALOG_TEXT` role (see `CATALOG_TEXT_USE`)
 *  rather than directly. */
export const CATALOG_TYPE_USE: Record<keyof typeof CATALOG_TYPE, string> = {
  xs: 'Backs the `micro`, `microLabel` and `codeMicro` roles: token values and meta captions; sidebar group labels and OS badges (uppercase); a prop\'s type and default value (monospace).',
  tableHeader: 'Reserved — no current consumer; grid column headers and list cell captions now use the `captionStrong` role (built on `sm`).',
  sm: 'Backs the `caption`, `captionStrong`, `label`, `codeSmall` and `codeSmallStrong` roles: breadcrumbs, block/prop descriptions, swatch/token names, table captions, monospace prop names and file paths.',
  panelHeading: 'Reserved — no current consumer; reference-panel and update-page headings now use the `label` role (built on `sm`).',
  md: 'Backs the `body`, `bodyStrong` and `code` roles: descriptions, nav links, the filter field, switch labels, a long unbroken value that needs to wrap at its \'/\'s (monospace).',
  lg: 'Backs the `heading3` and `icon` roles: a result note\'s title; pager arrows and the filter field\'s clear (×) glyph.',
  brand: 'Reserved — no current consumer; the sidebar app name now uses the `heading2` role (built on `xl`).',
  xl: 'Backs the `heading2` role: the app name at the top of the sidebar.',
  '2xl': 'Backs the `heading1` role: the update page\'s version numbers and the arrow between them.',
  pageTitle: 'Backs the `pageTitle` role: the selected page\'s title, including the update page\'s own title.',
  '3xl': 'Reserved — no current consumer.',
  '4xl': 'Reserved — no current consumer.',
};

/** When to reach for each catalog-chrome typography role. Rendered in the framework catalog's
 *  Type Scale page. */
export const CATALOG_TEXT_USE: Record<keyof typeof CATALOG_TEXT, string> = {
  pageTitle: 'The selected page\'s title, including the update page\'s own title.',
  heading1: 'The update page\'s version numbers and the arrow between them.',
  heading2: 'The app name at the top of the sidebar.',
  heading3: 'A result note\'s title (the update page\'s success/failure banner).',
  icon: 'Glyph-only controls: pager arrows, the filter field\'s clear (×) glyph, the update banner\'s close (×) glyph.',
  body: 'Default body text: descriptions, nav links, the filter field, update-page facts/notes/steps.',
  bodyStrong: 'Emphasised body text: grid/list row headers, switch and step labels, inline-bold notice text.',
  caption: 'Secondary text: breadcrumbs, status captions, block/prop descriptions, sidebar subtitle/footer, update-page captions.',
  captionStrong: 'Emphasised secondary text: grid column headers, grid/list/table captions, reference-panel subheadings, swatch/token names, replay and result links, step-icon glyphs.',
  label: 'Uppercase labels and headings: block and preview-frame labels, token-section labels, reference-panel and update-page headings.',
  micro: 'The smallest text: token values and meta captions, a prop\'s default-value label.',
  microLabel: 'Uppercase micro labels: variant-group names, sidebar group labels, OS badges.',
  code: 'Monospace body text: a long unbroken value that needs to wrap at its \'/\'s.',
  codeSmall: 'Monospace secondary text: a prop\'s optional marker, the update page\'s inline code, file paths and log lines.',
  codeSmallStrong: 'Emphasised monospace secondary text: a prop\'s own name.',
  codeMicro: 'Monospace micro text: a prop\'s type and default value.',
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
  /** A disabled control's surface, and its label. Approved with the update page's buttons
   *  (docs/design/2026-10-10-ds-viewer-update-page-always-approved.html). */
  controlDisabled: '#e6e6e6',
  controlDisabledText: '#8a8a8a',
  /** An example's cell when the example itself is white (`specimenSurface`), darker than surfaceMuted so a white card's edges show. */
  specimenStage: '#f2f2f2',
  pageBackground: '#f6f6f4',
  chip: '#eeeeee',
  /** Active nav label, prop types, scale bars. */
  accent: '#174dc6',
  /** Active nav row background. */
  accentSubtle: '#e9efff',
  /** 3px keyboard focus ring on every catalog control. */
  focusRing: '#c9d7ff',
  /** Family-page Part tree connector line (Slice D1/D2) — the approved reference's own line color
   *  has no match among the other tokens above. */
  treeLine: '#a9bdf0',
  /** @deprecated kept for the public API; re-points at `CATALOG_FONT.code` so there is one source
   *  of truth. New code should reach for `CATALOG_FONT.code` (or a `CATALOG_TEXT` `code*` role)
   *  instead. */
  code: CATALOG_FONT.code,
  /** Major-update banner background/border/text (design §5 "Viewer notice"). */
  warning: '#8a4b00',
  warningSubtle: '#fff4e0',
  warningBorder: '#f0cf97',
  /** "Can't prepare"/failure note-boxes on the update page. */
  danger: '#b3261e',
  dangerSubtle: '#fdecea',
  dangerBorder: '#f2b8b5',
  /** The update page's post-update success note-box and "Updated" pill. */
  success: '#1e6b3a',
  successSubtle: '#e8f5ec',
} as const;
