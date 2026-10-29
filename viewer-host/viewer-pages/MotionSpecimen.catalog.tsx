import React from 'react';
import { Easing } from 'react-native';
import { defineCatalogPage, MotionSpecimen } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  component: 'MotionSpecimen',
  internalProps: { valueRange: 'Derived from the motion token being shown, not picked per example.' },
  group: 'Components',
  source: '../native/catalog/MotionSpecimen.tsx',
  specimenSize: 'regular',
  description: "Shows a duration/easing or spring token as a real motion: a dot slides across a track once on load, and a Replay button plays it again. With reduce motion on, every play jumps straight to the end. `valueRange: 'unit'` is for a spring tuned for a 0-to-1 value. A spring can also be written the SwiftUI way, as `{ response, dampingFraction }` or `{ duration, bounce }`; the curve matches SwiftUI's spring model, while the moment it counts as settled may differ slightly.",
  whenToUse: "On a motion token page, next to each token's value.",
  a11y: 'The Replay button is named after the specimen ("Replay 240ms · standard"), so several on one page stay distinct.',
  variants: {
    items: [
      { key: 'timing', name: 'Timing', props: { kind: 'timing' }, node: <MotionSpecimen kind="timing" duration={240} easing={Easing.bezier(0.2, 0, 0, 1)} label="240ms · standard" /> },
      { key: 'spring', name: 'Spring', props: { kind: 'spring' }, node: <MotionSpecimen kind="spring" spring={{ stiffness: 220, damping: 24, mass: 1 }} label="Spring" /> },
      { key: 'swiftui-response', name: 'SwiftUI response / damping', props: { kind: 'spring' }, node: <MotionSpecimen kind="spring" spring={{ response: 0.5, dampingFraction: 0.7 }} label="response 0.5 · damping 0.7" /> },
      { key: 'swiftui-bounce', name: 'SwiftUI duration / bounce', props: { kind: 'spring' }, node: <MotionSpecimen kind="spring" spring={{ duration: 0.5, bounce: 0.3 }} label="duration 0.5 · bounce 0.3" /> },
    ],
  },
});
