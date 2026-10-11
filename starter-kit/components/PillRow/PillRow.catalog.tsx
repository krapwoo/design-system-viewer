import React from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { PillRow } from './PillRow';

export default defineCatalogPage({
  component: 'PillRow',
  group: 'Components',
  composedOf: [
    { component: 'Pill', role: "Each item in pills, plus the trailing icon-only Edit pill when shown.", relationship: 'built-in' },
  ],
  description: 'A horizontally-scrolling row of Pill chips, with an optional trailing icon-only add pill — keeps the selected pill scrolled into view automatically.',
  whenToUse: 'A scrollable row of selection chips (e.g. saved-place shortcuts) — for a fixed row of action buttons instead, use ButtonGroup.',
  a11y: 'The row itself carries no accessibility role; each Pill (including the add pill) keeps its own accessibilityLabel/role from the Pill component.',
  variants: {
    itemsFill: true,
    items: [
      {
        key: 'few',
        name: 'Few pills',
        node: (
          <PillRow
            pills={[
              { id: 'home', label: 'Home', variant: 'selected', iconName: 'home' },
              { id: 'work', label: 'Work', variant: 'not_selected', iconName: 'briefcase' },
            ]}
          />
        ),
      },
      {
        key: 'many',
        name: 'Many pills (scrollable)',
        node: (
          <PillRow
            pills={[
              { id: 'home', label: 'Home', variant: 'not_selected', iconName: 'home' },
              { id: 'work', label: 'Work', variant: 'selected', iconName: 'briefcase' },
              { id: 'gym', label: 'Gym', variant: 'not_selected', iconName: 'map' },
              { id: 'saved', label: 'Saved', variant: 'not_selected', iconName: 'bell' },
              { id: 'nearby', label: 'Nearby', variant: 'not_selected', iconName: 'pin' },
              { id: 'recent', label: 'Recent', variant: 'not_selected', iconName: 'clock' },
            ]}
          />
        ),
      },
    ],
  },
  states: {
    itemsFill: true,
    items: [
      {
        key: 'no-add',
        name: 'No add pill',
        props: { showAddPill: false },
        node: (
          <PillRow
            showAddPill={false}
            pills={[
              { id: 'home', label: 'Home', variant: 'selected', iconName: 'home' },
              { id: 'work', label: 'Work', variant: 'not_selected', iconName: 'briefcase' },
            ]}
          />
        ),
      },
      {
        key: 'add-selected',
        name: 'Add pill selected',
        props: { addSelected: true },
        node: (
          <PillRow
            addSelected
            pills={[
              { id: 'home', label: 'Home', variant: 'not_selected', iconName: 'home' },
              { id: 'work', label: 'Work', variant: 'not_selected', iconName: 'briefcase' },
            ]}
          />
        ),
      },
      {
        key: 'min-width',
        name: 'Minimum pill width',
        props: { minPillWidth: 96 },
        node: (
          <PillRow
            minPillWidth={96}
            pills={[
              { id: 'home', label: 'Home', variant: 'selected', iconName: 'home' },
              { id: 'work', label: 'Work', variant: 'not_selected', iconName: 'briefcase' },
            ]}
          />
        ),
      },
    ],
  },
});
