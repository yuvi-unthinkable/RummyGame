import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import React, { useState } from 'react';
import { Dropdown } from 'react-native-element-dropdown';

type JoinGameRoomModalProps = {
  visible: boolean;
  player?: string;
  onClose: () => void;
  onProceed: (roomId:number) => void;
  heading: string;
  button1: string;
  button2: string;
};

const data = [
  { label: '2 Players', value: 2 },
  { label: '3 Players', value: 3 },
  { label: '4 Players', value: 4 },
  { label: '5 Players', value: 5 },
  { label: '6 Players', value: 6 },
];

export default function JoinGameRoomModal({
  visible,
  onClose,
  onProceed,
  heading,
  button1,
  button2,
}: JoinGameRoomModalProps) {
  const [roomId, setRoomId] = useState(0);
  const [playersCount, setPlayersCount] = useState(2);

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>{heading}</Text>

          <TextInput
            value={roomId ? roomId.toString() : ''}
            onChangeText={text => {
              const numeric = text.replace(/[^0-9]/g, '');
              setRoomId(numeric ? parseInt(numeric, 10) : 0);
            }}
            keyboardType="numeric"
            placeholder="Enter Room ID"
            placeholderTextColor="#9ca3af"
            style={styles.input}
          />


          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{button1}</Text>
            </Pressable>

            <Pressable style={styles.primaryBtn} onPress={()=>onProceed(roomId)}>
              <Text style={styles.primaryText}>{button2}</Text>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modal: {
    width: '85%',
    maxWidth: 360,
    backgroundColor: '#18181b', // dark surface
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
  },

  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f4f4f5',
    marginBottom: 18,
    textAlign: 'center',
    letterSpacing: 0.4,
  },

  input: {
    height: 48,
    borderRadius: 8,
    backgroundColor: '#27272a',
    color: '#f4f4f5',
    paddingHorizontal: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },



  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
  },

  cancelText: {
    color: '#a1a1aa',
    fontSize: 15,
  },

  primaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    backgroundColor: '#22c55e',
    borderRadius: 8,
  },

  primaryText: {
    color: '#052e16',
    fontSize: 15,
    fontWeight: '600',
  },
});

