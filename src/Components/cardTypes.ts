import { SkImage } from "@shopify/react-native-skia";
import { useCard } from "./usecard";
import { useMemo } from "react";

export type Suit = 'club' | 'diamond' | 'heart' | 'spade';
export type Rank =
  | 'ace'
  | 'two'
  | 'three'
  | 'four'
  | 'five'
  | 'six'
  | 'seven'
  | 'eight'
  | 'nine'
  | 'ten'
  | 'jack'
  | 'queen'
  | 'king';
export type cardKey = `${Suit}-${Rank}`;

const SUITS: Suit[] = ['club', 'diamond', 'heart', 'spade'];
const RANKS: Rank[] = [
  'ace',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'jack',
  'queen',
  'king',
];

export type CardMeta = {
  id: number;
  key: cardKey;
  suit: Suit;
  rank: Rank;
  priority: number;
};

export type CardState =
  | 'deck'
  | 'player'
  | 'hand'
  | 'show'
  | 'prevcard'
  | 'collected';


export const CARD_DECK_META: CardMeta[] = SUITS.flatMap((suit) => 
  RANKS.map((rank, index) => ({
    id: SUITS.indexOf(suit) * 13 + index,
    key: `${suit}-${rank}` as cardKey,
    suit,
    rank,
    priority: index + 1,
  }))
)

export type Card = CardMeta & {
    image : SkImage | null;
};



export function useDeck(): Card[] {
  const faces = useCard();

  return useMemo(                                                                                                                                                                                                                                                                                                                                                                                                                                  
    () =>
      CARD_DECK_META.map((meta) => ({
        ...meta,
        image: faces[meta.key] ?? null,
      })),
    [faces],
  );
}
