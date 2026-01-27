import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';

type RulesModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function RulesModal({ visible, onClose }: RulesModalProps) {
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


          <Text style={styles.title}>Rules</Text>
          <Text style={styles.subtext}>
            1. You must take a card from the deck or from the previous cards
            before sending a card.{'\n'}
            2. You can pick or send only one card at a time.{'\n'}
            3. If you pick a card from previous cards, you must wait until the
            next turn to send that card or other cards of the same priority.
            {'\n'}
            4. A card picked from previous cards cannot be used as the last card
            in the same turn.{'\n'}
            5. All cards of the same priority can be sent at once.{'\n'}
            6. Highlighted cards denotes turn.{'\n'}
            7. The player who finishes their hand first or has the lowest total
            priority sum when the game ends wins the game.
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
              <Text style={styles.cancelText}>Close</Text>
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
