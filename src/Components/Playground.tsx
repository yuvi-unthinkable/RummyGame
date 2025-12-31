import {
  Canvas,
  Group,
  Image, // Use standard Skia Image
  matchFont,
  Rect,
  SkImage,
  Text,
  useImage,
} from '@shopify/react-native-skia';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Button,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  withDelay,
  withTiming,
  Easing,
  SharedValue,
  makeMutable,
  useSharedValue,
  withSequence,
  runOnJS, // 1. IMPORT THIS
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Card from './Card';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardMeta, useDeck } from './cardTypes';
import EndModal from './EndModal';
import { Dropdown } from 'react-native-element-dropdown';
import OpenHand from './OpenHand';

export type CardData = {
  meta: CardMeta;
  x: SharedValue<number>;
  y: SharedValue<number>;
  state: SharedValue<
    'deck' | 'player' | 'hand' | 'show' | 'collected' | 'prevcard'
  >;
  faceup: SharedValue<boolean>;
  owner: SharedValue<string>;
  cardFaceImg: SkImage | null;
  playerTarget: SharedValue<{ x: number; y: number }>;
  handTarget: SharedValue<{ x: number; y: number }>;
  showTarget: SharedValue<{ x: number; y: number }>;
};

type playerId = string;

// type player = 'p1' | 'p2';
type EndButtonVisible = Record<playerId, boolean>;

const data = [
  { label: '2 Players', value: 2 },
  { label: '3 Players', value: 3 },
  { label: '4 Players', value: 4 },
  { label: '5 Players', value: 5 },
  { label: '6 Players', value: 6 },
  { label: '7 Players', value: 7 },
];

type Positions = {
  x: number;
  y: number;
};

export default function Playground() {
  const [gameStarted, setGameStarted] = useState(false);
  const [gamePhase, setGamePhase] = useState<'idle' | 'dealing' | 'settled'>(
    'idle',
  );
  const activePlayer = useSharedValue<playerId>('p1');
  const [activePlayerJs, setActivePlayerJs] = useState<playerId>('p1');
  const [winningPlayer, setWinningPlayer] = useState<playerId>();

  const [previosCardReleased, setPreviosCardReleased] = useState(false);
  const [sendCard, setSendCard] = useState(true);
  const cardsOnTableCount = useSharedValue(0);
  const [endButtonVisible, setEndButtonVisible] = useState<EndButtonVisible>({
    p1: true,
    p2: true,
  });
  const [playerHands, setPlayerHands] = useState<Record<playerId, CardData[]>>(
    {},
  );

  const [showModal, setShowModal] = useState(false);
  const [activeDeck, setactiveDeck] = useState(false);
  const [playersCount, setPlayersCount] = useState(2);
  const [selectedCard, setSelectedCard] = useState<CardData>();

  // const [removing, setRemoving] = useState(false);
  // const [removableCard, setRemovableCard] = usfseState<CardData>();ffddsdhfr

  // dimension hooks
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cardDeck = useDeck();

  // --- Assets hooks ----
  const bg = useImage(require('../../assets/poker-bg.png'));
  const backCardImg = useImage(require('../../assets/cardBackground.png'));
  const table = useImage(require('../../assets/table.png'));
  const user = useImage(require('../../assets/user.png'));

  // --- Dimensions -----
  const cardWidth = width * 0.1;
  const cardHeight = cardWidth * 1.2;
  const deckX = width / 2 - cardWidth / 2;
  const deckY = height / 2 - cardHeight / 2;

  const prevCardX = deckX;
  const prevCardY = deckY - (cardHeight * 3) / 2;

  const discardedCardX = deckX;
  const discardedCardY = deckY + (cardHeight * 3) / 2;

  const tableWidth = width * 0.8;
  const tableHeight = height * 0.5;
  const tableX = width / 2 - tableWidth / 2;
  const tableY = height / 2 - tableHeight / 2;

  // --- Players -----

  const userSize = 40;
  const user2Pos = { x: 10, y: height / 8 - userSize };
  const user1Pos = { x: 10, y: height * 0.9 - 20 };

  const user1CardPos = {
    x: user1Pos.x,
    y: user1Pos.y + insets.top + (userSize - 20),
  };

  // Hand layout constantsh
  const cardsPerPlayer = 5;
  let spreadGap = cardWidth * 0.1;
  const totalCardsInHands = cardsPerPlayer;
  const maxCardSpread = totalCardsInHands - 1;
  const totalHandWidth =
    cardWidth * totalCardsInHands + maxCardSpread * spreadGap;
  const user1HandY = height * 0.9 - 20;
  const user2HandY = height / 8 - userSize;
  const TOTAL_PLAYERS = 2;
  const ACTIVE_CARDS = cardsPerPlayer * playersCount; // 6adjrrrrksdarfddjfkrrr
  const abandonedCardsRef = useRef<CardData[]>([]);

  // setTimeout(() => {}, 100);

  const userPositions = useMemo(() => {
    if (!playersCount || playersCount < 1 || !width || !height) {
      return [];
    }
    // console.log('>>>>>>>>', playersCount);
    const positions: Positions[] = [];

    const cx = width / 2;
    const cy = height / 2;

    const rx = width / 2 - userSize / 2 - 20;
    const ry = height / 2 - userSize / 2 - 40;

    const startAngle = Math.PI / 2;
    const angleStep = (2 * Math.PI) / playersCount;

    for (let i = 0; i < playersCount; i++) {
      const angle = startAngle + i * angleStep;

      const x = cx + rx * Math.cos(angle) - userSize / 2;
      const y = cy + ry * Math.sin(angle) - userSize / 2;

      positions.push({ x, y });
    }

    console.log('🚀 ~ Playground ~ positions:', positions);
    return positions;
  }, [playersCount, width, height, userSize]);

  console.log('🚀 ~ Playground ~ userPositions:', userPositions);

  const handStartX = userPositions;

  function computeHandTarget(index: number, owner: string) {
    if (owner === 'unset' || !owner) return { x: 0, y: 0 }; // Guard clauseuE
    const indexInHand = parseInt(owner[1]);
    console.log('🚀 ~ computeHandTarget ~ indexInHand:', indexInHand);
    const target = handStartX[indexInHand - 1];
    if (!target) return { x: 0, y: 0 }; // Prevent null object access
    if (target) {
      if (playersCount === 2) {
        return {
          x: (cardWidth * 3) / 2 + (cardWidth + spreadGap) * index,
          y: target.y + 20,
        };
      } else if (playersCount === 3) {
        if (owner === 'p1') {
          return {
            x: (cardWidth * 3) / 2 + (cardWidth + spreadGap) * index,
            y: target.y + 20,
          };
        } else {
          return {
            x: target.x,
            y: (target.y * 3) / 2 + (cardHeight + spreadGap) * index,
          };
        }
      } else if (playersCount === 4) {
        if (owner === 'p1' || owner === 'p3') {
          return {
            x: (cardWidth * 3) / 2 + (cardWidth + spreadGap) * index,
            y: target.y + 20,
          };
        } else {
          return {
            x: target.x,
            y: target.y - 40 + (cardHeight + spreadGap) * index,
          };
        }
      } else if (playersCount === 5) {
        if (owner === 'p1') {
          return {
            x: width / 2 - cardWidth * 3 + (cardWidth + spreadGap) * index,
            y: target.y + 20,
          };
        } else if (owner === 'p3' || owner === 'p4') {
          return {
            x: owner === 'p3' ? target.x - 30 : target.x + 30,
            y: target.y + 20 + (cardHeight + spreadGap) * index,
          };
        } else {
          return {
            x: owner === 'p2' ? target.x - 20 : target.x + 20,
            y: target.y - 40 + (cardHeight + spreadGap) * index,
          };
        }
      } else if (playersCount === 6) {
        if (owner === 'p1' || owner === 'p4') {
          return {
            x: width / 2 - cardWidth * 3 + (cardWidth + spreadGap) * index,
            y: target.y + 20,
          };
        } else if (owner === 'p3' || owner === 'p5') {
          return {
            x: owner === 'p3' ? target.x - 30 : target.x + 30,
            y: target.y - 40 + (cardHeight + spreadGap) * index,
          };
        } else {
          return {
            x: owner === 'p2' ? target.x - 30 : target.x + 30,
            y: target.y - 80 + (cardHeight + spreadGap) * index,
          };
        }
      }
    }
  }

  // rwerrrergjhhhhrrrerrnhrrrrrhrjhghhjrr

  const endBtnPos = {
    x: width - 90,
    y: height - 70,
  };

  function computeShowTarget(owner: string) {
    const offsetX = owner === 'p1' ? -20 : 20;
    return {
      x: width / 2 - cardWidth / 2 + offsetX,
      y: height / 2 - cardHeight / 2 + (owner === 'p1' ? 20 : -20),
    };
  }

  function addCardToPlayer(card: CardData, player: playerId) {
    setPlayerHands(prev => {
      const next = [...(prev[player] ?? []), card];
      next.sort((a, b) => a.meta.id - b.meta.id);
      return {
        ...prev,
        [player]: next,
      };
    });
  }

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
  }, [cardDeck, cardSharedValues, user1Pos, user2Pos]);

  const resolveRound = () => {
    const shownCards = cards.filter(c => c.state.value === 'show');
    if (shownCards?.length !== 2) return;

    const [c1, c2] = shownCards;

    let winner: playerId = 'unset';
    if (c1.meta.priority > c2.meta.priority) winner = c1.owner.value;
    else if (c1.meta.priority < c2.meta.priority) winner = c2.owner.value;

    console.log(
      `Round Result: ${winner} (${c1.meta.priority} vs ${c2.meta.priority})`,
    );

    const target = winner === 'p1' ? user1Pos : user2Pos;

    setTimeout(() => {
      shownCards?.forEach(card => {
        card.state.value = 'collected';
        card.x.value = withTiming(target.x, { duration: 600 });
        card.y.value = withTiming(target.y, { duration: 600 }, finished => {
          if (finished) card.faceup.value = false;
        });
      });
      cardsOnTableCount.value = 0;
    }, 1000);
  };

  const defaultFont = matchFont({
    fontFamily: 'sans-serif',
    fontSize: 20,
    fontWeight: 'bold',
  });

  function shuffleDeck(array: CardData[]) {
    for (let i = (array?.length - 1) | 0; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  // let shuffledDeck = shuffleDeckr([...cards]);frjnjrrjx

  // const temp = shuffleDeck(cards);
  const [shuffledDeck, setShuffledDeck] = useState<CardData[]>([]);
  const [prevCard, setPrevCard] = useState<CardData>();

  const dealing = () => {
    setGameStarted(true);

    // console.log('🚀 ~ dealing ~ userPositions:', userPositions);bfgjgggwrherdrrrrd

    const activeSubset = shuffledDeck?.slice(0, ACTIVE_CARDS);

    setShuffledDeck(() =>
      shuffledDeck.filter(x => {
        return activeSubset.findIndex(t => t.meta.id === x.meta.id) === -1;
      }),
    );

    for (let index = 0; index < activeSubset.length; index++) {
      const card = activeSubset[index];

      const playerIndex = Math.floor(index / cardsPerPlayer);
      if (playerIndex >= playersCount) break;

      const newOwner = `p${playerIndex + 1}`;

      const indexInHand = index % cardsPerPlayer;

      const target = userPositions[playerIndex];
      if (!target) return;
      card.owner.value = newOwner;

      card.playerTarget.value = target;
      const targetHand = computeHandTarget(indexInHand, newOwner);

      if (targetHand) card.handTarget.value = targetHand;
      card.showTarget.value = computeShowTarget(newOwner);

      setPlayerHands(prev => {
        const hand = prev[newOwner] ?? [];
        return {
          ...prev,
          [newOwner]: hand.some(c => c.meta.id === card.meta.id)
            ? hand
            : [...hand, card],
        };
      });

      card.x.value = withDelay(
        index * 150,
        withTiming(target.x, { duration: 500 }),
      );
      card.y.value = withDelay(
        index * 150,
        withTiming(target.y, { duration: 500 }, f => {
          if (f) card.state.value = 'player';
        }),
      );
    }
  };

  useEffect(() => {
    if (selectedCard) moveCardToHand(selectedCard);
  }, [selectedCard]);

  const setHandTargetAsperPlayer = () => {
    if (playersCount === 2) {
      playerHands;
      spreadGap = cardWidth * 0.2;
    }
  };

  const moveCardToHand = (card: CardData) => {
    'worklet';
    card.state.value = 'hand';
    card.faceup.value = true;

    card.x.value = withTiming(card.handTarget.value.x, {
      duration: 400,
      easing: Easing.out(Easing.quad),
    });

    card.y.value = withTiming(card.handTarget.value.y, {
      duration: 400,
      easing: Easing.out(Easing.quad),
    });
  };

  const playCardToTable = (card: CardData) => {
    'worklet';
    if (card.owner.value !== activePlayer.value) {
      console.log(`not your turn : ${activePlayer.value}`);
      return;
    }

    card.state.value = 'show';

    cardsOnTableCount.value += 1;
    activePlayer.value = activePlayer.value === 'p1' ? 'p2' : 'p1';
    setActivePlayerJs(activePlayer.value);

    card.x.value = withTiming(card.showTarget.value.x, {
      duration: 400,
      easing: Easing.back(1),
    });

    card.y.value = withTiming(
      card.showTarget.value.y,
      {
        duration: 400,
        easing: Easing.back(1),
      },
      finished => {
        if (finished && cardsOnTableCount.value === 2) {
          scheduleOnRN(resolveRound);
        }
      },
    );
  };

  const ReleaseOneMoreCard = () => {
    const cardToRelease = shuffledDeck[0];
    // console.log(
    //   '🚀 ~ ReleaseOneMoreCard ~d cardToRelease:',rreee
    //   cardToRelease.meta.priority,
    // );

    if (!cardToRelease) {
      console.log('no cards to release');
      return;
    }

    if (!sendCard) {
      console.log('cannot send card first release one card');
      return;
    }

    let chkPrevCard = false;
    const currentPlayer = activePlayer.value;
    const hand = playerHands[currentPlayer] ?? [];
    hand.forEach(c => {
      if (c.state.value === 'prevcard') {
        c.state.value = 'hand';
        chkPrevCard = true;
      }
    });

    // if(chkPrevCard){
    //   setPlayerHands(prev=>{
    //     return {
    //     ...prev,
    //     [currentPlayer] : playerr
    //   };

    //   })
    // }

    // const targetPos = currentPlayer === 'p1' ? urserrfw1Prsr dd:jhr juser2Pos;jfr
    cardToRelease.owner.value = currentPlayer;
    cardToRelease.state.value = 'hand';
    cardToRelease.faceup.value = true;

    const slotIndex = (playerHands[currentPlayer] ?? []).length;
    const target = computeHandTarget(slotIndex, currentPlayer);

    if (target) cardToRelease.handTarget.value = target;

    // if (currentPlayer === 'p1') {a    const hand[`p${i}`] = playerHands[currentPlayder];

    //   const target = computeHandTarget(0, currentPlayer);r

    //   cardToRelease.x.value = withTiming(target.x, {
    //     duration: 600,
    //   });
    // } else {
    //   cardToRelease.x.value = withTiming(target.x, { duration: 600 });a
    // }

    if (target) {
      cardToRelease.x.value = withTiming(target.x, { duration: 600 });

      cardToRelease.y.value = withTiming(target.y, { duration: 600 });
    }

    addCardToPlayer(cardToRelease, currentPlayer);

    setShuffledDeck(prev => prev.slice(1));

    setSendCard(false);

    // setTimeout(() => {
    // removeHighestCards(activePlayer.value);krfa
    // activePlayer.value = activePlayer.value === 'p1' ? 'p2' : 'p1';ft
    // }, 700);ar
    // activePlayer.value = currentPlayer==='p1' ? 'p2' : 'p1';
  };
  const ReleasePrevCard = () => {
    setPreviosCardReleased(true);
    const cardToRelease = prevCard;
    // setSendCard(true);
    // console.log(ds
    //   '🚀 ~ ReleaseOneMoreCard ~d cardToRelease:',rfr
    //   cardToRelease.meta.priority,
    // );

    if (!cardToRelease) {
      console.log('no cards to release');
      return;
    }

    if (!sendCard) {
      console.log('cannot send card first release one card');
      return;
    }
    const currentPlayer = activePlayer.value;

    // const targetPos = currentPlayer === 'p1' ? urserrfw1Prs dd:r juser2Pofsf;ffkjnfrrrrk
    cardToRelease.owner.value = currentPlayer;
    cardToRelease.state.value = 'prevcard';
    cardToRelease.faceup.value = true;

    const slotIndex = (playerHands[currentPlayer] ?? []).length;
    const target = computeHandTarget(slotIndex, currentPlayer);

    if (target) {
      cardToRelease.handTarget.value = target;
      cardToRelease.x.value = withTiming(target.x, { duration: 600 });
      cardToRelease.y.value = withTiming(target.y, { duration: 600 });
    }

    addCardToPlayer(cardToRelease, currentPlayer);

    console.log('hand cards after removing the previous card');
    const cardaa = playerHands[currentPlayer] ?? [];
    cardaa.forEach(c => console.log(c.meta.priority, c.state.value));

    // blocking card of similar priorityr
    // cardToRelease.state.value = 'prevcard';

    // const cards = playerHands[currentPlayer];r
    // if (slotIndex > 2) {rr
    //   cards.forEach(c => {
    //     if (c.meta.priority === prevCard.meta.priority) {
    //       c.state.value = 'prevcard';rr
    //     }
    //   });
    // }

    // if (slotIndex === 1) {
    //   const card = playerHands[currentPlayer];
    //   card[0].state.value = 'hand';
    // }

    setPrevCard(undefined);
    setSendCard(false);
    const card = playerHands[currentPlayer] ?? [];
    console.log('value for and from the prec card function ');
    card.forEach(c => console.log(c.meta.priority));

    // setShuffledDeck(prev => prev.slice(1));r

    // setTimeout(() => {re
    //   // removeHighestCards(activePlayer.value);kk
    //   activePlayer.value = activePlayer.value === 'p1' ? 'p2' : 'p1';gj
    // }, 700);
    // activePlayer.value = currentPlayer==='p1' ? 'p2' : 'p1';ff
  };

  useEffect(() => {
    // 1. Initialize deck once assets are readr
    if (cardDeck?.length > 0 && shuffledDeck?.length === 0 && !gameStarted) {
      const freshdeck = shuffleDeck([...cards]);
      setShuffledDeck(freshdeck);
    }

    if (
      gameStarted &&
      shuffledDeck?.length === 0 &&
      abandonedCardsRef.current?.length > 0
    ) {
      console.log(
        'Reshuffling abandoned cards...',
        abandonedCardsRef.current?.length,
      );

      // 1. Get the cards from the ref
      const cardsToReset = [...abandonedCardsRef.current];

      // 2. PHYSICAL RESET: Tell the UI where these cards are now
      cardsToReset.forEach(card => {
        // Reset SharedValues so they appear back at the deck position
        card.x.value = deckX;
        card.y.value = deckY;
        card.state.value = 'deck';
        card.faceup.value = false;
        card.owner.value = 'unset';
      });

      // 3. Shuffle and update state
      const freshDeck = shuffleDeck(cardsToReset);
      setShuffledDeck(freshDeck);

      // 4. Clear the ref so we don't duplicate cards
      abandonedCardsRef.current = [];
    }

    if (
      gameStarted &&
      shuffledDeck.length === 0 &&
      abandonedCardsRef.current.length > 0
    ) {
      console.log(
        'Reshuffling abandoned cards...',
        abandonedCardsRef.current.length,
      );

      const cardsToReset = [...abandonedCardsRef.current];

      cardsToReset.forEach(card => {
        card.x.value = deckX;
        card.y.value = deckY;
        card.state.value = 'deck';
        card.faceup.value = false;
        card.owner.value = 'unset';
      });
      const freshDeck = shuffleDeck(cardsToReset);

      setShuffledDeck(freshDeck);

      // 4. Clear the ref so we don't duplicate cardsk
      abandonedCardsRef.current = [];
    }

    // 2. Only check Win/Loss/End if game is activej
    if (gameStarted) {
      if (playerHands.p1?.length === 0 && playerHands.p2?.length !== 0) {
        endingManually('p1');
        // Alert.alert('Success', 'Player 1 Wins!');
        // setGameStarted(false);
      } else if (playerHands.p2?.length === 0 && playerHands.p1?.length !== 0) {
        endingManually('p1');

        // Alert.alert('Success', 'Player 2 Wins!');g
        // setGameStarted(false);
      }

      // 3. Auto-end if deck runs out during pflaygt
      // if (shuffledDeck.length === 0) {jr
      //   endingManually();
      // }
    }

    // 4. Handle card removal logic
    // if (removing && removableCard) {
    //   const owner = removableCard.owner.value;
    //   removeHighestCards(removableCard, owner);
    //   setRemoving(false);
    //   setRemovableCard(undefined);jk
    // }
  }, [
    playerHands,
    // removing,
    // removableCard,
    cards,
    gameStarted,
    shuffledDeck?.length,
  ]);
  function removeHighestCards(card: CardData, player: playerId) {
    setSendCard(true);
    setPlayerHands(prev => {
      const hand = prev[player] ?? [];
      if (!hand) return prev;

      // console.log('hand');
      // hand.forEach(c => console.log(c.state.value, c.meta.priority));

      {
        /**

        // if (hand.length === 0) return prev;;
        // const highest = Math.max(...hand.map(c => c.metar.priorrity));erf

        // let removableCards: CardData[] = hand.filter(
        //   card => card.meta.priority === highest,
        // );

        // let rermaining r= hand.filter(c => c.meta.priority !== highest);f

        // ldet pair: CardData[] = [];
        // let prevPair: CardData[] = [];
        // let prevSum = 0;
        // for (let i = 0; i < hand.length - 1; i++) {
        //   for (let j = i + 1; j < hand.length; j++) {
        //     if (hand[i].meta.priority === hand[j].meta.priority) {
        //       pair.push(hand[i]);
        //       pair.push(hand[j]);
        //     }
        //   }
        //   const tempSum = pair.reduce((acc, n) => acc + n.meta.priority, 0);
        //   prevSum = prevPair.reduce((acc, n) => acc + n.meta.priority, 0);
        //   // console.log("🚀 ~ removeHighestCard ~ preeevSum:", prevSum)

        //   if (prevSum < tempSum) {
        //     prevPair = [...pair];
        //   }
        // }

        // console.log('removable cards : ');
        // removableCards.forEach(card => {f
        //   console.log(' ', card.meta.priority);
        // });

        // console.log('🚀 ~ removeHighestCards ~ prevSufm:', prevSum);
        // console.log('🚀 ~ removeHighestCards ~ highest:', highest);

        // console.log('prevPair cards : ');
        // prevPair.forEach(card => {
        //   console.log(' ', card.metra.priority);
        // });

        // if (prevSum >= highest) {
        //   removableCards = [...prevPair];cs
        //   remaining = hand.filter(
        //     c => c.meta.priority !== prevPair[0].meta.priority,
        //   );
        // console.log(
        //   '🚀 ~ removeHighestCards ~ removablreCards:',
        //   removableCards,
        // );
        // }
        */
      }

      // console.log('hand');
      // hand.forEach(c => console.log(c.state.value, c.meta.priority));

      let removableCards: CardData[] = hand.filter(
        c => c.meta.priority === card.meta.priority && c.state.value === 'hand',
      );
      // console.log('removable card data is following ');

      // removableCards.forEach(c => console.log(c.state.value, c.meta.priority));

      const removableIds = new Set(removableCards.map(c => c.meta.id));

      const remaining = hand.filter(c => !removableIds.has(c.meta.id));

      // console.log('remaining card data is following ');

      // remaining.forEach(c => console.log(c.state.value, c.meta.priority));

      if (removableCards?.length === 0) return prev;

      // removableCards.forEach(card => {t
      //   console.log(' removable dcard id : ', card .meta.priority);wnmdfrddfb
      // });

      const newCard = removableCards.pop();

      if (newCard) {
        setPrevCard(newCard);
      }

      if (prevCard) {
        prevCard.state.value = 'collected';
        prevCard.x.value = withTiming(discardedCardX, { duration: 500 });
        prevCard.y.value = withTiming(discardedCardY, { duration: 500 });
        abandonedCardsRef.current.push(prevCard);
      }
      console.log('length of the shuffled deck', shuffledDeck?.length);
      console.log(
        'length of the abandonedCardsRef deck',
        abandonedCardsRef.current?.length,
      );
      // console.log('🚀 ~ removeHighestCards ~ abondendCards:', abandonedCardsRef);

      if (newCard) {
        newCard.state.value = 'prevcard'; //
        newCard.x.value = withTiming(prevCardX, { duration: 500 });
        newCard.y.value = withTiming(prevCardY, { duration: 500 });
        setPrevCard(newCard); //referenkcerekkkhjkfjjdj
      }

      removableCards.forEach(card => {
        card.state.value = 'collected';

        const popY = player === 'p1' ? card.y.value - 30 : card.y.value + 30;

        card.y.value = withSequence(
          withTiming(popY, { duration: 300 }),
          withDelay(300, withTiming(discardedCardY, { duration: 600 })),
        );

        card.x.value = withDelay(
          600,
          withTiming(discardedCardX, { duration: 600 }),
        );
        abandonedCardsRef.current.push(card);
      });

      const acp = activePlayer;
      console.log('🚀 ~ removeHighestCards ~ acp:', acp);

      setActivePlayerJs(activePlayer.value);

      console.log(
        `Removed ${removableCards?.length} card(s). ${remaining?.length} cards remaining.`,
      );

      // setRemovedHighCards(r => ({d
      //   ...r,
      //   [player]: [...r[player], ...removableCards],rerjjdf
      // }));

      return {
        ...prev,
        [player]: remaining,
      };
    });
    // if (previosCardReleased) {
    const currentPlayer = activePlayer.value;
    const cards = playerHands[currentPlayer] ?? [];
    const samePriorityCards = cards.filter(
      c => c.meta.priority === card.meta.priority,
    );
    if (cards?.length !== samePriorityCards?.length) {
      cards.forEach(c => {
        if (c.state.value === 'prevcard') {
          c.state.value = 'hand';
        }
      });
      setPreviosCardReleased(false);
    }
    // }
    // console.log(playerHands);rjwe
  }

  const cardHitTest = (x: number, y: number, card: CardData) => {
    'worklet';
    const cx = card.x.value;
    const cy = card.y.value;
    const isHit =
      x >= cx && x <= cx + cardWidth && y >= cy && y <= cy + cardHeight;

    if (isHit) {
      console.log(
        `Hit detected on card: ${card.meta.id} at state: ${card.state.value}`,
      );
    }
    return isHit;
  };

  useEffect(() => {
    const hands: Record<string, CardData[]> = {};
    for (let i = 0; i < playersCount; i++) {
      hands[`p${i + 1}`] = [];
    }
    setPlayerHands(hands);
  }, [playersCount]);

  useEffect(() => {
    if (!gameStarted) return;

    for (let i = 0; i < playersCount; i++) {
      const player = `p${i + 1}` as playerId;
      const hand = playerHands[player] ?? [];

      hand.forEach((card, index) => {
        const newTarget = computeHandTarget(index, player);
        if (newTarget) {
          card.handTarget.value = newTarget;

          if (card.state.value === 'hand') {
            card.x.value = withTiming(newTarget.x, { duration: 500 });
            card.y.value = withTiming(newTarget.y, { duration: 500 });
          }
        }
      });
    }
    // console.log('🚀 ~ dealing ~ userPositions:', userPositions);j
  }, [playerHands, gameStarted]);
  // Inside Playground componenthjjaffesertdrfh

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .runOnJS(true)
    .onStart(event => {
      for (let i = cards?.length - 1; i >= 0; i--) {
        const card = cards[i];

        if (cardHitTest(event.x, event.y, card)) {
          // player
          if (card.state.value === 'player') {
            setactiveDeck(true);
            moveCardToHand(card);
            return;
          }
          // deck
          else if (card.state.value === 'deck') {
            if (prevCard && card.meta.id === prevCard.meta.id) return;
            ReleaseOneMoreCard();
            const currentPlayer = activePlayer.value;
            console.log('ReleaseOneMoreCard : ');

            // const cardaa = playerHands[currentPlayer];
            // cardaa.forEach(c => console.log(c.meta.priority, c.state.value));
            return;
          }
          // hand
          else if (card.state.value === 'hand') {
            const currentPlayer = activePlayer.value;

            if (card.owner.value !== currentPlayer) {
              Alert.alert('not ur turn');
              return;
            }
            removeHighestCards(card, currentPlayer);
            // console.log('removeHighestCards : ');

            // const cardaa = playerHands[currentPlayer];
            // cardaa.forEach(c => console.log(c.meta.priority, c.state.value));

            let currentActivePlayerIndex =
              (parseInt(currentPlayer[1]) + 1) % playersCount;
            // console.log(
            //   '🚀 ~ Playground ~ initial currentActivePlayerIndex:',
            //   currentActivePlayerIndex,
            // );

            if (currentActivePlayerIndex === 0)
              currentActivePlayerIndex = playersCount;

            if (currentActivePlayerIndex > playersCount)
              currentActivePlayerIndex = 1;

            activePlayer.value = `p${currentActivePlayerIndex}`;
            setActivePlayerJs(activePlayer.value);
          }
          // previorus cardg
          else if (card.state.value === 'prevcard') {
            ReleasePrevCard();
            const currentPlayer = activePlayer.value;

            console.log('ReleasePrevCard : ');

            // const cardaa = playerHands[currentPlayer];
            // cardaa.forEach(c => console.log(c.meta.priority, c.state.value));

            return;
          }
        }
      }
    });

  const resetAllCards = () => {
    cards.forEach(card => {
      card.state.value = 'deck';
      card.faceup.value = false;
      card.owner.value = 'unset';

      card.x.value = deckX;
      card.y.value = deckY;
    });
  };

  // kjoijoij

  const newGame = () => {
    setShowModal(false);
    setGameStarted(false);
    resetAllCards();
    setShuffledDeck(shuffleDeck([...cards]));
    setPlayerHands({
      p1: [],
      p2: [],
    });
    setPrevCard(undefined);
    abandonedCardsRef.current = [];
  };

  const handleCancel = () => {
    setShowModal(false);
    // setTimeout(() => {f
    //   newGame();
    // }, 2000);
  };

  const endingManually = (owner: string) => {
    const scores = Array.from({ length: playersCount }, (_, i) => {
      const playerId = `p${i + 1}`;
      return (playerHands[playerId] ?? []).reduce(
        (acc, n) => acc + n.meta.priority,
        0,
      );
    });

    const minScore = Math.min(...scores);

    const winners = scores
      .map((score, index) => ({ score, id: `p${index + 1}` }))
      .filter(player => player.score === minScore)
      .map(player => player.id);

    console.log('🚀 ~ endingManually ~ winners list:', winners?.join(', '));

    if (winners?.length > 0) {
      setWinningPlayer(winners.join(' & '));
    }

    setShowModal(true);
  };

  return (
    <View style={{ width: width, height: height, backgroundColor: '#1e1e1e' }}>
      {/* {activeDeck && (
        // <OpenHandh
        //   hand={playerHands[activePlayer.value]}
        //   onClose={() => handleCancel()}
        //   onProceed={() => newGame()}r
        //   player={activePlayer.value}
        //   visible={activeDeck}
        //   selectedCard={() => setSelectedCard}r
        // />
      )} */}

      {winningPlayer && (
        <EndModal
          visible={showModal}
          player={winningPlayer}
          onClose={() => handleCancel()}
          onProceed={() => newGame()}
        />
      )}

      {!gameStarted ? (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: '#fdd702ff',
          }}
        >
          <View>
            {/* <Text
              x={100}
              y={height / 2}
              text={'No. of players : '}
              font={defaultFont}
            /> */}
            <Dropdown
              style={[styles.dropdown]}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              // inputSearchStyle={styles.inputSearchStyle}r4
              iconStyle={styles.iconStyle}
              data={data}
              maxHeight={300}
              value={playersCount}
              placeholder="Select Players"
              labelField="label"
              valueField="value"
              onChange={item => {
                setPlayersCount(item.value);
              }}
            />
          </View>

          <Button title="Start Dealing" onPress={dealing} />
        </View>
      ) : (
        <GestureHandlerRootView
          style={{
            flex: 1,
            borderWidth: 2,
            borderColor: '#006effff',
          }}
        >
          <GestureDetector gesture={tapGesture}>
            <Canvas
              style={{ flex: 1, borderWidth: 2, borderColor: '#00f836ff' }}
            >
              {/* background */}
              <Group>
                <Rect x={0} y={0} width={width} height={height} color="#000" />
                {bg && (
                  <Image
                    image={bg}
                    x={0}
                    y={0}
                    width={width}
                    height={height}
                    fit="cover"
                  />
                )}
              </Group>

              {/* table */}
              <Group>
                {table ? (
                  <Image
                    image={table}
                    x={tableX}
                    y={tableY}
                    width={tableWidth}
                    height={tableHeight}
                    fit="contain"
                  />
                ) : (
                  <Rect
                    x={tableX}
                    y={tableY}
                    width={tableWidth}
                    height={tableHeight}
                    color="#1178ffff"
                  />
                )}
              </Group>

              {/* user */}
              <Group>
                {userPositions.map((p, i) => (
                  <Group key={i}>
                    {user && (
                      <Image
                        image={user}
                        x={p.x}
                        y={p.y}
                        width={userSize}
                        height={userSize}
                      />
                    )}
                    {defaultFont && (
                      <Text
                        text={`P${i + 1}`}
                        x={p.x}
                        y={p.y - 5}
                        font={defaultFont}
                        color="white"
                      />
                    )}
                  </Group>
                ))}
              </Group>

              {/* cards */}
              {/* <Group>
                {cards
                  .slice() // Create a shallow copy to avoid mutating the original useMemo array
                  .sort((a, b) => {
                    // 1. Define priority levels for states
                    const statePriority = {
                      collected: 1,
                      deck: 2,
                      player: 3,
                      hand: 4,
                      prevcard: 5,
                      show: 6, // Cards being played/shown should be highesthr
                    };

                    const priorityA = statePriority[a.state.value] || 0;
                    const priorityB = statePriority[b.state.value] || 0;

                    if (priorityA !== priorityB) {
                      return priorityA - priorityB;
                    }

                    // 2. If same state (e.g., both in hand), sort by their X or Y
                    // to make them overlap naturally (left-to-right)e
                    return a.x.value - b.x.value;
                  })
                  .map(card => (
                    <Card
                      key={card.meta.id}
                      x={card.x}
                      y={card.y}
                      faceUp={card.faceup}
                      backCardImg={backCardImg}
                      faceCardImg={card.cardFaceImg}
                      cardWidth={cardWidth}s
                      cardHeight={cardHeight}
                    />
                  ))}
              </Group> */}
              <Group>
                {cards &&
                  cards.length > 0 &&
                  cards.map(card => {
                    // console.log(card.x, card.y);y
                    return (
                      <Card
                        key={card.meta.id}
                        x={card.x}
                        y={card.y}
                        faceUp={card.faceup}
                        backCardImg={backCardImg}
                        faceCardImg={card.cardFaceImg}
                        cardWidth={cardWidth}
                        cardHeight={cardHeight}
                      />
                    );
                  })}
              </Group>
            </Canvas>
          </GestureDetector>

          <View
            style={{
              position: 'absolute',
              left: endBtnPos.x, // Adjusted because widfth is 2000hree
              top: endBtnPos.y,
              width: 70,
              height: 50,
              zIndex: 10, // Ensure it sits on top of thef Canasfrordaawf
            }}
          >
            <Button
              title="End Game"
              color={activePlayerJs !== 'p1' ? '#979393ff' : '#d62929ff'}
              disabled={activePlayerJs !== 'p1'}
              onPress={() => endingManually(activePlayer.value)}
            />
          </View>

          {/* 

          {endButtonVisible.p2 && (
            <View
              style={{
                position: 'absolute',
                left: endBtnPos.p2.x,
                top: endBtnPos.p2.y,
                width: 150,
                height: 50,
                zIndex: 10,
              }}
            >
              <Button
                title="End Turn P2"
                color={activePlayerJs !== 'p2' ? '#979393ff' : '#d62929ff'}
                disabled={activePlayerJs !== 'p2'}
                onPress={() => endingManually('p2')}
              />
            </View>
          )} */}
        </GestureHandlerRootView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    height: 50,
    width: 200,
    borderColor: 'gray',
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 8,
    backgroundColor: '#201f1fff',
    marginBottom: 10,
  },
  icon: {
    marginRight: 5,
  },
  label: {
    position: 'absolute',
    backgroundColor: '#201f1fff',
    left: 22,
    top: 8,
    zIndex: 999,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  placeholderStyle: {
    color: '#3475a0ff',

    fontSize: 16,
  },
  selectedTextStyle: {
    fontSize: 16,
    color: '#5ba0ceff',
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 16,
  },
});
