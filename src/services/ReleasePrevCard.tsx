import { StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { getDatabase, ref, update } from '@react-native-firebase/database';
import { getApp } from '@react-native-firebase/app';
import { RoomData } from '../Backend/Room';
import { Card } from '../Components/cardTypes';
import { getHandForPlayer } from '../Utility/getPlayerHands';
import { getNextHandIndex } from '../Utility/getNextHandIndex';
import { CardData } from '../Components/Playground';

export async function ReleasePrevCard(
  room: RoomData,
  roomId: number,
  setCardSent: React.Dispatch<React.SetStateAction<boolean>>,
  setPrevCard: React.Dispatch<React.SetStateAction<CardData | undefined>>,
  myPlayerId: string,
) {
  const db = getDatabase(getApp());

  setCardSent(true);

  if (!room || !room.activePlayer || !myPlayerId) return;

  if (room?.status === 'ended') return;

  if (room.activePlayer !== myPlayerId) {
    console.log('[ReleasePrev] Not your turn');
    return;
  }

  if (!room.PreviousCard) {
    console.log('[ReleasePrev] No PreviousCard in room');
    return;
  }

  const prev = room.PreviousCard;

  if (prev.owner && prev.owner !== 'unset') {
    console.log('[ReleasePrev] PreviousCard already owned');
    return;
  }

  const handCards = getHandForPlayer(room, myPlayerId);
  const nextIndex = getNextHandIndex(handCards);

  const updates: Record<string, any> = {
    [`players/${myPlayerId}/handCards/${prev.id}`]: {
      ...prev,
      owner: myPlayerId,
      state: 'hand',
      indexInHand: nextIndex,
      priority: prev.priority,
    },
    PreviousCard: null,
    [`turnLocks/${myPlayerId}`]: {
      id: prev.id,
      blockedPriority: prev.priority,
      untilTurn: (room.turnNumber ?? 0) + 1,
    },
    turnNumber: (room.turnNumber ?? 0) + 1,
  };

  await update(ref(db, `room/${roomId}`), updates);

  setPrevCard(undefined);
}
