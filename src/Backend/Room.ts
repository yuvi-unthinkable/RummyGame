import { StyleSheet, Text, View } from 'react-native';
import React, { useEffect } from 'react';
import { useRSXformBuffer } from '@shopify/react-native-skia';
import Playground, { CardData } from '../Components/Playground';
import GameStart from './GameStart';
import { database } from '../context/Firebase';
import { child, get, ref, set, update } from 'firebase/database';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { signInAnonymously } from 'firebase/auth';
import { useUser } from '../context/UserContext';

export type RoomData = {
  roomId: number;
  playerCount: number;
  ownerId: number;
  createdAt: string;
  players: Player[];
  status: 'waiting' | 'playing' | 'ended';
};

export type Player = {
  userId: string;
  position?: string;
  connected: boolean;
  dropped: boolean;
  hand?: CardData[];
};

const currentTimeString = new Date().toLocaleTimeString();

const room1: RoomData = {
  roomId: 123456,
  playerCount: 2,
  ownerId: 1,
  createdAt: currentTimeString,
  status: 'waiting',
  players: [],
};

export async function createRoom() {
  // const user = await getCurrentUser();
  // console.log('🚀 ~ createRoom ~ user:', user);

  // const user = useUser();

  // if (user) console.log('user..................', user);

  writeToFirebase(
    room1.roomId.toString(),
    room1.playerCount,
    room1.ownerId,
    room1.createdAt,
    room1.status,
    room1.players,
  );
}

export const JoinRoom = async (roomId: number, player: Player, uid: string) => {
  console.log('hi from join room please wait....');

  const roomRef = ref(database);

  player.userId = uid;

  try {
    const snapshot = await get(child(roomRef, `room/${roomId}`));

    if (!snapshot.exists()) {
      console.error('Room does not exist');
      return;
    }

    const roomData = snapshot.val() as RoomData;

    const currentPlayer = roomData.players || [];

    const isAlreadyjoined = currentPlayer.some(p => p.userId === player.userId);

    if (isAlreadyjoined) {
      console.log('player is already in this room. ');
      return;
    }

    const updatedPlayer = [...currentPlayer, player];
    const isNowFull = updatedPlayer.length === roomData.playerCount;

    const updates: any = {
      [`room/${roomId}/players`]: updatedPlayer,
    };

    if (isNowFull) {
      updates[`room/${roomId}/status`] = 'playing';
    }

    await update(ref(database), updates);
    console.log('player joined sucessfully');

    if (isNowFull) {
      console.log('room is ful. Starting game...');
      GameStart(updatedPlayer, roomData.playerCount);
    }
  } catch (error) {
    console.log('🚀 ~ JoinRoom ~ error:', error);
  }
};

const db = database;

const writeToFirebase = async (
  roomid: string,
  playerCount: number,
  ownerId: number,
  createdAt: string,
  status: 'waiting' | 'playing' | 'ended',
  players: Player[],
) => {
  console.log('hiiiii from new room');
  try {
    // Use the 'set' function with a database reference
    await set(ref(database, `room/${roomid}`), {
      roomId: roomid,
      playerCount: playerCount,
      ownerId: ownerId,
      createdAt: createdAt,
      status: status,
      players: players,
    });
    console.log('Success: Data saved to Firebase!');
  } catch (error) {
    console.log('🚀 ~ writeToFirebase ~ error:', error);
  }
};

export default function Room() {
  const currentTimeString = new Date().toLocaleTimeString();
}

const styles = StyleSheet.create({});
