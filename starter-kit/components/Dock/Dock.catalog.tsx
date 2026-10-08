import React from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { Button } from '../Button';
import { Dock } from './Dock';

export default defineCatalogPage({
  component: 'Dock',
  group: 'Navigation',
  description: 'Pinned to the bottom of the screen, above the home indicator — holds up to three full-width Buttons stacked vertically, with an optional small caption area above them.',
  a11y: 'A plain View; each Button child carries its own accessibility role and label.',
  // No `variant` prop exists on Dock — its "Variants" column just shows the one default look,
  // at its max button count; the caption/count variations live under "States".
  variants: {
    itemsFill: true,
    items: [
      {
        key: 'default',
        name: 'Default',
        node: (
          <Dock caption="3 stops · 24 min total">
            <Button label="Start trip" onPress={() => {}} />
            <Button label="Save for later" variant="secondary" onPress={() => {}} />
            <Button label="Share" variant="tertiary" onPress={() => {}} />
          </Dock>
        ),
      },
    ],
  },
  states: {
    itemsFill: true,
    items: [
      {
        key: 'no-caption',
        name: 'No caption',
        node: (
          <Dock>
            <Button label="Confirm" onPress={() => {}} />
            <Button label="Cancel" variant="tertiary" onPress={() => {}} />
          </Dock>
        ),
      },
      {
        key: 'caption-hidden',
        name: 'Caption hidden',
        node: (
          <Dock caption="3 stops · 24 min total" showCaption={false}>
            <Button label="Start trip" onPress={() => {}} />
          </Dock>
        ),
      },
      {
        key: 'single-button',
        name: 'Single button',
        node: (
          <Dock>
            <Button label="Got it" onPress={() => {}} />
          </Dock>
        ),
      },
      {
        key: 'elevated',
        name: 'Elevated',
        node: (
          <Dock elevated caption="3 stops · 24 min total">
            <Button label="Start trip" onPress={() => {}} />
          </Dock>
        ),
      },
    ],
  },
});
