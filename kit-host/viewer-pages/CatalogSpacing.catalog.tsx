import React from 'react';
import { defineCatalogPage, SpacingScaleGallery, CATALOG_SPACE, CATALOG_SPACE_USE } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  group: 'Viewer',
  previewWidths: 'full',
  tokenGallery: true,
  description: 'The catalog chrome\'s own spacing scale, each step with a grounded "when to use this" note from CATALOG_SPACE_USE, based on how the framework\'s own files actually use them.',
  render: () => (
    <SpacingScaleGallery
      steps={Object.keys(CATALOG_SPACE) as (keyof typeof CATALOG_SPACE)[]}
      values={CATALOG_SPACE}
      useNotes={CATALOG_SPACE_USE}
    />
  ),
});
