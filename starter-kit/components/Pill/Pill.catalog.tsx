import React from 'react';
import { defineCatalogPage, grid } from '@krapwoo/ds-viewer';
import { Pill } from './Pill';

// Pill: Selection × State.
// `rows` is bound to Pill's own `variant` prop (design §4); the second item's key is
// `'not_selected'` (underscore), matching `PillVariant` exactly — not `'not-selected'`, which is
// only this page's own label-ish spelling and would fail `doctor`'s "item key must be a real
// option" check.
const PILL_COMPARISON = grid(
  'Selection',
  'State',
  {
    prop: 'variant',
    items: [
      { key: 'selected', label: 'Selected' },
      { key: 'not_selected', label: 'Not selected' },
    ],
  },
  [
    { key: 'icon-text', label: 'Icon + Text' },
    { key: 'icon-only', label: 'Icon-only' },
    { key: 'disabled', label: 'Disabled' },
    { key: 'loading', label: 'Loading' },
  ],
  (row, column) => (
    <Pill
      label="Home"
      variant={row === 'selected' ? 'selected' : 'not_selected'}
      iconName="home"
      showText={column !== 'icon-only'}
      accessibilityLabel="Home"
      disabled={column === 'disabled'}
      loading={column === 'loading'}
      onPress={() => {}}
    />
  ),
  'compact',
);

export default defineCatalogPage({
  component: 'Pill',
  group: 'Components',
  standalone: 'A reusable kit component in its own right; PillRow is just the only kit component that uses it.',
  composedOf: [
    { component: 'Loading', role: "The spinner shown instead of the label and icon while loading is true.", relationship: 'built-in' },
  ],
  specimenSize: 'compact',
  comparison: PILL_COMPARISON,
  description:
    'A single-line selection chip. `selected` is a solid dark fill with inverse content; `not_selected` sits on white with a resting shadow. The leading slot holds a named `iconName`, a custom `icon` node, or — when neither is given — a default menu icon; the label can be hidden for an icon-only pill.',
  whenToUse:
    "A tappable chip whose state is a persistent selection: the caller flips `variant` between selected and not selected. For a read-only status on a row — not tappable, no selected state — use Badge, which Pill resembles but does not replace. For an action that makes something happen on tap, use Button; for several chips in one scrolling row, PillRow.",
  a11y:
    'Only an unselected pill with an `onPress` is interactive: it renders a Pressable with accessibilityRole="button", named by `accessibilityLabel` and falling back to `label` (default "Text"), with accessibilityState disabled, busy and selected. A selected pill, or any pill without `onPress`, renders an `accessible` View with the same `accessibilityLabel` and accessibilityState, so a screen reader announces "selected" rather than leaving it to colour alone. The role is conditional: the View is `button` only when `onPress` is set, so a pill without `onPress` has no role, deliberately, to avoid announcing a control that does not exist. A selected pill with `onPress` is announced as a selected button even though activating it does nothing. The Pressable\'s own `selected` flag is always false, because a selected pill never renders the Pressable — the View carries `selected: true` instead. An icon-only pill (`showText={false}`) with no `accessibilityLabel` is announced by the placeholder `label` default — the type does not enforce one and, unlike Badge, there is no development warning. hitSlop extends the 40pt-tall pill to the 44pt minimum touch target (2px top and bottom, and left and right too when icon-only). Keyboard focus draws a 2px focus-colour border (not shown while disabled); there is no other keyboard handling beyond Pressable\'s defaults. `loading` counts as disabled and sets the busy state; the spinner itself is not announced.',
  notes: [
    'A selected pill renders a View, not a Pressable, even when `onPress` is set — tapping the current selection does nothing, and the caller changes `variant` from the other pills\' handlers.',
    'There is no text-only pill: the leading slot always renders, falling back to the `menu` icon when neither `iconName` nor `icon` is given.',
    '`variant` defaults to `selected` and `label` to "Text".',
    '`disabled` dims the whole pill (label and icon included) with the shared disabled opacity.',
  ],
  variants: {
    items: [
      { key: 'selected', name: 'Selected', props: { variant: 'selected' }, node: <Pill label="Home" variant="selected" iconName="home" onPress={() => {}} /> },
      { key: 'not-selected', name: 'Not selected', props: { variant: 'not_selected' }, node: <Pill label="Work" variant="not_selected" iconName="briefcase" onPress={() => {}} /> },
    ],
  },
  states: {
    items: [
      {
        key: 'icon-text',
        name: 'Icon + Text',
        node: <Pill label="Nearby" variant="not_selected" iconName="pin" onPress={() => {}} />,
      },
      {
        key: 'icon-only',
        name: 'Icon-only',
        node: <Pill label="Saved" variant="not_selected" iconName="bell" showText={false} onPress={() => {}} />,
      },
      {
        key: 'disabled',
        name: 'Disabled',
        node: <Pill label="Sold out" variant="not_selected" iconName="clock" disabled onPress={() => {}} />,
      },
      {
        key: 'loading',
        name: 'Loading',
        node: <Pill label="Saving" variant="not_selected" iconName="clock" loading onPress={() => {}} />,
      },
    ],
  },
});
