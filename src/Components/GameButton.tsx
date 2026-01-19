import React from 'react';
import { Pressable, Text, StyleSheet, Platform } from 'react-native';

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
      // Using android_ripple for better native feel
      android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
      style={({ pressed }) => [
        styles.button,
        danger ? styles.danger : styles.primary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.text, disabled && styles.disabledText]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52, // Slightly taller for better touch targets
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginVertical: 6,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  // Default "Join/Create Room" style
  primary: {
    backgroundColor: '#27272a', // Zinc-800
    borderColor: '#3f3f46', // Zinc-700
  },

  // "End Turn / Quit" style
  danger: {
    backgroundColor: '#7f1d1d', // Deep Red (Darker, more premium)
    borderColor: '#b91c1c', 
  },

  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }], // Visual feedback of "pressing down"
  },

  disabled: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
    opacity: 0.5,
  },

  text: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase', // Consistent with the gaming modals
    letterSpacing: 0.8,
  },

  disabledText: {
    color: '#52525b',
  },
});