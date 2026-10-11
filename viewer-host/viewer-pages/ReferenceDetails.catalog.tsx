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

export default defineCatalogPage({
  group: 'Viewer',
  previewWidths: 'full',
  hide: { states: true, props: true, accessibility: true },
  description: 'Always-visible Guidance (when to use it, accessibility) and Quick reference (source path), plus Props in its own box (two columns, filled across first, when there are 4+ props and room) — everything a page shows below its specimens, regardless of layout. A token-gallery page (`tokenGallery: true`) shows only Quick reference, with no Guidance or Props box, since there\'s no component API to document.',
  render: () => <ReferenceDetails def={DEMO} />,
});
