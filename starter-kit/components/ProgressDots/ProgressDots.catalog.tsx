import React from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { ProgressDots } from './ProgressDots';

export default defineCatalogPage({
  component: 'ProgressDots',
  group: 'Feedback',
  description: 'A row of dots for a stepped flow; the active dot widens into a pill.',
  a11y: 'Decorative progress indicator; convey the "step X of Y" position in text for screen readers.',
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
