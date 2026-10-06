import React, { type ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { DS_RADIUS, DS_SEMANTIC } from '../../../tokens';
import { Divider } from '../Divider';

export interface ListProps {
  /** ListItem elements, stacked with a Divider automatically inserted between each consecutive
   *  pair — never after the last. */
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Stacks ListItem rows on a rounded white surface, with a Divider between each pair — the same
 *  "insert a divider between, never after the last" mechanism the catalog's own DividedStack uses. */
export function List({ children, style }: ListProps) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.list, style]}>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {child}
          {i < items.length - 1 && <Divider />}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
    borderRadius: DS_RADIUS.medium,
    overflow: 'hidden',
    backgroundColor: DS_SEMANTIC.surface.white,
  },
});
