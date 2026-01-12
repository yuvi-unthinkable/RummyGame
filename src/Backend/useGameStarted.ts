import { makeMutable } from 'react-native-reanimated';
import { CardState, useDeck } from '../Components/cardTypes';
import { useWindowDimensions } from 'react-native';
import { useEffect, useMemo } from 'react';
import { CardData } from '../Components/Playground';
import { database } from '../context/Firebase';
import { onValue } from '@react-native-firebase/database';

export type NetworkCard = {
  owner: string;
  state: CardState;
  faceup: boolean;
  indexInHand?: number;
};

export function useGameStarted(roomId: number, _gameStarted: boolean) {
  const cardDeck = useDeck();
  const { width, height } = useWindowDimensions();

  const cardWidth = width * 0.1;
  const cardHeight = cardWidth * 1.2;

  const deckX = width / 2 - cardWidth / 2;
  const deckY = height / 2 - cardHeight / 2;

  /**
   * 1️⃣ SharedValues — created ONCE per device
   */
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

  /**
   * 2️⃣ Card objects — ALWAYS CREATED
   */
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

  /**
   * 3️⃣ Firebase → SharedValue hydration
   */
  useEffect(() => {
    if (!roomId || !cards.length) return;

    const roomRef = database().ref(`room/${roomId}`);

    return onValue(roomRef, snapshot => {
      const room = snapshot.val();
      if (!room?.cards) return;

      Object.entries(room.cards).forEach(([id, raw]) => {
        const netCard = raw as NetworkCard;
        const card = cards.find(c => c.meta.id === Number(id));
        if (!card) return;

        card.owner.value = netCard.owner;
        card.state.value = netCard.state;
        card.faceup.value = netCard.faceup;
        card.indexInHand.value = netCard.indexInHand ?? null;
      });
    });
  }, [roomId, cards]);

  return cards;
}
