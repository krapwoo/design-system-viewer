import React from 'react';
import { defineCatalogPage, SidePanelTrigger } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  component: 'SidePanelTrigger',
  group: 'Components',
  standalone: 'Also the control behind the family and group member panels, not a part of ReferenceDetailsPanel alone.',
  source: '../native/catalog/SidePanelTrigger.tsx',
  specimenSize: 'compact',
  hide: { props: true },
  description: 'The link-style control that opens a SidePanel: a label in the accent colour followed by a ›, 44px tall so it is easy to hit. The › is always shown — the content opens beside the page, it never expands in place.',
  whenToUse: 'Beside the thing the panel is about, after its specimens. Pass `open` so the control reports whether its panel is showing.',
  a11y: 'A button that reports `aria-expanded` and `aria-haspopup="dialog"`; the › is hidden from assistive technology so the name is just the label. Keyboard focus shows an outline ring.',
  states: {
    items: [
      { key: 'closed', name: 'Closed', props: { open: 'false' }, node: <SidePanelTrigger label="Notes and API" open={false} onPress={() => {}} /> },
      { key: 'open', name: 'Open', props: { open: 'true' }, node: <SidePanelTrigger label="Notes and API" open onPress={() => {}} /> },
    ],
  },
});
