import { StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { playerId } from './Playground';
import { RoomData } from '../Backend/Room';
import { NetworkCard } from '../Backend/useGameStarted';
import { removeHighestCards } from '../services/RemoveCard';
import { getRoomSnap } from '../services/db.service';

export default async function Bot(
  roomId: number,
  setCardSent: React.Dispatch<React.SetStateAction<boolean>>,
  playerId: playerId,
) {
  console.log('bot working for player >>>>>>>>> ', playerId);

  const roomSnap = await getRoomSnap(roomId);
  if (roomSnap === null) return;
  const map = roomSnap.players[playerId]?.handCards;
  const hand = map ? Object.values(map).filter(Boolean) : [];
  // const hand = getHandForPlayer(room, playerId);
  if (hand.length === 0) return;

  console.log('i want to print');
  console.log('🚀 ~ Bot ~ hand:>>>>>>>>>>>>>>>>>>>>>>', hand);

  const highest = Math.max(...hand.map(c => c.priority));

  let removableCards: NetworkCard[] = hand.filter(
    card => card.priority === highest,
  );

  let remaining = hand.filter(c => c.priority !== highest);

  let pair: NetworkCard[] = [];
  let prevPair: NetworkCard[] = [];
  let prevSum = 0;
  for (let i = 0; i < hand.length - 1; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      if (hand[i].priority === hand[j].priority) {
        pair.push(hand[i]);
        pair.push(hand[j]);
      }
    }
    const tempSum = pair.reduce((acc, n) => acc + n.priority, 0);
    prevSum = prevPair.reduce((acc, n) => acc + n.priority, 0);

    if (prevSum < tempSum) {
      prevPair = [...pair];
    }
  }

  if (prevSum >= highest) {
    removableCards = [...prevPair];
    remaining = hand.filter(c => c.priority !== prevPair[0].priority);
  }

  if (removableCards.length === 0) return;

  await removeHighestCards(roomId, setCardSent, removableCards[0].id, playerId);
}

const styles = StyleSheet.create({});
