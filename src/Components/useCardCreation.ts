import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import React, { useMemo } from 'react';
import { SkImage, useImage } from '@shopify/react-native-skia';
import { makeMutable, SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCard } from './usecard';

type CardData = {
  id: number;
  x: SharedValue<number>;
  y: SharedValue<number>;
  state: SharedValue<'deck' | 'player' | 'hand' | 'show'>;
  faceup: SharedValue<boolean>;
  owner: 'p1' | 'p2';
  cardFaceImg: SkImage | null;
  playerTarget: { x: number; y: number };
  handTarget: { x: number; y: number };
  showTarget: { x: number; y: number };
};

export default function CardCreation() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const CardFaces2 = useCard();

  // --- Dimensions ---
  const cardWidth = width * 0.12;
  const cardHeight = cardWidth * 1.4;
  const deckX = width / 2 - cardWidth / 2;
  const deckY = height / 2 - cardHeight / 2;
  const tableWidth = width * 0.8;
  const tableHeight = height * 0.5;
  const tableX = width / 2 - tableWidth / 2;
  const tableY = height / 2 - tableHeight / 2;

  const cardSharedValues = useMemo(() => {
    return Array.from({ length: 52 }).map(() => ({
      x: makeMutable(0),
      y: makeMutable(0),
      state: makeMutable<'deck' | 'player' | 'hand' | 'show'>('deck'),
      faceup: makeMutable(false),
    }));
  }, []);

  const userSize = 40;

  // Hand layout constants
  const cardsPerPlayer = 3;
  const spreadGap = cardWidth * 0.1;
  const totalCardsInHands = cardsPerPlayer;
  const maxCardSpread = totalCardsInHands - 1;
  const totalHandWidth =
    cardWidth * totalCardsInHands + maxCardSpread * spreadGap;
  const handStartX = width / 2 - totalHandWidth / 2;
  const user1HandY = height * 0.9 - 20;
  const user2HandY = height / 8 - userSize;

  const cards: CardData[] = useMemo(() => {
    // constraintd

    const userSize = 40;
    const user2Pos = { x: 10, y: height / 8 - userSize };
    const user1Pos = { x: width * 0.8, y: height * 0.9 - 20 };
    const user1CardPos = {
      x: user1Pos.x,
      y: user1Pos.y + insets.top + (userSize - 20),
    };

    const owners: ('p1' | 'p2')[] = Array.from({ length: 52 }, (_, i) =>
      i < 26 ? 'p1' : 'p2',
    );

    return cardSharedValues.map((sharedValues, i) => {
      const indexInHand = i % cardsPerPlayer;
      const owner = owners[i];

      const targetY = owner === 'p1' ? user1HandY : user2HandY;
      const handTargetX = handStartX + (cardWidth + spreadGap) * indexInHand;
      const showTargetX = deckX;
      const showTargetY = deckY + cardHeight * 1.5;

      return {
        id: i,
        x: sharedValues.x as SharedValue<number>,
        y: sharedValues.y as SharedValue<number>,
        state: sharedValues.state as SharedValue<
          'deck' | 'player' | 'hand' | 'show'
        >,
        faceup: sharedValues.faceup as SharedValue<boolean>,
        owner: owners[i],
        cardFaceImg: CardFaces[i],
        playerTarget:
          owner === 'p1'
            ? { x: user1Pos.x, y: user1Pos.y + userSize - 20 }
            : user2Pos,
        handTarget: {
          x: handTargetX,
          y: targetY,
        },
        showTarget:
          owner === 'p1'
            ? {
                x: showTargetX,
                y: showTargetY,
              }
            : {
                x: showTargetX,
                y: deckY - cardHeight * 1.5,
              },
      };
    });
  }, []);

  return cards;
}
