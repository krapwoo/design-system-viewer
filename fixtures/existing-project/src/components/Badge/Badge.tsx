import React from 'react';
import { Text } from 'react-native';

export interface BadgeProps {
  /** The badge's text. */
  label: string;
}

export function Badge({ label }: BadgeProps) {
  return <Text>{label}</Text>;
}
