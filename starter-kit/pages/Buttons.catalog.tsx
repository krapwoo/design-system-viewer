import React from 'react';
import { Inventory, InventoryGroup, InventoryTile, WarningBanner, defineCatalogPage } from '@krapwoo/ds-viewer';
import { Button } from '../components/Button';
import { ButtonGroup } from '../components/ButtonGroup';

// A category overview: the page the sidebar's "Buttons" entry opens, with the two button pages listed
// under it (`sidebarParent: 'Buttons'` on Button and ButtonGroup). It adds no components of its own.
// Membership is a reviewed list: the tiles below are the buttons this page claims, written as data.
// Each `InventoryTile` draws a real specimen and links to its page by that page's own title. The
// `Inventory` turns its groups into the filter chips, so every number on the page is a filter and
// the facts that filter nothing (five variants, three sizes) are said in the group's own sentence.
export default defineCatalogPage({
  id: 'Buttons',
  group: 'Components',
  description: 'Start here for buttons: one Button for a single action, or ButtonGroup when two or three actions go together.',
  standalone: 'A category page for the sidebar: it documents no component of its own.',
  // Not a phone component: let the preview use the whole page width, so the tiles sit in a row.
  previewWidths: 'full',
  render: () => (
    <>
      <WarningBanner title="One primary per surface">
        Each screen, modal or sheet gets one primary Button, the one thing it most wants you to do. Make every other action secondary, tertiary or ghost.
      </WarningBanner>
      <Inventory>
        <InventoryGroup title="One action" description="A single Button, in five variants (primary to ghost) and three sizes. Open its name for every variant, size and state.">
          <InventoryTile target="Button" specimen={<Button label="Continue" onPress={() => {}} />} />
        </InventoryGroup>
        <InventoryGroup title="Several actions" description="ButtonGroup, when two or three actions go together. Open its name for the layouts.">
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
      </Inventory>
    </>
  ),
});
