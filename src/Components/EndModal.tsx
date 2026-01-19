import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import React from 'react';

type endModalProps = {
  visible: boolean;
  player?: string;
  onClose: () => void;
  onProceed?: () => void;
  heading: string;
  message: string;
  button1: string;
  button2: string;
};

export default function EndModal({
  visible,
  onClose,
  player,
  onProceed,
  heading,
  message,
  button1,
  button2,
}: endModalProps) {
  
  console.log('called reached to the component');

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.wrapper}>
        <View style={styles.box}>
          <View>
            <Text style={styles.title}>{heading}</Text>
            <Text style={styles.description}>{message}</Text>
          </View>
          <View
            style={{
              width: '100%',
              flexDirection: 'row',
              justifyContent: 'space-around',
            }}
          >
            <Pressable onPress={onClose}>
              <Text style={styles.btn}>{button1}</Text>
            </Pressable>
            <Pressable onPress={onProceed}>
              <Text style={[styles.btn, { color: 'green' }]}>{button2}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: { width: 300, padding: 20, borderRadius: 12, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '600', textTransform: 'uppercase' },
  description: { marginVertical: 20, textTransform: 'capitalize' },
  btn: { textAlign: 'right', color: 'blue' },
});
