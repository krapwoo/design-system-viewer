import React from 'react';
import { defineCatalogPage, TypeScaleGallery, CATALOG_TYPE, CATALOG_TYPE_USE } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  id: 'Type Scale',
  group: 'Viewer',
  previewWidths: 'full',
  tokenGallery: true,
  description: 'The catalog chrome\'s own font-size scale (sizes only — no weights/line-heights, unlike the host app\'s own typography tokens). Every chrome font size in this framework — headings, labels, prop tables, nav, notes — draws from this scale.',
  render: () => (
    <TypeScaleGallery
      steps={Object.keys(CATALOG_TYPE) as (keyof typeof CATALOG_TYPE)[]}
      sampleStyle={(step) => ({ fontSize: CATALOG_TYPE[step] })}
      meta={(step) => `${CATALOG_TYPE[step]}px`}
      useNotes={CATALOG_TYPE_USE}
    />
  ),
});
