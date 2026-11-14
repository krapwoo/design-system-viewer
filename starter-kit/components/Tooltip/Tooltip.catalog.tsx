import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { defineCatalogPage, PhoneFrame } from '@krapwoo/ds-viewer';
import { Button } from '../Button';
import { Card } from '../Card';
import { OverlayHost } from '../OverlayHost';
import { Tooltip } from './Tooltip';

const styles = StyleSheet.create({
  // Fills the phone edge to edge (PhoneFrame centres and shrinks its children otherwise), so the
  // OverlayHost inside it covers the whole device and its origin is the phone's own.
  frame: { flex: 1, alignSelf: 'stretch' },
  // Tooltip demos — the bubble is an absolutely-positioned overlay above/below the trigger, sized
  // relative to the trigger's own tiny box, not this box. A fixed-height box with the trigger
  // centred inside gives the bubble equal clearance whichever direction it points. This is the
  // demo's box, not part of Tooltip.
  tooltipDemoBox: { height: 120, alignItems: 'center', justifyContent: 'center' },
  // The clipping proof: a small rounded Card that clips (`overflow: 'hidden'`) with the trigger well
  // inside it, so a bubble drawn in place would be cut off at the card's edge.
  clipCard: { width: 120, overflow: 'hidden', alignItems: 'center' },
});

/** Every example is a phone with an OverlayHost inside it, so the host's coordinate space is the
 *  phone's (not the catalog page's) and the examples show the real path, not the in-place fallback. */
function Phone({ children }: { children: React.ReactNode }) {
  return (
    <PhoneFrame>
      <View style={styles.frame}>
        <OverlayHost>
          <View style={styles.frame}>{children}</View>
        </OverlayHost>
      </View>
    </PhoneFrame>
  );
}

const LONG_LABEL = 'Tap to add a stop to your trip. Stops can be reordered later from the list.';

function TooltipDemo() {
  const [visible, setVisible] = useState(true);
  return (
    <Phone>
      <View style={styles.tooltipDemoBox}>
        <Tooltip visible={visible} label="Tap to add a stop">
          <Button
            variant="ghost"
            size="medium"
            showIcon
            showLabel={false}
            iconName="add"
            accessibilityLabel="Add stop"
            onPress={() => setVisible((v) => !v)}
          />
        </Tooltip>
      </View>
    </Phone>
  );
}

/** The fix, shown: the trigger sits inside a rounded, `overflow: 'hidden'` Card, and the bubble reaches
 *  well beyond the Card on every side. Drawn in place it would be cut off at the Card's edge. */
function Clipped() {
  return (
    <Phone>
      <View style={styles.tooltipDemoBox}>
        <Card style={styles.clipCard}>
          <Tooltip visible label={LONG_LABEL}>
            <Button variant="ghost" size="medium" showIcon showLabel={false} iconName="add" accessibilityLabel="Add stop" onPress={() => {}} />
          </Tooltip>
        </Card>
      </View>
    </Phone>
  );
}

export default defineCatalogPage({
  component: 'Tooltip',
  group: 'Components',
  whenToUse: 'A brief floating label for a control whose purpose an icon alone doesn\'t carry. It measures the trigger\'s real screen position, so the bubble stays inside the screen\'s edges and the arrow still points at the trigger\'s true centre. For something the reader must acknowledge, use Dialog.',
  // Every example is a phone; at a narrower size the 375px device scales down. 'wide' keeps the width it is laid out at.
  specimenSize: 'wide',
  composedOf: [
    { component: 'OverlayHost', role: 'The layer the bubble is drawn into. Mount one near the app root; without it the bubble is drawn in place and can be clipped.', relationship: 'related' },
  ],
  description:
    'A small dark bubble with an arrow, shown above or below the element it wraps. It is fully controlled: the bubble is on screen exactly while `visible` is true, and nothing inside the component shows or hides it. It is drawn into the app\'s OverlayHost, at the trigger\'s on-screen position, so no scrolling or `overflow: hidden` ancestor can clip it. It measures the trigger and the bubble, centres the bubble on the trigger (or lines up its left or right edge with `align`), clamps it to stay inside the window, and always points the arrow at the trigger\'s true centre. The label wraps rather than truncating, up to 80% of the window width.',
  a11y:
    'The bubble is a View with `pointerEvents="none"` (so it cannot be tapped or focused) and accessibilityLiveRegion="polite", the one accessibility behaviour it has: in React Native that prop is an Android prop, so whether iOS VoiceOver announces the label when the bubble mounts was not checked, and on web it maps to aria-live. The bubble is not focusable and nothing traps focus: it is drawn into the OverlayHost\'s layer, which is not a Modal, so it takes no screen-reader focus and the rest of the screen stays reachable. There is no tooltip role, and the trigger is not linked to the bubble (no accessibilityHint, no described-by), so a screen reader on the trigger does not read the label unless the live region happens to fire. NOT VERIFIED ON A DEVICE: the order in which TalkBack and VoiceOver announce the live region relative to the trigger, and whether a bubble mounted in the host layer (outside the trigger\'s own subtree) is announced at all on iOS. The trigger has to carry its own accessible name; the label should not be the only place that name exists. The component handles no input at all: no long-press, hover, focus or Escape, and no timer, so showing it from keyboard focus, and dismissing it, are entirely the caller\'s work. Nothing animates (the bubble appears and disappears at once), so reduce-motion does not apply. The label is 12pt body text (bodyXs) in text.inverse on surface.inverse; its contrast was not measured here. Placement does not flip if there is no room above or below, only the horizontal position is clamped.',
  notes: [
    '`visible` and `label` are required. `placement` defaults to `top`, `align` to `center`.',
    '`align` is a preference only: the bubble is clamped to 8pt inside the window edges, and the arrow still points at the trigger.',
    'It needs an `OverlayHost` near the app root to escape clipping. With one, the bubble is drawn in the host\'s layer at the trigger\'s window position minus the host\'s own origin (the host is not assumed to sit at 0,0), and is invisible until the trigger and the bubble are measured. With none, it is drawn in place beside the trigger as before, can be clipped by an ancestor, and warns once in development; it never throws.',
    'It re-measures the trigger when it becomes visible and when the window is resized, one frame later. A trigger that scrolls or moves while its tooltip is showing leaves the bubble behind: there is no scroll tracking, which a transient hint does not need.',
    '`style` is applied to the bubble, not to the wrapper around the trigger.',
    'The wrapper shrinks to the trigger\'s own size (`alignSelf: flex-start`), so a Tooltip inside a wider row does not stretch.',
    'Its width rule uses the web-only CSS value `max-content` (cast through `unknown`); native layout ignores it.',
  ],
  variants: {
    items: [
      {
        key: 'default',
        name: 'Default (tap to toggle)',
        props: { placement: 'top', align: 'center' },
        node: <TooltipDemo />,
      },
    ],
  },
  states: {
    // No `itemsFill`: these specimens are a small icon trigger with a floating bubble, not a
    // block-level component that wants the row's width. Filling pins the trigger to the cell's
    // left edge (a filled specimen aligns to start, which is right for a Banner and wrong here),
    // and the bubble — which centres on its trigger — then overflows the cell and is clipped.
    items: [
      {
        key: 'bottom',
        name: 'Placement: bottom',
        props: { placement: 'bottom' },
        node: (
          <Phone>
            <View style={styles.tooltipDemoBox}>
              <Tooltip visible label="Tap to add a stop" placement="bottom">
                <Button variant="ghost" size="medium" showIcon showLabel={false} iconName="add" accessibilityLabel="Add stop" onPress={() => {}} />
              </Tooltip>
            </View>
          </Phone>
        ),
      },
      {
        // The arrow always attaches to whichever bubble edge faces the trigger — so a
        // placement="bottom" bubble (sitting below the trigger) has its arrow on its own TOP
        // edge, not its bottom. Naming/labels below describe the arrow's actual visual corner on
        // the bubble, not the `placement` value, since that's what a reader looking at the
        // rendered example actually sees.
        key: 'top-left',
        name: 'Top-left arrow',
        props: { placement: 'bottom', align: 'left' },
        node: (
          <Phone>
            <View style={styles.tooltipDemoBox}>
              <Tooltip visible label="Top left" placement="bottom" align="left">
                <Button variant="ghost" size="medium" showIcon showLabel={false} iconName="add" accessibilityLabel="Add stop" onPress={() => {}} />
              </Tooltip>
            </View>
          </Phone>
        ),
      },
      {
        key: 'top-right',
        name: 'Top-right arrow',
        props: { placement: 'bottom', align: 'right' },
        node: (
          <Phone>
            <View style={styles.tooltipDemoBox}>
              <Tooltip visible label="Top right" placement="bottom" align="right">
                <Button variant="ghost" size="medium" showIcon showLabel={false} iconName="add" accessibilityLabel="Add stop" onPress={() => {}} />
              </Tooltip>
            </View>
          </Phone>
        ),
      },
      {
        key: 'bottom-left',
        name: 'Bottom-left arrow',
        props: { placement: 'top', align: 'left' },
        node: (
          <Phone>
            <View style={styles.tooltipDemoBox}>
              <Tooltip visible label="Bottom left" placement="top" align="left">
                <Button variant="ghost" size="medium" showIcon showLabel={false} iconName="add" accessibilityLabel="Add stop" onPress={() => {}} />
              </Tooltip>
            </View>
          </Phone>
        ),
      },
      {
        key: 'bottom-right',
        name: 'Bottom-right arrow',
        props: { placement: 'top', align: 'right' },
        node: (
          <Phone>
            <View style={styles.tooltipDemoBox}>
              <Tooltip visible label="Bottom right" placement="top" align="right">
                <Button variant="ghost" size="medium" showIcon showLabel={false} iconName="add" accessibilityLabel="Add stop" onPress={() => {}} />
              </Tooltip>
            </View>
          </Phone>
        ),
      },
      { key: 'clipped', name: 'Inside a clipping container (not clipped)', props: {}, node: <Clipped /> },
    ],
  },
});
