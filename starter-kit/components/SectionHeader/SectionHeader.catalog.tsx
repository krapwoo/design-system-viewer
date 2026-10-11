import React from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { SectionHeader } from './SectionHeader';

export default defineCatalogPage({
  component: 'SectionHeader',
  group: 'Components',
  specimenSize: 'regular',
  composedOf: [
    { component: 'Button', role: "The trailing button, rendered when trailingButtonLabel is set.", relationship: 'built-in' },
  ],
  description: 'An uppercase muted section label with an optional inline icon and a right-aligned ghost button.',
  whenToUse: "A label above a group of related rows within a screen (e.g. above a List) — for the screen's own top bar, use TopNav.",
  a11y: 'Title renders as plain Text — no heading role. A tappable labelIcon (onPress set) becomes accessibilityRole="button" with accessibilityLabel falling back to the section\'s own title; a non-interactive labelIcon has no accessibility node of its own. The trailing button is a real Button, so it carries Button\'s own accessibility for free.',
  variants: {
    itemsFill: true,
    items: [
      { key: 'title-only', name: 'Title only', node: <SectionHeader title="Nearby stations" /> },
      {
        key: 'with-icon',
        name: 'With icon',
        node: <SectionHeader title="Trip details" labelIcon={{ name: 'info-circle', accessibilityLabel: 'About trip details' }} />,
      },
      {
        key: 'with-button',
        name: 'With trailing button',
        node: <SectionHeader title="Saved places" trailingButtonLabel="See all" onTrailingButtonPress={() => {}} />,
      },
    ],
  },
  states: {
    itemsFill: true,
    items: [
      {
        key: 'tappable-icon',
        name: 'Tappable icon',
        node: (
          <SectionHeader
            title="Delays"
            labelIcon={{ name: 'info-circle', onPress: () => {}, accessibilityLabel: 'What causes delays' }}
          />
        ),
      },
      {
        key: 'icon-and-button',
        name: 'Icon + trailing button',
        // This instance demonstrates the 'trailing' (default) icon position — tagged so
        // checkCompleteness sees both enum values covered, not just the 'leading' one below.
        props: { trailingButtonIconPosition: 'trailing' },
        node: (
          <SectionHeader
            title="Alerts"
            labelIcon={{ name: 'bell' }}
            trailingButtonLabel="Manage"
            trailingButtonIconName="chevron-right"
            onTrailingButtonPress={() => {}}
          />
        ),
      },
      {
        key: 'leading-icon-position',
        name: 'Trailing button, leading icon',
        props: { trailingButtonIconPosition: 'leading' },
        node: (
          <SectionHeader
            title="Saved places"
            trailingButtonLabel="Add"
            trailingButtonIconName="add"
            trailingButtonIconPosition="leading"
            onTrailingButtonPress={() => {}}
          />
        ),
      },
    ],
  },
});
