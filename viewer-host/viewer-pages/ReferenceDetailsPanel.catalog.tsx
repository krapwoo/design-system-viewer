import React from 'react';
import { ReferenceDetailsPanel, defineCatalogPage, type SectionDef } from '@krapwoo/ds-viewer';

const DEMO: SectionDef<'ReferenceDetailsPanelDemo'> = {
  id: 'ReferenceDetailsPanelDemo',
  path: 'your/components/Example',
  description: 'unused here — the panel only reads whenToUse/a11y/notes/composedOf/props below.',
  whenToUse: 'Shown here only to demonstrate the panel — in a real page this names the one sentence that disambiguates this component from its closest look-alike.',
  a11y: 'Whatever is actually true about the real component\'s accessibility goes here, grounded in its source.',
  notes: ['Notes are listed under Quick reference.'],
  composedOf: [{ component: 'Icon', role: 'The leading glyph.', relationship: 'slot' }],
  props: [{ name: 'label', type: 'string', required: true, desc: 'What it says.' }],
};
const EMPTY: SectionDef<'ReferenceDetailsPanelDemo'> = { id: 'ReferenceDetailsPanelDemo', path: '', description: 'Nothing to add.' };

export default defineCatalogPage({
  component: 'ReferenceDetailsPanel',
  group: 'Components',
  standalone: 'Exported on its own, so a catalog can use it outside SectionBlock.',
  whenToUse: 'A page\'s Guidance, Quick reference, Composition and Props behind a "Notes and API ›" control. SectionBlock renders one after the specimens of every non-token page, so use it directly only when composing a page yourself.',
  source: '../native/catalog/ReferenceDetails.tsx',
  composedOf: [
    { component: 'ReferenceDetails', role: 'The cards shown inside the panel.', relationship: 'built-in' },
    { component: 'SidePanel', role: 'The overlay that holds them.', relationship: 'built-in' },
    { component: 'SidePanelTrigger', role: 'The "Notes and API ›" control.', relationship: 'built-in' },
  ],
  specimenSize: 'compact',
  hide: { props: true },
  description: 'The control that opens a standalone page\'s reference details in a side panel, so the page itself keeps to its description, specimens and where it is used. The panel holds exactly what the page used to show inline. A page with nothing to put there gets no control at all. Following a reference link inside the panel closes it first, then navigates.',
  a11y: 'See SidePanel: a modal dialog named by the page, with focus returned to the control on close.',
  variants: {
    items: [
      { key: 'full', name: 'A page with guidance, notes, composition and props', node: <ReferenceDetailsPanel def={DEMO} /> },
    ],
  },
  states: {
    items: [
      { key: 'empty', name: 'Nothing to show: renders nothing', node: <ReferenceDetailsPanel def={EMPTY} /> },
    ],
  },
});
