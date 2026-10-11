/**
 * Reusable design-system catalog framework.
 *
 * App-agnostic by design — nothing here imports from a specific app's `design-system/` folder or
 * component set. To document an app's components, build a `SectionDef[]` (one per component or
 * token group, each with a `render()` that uses that app's real components) and a `NavGroup[]`
 * (how to bucket those sections in the sidebar), then render a single `<CatalogShell />`.
 *
 * A page is written with `defineCatalogPage()` from this barrel and placed next to its component
 * (or standalone, for tokens/recipes) — see the starter kit under `starter-kit/` for worked
 * examples, and `kit-host/viewer-pages/` for pages documenting this framework's own pieces. This
 * barrel itself stays free of any specific component (including its own) so it can be copied into
 * a different app's repo as-is.
 */
export { CatalogShell } from './CatalogShell';
export { CatalogSidebar } from './CatalogSidebar';
export { CatalogSearchInput } from './CatalogSearchInput';
export { SectionBlock } from './SectionBlock';
export { ComparisonGrid } from './ComparisonGrid';
export { grid, axisItems, axisProp } from './comparison';
export { ComparisonGroups } from './ComparisonGroups';
export { ComparisonList } from './ComparisonList';
export { ReferenceDetails } from './ReferenceDetails';
export { PropsTable } from './PropsTable';
export { VariantGroup } from './VariantGroup';
export { TokenRow } from './TokenRow';
export { MotionSpecimen } from './MotionSpecimen';
export type { MotionSpecimenProps, MotionSpecimenSpringConfig } from './MotionSpecimen';
export { SpecimenSurface } from './SpecimenSurface';
export { TokenSections, TokenGrid, TokenTile } from './TokenLayouts';
export { DividedStack } from './DividedStack';
export { Swatch } from './Swatch';
export { PhoneFrame } from './PhoneFrame';
export { PhoneScreen } from './PhoneScreen';
export { OverlayDemo } from './OverlayDemo';
export { CatalogButton } from './CatalogButton';
export { BoundedOverlayViewport } from './BoundedOverlayViewport';
export type { BoundedOverlayViewportProps } from './BoundedOverlayViewport';
export { comparisonCellItemKey } from './overlayViewport';
export type { OverlayAddress, OverlaySlot } from './overlayViewport';
export { SpacingScaleGallery } from './SpacingScaleGallery';
export { TypeScaleGallery } from './TypeScaleGallery';
export { buildComponentManifest } from './manifest';
export type { ComponentManifestEntry, ManifestExample } from './manifest';
export { defineCatalogPage, buildCatalogSections } from './pageApi';
export type { CatalogPage, CatalogPageInput, GeneratedComponent, GeneratedPropRecord } from './pageApi';
export type {
  PropDef, SectionDef, NavGroup, SpecimenSize, SpecimenSurfaceKind, ComparisonDef, ComparisonCell, ComparisonAxisItem, GridAxis,
  PreviewWidths, TokenSection, ComposedOfEntry,
} from './types';
export { UpdatePanel } from './UpdatePanel';
export { UPDATE_PAGE_ID } from './catalogNavigation';
export type { UpdateNotice } from './types';
export type { ListGroup, ListItem } from './comparison';
export {
  CATALOG_TYPE,
  CATALOG_TYPE_USE,
  CATALOG_SPACE,
  CATALOG_SPACE_USE,
  CATALOG_RADIUS,
  CATALOG_COLOR,
  CATALOG_LAYOUT,
  CATALOG_MAX_CONTENT_WIDTH,
} from './tokens';
