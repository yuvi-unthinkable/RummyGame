import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type EndModalProps = {
  visible: boolean;
  player?: string | null; 
  onClose: () => void;
  onProceed: () => void; 
  heading: string;
  message: string;
  button1: string;
  button2: string;
};

export default function EndModal({
  visible,
  onClose,
  onProceed,
  heading,
  message,
  button1,
  button2,
}: 
EndModalProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.contentContainer}>
            <Text style={styles.title}>{heading}</Text>
            <Text style={styles.description}>{message}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.secondaryBtn]}
              onPress={onClose}
              android_ripple={{ color: '#3f3f46' }}
            >
              <Text style={styles.secondaryBtnText}>{button1}</Text>
            </Pressable>

            <Pressable
              style={[styles.btn, styles.primaryBtn]}
              onPress={onProceed}
              android_ripple={{ color: '#bbf7d0' }}
            >
              <Text style={styles.primaryBtnText}>{button2}</Text>
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
    backgroundColor: 'rgba(0,0,0,0.8)', 
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '85%',
    maxWidth: 340,
    backgroundColor: '#18181b',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  contentContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f4f4f5', 
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#a1a1aa', 
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#27272a',
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12, 
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3f3f46', 
  },
  secondaryBtnText: {
    color: '#e4e4e7', 
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: '#22c55e', 
  },
  primaryBtnText: {
    color: '#052e16', 
    fontSize: 14,
    fontWeight: '700',
  },
});
