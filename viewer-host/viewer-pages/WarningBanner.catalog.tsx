import React from 'react';
import { Text } from 'react-native';
import { defineCatalogPage, WarningBanner, CATALOG_COLOR, CATALOG_TEXT } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  component: 'WarningBanner',
  group: 'Components',
  source: '../native/catalog/WarningBanner.tsx',
  specimenSize: 'regular',
  propNotes: {
    title: 'The note\'s name, shown above the body and read first by a screen reader.',
    children: 'The body. A plain string is styled for you; pass your own `Text`/`View` elements for anything richer.',
  },
  description: 'A short note that asks for attention on a page, in the viewer\'s own attention colours: amber by default, the same colours its update notice uses, or its accent blue with `tone="info"`. It has no dismiss control, so it is for something that stays true while the page does.',
  whenToUse: 'On a category overview page, for one thing a reader should know before they browse (a pattern being replaced, a rule that applies to every page below). Not for an event or an error that appears at a moment: this is not announced as an alert.',
  a11y: 'A note (`role="note"`) named by its title. It is not an alert, so it does not interrupt a screen reader. It has no controls.',
  variants: {
    itemsFill: true,
    items: [
      { key: 'warning', name: 'Warning (the default)', props: { tone: 'warning' }, node: <WarningBanner title="One primary per surface">A screen has one primary button. Give every other action a lower variant.</WarningBanner> },
      { key: 'info', name: 'Info', props: { tone: 'info' }, node: <WarningBanner title="Where these pages live" tone="info">The pages below are listed under this entry in the sidebar.</WarningBanner> },
    ],
  },
  states: {
    itemsFill: true,
    items: [
      {
        key: 'rich',
        name: 'Rich body: your own elements',
        node: (
          <WarningBanner title="Two things to know">
            <Text style={{ ...CATALOG_TEXT.body, color: CATALOG_COLOR.warning }}>Ghost is for text-heavy areas only.</Text>
            <Text style={{ ...CATALOG_TEXT.body, color: CATALOG_COLOR.warning }}>White is for dark or photo backgrounds only.</Text>
          </WarningBanner>
        ),
      },
    ],
  },
});
