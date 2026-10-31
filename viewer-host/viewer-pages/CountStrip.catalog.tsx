import React from 'react';
import { defineCatalogPage, CountStrip } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  component: 'CountStrip',
  group: 'Components',
  source: '../native/catalog/CountStrip.tsx',
  specimenSize: 'wide',
  propNotes: {
    items: 'Two to six stats. Each has a `label` (shown small and uppercase), a `value` (shown large), and an optional `sub` caption. With fewer than two or more than six, it still renders and logs a development warning.',
  },
  description: 'A row of 2–6 stats for a category overview page. The cells share the row equally and wrap onto the next row when the page is narrow (each is at least 150px wide). Drawn in the viewer\'s own tokens: the label in the micro-label style, the value large, the caption muted; a hairline separates neighbouring cells, across and down.',
  whenToUse: 'At the top of a category overview page, for the few numbers that say how big the category is. For one number inside running text, write the sentence instead. For a list of things, use cards or rows.',
  a11y: 'A list of stats: each cell is a list item that reads its label, then its value, then its caption. The values are plain text, not live regions.',
  variants: {
    itemsFill: true,
    items: [
      { key: 'three', name: 'Three stats', node: <CountStrip items={[{ label: 'Pages', value: 14 }, { label: 'Variants', value: 62 }, { label: 'Sizes', value: 3 }]} /> },
      { key: 'captions', name: 'With captions', node: <CountStrip items={[{ label: 'Buttons', value: 31, sub: '5 shared styles and 26 buttons' }, { label: 'Shared styles', value: 5, sub: 'used by 18 buttons' }, { label: 'Hand-rolled', value: 13, sub: 'draw their own look' }]} /> },
      { key: 'two', name: 'Two stats (the fewest)', node: <CountStrip items={[{ label: 'Pages', value: 2 }, { label: 'Status', value: 'Stable' }]} /> },
      { key: 'six', name: 'Six stats (the most; wraps on a narrow page)', node: <CountStrip items={[1, 2, 3, 4, 5, 6].map((n) => ({ label: `Stat ${n}`, value: n * 11, sub: 'a caption' }))} /> },
    ],
  },
});
