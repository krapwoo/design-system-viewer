import React from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { EmptyState } from './EmptyState';
import { DS_SEMANTIC } from '../../tokens';

export default defineCatalogPage({
  component: 'EmptyState',
  group: 'Components',
  specimenSize: 'regular',
  composedOf: [
    { component: 'Avatar', role: "The icon circle above the title (iconName, default 'users').", relationship: 'built-in' },
    { component: 'ButtonGroup', role: "Stacks the action buttons when action is set.", relationship: 'built-in' },
    { component: 'Button', role: "The action button, plus a tertiary secondaryAction button when set.", relationship: 'built-in' },
  ],
  description: 'A centred placeholder for a screen or section with nothing to show yet — no results, no saved items, a first-run state.',
  whenToUse:
    "Fills the entire content area because there's nothing else to show. For a note that sits alongside other real content, use Banner instead. It carries at most two actions; for an illustration or a richer layout, compose your own.",
  a11y:
    'No explicit handling beyond React Native defaults. The title has accessibilityRole="header", so it is a heading; the description is plain Text. The icon is decorative: the Avatar is wrapped in a View with `aria-hidden` (the cross-platform prop; the older accessibilityElementsHidden / importantForAccessibility are not mapped by react-native-web, which exposed the icon as an unnamed image), so assistive tech skips it rather than announcing an unlabelled image. The actions are real Buttons (accessibilityRole="button", named by their label), always rendered `small`; a label-only small Button is 36pt tall but gets 4pt of vertical hitSlop, which reaches the 44pt minimum touch target (vertical only, so its width is not extended).',
  notes: [
    '`secondaryAction` is only rendered when `action` is also set.',
    '`backgroundColor` passes through to Avatar, which switches its icon to light (inverse) colour whenever a custom fill is given — pair it with a saturated or dark fill.',
  ],
  // No `variant` prop exists on EmptyState — its "Variants" column shows the minimal default
  // (iconName omitted, so it falls back to the real default) — the description/action
  // configurations live under "States".
  variants: {
    itemsFill: true,
    items: [{ key: 'default', name: 'Default', node: <EmptyState title="No saved trips yet" /> }],
  },
  states: {
    itemsFill: true,
    items: [
      {
        key: 'description',
        name: 'With description',
        node: <EmptyState iconName="search" title="No results found" description="Try a different station or address." />,
      },
      {
        key: 'action',
        name: 'With action',
        node: (
          <EmptyState
            iconName="waypoints"
            title="No saved trips yet"
            description="Your saved trips will show up here."
            action={{ label: 'Start a trip', onPress: () => {} }}
          />
        ),
      },
      {
        key: 'secondary-action',
        name: 'With two actions',
        props: { secondaryAction: true },
        node: (
          <EmptyState
            iconName="waypoints"
            title="No saved trips yet"
            description="Your saved trips will show up here."
            action={{ label: 'Start a trip', onPress: () => {} }}
            secondaryAction={{ label: 'Not now', onPress: () => {} }}
          />
        ),
      },
      {
        key: 'custom-color',
        name: 'Custom avatar colour',
        node: (
          <EmptyState
            iconName="triangle-alert"
            title="Something went wrong"
            description="Check your connection and try again."
            backgroundColor={DS_SEMANTIC.emphasis.negative}
          />
        ),
      },
    ],
  },
});
