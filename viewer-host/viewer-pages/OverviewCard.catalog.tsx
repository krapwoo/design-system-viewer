import React from 'react';
import { Text, View } from 'react-native';
import { CATALOG_COLOR, CATALOG_SPACE, CATALOG_TEXT, OverviewCard, defineCatalogPage } from '@krapwoo/ds-viewer';

const pill = (label: string) => (
  <View style={{ backgroundColor: CATALOG_COLOR.accent, paddingHorizontal: CATALOG_SPACE.lg, paddingVertical: CATALOG_SPACE.md, borderRadius: CATALOG_SPACE.xl }}>
    <Text style={{ ...CATALOG_TEXT.bodyStrong, color: CATALOG_COLOR.surface }}>{label}</Text>
  </View>
);

const frame = (node: React.ReactNode) => <View style={{ width: 260 }}>{node}</View>;

export default defineCatalogPage({
  component: 'OverviewCard',
  group: 'Components',
  standalone: 'Exported on its own, so a catalog can show a page as a card outside the Overview.',
  whenToUse: 'A page as a card: a live thumbnail of its first specimen, its title and one line of caption. The Overview draws one per page, and the Parts block draws one per component a page is built from. Use it directly only to link to a page from a screen you compose yourself.',
  source: '../native/catalog/Overview.tsx',
  composedOf: [{ component: 'OverviewThumbnail', role: 'The scaled-down live copy of the specimen.', relationship: 'built-in' }],
  hide: { props: true },
  description: 'A plain box, not a link around everything: the thumbnail is a sibling of the title link, the title link is the card\'s one tab stop, and a stretched overlay makes the rest of the card click through to the same address. A title takes up to two lines and the room for both is always kept, the caption is one line, and a card with no specimen keeps an empty thumbnail frame, so every card is the same height.',
  a11y: 'One tab stop: the title link, named by the full title. The thumbnail is hidden from assistive technology and inert.',
  variants: {
    items: [
      { key: 'specimen', name: 'With a specimen', node: frame(<OverviewCard title="Button" caption="17 uses · 7 areas" source={{ node: pill('Continue') }} href="#Button" onPress={() => undefined} />) },
      { key: 'long-title', name: 'Long title, two lines', node: frame(<OverviewCard title="A remarkably long component title that wraps onto a second line" caption="Fills the header." source={{ node: pill('Continue') }} href="#Long" onPress={() => undefined} />) },
      { key: 'no-specimen', name: 'No specimen: the thumbnail frame stays', node: frame(<OverviewCard title="Colors" caption="A token page." href="#Colors" onPress={() => undefined} />) },
    ],
  },
});
