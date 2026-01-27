import { StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { CardData, LogicalCard, playerId } from './Playground';
import { getHandForPlayer } from '../Utility/getPlayerHands';
import { RoomData } from '../Backend/Room';
import { NetworkCard } from '../Backend/useGameStarted';
import { removeHighestCards } from '../services/RemoveCard';

export default async function Bot(
  room: RoomData,
  roomId: number,
  setCardSent: React.Dispatch<React.SetStateAction<boolean>>,
  logicalCards: LogicalCard[],
  playerId: playerId,
  cards: CardData[],
) {
  const hand = getHandForPlayer(room, playerId);
  if (hand.length === 0) return;

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
  console.log('🚀 ~ Bot ~ highest:', highest);
  console.log('🚀 ~ Bot ~ prevSum:', prevSum);
  console.log('🚀 ~ Bot ~ remaining:', remaining);

const SendingCard = cards.find(
  c => c.meta.id === removableCards[0].id
);
  if (SendingCard)
    await removeHighestCards(
      room,
      roomId,
      setCardSent,
      logicalCards,
      SendingCard,
      playerId,
    );
}

const styles = StyleSheet.create({});
