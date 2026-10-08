import React from 'react';
import { Pressable, Text } from 'react-native';

export interface ButtonProps {
  /** Button label. @default 'Button' */
  label?: string;
  /** Called when pressed. */
  onPress: () => void;
}

function ButtonImpl({ label = 'Button', onPress }: ButtonProps) {
  return (
    <Pressable onPress={onPress}>
      <Text>{label}</Text>
    </Pressable>
  );
}

export const Button = React.memo(ButtonImpl);
