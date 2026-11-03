import React from 'react';
import { defineCatalogPage, StyleBadge } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  component: 'StyleBadge',
  group: 'Components',
  source: '../native/catalog/PageKindBadge.tsx',
  specimenSize: 'regular',
  hide: { props: true },
  standalone: 'Every InventoryTile whose page is a style draws it; a page head draws the StyleBadgeButton form.',
  description: "The small \"Style\" pill. It sits next to the title of a page that sets `pageKind: 'style'` (a SwiftUI `ButtonStyle`, `ViewModifier` or `TextRenderer`, a shared surface or background treatment). On the page head the pill is a button (`StyleBadgeButton`) that opens a popover with the explanation (the page's `styleNote` first, if it has one); an `InventoryTile` whose page is a style shows this decorative pill. The viewer draws it; a page only sets `pageKind`.",
  whenToUse: "Never placed by hand: set `pageKind: 'style'` on the page. A style lives with components and in families, not in a category of its own, and this badge is how a reader tells it from a view.",
  a11y: 'The word "Style" is the signal, not colour. The button form on a page head has its own name (see StyleBadgeButton). On an `InventoryTile` the title link is also named "<title>, style", so a screen reader hears it without the pill.',
  variants: {
    items: [{ key: 'badge', name: 'The badge', node: <StyleBadge /> }],
  },
});
