import React from 'react';
import { defineCatalogPage, StyleBadgeButton } from '@krapwoo/ds-viewer';

export default defineCatalogPage({
  component: 'StyleBadgeButton',
  group: 'Components',
  source: '../native/catalog/PageKindBadge.tsx',
  specimenSize: 'regular',
  hide: { props: true },
  composedOf: [{ component: 'Popover', role: 'The popover the badge opens.', relationship: 'built-in' }],
  standalone: 'Every page head draws it for pageKind: \'style\'; the inventory tile uses the decorative StyleBadge instead.',
  description: "The \"Style\" badge on a page head, as a button. Pressing it opens a small popover anchored to the badge with a plain explanation: what a style is (a SwiftUI `ButtonStyle`, `ViewModifier`, `TextRenderer`, a shared background), how it differs from a component (you apply it to something, and changing it changes everything that applies it) and how to read the page. The page's `styleNote`, when it has one, is shown first. The popover opens below the badge (above it near the bottom of the window, shifted sideways near an edge, at most 320px wide) and closes on a second press, Escape, a press outside or scrolling. The viewer draws it; a page only sets `pageKind`.",
  whenToUse: "Never placed by hand: set `pageKind: 'style'` on the page.",
  a11y: 'A button named "Style — what this means" with a 44px hit area around the pill, reachable by keyboard with a focus ring, that reports `aria-expanded` and `aria-haspopup="dialog"`. The popover is a dialog named "About styles" (not modal: the page behind stays usable); focus moves into it on open and returns to the badge when it closes. It fades in with opacity only, and appears at once under reduced motion. Only one popover is open at a time.',
  variants: {
    items: [
      { key: 'plain', name: 'With the default explanation', node: <StyleBadgeButton /> },
      { key: 'note', name: "With the page's own styleNote", node: <StyleBadgeButton note="Apply it with .chipLook() on any Text." /> },
    ],
  },
});
