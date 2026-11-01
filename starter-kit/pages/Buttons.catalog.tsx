import React from 'react';
import { View } from 'react-native';
import { CATALOG_SPACE, CountStrip, InventoryGroup, InventoryTile, WarningBanner, defineCatalogPage } from '@krapwoo/ds-viewer';
import { Button } from '../components/Button';
import { ButtonGroup } from '../components/ButtonGroup';

// A category overview: the page the sidebar's "Buttons" entry opens, with the two button pages listed
// under it (`sidebarParent: 'Buttons'` on Button and ButtonGroup). It adds no components of its own.
// Membership is a reviewed list: the tiles below are the buttons this page claims, written as data.
// Each `InventoryTile` draws a real specimen and links to its page by that page's own title.
export default defineCatalogPage({
  id: 'Buttons',
  group: 'Components',
  description: 'Start here for buttons: one Button for a single action, or ButtonGroup when two or three actions go together.',
  standalone: 'A category page for the sidebar: it documents no component of its own.',
  // Not a phone component: let the preview use the whole page width, so the stats sit on one row.
  previewWidths: 'full',
  render: () => (
    <View style={{ gap: CATALOG_SPACE.xl }}>
      <WarningBanner title="One primary per surface">
        Each screen, modal or sheet gets one primary Button, the one thing it most wants you to do. Make every other action secondary, tertiary or ghost.
      </WarningBanner>
      <CountStrip
        items={[
          { label: 'Pages', value: 2, sub: 'Button and ButtonGroup' },
          { label: 'Variants', value: 5, sub: 'primary to ghost' },
          { label: 'Sizes', value: 3, sub: 'large, medium, small' },
        ]}
      />
      <InventoryGroup title="Buttons" description="The two button components, as they look by default. Open a name for every variant, size and state.">
        <InventoryTile target="Button" specimen={<Button label="Continue" onPress={() => {}} />} />
        <InventoryTile
          target="ButtonGroup"
          specimen={
            <ButtonGroup variant="horizontal">
              <Button label="Cancel" variant="tertiary" onPress={() => {}} />
              <Button label="Confirm" onPress={() => {}} />
            </ButtonGroup>
          }
        />
      </InventoryGroup>
    </View>
  ),
});
