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
  whenToUse: "Fills the entire content area because there's nothing else to show. For a note that sits alongside other real content, use Banner instead.",
  a11y: 'A plain View with text; the action(s) render as real Buttons inside a ButtonGroup, which carry their own accessibility.',
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
