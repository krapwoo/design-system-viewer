import React from 'react';
import { defineCatalogPage, CatalogButton } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  component: 'CatalogButton',
  group: 'Components',
  source: '../native/catalog/CatalogButton.tsx',
  specimenSize: 'compact',
  description: "The viewer's own button, for catalog chrome and demo triggers (not an app component). 44px tall, a rounded rectangle (9px radius), in the catalog's own colours; a 3px outline ring on keyboard focus. `disabled` greys it flat; `busy` keeps its own colours and puts a spinner before the label, for an action that has started and not finished.",
  whenToUse: "Inside catalog chrome and demos, such as OverlayDemo's trigger and every action on the update page. Never inside an app's own examples: show the app's own Button there.",
  a11y: 'A Pressable with role button; its accessible name is `accessibilityLabel` or the label. Disabled and busy are both reported through `accessibilityState` and both stop the press, so a reader is never told to wait on an action that already ran. Focus shows an outline (no layout shift). Forwards a ref, so a parent can return focus to it.',
  notes: ['The member side panel on family and group pages reuses this button, secondary variant, for its × close control.'],
  variants: {
    items: [
      { key: 'primary', name: 'Primary', props: { variant: 'primary' }, node: <CatalogButton label="Open sheet" onPress={() => {}} /> },
      { key: 'secondary', name: 'Secondary', props: { variant: 'secondary' }, node: <CatalogButton label="Check now" variant="secondary" onPress={() => {}} /> },
    ],
  },
  states: {
    items: [
      // Disabled is one flat grey for both variants, so the pair shows that on purpose.
      { key: 'disabled-primary', name: 'Disabled', props: { disabled: 'true' }, node: <CatalogButton label="Update now" disabled onPress={() => {}} /> },
      { key: 'disabled-secondary', name: 'Disabled, secondary', props: { disabled: 'true' }, node: <CatalogButton label="Check now" variant="secondary" disabled onPress={() => {}} /> },
      { key: 'busy', name: 'Busy', props: { busy: 'true' }, node: <CatalogButton label="Checking…" variant="secondary" busy onPress={() => {}} /> },
    ],
  },
});
