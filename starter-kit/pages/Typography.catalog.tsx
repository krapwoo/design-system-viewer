import React from 'react';
import { defineCatalogPage, TypeScaleGallery } from '@krapwoo/ds-viewer';
import { DS_TYPOGRAPHY, DS_TYPOGRAPHY_USE, type TypographyToken } from '../tokens';

export default defineCatalogPage({
  group: 'Tokens',
  description: 'The type scale, rendered at its real sizes with a grounded "when to use this" note from DS_TYPOGRAPHY_USE per token — label* are semibold UI labels, body* regular reading text, emphasis*/title/display headlines.',
  tokenGallery: true,
  render: () => (
    <TypeScaleGallery
      steps={Object.keys(DS_TYPOGRAPHY) as TypographyToken[]}
      sampleStyle={(name) => DS_TYPOGRAPHY[name]}
      meta={(name) => `${DS_TYPOGRAPHY[name].fontSize}/${DS_TYPOGRAPHY[name].fontWeight}`}
      useNotes={DS_TYPOGRAPHY_USE}
    />
  ),
});
