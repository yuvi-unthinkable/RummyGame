import { StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { getDatabase, ref, update } from '@react-native-firebase/database';
import { getApp } from '@react-native-firebase/app';
import { RoomData } from '../Backend/Room';
import { Card } from '../Components/cardTypes';
import { getHandForPlayer } from '../Utility/getPlayerHands';
import { getNextHandIndex } from '../Utility/getNextHandIndex';

export async function ReleaseOneMoreCard(
  room: RoomData,
  roomId: number,
  setCardSent: React.Dispatch<React.SetStateAction<boolean>>,
  myPlayerId: string,
  cardDeck: Card[],
) {
  const db = getDatabase(getApp());

  setCardSent(true);

  if (!room || !room.deck?.order || !room.activePlayer) {
    console.log('[Release] Room not ready');
    return;
  }

  if (room?.status === 'ended') return;

  if (!myPlayerId || !room.players[myPlayerId]) {
    console.log('[Release] Player not registered');
    return;
  }

  if (room.activePlayer !== myPlayerId) {
    console.log('[Release] Not your turn');
    return;
  }

  const handCards = getHandForPlayer(room, myPlayerId);
  const targetCardId = room.deck.order[0];

  if (targetCardId == null) {
    console.log('[Release] No cards left in deck');
    return;
  }

  const nextIndex = getNextHandIndex(handCards);

  const updates: Record<string, any> = {
    [`players/${myPlayerId}/handCards/${targetCardId}`]: {
      id: targetCardId,
      owner: myPlayerId,
      state: 'hand',
      indexInHand: nextIndex,
      priority: cardDeck[targetCardId].priority,
    },
    deck: {
      order: room.deck.order.slice(1),
    },
    turnNumber: (room.turnNumber ?? 0) + 1,
  };

  await update(ref(db, `room/${roomId}`), updates);
}

const styles = StyleSheet.create({});
