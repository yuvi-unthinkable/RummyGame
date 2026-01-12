import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import React from 'react';

type endModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function EndModal({ visible, onClose }: endModalProps) {
  console.log('called reached to the component');

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.wrapper}>
        <View style={styles.box}>
          <View>
            <Text style={styles.title}>Waiting</Text>
            <Text style={styles.description}>
              Please wait while other player are joining...
            </Text>
          </View>
          <View
            style={{
              width: '100%',
              flexDirection: 'row',
              justifyContent: 'space-around',
            }}
          >
            <Pressable onPress={onClose}>
              <Text style={styles.btn}>Cancel</Text>
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
