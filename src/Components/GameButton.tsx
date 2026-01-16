import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';

type GameButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
};

export function GameButton({
  title,
  onPress,
  disabled = false,
  danger = false,
}: GameButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        danger && styles.danger,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2E86DE',
    paddingHorizontal: 18,
  },

  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },

  disabled: {
    opacity: 0.35,
  },

  danger: {
    backgroundColor: '#D63031',
  },

  text: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
