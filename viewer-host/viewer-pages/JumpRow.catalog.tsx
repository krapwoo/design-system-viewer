import React from 'react';
import { defineCatalogPage, JumpRow, JumpChip, type JumpItem } from '@krapwoo/ds-viewer';

// #63 R1/R5: the shared "on this page" jump row — one chip per item, each either a real link (a
// group member's own address) or an in-page scroll (a tokenDefinition category). Fixture values
// only, standing in for a real token page's own categories.
const rowItems: JumpItem[] = [
  { id: 'attention', title: 'Attention (fixture)', qualifier: '3', accessibilityLabel: 'Attention (fixture), 3 values', onPress: () => {} },
  { id: 'palette', title: 'Palette (fixture)', qualifier: '25', accessibilityLabel: 'Palette (fixture), 25 values', onPress: () => {} },
];
const rowDemo = <JumpRow items={rowItems} />;

const linkChipDemo = (
  <JumpChip title="OnboardingPrimaryButtonStyle (fixture)" qualifier="Part 1 of Onboarding buttons" href="#OnboardingPrimaryButtonStyle" />
);

export default defineCatalogPage({
  id: 'JumpRow',
  group: 'Components',
  title: 'JumpRow',
  description: 'The "on this page" jump row shared by a tokenDefinition page\'s category row and a group page\'s top-level-member row: one chip per item, with a title, an optional muted qualifier, and either an onPress (an in-page scroll) or an href (a real, keyboard-reachable link).',
  source: '../native/catalog/JumpRow.tsx',
  whole: 'JumpRow',
  sections: [{ label: 'Parts', kind: 'blocks', inWhole: true, members: ['JumpChip'] }],
  members: [
    {
      id: 'JumpRow',
      component: 'JumpRow',
      source: '../native/catalog/JumpRow.tsx:50',
      fidelity: 'replicated',
      relationship: 'Main component',
      description: "One chip per item, in authored order, each inside a listitem of an accessibilityRole=\"list\" wrapper.",
      whenToUse: "Render JumpRow above a page's first section whenever it has more than one jump-worthy item — a tokenDefinition page's own categories, or a group page's own top-level members.",
      a11y: 'The row itself is accessibilityRole="list" with one listitem per chip; each chip is a button (onPress only) or a real link (href set), reachable by keyboard either way.',
      variants: { items: [{ key: 'demo', name: 'Two chips with a count qualifier', node: rowDemo }] },
    },
    {
      id: 'JumpChip',
      component: 'JumpChip',
      parent: 'JumpRow',
      source: '../native/catalog/JumpRow.tsx:24',
      fidelity: 'replicated',
      relationship: 'Part',
      description: 'One chip: a title, an optional muted qualifier, and either an onPress or a real href.',
      whenToUse: 'Reach for JumpChip directly only when building a jump row outside JumpRow itself — the row above already renders one per item.',
      a11y: 'A real link (role="link") when href is set — the same keyboard activation every other canonical link in this catalog uses; otherwise a plain role="button".',
      variants: { items: [{ key: 'demo', name: 'A real link chip with a "Part N of <Family>" qualifier', node: linkChipDemo }] },
    },
  ],
});
