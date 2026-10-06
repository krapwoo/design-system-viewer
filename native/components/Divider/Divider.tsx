import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { DS_SEMANTIC } from '../../../tokens';

export interface DividerProps {
  style?: StyleProp<ViewStyle>;
}

/** A 1px hairline separator at the divider token colour. */
export function Divider({ style }: DividerProps) {
  return <View style={[styles.line, style]} />;
}

const styles = StyleSheet.create({
  line: {
    height: 1,
    width: '100%',
    backgroundColor: DS_SEMANTIC.element.divider,
  },
});
