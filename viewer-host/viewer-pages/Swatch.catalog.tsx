import React from 'react';
import { defineCatalogPage, Swatch, CATALOG_COLOR } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  group: 'Components',
  source: '../native/catalog/Swatch.tsx',
  previewWidths: 'full',
  hide: { states: true, props: true, accessibility: true },
  description: 'One token swatch inside a Colors gallery: a rendered colour chip plus its name/value as data. The shared shape behind every Colors gallery — this catalog\'s own and the starter kit\'s.',
  render: () => <Swatch name="accent" value={CATALOG_COLOR.accent} />,
});
