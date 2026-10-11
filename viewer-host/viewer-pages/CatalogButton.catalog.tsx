import React from 'react';
import { defineCatalogPage, CatalogButton } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  group: 'Components',
  source: '../native/catalog/CatalogButton.tsx',
  specimenSize: 'compact',
  description: "The viewer's own button, for catalog chrome and demo triggers (not an app component). 44px tall, pill-shaped, in the catalog's own colours; a 3px outline ring on keyboard focus.",
  whenToUse: "Inside catalog chrome and demos, such as OverlayDemo's trigger. Never inside an app's own examples: show the app's own Button there.",
  a11y: 'A Pressable with role button; its accessible name is `accessibilityLabel` or the label. Focus shows an outline (no layout shift). Forwards a ref, so a parent can return focus to it.',
  variants: {
    items: [
      { key: 'primary', name: 'Primary', props: { variant: 'primary' }, node: <CatalogButton label="Open sheet" onPress={() => {}} /> },
      { key: 'secondary', name: 'Secondary', props: { variant: 'secondary' }, node: <CatalogButton label="Check now" variant="secondary" onPress={() => {}} /> },
    ],
  },
});
