import React from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { Avatar } from '../Avatar';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { ListItem } from './ListItem';
import { Icon } from '../../icons/Icon.native';
import { DS_SEMANTIC } from '../../tokens';

export default defineCatalogPage({
  component: 'ListItem',
  group: 'Components',
  composedOf: [
    { component: 'Avatar', role: "The leading slot, typically an Avatar (or an icon).", relationship: 'slot' },
    { component: 'Switch', role: "A trailing-slot option, e.g. a settings toggle.", relationship: 'slot' },
    { component: 'Button', role: "A trailing-slot option, e.g. an Accept action.", relationship: 'slot' },
  ],
  specimenSize: 'regular',
  description: 'A single row: optional leading/trailing slots flanking a title (+ optional subtitle/footer). Stack several inside a List for a settings screen, menu, or search-results list.',
  whenToUse: "A row in a set of visually-light peers sharing a List's own surface and dividers. For a standalone unit with its own shadow, use Card instead.",
  a11y: 'A tappable row (onPress set) renders as a Pressable with accessibilityRole="button" and an accessibilityLabel built from title + subtitle; a plain row is a non-interactive View.',
  // No `variant` prop exists on ListItem — its "Variants" column shows the title-only default and
  // the title+subtitle look; slot/interaction configurations live under "States".
  variants: {
    itemsFill: true,
    items: [
      { key: 'default', name: 'Default', node: <ListItem title="Notifications" /> },
      { key: 'subtitle', name: 'With subtitle', node: <ListItem title="Notifications" subtitle="Delay and service alerts" /> },
    ],
  },
  states: {
    itemsFill: true,
    items: [
      {
        key: 'leading',
        name: 'With leading',
        node: <ListItem title="Jordan Lee" subtitle="Last trip: Uptown & The Bronx" leading={<Avatar initials="JL" size={32} />} />,
      },
      {
        key: 'trailing',
        name: 'With trailing',
        node: <ListItem title="Notifications" trailing={<Icon name="chevron-right" color={DS_SEMANTIC.text.muted} />} />,
      },
      {
        key: 'footer-text',
        name: 'With footer (text)',
        node: <ListItem title="Signal delay" subtitle="Reported near 14 St" footer="2 min ago" />,
      },
      {
        key: 'footer-badge',
        name: 'With footer (badge)',
        node: <ListItem title="Line suspended" subtitle="96 St and 137 St" footer={<Badge variant="negative" label="Service alert" />} />,
      },
      {
        key: 'footer-button',
        name: 'With footer (button)',
        node: <ListItem title="Trip request" subtitle="Jordan Lee wants to share a ride" footer={<Button label="Accept" size="small" onPress={() => {}} />} />,
      },
      {
        key: 'trailing-text',
        name: 'With trailing data',
        node: (
          <ListItem
            title="Language"
            trailingText="English"
            trailing={<Icon name="chevron-right" color={DS_SEMANTIC.text.muted} />}
            onPress={() => {}}
          />
        ),
      },
      {
        key: 'trailing-subtext',
        name: 'With trailing data (secondary)',
        node: <ListItem title="Storage used" trailingText="2.4 GB" trailingSubtext="of 5 GB" />,
      },
      {
        key: 'trailing-button',
        name: 'With trailing button',
        node: <ListItem title="Pending invite" subtitle="Sam Rivera" trailing={<Button label="Accept" size="small" onPress={() => {}} />} />,
      },
      {
        key: 'pressable',
        name: 'Pressable',
        node: (
          <ListItem
            title="Notifications"
            trailing={<Icon name="chevron-right" color={DS_SEMANTIC.text.muted} />}
            onPress={() => {}}
          />
        ),
      },
      { key: 'disabled', name: 'Disabled', node: <ListItem title="Notifications" onPress={() => {}} disabled /> },
    ],
  },
});
