import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { defineCatalogPage } from '@krapwoo/ds-viewer';
import { Button } from '../Button';
import { Tooltip } from './Tooltip';

const styles = StyleSheet.create({
  // Tooltip demos — the bubble is an absolutely-positioned overlay above/below the trigger, sized
  // relative to the trigger's own tiny box, not this box. A fixed-height box with the trigger
  // centred inside gives the bubble equal clearance whichever direction it points, so stacked items
  // (States/Configurations renders 5 of these one after another) don't crowd or overlap each other.
  tooltipDemoBox: { height: 80, alignItems: 'center', justifyContent: 'center' },
});

function TooltipDemo() {
  const [visible, setVisible] = useState(true);
  return (
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
  );
}

export default defineCatalogPage({
  component: 'Tooltip',
  group: 'Components',
  whenToUse: 'A brief floating label for a control whose purpose an icon alone doesn\'t carry. It measures the trigger\'s real screen position, so the bubble stays inside the screen\'s edges and the arrow still points at the trigger\'s true centre. For something the reader must acknowledge, use Dialog.',
  specimenSize: 'regular',
  description: 'A small floating label anchored above or below its wrapped trigger. Fully controlled — drive `visible` from the trigger\'s own onLongPress/onPressIn, since mobile has no hover.',
  a11y: 'The bubble is a plain, non-interactive View; the trigger you wrap it around carries its own accessibility.',
  variants: {
    items: [
      {
        key: 'default',
        name: 'Default (tap to toggle)',
        props: { placement: 'top', align: 'center' },
        node: (
          <View style={styles.tooltipDemoBox}>
            <TooltipDemo />
          </View>
        ),
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
          <View style={styles.tooltipDemoBox}>
            <Tooltip visible label="Tap to add a stop" placement="bottom">
              <Button variant="ghost" size="medium" showIcon showLabel={false} iconName="add" accessibilityLabel="Add stop" onPress={() => {}} />
            </Tooltip>
          </View>
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
          <View style={styles.tooltipDemoBox}>
            <Tooltip visible label="Top left" placement="bottom" align="left">
              <Button variant="ghost" size="medium" showIcon showLabel={false} iconName="add" accessibilityLabel="Add stop" onPress={() => {}} />
            </Tooltip>
          </View>
        ),
      },
      {
        key: 'top-right',
        name: 'Top-right arrow',
        props: { placement: 'bottom', align: 'right' },
        node: (
          <View style={styles.tooltipDemoBox}>
            <Tooltip visible label="Top right" placement="bottom" align="right">
              <Button variant="ghost" size="medium" showIcon showLabel={false} iconName="add" accessibilityLabel="Add stop" onPress={() => {}} />
            </Tooltip>
          </View>
        ),
      },
      {
        key: 'bottom-left',
        name: 'Bottom-left arrow',
        props: { placement: 'top', align: 'left' },
        node: (
          <View style={styles.tooltipDemoBox}>
            <Tooltip visible label="Bottom left" placement="top" align="left">
              <Button variant="ghost" size="medium" showIcon showLabel={false} iconName="add" accessibilityLabel="Add stop" onPress={() => {}} />
            </Tooltip>
          </View>
        ),
      },
      {
        key: 'bottom-right',
        name: 'Bottom-right arrow',
        props: { placement: 'top', align: 'right' },
        node: (
          <View style={styles.tooltipDemoBox}>
            <Tooltip visible label="Bottom right" placement="top" align="right">
              <Button variant="ghost" size="medium" showIcon showLabel={false} iconName="add" accessibilityLabel="Add stop" onPress={() => {}} />
            </Tooltip>
          </View>
        ),
      },
    ],
  },
});
