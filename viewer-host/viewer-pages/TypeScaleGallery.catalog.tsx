import React from 'react';
import { defineCatalogPage, TypeScaleGallery, CATALOG_TYPE, CATALOG_TYPE_USE } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  component: 'TypeScaleGallery',
  intentionalStaticPreview: { reason: 'Generic over whatever type scale it is given: one real scale is the demonstration, and a second would only repeat it with other numbers.' },
  group: 'Components',
  whenToUse: 'A type scale, with each step\'s name rendered at its own real style so the name doubles as the sample. For spacing steps shown as bars, use SpacingScaleGallery.',
  a11y: 'No explicit handling beyond the defaults: each step\'s name doubles as its sample, and the meta caption repeats the size as text, so the scale can be read without comparing glyph sizes by eye.',
  composedOf: [
    { component: 'TokenRow', role: "One TokenRow per type step: a sample at that size, its name and value, with its note.", relationship: 'built-in' },
  ],
  source: '../native/catalog/TypeScaleGallery.tsx',
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
