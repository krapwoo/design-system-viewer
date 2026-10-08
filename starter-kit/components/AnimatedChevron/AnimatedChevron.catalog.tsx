import React from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { AnimatedChevron } from './AnimatedChevron';
import { DS_SEMANTIC } from '../../tokens';

export default defineCatalogPage({
  component: 'AnimatedChevron',
  group: 'Sub-Parts',
  description: 'A chevron that morphs between down (collapsed) and up (expanded) — flipping vertically in place instead of rotating through a sideways-pointing angle, and instead of swapping icons. The morph Banner\'s own collapsible header uses for its disclosure indicator. Not commonly used on its own; exported for building a custom disclosure/accordion toggle.',
  a11y: 'Purely decorative — no accessibility role of its own. Wrap it in an accessible parent (the way Banner\'s own header Pressable does) if the toggle needs to be announced.',
  variants: {
    items: [
      { key: 'collapsed', name: 'Collapsed', props: { expanded: false }, node: <AnimatedChevron expanded={false} /> },
      { key: 'expanded', name: 'Expanded', props: { expanded: true }, node: <AnimatedChevron expanded={true} /> },
    ],
  },
  states: {
    items: [
      { key: 'size', name: 'Custom size', node: <AnimatedChevron expanded={false} size={28} /> },
      { key: 'color', name: 'Custom color', node: <AnimatedChevron expanded={true} color={DS_SEMANTIC.emphasis.info} /> },
    ],
  },
});
