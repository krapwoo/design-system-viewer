import React from 'react';
import { defineCatalogPage, TypeScaleGallery, CATALOG_TYPE, CATALOG_TYPE_USE } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  group: 'Viewer',
  previewWidths: 'full',
  hide: { states: true, props: true, accessibility: true },
  description: 'Renders a type scale as a stack of TokenRows — each step\'s name rendered at its own real style, plus a short meta caption. `sampleStyle`/`meta` are per-step accessor functions rather than plain maps, so the same component works for a full typography token with a weight worth calling out, or a bare size-only scale like this framework\'s own Type Scale.',
  render: () => (
    <TypeScaleGallery
      steps={['sm', 'lg'] as const}
      sampleStyle={(step) => ({ fontSize: CATALOG_TYPE[step] })}
      meta={(step) => `${CATALOG_TYPE[step]}px`}
      useNotes={{ sm: CATALOG_TYPE_USE.sm, lg: CATALOG_TYPE_USE.lg }}
    />
  ),
});
