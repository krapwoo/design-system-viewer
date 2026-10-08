import React from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { Avatar } from '../Avatar';
import { ListItem } from '../ListItem';
import { List } from './List';
import { Icon } from '../../icons/Icon.native';
import { DS_SEMANTIC } from '../../tokens';

export default defineCatalogPage({
  component: 'List',
  group: 'Layout',
  description: 'Stacks ListItem rows on a rounded white surface, with a Divider automatically inserted between each consecutive pair — never after the last.',
  a11y: 'A plain View; each ListItem child carries its own accessibility.',
  variants: {
    itemsFill: true,
    items: [
      {
        key: 'default',
        name: 'Default',
        node: (
          <List>
            <ListItem title="Notifications" trailing={<Icon name="chevron-right" color={DS_SEMANTIC.text.muted} />} onPress={() => {}} />
            <ListItem title="Jordan Lee" subtitle="Last trip: Uptown & The Bronx" leading={<Avatar initials="JL" size={32} />} onPress={() => {}} />
            <ListItem title="Delete account" onPress={() => {}} />
          </List>
        ),
      },
    ],
  },
});
