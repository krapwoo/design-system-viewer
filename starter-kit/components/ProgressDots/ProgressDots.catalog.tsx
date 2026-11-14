import React from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { ProgressDots } from './ProgressDots';

export default defineCatalogPage({
  component: 'ProgressDots',
  group: 'Components',
  whenToUse: 'A short sequence of steps whose length is known, with the current step widened into a pill. For a wait of unknown length, use Loading.',
  description: 'A row of dots for a stepped flow; the active dot widens into a pill.',
  a11y: 'A single accessible View with accessibilityRole="progressbar", accessibilityLabel "Step X of Y" and `aria-valuemin` 1, `aria-valuemax` total and `aria-valuenow` active + 1, so the dots are not read one by one. The label is English and built inside the component.',
  // No `variant` prop exists on ProgressDots — its "Variants" column just shows the one default
  // look; `active`'s different positions are progress states, covered under "States".
  variants: {
    items: [{ key: 'default', name: 'Default', node: <ProgressDots active={1} total={4} /> }],
  },
  states: {
    items: [
      { key: 'first', name: 'First step', node: <ProgressDots active={0} total={4} /> },
      { key: 'middle', name: 'Middle step', node: <ProgressDots active={2} total={4} /> },
      { key: 'last', name: 'Last step', node: <ProgressDots active={3} total={4} /> },
    ],
  },
});
