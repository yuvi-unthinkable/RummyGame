import { Alert, StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { CardData, LogicalCard, playerId } from '../Components/Playground';
import { RoomData } from '../Backend/Room';
import { NetworkCard } from '../Backend/useGameStarted';
import { getDatabase, ref, update } from '@react-native-firebase/database';
import { getApp } from '@react-native-firebase/app';

export async function removeHighestCards(
  room: RoomData,
  roomId: number,
  setCardSent: React.Dispatch<React.SetStateAction<boolean>>,
  logicalCards: LogicalCard[],
  card: CardData,
  player: playerId,
) {
  const db = getDatabase(getApp());
  setCardSent(false);

  if (!room || !room.activePlayer) {
    console.log('room not ready');
    setCardSent(true);
    return;
  }
  if (room?.status === 'ended') {
    setCardSent(true);
    return;
  }

  const logical = logicalCards.find(c => c.id === card.meta.id);
  if (!logical) {
    setCardSent(true);
    return;
  }

  if (logical.owner !== player) {
    Alert.alert('Invalid Move', 'This card does not belong to you');
    setCardSent(true);
    return;
  }

  const handMap = room.players[player]?.handCards;
  if (!handMap) return;

  const handCards = Object.values(handMap).filter(Boolean);

  const currentTurn = room.turnNumber ?? 0;
  const lock = room.turnLocks?.[player];
  const isLocked = lock && currentTurn <= lock.untilTurn;
  const lockedId = isLocked ? lock.id : null;

  const clickedPriority = handMap[logical.id]?.priority;
  if (clickedPriority == null) {
    setCardSent(true);
    return;
  }

  const samePriority = handCards.filter(c => c.priority === clickedPriority);
  if (samePriority.length === 0) {
    setCardSent(true);
    return;
  }

  const allSamePriority = samePriority.length === handCards.length;

  if (!allSamePriority && lockedId === logical.id) {
    Alert.alert(
      'Invalid Move',
      'You cannot send the card you just picked from previous.',
    );
    setCardSent(true);
    return;
  }

  let newPrev: NetworkCard;
  let toCollect: NetworkCard[];

  if (allSamePriority && lockedId) {
    const availableToSend = samePriority.filter(c => c.id !== lockedId);

    if (availableToSend.length === 0) {
      Alert.alert('Invalid Move', 'No valid cards to send.');
      setCardSent(true);
      return;
    }

    const userClickedValid = availableToSend.some(c => c.id === logical.id);

    if (userClickedValid) {
      newPrev = handMap[logical.id];
    } else {
      newPrev = availableToSend[0];
    }

    toCollect = samePriority.filter(
      c => c.id !== newPrev.id && c.id !== lockedId,
    );
  } else {
    newPrev = handMap[logical.id];
    toCollect = samePriority.filter(c => c.id !== logical.id);
  }

  if (
    isLocked &&
    !allSamePriority &&
    lock.blockedPriority === handMap[logical.id]?.priority
  ) {
    Alert.alert('Invalid Move', 'You cannot send this priority level yet.');
    setCardSent(true);
    return;
  }

  const updates: Record<string, any> = {};

  const remainingHand = handCards.filter(
    c => c.id !== newPrev.id && !toCollect.some(tc => tc.id === c.id),
  );

  const didPlayerWin = remainingHand.length === 0;

  if (didPlayerWin) {
    updates.status = 'ended';
    updates.result = {
      winners: player,
      reason: 'empty-hand',
      endedAt: Date.now(),
    };

    updates.activePlayer = null;
  }

  if (room.PreviousCard) {
    updates[`abandonedCards/${room.PreviousCard.id}`] = {
      ...room.PreviousCard,
      state: 'collected',
      owner: 'unset',
      indexInHand: null,
    };
  }

  updates[`players/${player}/handCards/${newPrev.id}`] = null;

  toCollect.forEach(c => {
    updates[`players/${player}/handCards/${c.id}`] = null;
    updates[`abandonedCards/${c.id}`] = {
      ...handMap[c.id],
      state: 'collected',
      owner: 'unset',
      indexInHand: null,
    };
  });

  updates.PreviousCard = {
    ...newPrev,
    state: 'prevcard',
    owner: 'unset',
    indexInHand: null,
  };

  if (!didPlayerWin) {
    const players = Object.keys(room.players).sort(
      (a, b) => Number(a.slice(1)) - Number(b.slice(1)),
    );
    updates.activePlayer =
      players[(players.indexOf(player) + 1) % players.length];

    updates.turnNumber = currentTurn + 1;
  }

  remainingHand
    .sort((a, b) => (a.indexInHand ?? 0) - (b.indexInHand ?? 0))
    .forEach((c, i) => {
      updates[`players/${player}/handCards/${c.id}/indexInHand`] = i;
    });

  if (lock && currentTurn + 1 > lock.untilTurn) {
    updates[`turnLocks/${player}`] = null;
  }

  await update(ref(db, `room/${roomId}`), updates);
}
