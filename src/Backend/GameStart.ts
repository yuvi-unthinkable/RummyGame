import { useMemo } from 'react';
import { useDeck } from '../Components/cardTypes';
import { CardData } from '../Components/Playground';
import { Player } from './Room';
import { makeMutable, useSharedValue } from 'react-native-reanimated';
import { useWindowDimensions } from 'react-native';

type deck = {
  prevCard: CardData;
  deckCards: CardData[];
  abondendCards: CardData[];
};

type turn = {
  activePlayer: string;
  startedAt: string;
  expiresAt: string;
};

type rules = {
  cardsPerPlayer: number;
  turnTimeout: 3000; // 3000 mili seconds
};

export default function GameStart(players: Player[], playerCount: number) {
  const cardDeck = useDeck();
  const activePlayer = useSharedValue<string>('p1');

  const { width, height } = useWindowDimensions();
  const cardWidth = width * 0.1;
  const cardHeight = cardWidth * 1.2;

  const deckX = width / 2 - cardWidth / 2;
  const deckY = height / 2 - cardHeight / 2;
  const user1Pos = { x: 10, y: height * 0.9 - 20 };

  const cardSharedValues = useMemo(() => {
    const cardArray = Array?.from({ length: 52 });
    console.log('🚀 ~ Playground ~ cardArray:', cardArray);

    return Array.from({ length: 52 }).map((_, i) => ({
      x: makeMutable(deckX),
      y: makeMutable(deckY),
      state: makeMutable<'deck' | 'player' | 'hand' | 'show'>('deck'),
      faceup: makeMutable(false),
      owner: makeMutable<'p1' | 'p2' | 'unset'>('unset'),
      playerTarget: makeMutable(user1Pos),
      handTarget: makeMutable({ x: 0, y: 0 }),
      showTarget: makeMutable({ x: 0, y: 0 }),
    }));
  }, [deckX, deckY, activePlayer]);

  let cards: CardData[] = useMemo(() => {
    if (!cardDeck || !cardSharedValues || cardDeck.length === 0) return [];
    return cardDeck
      ?.map((meta, i) => {
        if (!cardSharedValues[i]) return null;

        return {
          meta,
          x: cardSharedValues[i].x,
          y: cardSharedValues[i].y,
          state: cardSharedValues[i].state,
          faceup: cardSharedValues[i].faceup,
          owner: cardSharedValues[i].owner,
          cardFaceImg: meta.image,
          playerTarget: cardSharedValues[i].playerTarget,
          handTarget: cardSharedValues[i].handTarget,
          showTarget: cardSharedValues[i].showTarget,
        };
      })
      .filter(Boolean) as CardData[];
  }, [cardDeck, cardSharedValues]);

  //   const currentdeck:deck = {
  //     prevCard : {},
  //     deckCards : cardDeck,
  //     abondendCards : []
  //   }
  console.log('cards data', cards);


}
