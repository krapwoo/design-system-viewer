import React, { useState } from 'react';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { InputField } from './InputField';

// The starter kit's sample labels. `label` is free text, so these are not the only values it accepts —
// they are transit-themed examples; a product passes whatever its own field is called. Hints are
// sample text too.
const LABEL = 'To';
const VALUE = 'Grand Central';
const SAMPLE_HINT = 'Search a station';

/** A real editable field. Focus it to see the label float, the border fade in and, once there is
 *  text, the clear button; blur it with text in it to see the filled look. */
function Editable({ label = LABEL, initial = '', optional }: { label?: string; initial?: string; optional?: boolean }) {
  const [value, setValue] = useState(initial);
  return <InputField label={label} value={value} onChangeText={setValue} placeholder={SAMPLE_HINT} editable optional={optional} />;
}

/** A picker-mode field whose external picker is "open" (`active`). The clear button that appears
 *  calls `onChangeText('')`, so the demo wires it to its own state; without `onChangeText` that
 *  button does nothing. */
function ActivePicker() {
  const [value, setValue] = useState(VALUE);
  return <InputField label={LABEL} value={value} placeholder={SAMPLE_HINT} active onChangeText={setValue} onPress={() => {}} />;
}

export default defineCatalogPage({
  component: 'InputField',
  group: 'Components',
  specimenSize: 'regular',
  composedOf: [
    { component: 'InputClearButton', role: "The clear (\u00d7) button, shown while the field has a value and is focused (or active, when not editable).", relationship: 'built-in' },
    { component: 'SurfaceScope', role: 'Publishes the tone this reads, so the field stays visible on a muted background.', relationship: 'related' },
  ],
  description:
    'A single-line field with a floating label. At rest only the muted label shows, centred, with no border. When it is active (an editable field while focused; a picker field while `active` is set or while pressed) or holds a value, the label shrinks to a caption and the value or hint appears beneath it. With `editable` it is a live TextInput; without, it is a tappable row that shows a value and calls `onPress`, leaving the picker itself to the caller.',
  whenToUse:
    'One line of text, or one tappable value, under a name that stays visible. For several lines of free text with no label of its own, use TextArea. For searching or filtering, where the field has no name and a leading search icon, use SearchField. For choosing one option from a list, use Dropdown, which owns its picker sheet; an InputField in picker mode only displays what the caller chose and calls `onPress`, so it is for a picker you build yourself.',
  a11y:
    'The two modes are announced differently. EDITABLE (`editable` and not `disabled`): a real TextInput inside a Pressable wrapper that is given no accessibilityRole, label or state. The visible label is a separate Animated.Text with pointerEvents="none", and nothing ties it to the input, so the input has no accessible name unless the caller passes `inputProps.accessibilityLabel` (spread onto the TextInput) or a placeholder is read; the component supplies neither. At rest the value row that holds the input is at opacity 0 but still mounted. PICKER (everything else, including `disabled`): the Pressable gets accessibilityRole="button", accessibilityLabel "<label>, <value>" (the placeholder is not part of it; a field with no value is named by the label alone, and an icon-label field (`labelIcon`) has no label text, so one with no value has an empty name), and accessibilityState { disabled }. A picker with no `onPress` is read-only: the Pressable is disabled, and RN\'s Pressable merges its own `disabled` into accessibilityState (Pressable.js, RN 0.86), so native announces it as disabled although the component\'s own state object says false. While the clear button is shown, the outer role, label and state are dropped so a button is not nested in a button, leaving the picker field unnamed in that state. The clear button is a button named "Clear <label>" ("Clear field" for the icon label), 24pt with hitSlop 10 on every side for a 44pt target; it exists only while the field is focused or `active`, so on web, moving keyboard focus onto it blurs the input and removes it (read from the source, not exercised in a browser). The field is at least 63pt tall and as wide as its parent, and the whole field is tappable. There is no error, invalid or helper-text handling, so a validation message is not announced. The focused state is a 1px border fading from transparent to border.dark; there is no ring. The label, border and float animations (170ms, JS-driven) ignore the OS reduce-motion setting. Colour contrast for the muted and disabled text tones was not measured here.',
  notes: [
    'The label is free text and has no default: pass `label` (any string) or, for an icon in place of a word, `labelIcon` (an icon name). The two are mutually exclusive and one is required, enforced by the type. The "(Optional)" marker is a literal English string.',
    'An icon-label field has no text to name it. Nothing in the component supplies a name for that mode, so a field with no value is announced with an empty name.',
    '`editable` defaults to false, so an InputField with no `editable` and no `onPress` is a read-only display.',
    '`disabled` wins over `editable`: a disabled editable field renders as the picker-mode row (no TextInput), dimmed.',
    '`active` is only read in picker mode; editable fields derive the active look from focus and ignore it.',
    'The clear button calls `onChangeText(\'\')`. A picker that wants it to work must pass `onChangeText`; there is no separate clear handler.',
    '`valueIcon` and `valueAccent` apply only to a picker-mode value; an editable field ignores both.',
    'Reads the ambient SurfaceScope tone: recessed fill on a white surface, opaque white on a muted one.',
    'No error, success, helper-text, loading or read-only-visual state exists. A caller that needs one has to build it around the field.',
  ],
  variants: {
    itemsFill: true,
    // The label's two modes: free text (three sample labels) and an icon. Rested rather than filled:
    // the label is the only thing that differs between them.
    items: [
      { key: 'to', name: 'To', props: { label: 'To' }, node: <InputField label="To" onPress={() => {}} /> },
      { key: 'walk-time', name: 'Walk time', props: { label: 'Walk time' }, node: <InputField label="Walk time" onPress={() => {}} /> },
      { key: 'arrive-by', name: 'Arrive by', props: { label: 'Arrive by' }, node: <InputField label="Arrive by" onPress={() => {}} /> },
      { key: 'icon', name: 'Icon label (labelIcon)', props: { labelIcon: 'flag' }, node: <InputField labelIcon="flag" onPress={() => {}} /> },
    ],
  },
  states: {
    itemsFill: true,
    items: [
      { key: 'editable', name: 'Editable (focus it and type)', node: <Editable /> },
      { key: 'editable-filled', name: 'Editable, filled', node: <Editable initial={VALUE} /> },
      { key: 'picker-filled', name: 'Picker, filled', node: <InputField label={LABEL} value={VALUE} onPress={() => {}} /> },
      { key: 'picker-active', name: 'Picker, active (clear button shown)', node: <ActivePicker /> },
      { key: 'optional', name: 'Optional marker (resting label only)', node: <Editable optional /> },
      { key: 'value-icon', name: 'Value with icon', node: <InputField label="Walk time" value="8 min" valueIcon="footprints" /> },
      { key: 'value-accent', name: 'Accent value', node: <InputField label="Arrive by" value="9:12 AM" valueAccent onPress={() => {}} /> },
      { key: 'read-only', name: 'Read-only (no editable, no onPress)', node: <InputField label={LABEL} value={VALUE} /> },
      { key: 'disabled', name: 'Disabled', node: <InputField label="Arrive by" value="9:12 AM" disabled /> },
    ],
  },
});
