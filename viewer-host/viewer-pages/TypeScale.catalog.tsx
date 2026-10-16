import React from 'react';
import { defineCatalogPage, TypeScaleGallery, VariantGroup, DividedStack, CATALOG_TYPE, CATALOG_TYPE_USE, CATALOG_TEXT, CATALOG_TEXT_USE } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  id: 'Type Scale',
  title: 'Type scale',
  group: 'Tokens',
  source: '../native/catalog/tokens.ts',
  previewWidths: 'full',
  tokenGallery: true,
  description: 'The catalog chrome\'s own font-size scale, plus the fixed set of typography roles built on it. Every chrome text style in this framework — headings, labels, prop tables, nav, notes — spreads one of the roles below rather than setting fontSize/fontWeight/lineHeight/letterSpacing directly.',
  render: () => (
    <DividedStack>
      <VariantGroup name="Sizes" desc="Sizes only — no weights/line-heights of their own; the roles below are what combine a size into something a style actually uses." align="left">
        <TypeScaleGallery
          steps={Object.keys(CATALOG_TYPE) as (keyof typeof CATALOG_TYPE)[]}
          sampleStyle={(step) => ({ fontSize: CATALOG_TYPE[step] })}
          meta={(step) => `${CATALOG_TYPE[step]}px`}
          useNotes={CATALOG_TYPE_USE}
        />
      </VariantGroup>
      <VariantGroup name="Roles" desc="The complete, fixed set every catalog-chrome text style spreads — fontSize, fontWeight and lineHeight together (plus letterSpacing/textTransform/fontFamily where the role needs them)." align="left">
        <TypeScaleGallery
          steps={Object.keys(CATALOG_TEXT) as (keyof typeof CATALOG_TEXT)[]}
          sampleStyle={(step) => CATALOG_TEXT[step]}
          meta={(step) => `${CATALOG_TEXT[step].fontSize}/${CATALOG_TEXT[step].fontWeight}`}
          useNotes={CATALOG_TEXT_USE}
        />
      </VariantGroup>
    </DividedStack>
  ),
});
