import { makeMutable } from 'react-native-reanimated';
import { CardState, useDeck } from '../Components/cardTypes';
import { useWindowDimensions } from 'react-native';
import { useEffect, useMemo } from 'react';
import { CardData } from '../Components/Playground';
import { database } from '../context/Firebase';
import { getDatabase, onValue, ref } from '@react-native-firebase/database';
import { Player } from './Room';

export type NetworkCard = {
  id: number;
  owner: string;
  state: CardState;
  indexInHand: number;
  priority: number;
};

export function useGameStarted(
  roomId: number,
  gameStarted: boolean,
  players?: Record<string, Player>,
) {
  const cardDeck = useDeck();
  const { width, height } = useWindowDimensions();

  const cardWidth = width * 0.1;
  const cardHeight = cardWidth * 1.2;

  const deckX = width / 2 - cardWidth / 2;
  const deckY = height / 2 - cardHeight / 2;

  const db = getDatabase();

  const cardSharedValues = useMemo(() => {
    return Array.from({ length: 52 }).map(() => ({
      x: makeMutable(deckX),
      y: makeMutable(deckY),
      state: makeMutable<CardState>('deck'),
      faceup: makeMutable(false),
      owner: makeMutable<string>('unset'),
      indexInHand: makeMutable<number | null>(null),

      playerTarget: makeMutable({ x: 0, y: 0 }),
      handTarget: makeMutable({ x: 0, y: 0 }),
      showTarget: makeMutable({ x: 0, y: 0 }),
    }));
  }, [deckX, deckY]);

  useEffect(() => {
    if (!gameStarted) {
      cardSharedValues.forEach(shared => {
        shared.x.value = deckX;
        shared.y.value = deckY;
        shared.state.value = 'deck';
        shared.faceup.value = false;
        shared.owner.value = 'unset';
        shared.indexInHand.value = null;

        shared.playerTarget.value = { x: 0, y: 0 };
        shared.handTarget.value = { x: 0, y: 0 };
        shared.showTarget.value = { x: 0, y: 0 };
      });
    }
  }, [gameStarted, roomId, deckX, deckY]);

  const cards: CardData[] = useMemo(() => {
    if (!cardDeck.length) return [];

    return cardDeck.map((meta, i) => {
      const shared = cardSharedValues[i];

      return {
        meta,
        x: shared.x,
        y: shared.y,
        state: shared.state,
        faceup: shared.faceup,
        owner: shared.owner,
        indexInHand: shared.indexInHand,
        cardFaceImg: meta.image,
        playerTarget: shared.playerTarget,
        handTarget: shared.handTarget,
        showTarget: shared.showTarget,
      };
    });
  }, [cardDeck, cardSharedValues]);

  useEffect(() => {
    if (!roomId || !cards.length) return;

    const roomRef = ref(db, `room/${roomId}`);

    return onValue(roomRef, snapshot => {
      const room = snapshot.val();
      if (!room?.cards) return;

      Object.entries(room.cards).forEach(([id, raw]) => {
        const netCard = raw as NetworkCard;
        const card = cards.find(c => c.meta.id === Number(id));
        if (!card) return;
        card.meta.id = netCard.id;
        card.owner.value = netCard.owner;
        card.state.value = netCard.state;
        card.indexInHand.value = netCard.indexInHand ?? null;
        card.meta.priority = netCard.priority;
      });
    });
  }, [roomId, cards, gameStarted, players]);

  return cards;
}
