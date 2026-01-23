import { StyleSheet, Text, View } from 'react-native';
import React, { useState } from 'react';
import { GameButton } from './GameButton';
import CreateGameRoomModal from './CreateGameRoomModal';
import JoinGameRoomModal from './JoinGameRoomModal';
import WaitingModal from './WaitingModal';
import { useUser } from '../context/UserContext';
import { createRoom, JoinRoom } from '../Backend/Room';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigators/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function Home() {
  const [CreateRoomModal, setCreateRoomModal] = useState(false);
  const [JoinRoomModal, setJoinRoomModal] = useState(false);
  const [playersCount, setPlayersCount] = useState(2);
  const [roomId, setRoomId] = useState(0);

  const navigation = useNavigation<NavigationProp>();

  const { user } = useUser();

  async function createRoomFunction(roomId: number, totalPlayers: number) {
    setPlayersCount(totalPlayers);
    setRoomId(roomId);
    if (user?.uid) {
      const created = await createRoom(user.uid, roomId, totalPlayers);
      if (created) {
        setCreateRoomModal(false);
        joinRoomFunction(roomId);
      }
    }
  }
  async function joinRoomFunction(roomId: number) {
    setRoomId(roomId);
    if (user?.uid) {
      const result = await JoinRoom(roomId, user.uid, user.username);

      if (result.gameStart) {
        setJoinRoomModal(false);
        setPlayersCount(result.playerCount);
        navigation.navigate('Playground',{roomid:roomId, playerCount:playersCount});
      }
    //   else{
    //     setWaitingRoomModal(true)
    //   }
    }
  }

  //   async function handleCancel() {
  //     setWaitingRoomModal(false);
  //     if (!room?.players) return;

  //     await set(ref(db, `room/${roomId}/players/${myId}`), null);

  //     playersOpenedCards.value = 0;
  //   }

  return (
    <>
      {CreateRoomModal && (
        <CreateGameRoomModal
          visible={CreateRoomModal}
          onClose={() => setCreateRoomModal(false)}
          onProceed={(roomId, totalPlayers) =>
            createRoomFunction(roomId, totalPlayers)
          }
          heading={'Create Room'}
          button1="Cancel"
          button2="Create"
        />
      )}
      {JoinRoomModal && (
        <JoinGameRoomModal
          visible={JoinRoomModal}
          onClose={() => setJoinRoomModal(false)}
          onProceed={roomId => joinRoomFunction(roomId)}
          heading={'Join Room'}
          button1="Cancel"
          button2="Join"
        />
      )}
    
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          borderColor: '#22c55e',
          borderWidth: 2,
        }}
      >
        <View style={{ gap: 10 }}>
          <GameButton
            title="Join Room"
            onPress={async () => {
              console.log(JoinRoomModal);
              setJoinRoomModal(true);
            }}
          />

          <GameButton
            title="Create Room"
            onPress={() => {
              console.log(CreateRoomModal);
              setCreateRoomModal(true);
            }}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({});
