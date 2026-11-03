import React from 'react';
import { Text } from 'react-native';
import { defineCatalogPage, DividedStack, VariantGroup } from '@krapwoo/ds-viewer';

// FLAGGED ON PURPOSE (not in `viewer-host`, so `check:catalog` and `check:doctor` stay clean): a token
// gallery that draws two titled groups, one `VariantGroup` each, in its one `render`. A token page
// gives every section its own box, so `doctor --render` must report `sections-in-one-box` for it. To
// see it, copy this file into `viewer-host/viewer-pages/`, run `node dist/cli/main.js doctor --render`
// there, and delete the copy. The fix is `tokenSections: [{ title, desc, render }]`, one entry per group.
export default defineCatalogPage({
  id: 'GalleryInOneBox',
  group: 'Tokens',
  description: 'A gallery whose groups share one box.',
  tokenGallery: true,
  render: () => (
    <DividedStack>
      <VariantGroup name="Sizes" desc="small to large" align="left"><Text>Sizes</Text></VariantGroup>
      <VariantGroup name="All icons" desc="at 24px" align="left"><Text>Icons</Text></VariantGroup>
    </DividedStack>
  ),
});
