import React from 'react';
import { defineCatalogPage, Swatch, CATALOG_COLOR } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  component: 'Swatch',
  group: 'Components',
  source: '../native/catalog/Swatch.tsx',
  hide: { props: true },
  description: 'One token swatch inside a Colors gallery: a rendered colour chip plus its name/value as data. The shared shape behind every Colors gallery — this catalog\'s own and the starter kit\'s. `valueLabel` replaces the raw value under the name, for a token whose value reads better as a reference than a hex; `width` sizes the chip when a gallery wants a wider sample; `wrapName` lets a long name wrap onto more lines instead of being cut to one.',
  whenToUse: 'Inside a colour gallery. For a token whose preview is a shape rather than a colour (radius, shadow), use TokenTile in a TokenGrid.',
  a11y: 'The name and the value are real text, so the token is readable without seeing the colour. The chip itself carries no label of its own.',
  variants: {
    items: [
      { key: 'value', name: 'Name and value', node: <Swatch name="accent" value={CATALOG_COLOR.accent} /> },
      // A semantic token points at another token: the reference reads better than its hex.
      { key: 'label', name: 'With a valueLabel', node: <Swatch name="focusRing" value={CATALOG_COLOR.focusRing} valueLabel="accent · focus ring" /> },
      { key: 'width', name: 'A wider chip', node: <Swatch name="surfaceMuted" value={CATALOG_COLOR.surfaceMuted} width={160} /> },
      { key: 'wrap', name: 'A long name that wraps', node: <Swatch name="liveActivityWidgetBackgroundTint" value={CATALOG_COLOR.accent} wrapName /> },
    ],
  },
});
