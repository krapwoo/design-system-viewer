import React from 'react';
import { ReferenceDetails, defineCatalogPage, type SectionDef } from '@krapwoo/ds-viewer';

const DEMO: SectionDef<'ReferenceDetailsDemo'> = {
  id: 'ReferenceDetailsDemo',
  path: 'your/components/Example',
  description: 'unused here — ReferenceDetails only reads whenToUse/a11y/props below.',
  whenToUse: 'Shown here only to demonstrate the "deciding question" line — in a real page this names the one sentence that disambiguates this component from its closest look-alike.',
  a11y: 'Whatever is actually true about the real component\'s accessibility goes here, grounded in its source.',
  props: [
    { name: 'label', type: 'string', required: true, desc: 'What it says.' },
    { name: 'variant', type: "'a' | 'b'", default: 'a', desc: 'Which flavor.' },
  ],
};

const WITH_COMPOSITION: SectionDef<'ReferenceDetailsDemo'> = {
  ...DEMO,
  composedOf: [{ component: 'Icon', role: 'The leading glyph.', relationship: 'slot' }],
};
const TOKEN_PAGE: SectionDef<'ReferenceDetailsDemo'> = { ...DEMO, tokenGallery: true, props: undefined };

export default defineCatalogPage({
  component: 'ReferenceDetails',
  group: 'Components',
  standalone: 'Exported on its own, so a catalog can use it outside SectionBlock.',
  whenToUse: 'A page\'s props in their own full-width box, in two columns once there are four or more. SectionBlock renders one at the foot of every page, so use it directly only when composing a page yourself.',
  source: '../native/catalog/ReferenceDetails.tsx',
  composedOf: [
    { component: 'PropsTable', role: "The Props box.", relationship: 'built-in' },
  ],
  specimenSize: 'page',
  hide: { props: true },
  description: 'Always-visible Guidance (when to use it, accessibility) and Quick reference (source path), plus Props in its own box (two columns, filled across first, when there are 4+ props and room) — everything a page shows below its specimens, regardless of layout. A token-gallery page (`tokenGallery: true`) shows only Quick reference, with no Guidance or Props box, since there\'s no component API to document.',
  a11y: 'Each card title is a level-2 heading; facts are label and value pairs.',
  variants: {
    items: [
      { key: 'component', name: 'Component page', node: <ReferenceDetails def={DEMO} /> },
      { key: 'composition', name: 'With composition (third column)', node: <ReferenceDetails def={WITH_COMPOSITION} /> },
      { key: 'token', name: 'Token page (Quick reference only)', node: <ReferenceDetails def={TOKEN_PAGE} /> },
    ],
  },
});
