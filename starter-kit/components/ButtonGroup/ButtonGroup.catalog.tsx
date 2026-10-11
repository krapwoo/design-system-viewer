import React from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { ButtonGroup } from './ButtonGroup';
import { Button } from '../Button';

export default defineCatalogPage({
  component: 'ButtonGroup',
  group: 'Components',
  composedOf: [
    { component: 'Button', role: "Its children: up to two Buttons side by side, or three stacked.", relationship: 'slot' },
  ],
  specimenSize: 'regular',
  description: 'Groups Button elements in one of two layouts: horizontal (up to two, auto-width, trailing-aligned) or vertical (up to three, stretched full width — the same layout Dock\'s own button area uses). Every button in a group should read as one family — the same variant tier (primary/secondary/tertiary/white, never ghost), the same size, and either all icon+label or all label-only, never a mix. Dev-console warns if two or more children disagree.',
  a11y: 'A plain View; each Button child carries its own accessibility role and label.',
  variants: {
    itemsFill: true,
    items: [
      {
        key: 'horizontal',
        name: 'Horizontal',
        props: { variant: 'horizontal' },
        node: (
          <ButtonGroup variant="horizontal">
            <Button label="Cancel" variant="tertiary" onPress={() => {}} />
            <Button label="Confirm" onPress={() => {}} />
          </ButtonGroup>
        ),
      },
      {
        key: 'vertical',
        name: 'Vertical',
        props: { variant: 'vertical' },
        node: (
          <ButtonGroup variant="vertical">
            <Button label="Start trip" onPress={() => {}} />
            <Button label="Save for later" variant="secondary" onPress={() => {}} />
            <Button label="Share" variant="tertiary" onPress={() => {}} />
          </ButtonGroup>
        ),
      },
    ],
  },
});
