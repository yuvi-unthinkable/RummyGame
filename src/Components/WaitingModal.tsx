import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';

type WaitingModalProps = {
  visible: boolean;
  onClose: () => void;
  heading: string;
  button1: string; // e.g., "Leave"
  joinedPlayers:number;
  playerCount:number;

};

export default function WaitingModal({
  visible,
  onClose,
  heading,
  button1,
  joinedPlayers,
  playerCount,
}: WaitingModalProps) {
  // Assuming roomId logic might be expanded later, keeping as is.
  const [roomId, setRoomId] = useState(0);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Visual Anchor: The Spinner */}
          <View style={styles.indicatorContainer}>
            <ActivityIndicator size="large" color="#22c55e" />
          </View>

          {/* Text Content */}
          <Text style={styles.title}>{heading}</Text>
          <Text style={styles.subtext}>
            We are looking for opponents...{'\n'}
            Kindly wait for other players to join.
          </Text>
          <Text style={styles.subtext}>
            Players Joined  : {joinedPlayers}/{playerCount}
          </Text>

          {/* Divider Line (Optional) */}
          <View style={styles.divider} />

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.cancelBtn]}
              onPress={onClose}
              android_ripple={{ color: '#3f3f46' }}
            >
              <Text style={styles.cancelText}>{button1}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)', // Slightly darker for better focus
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '85%',
    maxWidth: 340,
    backgroundColor: '#18181b', // Zinc-900
    borderRadius: 20, // Softer corners
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272a',
    // Shadows for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  indicatorContainer: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    width: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(34, 197, 94, 0.1)', // Subtle green glow behind spinner
    alignSelf: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f4f4f5',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    color: '#a1a1aa', // Zinc-400
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#27272a',
    marginBottom: 20,
    width: '100%',
  },
  actions: {
    flexDirection: 'row',
    gap: 12, // Modern spacing (check React Native version, use marginLeft on child if < 0.71)
    justifyContent: 'space-between',
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#27272a', // Zinc-800
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  cancelText: {
    color: '#e4e4e7',
    fontSize: 15,
    fontWeight: '500',
  },
  primaryBtn: {
    backgroundColor: '#22c55e', // Green-500
  },
  primaryText: {
    color: '#052e16',
    fontSize: 15,
    fontWeight: '600',
  },
});
