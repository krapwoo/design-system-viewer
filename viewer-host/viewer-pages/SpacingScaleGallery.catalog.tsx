import React from 'react';
import { defineCatalogPage, SpacingScaleGallery, CATALOG_SPACE, CATALOG_SPACE_USE } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  component: 'SpacingScaleGallery',
  intentionalStaticPreview: { reason: 'Generic over whatever spacing scale it is given: one real scale is the demonstration, and a second would only repeat it with other numbers.' },
  group: 'Components',
  composedOf: [
    { component: 'TokenRow', role: "One TokenRow per spacing step: the step name, a bar at that width and the value, with its note.", relationship: 'built-in' },
  ],
  source: '../native/catalog/SpacingScaleGallery.tsx',
  previewWidths: 'full',
  hide: { states: true, props: true, accessibility: true },
  description: 'Renders a spacing scale as a stack of TokenRows — a step\'s name, a bar sized to its real pixel value, and the value itself. Generic over the step-name type, so this catalog\'s own Spacing page and the starter kit\'s share one implementation instead of two near-identical copies.',
  render: () => (
    <SpacingScaleGallery
      steps={['sm', 'lg'] as const}
      values={{ sm: CATALOG_SPACE.sm, lg: CATALOG_SPACE.lg }}
      useNotes={{ sm: CATALOG_SPACE_USE.sm, lg: CATALOG_SPACE_USE.lg }}
    />
  ),
});
