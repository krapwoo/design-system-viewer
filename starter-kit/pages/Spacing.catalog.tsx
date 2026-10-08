import React from 'react';
import { defineCatalogPage, SpacingScaleGallery } from '@krapwoo/ds-viewer';
import { DS_SPACING, DS_SPACING_STEPS, DS_SPACING_USE } from '../tokens';

export default defineCatalogPage({
  group: 'Tokens',
  description: 'The spacing scale (token number ÷ 50 = px), each step with a grounded "when to use this" note from DS_SPACING_USE. Reference steps directly — DS_SPACING[800], never a raw 16 — the key union is typo-safe by itself.',
  tokenGallery: true,
  render: () => (
    <SpacingScaleGallery steps={DS_SPACING_STEPS} values={DS_SPACING} useNotes={DS_SPACING_USE} />
  ),
});
