import React from 'react';
import { defineCatalogPage, TokenDetails, TokenTile } from '@krapwoo/ds-viewer';

const USAGES = Array.from({ length: 24 }, (_, index) => `Sources/Features/Feature${index + 1}/CardView.swift:${12 + index * 3}`);

export default defineCatalogPage({
  component: 'TokenDetails',
  group: 'Components',
  source: '../native/catalog/TokenDetails.tsx',
  specimenSize: 'compact',
  description: 'A token\'s "Details ›" link and the side panel it opens: the token\'s source expression, where it is defined, and every place it is used. It keeps that text off the token\'s tile, so a tile shows only its value and specimen.',
  whenToUse: 'Under a token\'s tile or row, whenever the token has a source, a usage note or a list of uses to show. Built-in token pages add it for you.',
  a11y: 'The link is named for its token ("Details for 8pt"), since a page has many. Opening one token\'s panel closes any other; focus moves into the panel and returns to the link when it closes. The panel\'s content is not mounted until it is opened.',
  composedOf: [
    { component: 'SidePanelTrigger', role: 'The "Details ›" link.', relationship: 'built-in' },
    { component: 'SidePanel', role: 'The panel the link opens.', relationship: 'built-in' },
  ],
  variants: {
    items: [
      { key: 'source', name: 'Expression and source', node: <TokenTile name="Radius md" value="8pt" action={<TokenDetails title="Radius md" kicker="Corner radius" expression="DS_RADIUS.md" source="Sources/Theme/Radius.swift:12" />}><React.Fragment /></TokenTile> },
      { key: 'usages', name: 'Every use listed', node: <TokenTile name="Card padding" value="16pt" action={<TokenDetails title="Card padding" kicker="Spacing" source="Sources/Theme/Spacing.swift:8" usages={USAGES} />}><React.Fragment /></TokenTile> },
      { key: 'summary', name: 'Usage summary only', node: <TokenTile name="Surface" value="#ffffff" action={<TokenDetails title="Surface" kicker="Color" usageSummary="Behind cards and sheets." />}><React.Fragment /></TokenTile> },
    ],
  },
});
