import React from 'react';
import { defineCatalogPage, PagerButton } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  component: 'PagerButton',
  title: 'Pager button',
  group: 'Components',
  source: '../native/catalog/SectionBlock.tsx',
  specimenSize: 'regular',
  description: 'The individual previous/next button of a page head. SectionPagerRow renders a pair; a button with no neighbouring page is disabled and says so.',
  whenToUse: "Reach for PagerButton directly only when building a different pager layout that still wants the same disabled, hover and focus behaviour as SectionPagerRow's own pair.",
  a11y: 'Exposes `accessibilityRole="button"`, a direction- and destination-aware `accessibilityLabel` (e.g. "Previous: Button"), and `accessibilityState={{ disabled }}` when there is no neighbouring page; shows the catalog\'s own focus ring on keyboard focus.',
  variants: {
    items: [
      { key: 'previous', name: 'Previous, with a page to go to', props: { direction: 'previous' }, node: <PagerButton direction="previous" targetId="Button" onNavigate={() => {}} labelOf={(id) => id} /> },
      { key: 'next', name: 'Next, with a page to go to', props: { direction: 'next' }, node: <PagerButton direction="next" targetId="Banner" onNavigate={() => {}} labelOf={(id) => id} /> },
    ],
  },
  states: {
    items: [
      { key: 'disabled', name: 'Disabled: no neighbouring page', node: <PagerButton direction="previous" targetId={null} onNavigate={() => {}} /> },
    ],
  },
});
