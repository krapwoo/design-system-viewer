import React from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { Loading } from './Loading';
import { DS_SEMANTIC } from '../../tokens';

export default defineCatalogPage({
  component: 'Loading',
  group: 'Components',
  specimenSize: 'regular',
  description: 'An indeterminate loader — the shape fills up, empties out, then fills again, seamlessly. Two variants: circle (used internally by Button and Pill for their own loading states) and linear.',
  a11y: 'Exposed to assistive tech as accessibilityRole="progressbar" with accessibilityLabel="Loading" — no extra wiring needed at the call site.',
  // One example per `variant` enum value — `circle` is the default, so it comes first.
  variants: {
    itemsFill: true,
    items: [
      { key: 'circle', name: 'Circle', props: { variant: 'circle' }, node: <Loading variant="circle" /> },
      { key: 'linear', name: 'Linear', props: { variant: 'linear' }, node: <Loading variant="linear" /> },
    ],
  },
  // `size` (circle) and `height` (linear) are continuous numbers, not enums — small/medium/large
  // and thin/default/thick are explicit, labeled sweeps across each. Each sweep names its variant
  // through `group`, so the page shows one row per variant; Accent colour applies to both and
  // stays in "Other configurations".
  states: {
    items: [
      { key: 'small-circle', group: 'circle', name: 'Small circle', node: <Loading variant="circle" size={14} /> },
      { key: 'medium-circle', group: 'circle', name: 'Medium circle (default)', node: <Loading variant="circle" size={20} /> },
      { key: 'large-circle', group: 'circle', name: 'Large circle', node: <Loading variant="circle" size={40} /> },
      { key: 'thin-linear', group: 'linear', fill: true, name: 'Thin linear', node: <Loading variant="linear" height={2} /> },
      { key: 'default-linear', group: 'linear', fill: true, name: 'Default linear', node: <Loading variant="linear" height={4} /> },
      { key: 'thick-linear', group: 'linear', fill: true, name: 'Thick linear', node: <Loading variant="linear" height={8} /> },
      { key: 'accent', name: 'Accent colour', node: <Loading variant="circle" color={DS_SEMANTIC.emphasis.info} /> },
    ],
  },
});
