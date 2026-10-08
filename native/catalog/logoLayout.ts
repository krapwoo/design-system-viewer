/** Sidebar logo header layout (design `docs/design/2026-10-08-ds-viewer-sidebar-logo-approved.html`,
 *  "C · Adaptive", approved 2026-10-08): the configured logo image's own aspect ratio decides the
 *  layout — no config field chooses it. An unknown or invalid aspect falls back to the safer
 *  text-only header rather than guessing (`CatalogSidebar.tsx` renders this case until the image's
 *  `onLoad` reports a real size, and whenever there is no logo, it failed to load, or its file is
 *  missing). */
export const LOGO_WORDMARK_MIN_ASPECT = 2;

export function logoLayout(aspect: number | undefined): 'text' | 'mark' | 'wordmark' {
  if (aspect === undefined || !Number.isFinite(aspect) || aspect <= 0) return 'text';
  return aspect > LOGO_WORDMARK_MIN_ASPECT ? 'wordmark' : 'mark';
}
