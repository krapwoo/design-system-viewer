import React from 'react';
import { Text, View } from 'react-native';
import { CATALOG_COLOR, CATALOG_SPACE, CATALOG_TEXT, OverviewThumbnail, defineCatalogPage } from '@krapwoo/ds-viewer';

const pill = (label: string, width?: number) => (
  <View style={{ width, backgroundColor: CATALOG_COLOR.accent, paddingHorizontal: CATALOG_SPACE.lg, paddingVertical: CATALOG_SPACE.md, borderRadius: CATALOG_SPACE.xl }}>
    <Text style={{ ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.surface }}>{label}</Text>
  </View>
);

export default defineCatalogPage({
  component: 'OverviewThumbnail',
  group: 'Components',
  standalone: 'Exported on its own, so a catalog can show a scaled preview of any specimen outside the Overview.',
  whenToUse: 'The scaled-down live preview the Overview shows on each card. Use it directly only to show a small preview of a specimen elsewhere.',
  source: '../native/catalog/OverviewThumbnail.tsx',
  composedOf: [{ component: 'SpecimenSurface', role: 'The surface the specimen sits on, as on its own page.', relationship: 'built-in' }],
  hide: { props: true },
  description: 'A live copy of a specimen, laid out at the first preview width of its page, on the same specimen surface, and shrunk with transform: scale to fit a fixed frame (it never enlarges a small one). It is decoration: hidden from assistive technology, never focusable or clickable. On the web it mounts only once near the viewport, and mounts at once where IntersectionObserver is unavailable. A specimen that throws leaves the frame empty.',
  a11y: 'The frame is aria-hidden, inert and pointer-events: none, so nothing inside can take focus or a click; put the accessible name on the card around it.',
  variants: {
    items: [
      { key: 'small', name: 'A small specimen, centred at its own size', node: <View style={{ width: 240 }}><OverviewThumbnail height={132} source={{ node: pill('Continue') }} /></View> },
      { key: 'wide', name: 'A phone-width specimen, shrunk to fit', node: <View style={{ width: 240 }}><OverviewThumbnail height={132} source={{ node: pill('A button that fills the phone width', 402) }} /></View> },
      { key: 'row', name: 'A small fixed-width frame (width and height both given)', node: <OverviewThumbnail width={64} height={44} source={{ node: pill('Continue') }} /> },
    ],
  },
});
