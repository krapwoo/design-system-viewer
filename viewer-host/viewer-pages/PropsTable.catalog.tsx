import React from 'react';
import { defineCatalogPage, PropsTable, type PropDef } from '@krapwoo/ds-viewer';

const THREE: PropDef[] = [
  { name: 'label', type: 'string', desc: 'Button text.' },
  { name: 'variant', type: "'primary' | 'secondary'", default: 'primary', desc: 'Visual weight.' },
  { name: 'onPress', type: '() => void', required: true, desc: 'Tap handler.' },
];

// Six props, the case ReferenceDetails hands to `columns={2}` — enough to show that props fill
// across first, so reading and focus order stay the declared order.
const SIX: PropDef[] = [
  ...THREE,
  { name: 'icon', type: 'IconName', desc: 'A leading glyph, shown before the label.' },
  { name: 'fullWidth', type: 'boolean', default: 'false', desc: 'Stretches the button to its container, for a form\'s primary action.' },
  { name: 'disabled', type: 'boolean', default: 'false', desc: 'Blocks presses and drops the button to its muted tone.' },
];

export default defineCatalogPage({
  group: 'Components',
  source: '../native/catalog/PropsTable.tsx',
  specimenSize: 'page',
  hide: { props: true },
  description: 'Renders a component\'s real prop interface as a table: each row stacks name + type above its description (and default, if any) — top-to-bottom, not side by side, so a long description reads at the card\'s full width instead of being squeezed into a narrow leftover column. An optional prop\'s name carries a `?`; a default is shown under its description. ReferenceDetails chooses one or two columns by the prop count and the room it has.',
  a11y: 'Plain stacked text, with no table semantics: each prop reads as its name, then its type, then its description and default, in the order the component declares them.',
  variants: {
    items: [
      { key: 'one', name: 'One column', node: <PropsTable props={THREE} /> },
      { key: 'two', name: 'Two columns (six props, filled across first)', node: <PropsTable props={SIX} columns={2} /> },
    ],
  },
});
