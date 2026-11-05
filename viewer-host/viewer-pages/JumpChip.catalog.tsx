import React from 'react';
import { defineCatalogPage, JumpChip } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  component: 'JumpChip',
  title: 'Jump chip',
  group: 'Components',
  source: '../native/catalog/JumpRow.tsx',
  specimenSize: 'regular',
  hide: { props: true },
  description: 'One chip of a jump row: a title, an optional muted qualifier, and either an onPress (an in-page scroll) or a real href.',
  whenToUse: 'Reach for JumpChip directly only when building a jump row outside JumpRow itself; the row already renders one per item.',
  a11y: 'A real link (role="link") when href is set, with the same keyboard activation every other canonical link in this catalog uses; otherwise a plain role="button".',
  variants: {
    items: [
      { key: 'link', name: 'A real link, with a "Part N of <Family>" qualifier', node: <JumpChip title="OnboardingPrimaryButtonStyle (fixture)" qualifier="Part 1 of Onboarding buttons" href="#OnboardingPrimaryButtonStyle" /> },
      { key: 'button', name: 'An in-page scroll, with a count qualifier', node: <JumpChip title="Attention (fixture)" qualifier="3" accessibilityLabel="Attention (fixture), 3 values" onPress={() => {}} /> },
    ],
  },
});
