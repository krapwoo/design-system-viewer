import React from 'react';
import { View } from 'react-native';
import { Inventory, InventoryGroup, InventoryTile, WarningBanner, defineCatalogPage } from '@krapwoo/ds-viewer';

// FLAGGED ON PURPOSE (not in `viewer-host`, so `check:catalog` and `check:doctor` stay clean): the
// overview wraps its `Inventory` in a `View`, so the page does not start with one and everything,
// the banner, the chips and both groups, is drawn inside one box instead of the token-page layout.
// `doctor --render` must report `sections-in-one-box` for it. To see it, copy this file into
// `viewer-host/viewer-pages/`, run `node dist/cli/main.js doctor --render` there, and delete the copy.
// The fix is the page's own `render`: return the `WarningBanner` and the `Inventory` directly, with no
// wrapper. Its correct twin is `viewer-host/viewer-pages/Inventory.catalog.tsx` (an overview) and
// `starter-kit/pages/Buttons.catalog.tsx`.
export default defineCatalogPage({
  id: 'InventoryInBox',
  group: 'Components',
  description: 'An overview whose inventory sits in one box.',
  standalone: 'A fixture for the doctor check.',
  previewWidths: 'full',
  render: () => (
    <View>
      <WarningBanner title="One primary per surface">Each screen gets one primary Button.</WarningBanner>
      <Inventory>
        <InventoryGroup title="One action" description="A single Button.">
          <InventoryTile target="Button" />
        </InventoryGroup>
        <InventoryGroup title="Several actions" description="A ButtonGroup.">
          <InventoryTile target="ButtonGroup" />
        </InventoryGroup>
      </Inventory>
    </View>
  ),
});
