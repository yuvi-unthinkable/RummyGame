import { NetworkCard } from "../Backend/useGameStarted";

 export function getNextHandIndex(handCards: NetworkCard[]): number {
    if (handCards.length === 0) return 0;

    return Math.max(...handCards.map(c => c.indexInHand ?? -1)) + 1;
  }