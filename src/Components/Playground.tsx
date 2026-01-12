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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  withTiming,
  SharedValue,
  useSharedValue,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { auth, database } from '../context/Firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardMeta, CardState, useDeck } from './cardTypes';
import EndModal from './EndModal';

import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// import { UserContext } from '../context/UserContext';
import { RootStackParamList } from '../navigators/types';
import { useNavigation } from '@react-navigation/native';
import { createRoom, JoinRoom, Player, RoomData } from '../Backend/Room';
import { useUser } from '../context/UserContext';
// import { get, set, update } from 'firebase/database';
import { useGameStarted } from '../Backend/useGameStarted';
import { onValue, update } from '@react-native-firebase/database';
import { getRoomSnap, UpdateCardData } from '../services/db.service';
import Card from './Card';

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Playground'
>;

export type CardData = {
  meta: CardMeta;
  x: SharedValue<number>;
  y: SharedValue<number>;
  state: SharedValue<CardState>;
  faceup: SharedValue<boolean>;
  owner: SharedValue<string>;

  indexInHand: SharedValue<number | null>;

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
];

type Positions = {
  x: number;
  y: number;
};

type RoomJoiningData = {
  PlayerQty: number;
  startGame: boolean;
  position?: string;
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
  const [cardReleased, setCardReleased] = useState(false);
  const [sendCard, setSendCard] = useState(true);
  const cardsOnTableCount = useSharedValue(0);
  const [endButtonVisible, setEndButtonVisible] = useState<EndButtonVisible>({
    p1: true,
    p2: true,
  });

  const [showModal, setShowModal] = useState(false);
  const [quitModal, setQuitModal] = useState(false);
  const [activeDeck, setactiveDeck] = useState(false);
  const [playersCount, setPlayersCount] = useState(2);
  const [roomId, setRoomId] = useState(123456);
  const [quitConfirmation, setQuitConfirmation] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [gameRoomData, setGameRoomData] = useState();
  const [deckFlattened, setdeckFlattened] = useState(false);
  const [myId, setMyId] = useState('');
  const [prevCardReleased, setprevCardReleased] = useState<CardData>();

  const navigation = useNavigation<NavigationProp>();

  // const [removing, setRemoving] = useState(false);
  const [cardSent, setCardSent] = useState(false);
  // const [removableCard, setRemovableCard] = usfseState<CardData>();ffddsdhfr

  // dimension hooks
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cardDeck = useDeck();

  // --- Assets hooks ----
  const bg = useImage(require('../../assets/poker-bg.png'));
  const backCardImg = useImage(require('../../assets/cardBackground.png'));
  const table = useImage(require('../../assets/table.png'));
  const userImage = useImage(require('../../assets/user.png'));

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
  const hasDealtRef = useRef(false);
  const [room, setroom] = useState<RoomData | null>();
  const prevCardStateRef = useRef<Record<number, CardState>>({});

  // references---------------------------------------------------------------

  // const cardRef = database().ref(`room/${roomId}/cards/${cardId}`);
  const roomRef = useMemo(() => database().ref(`room/${roomId}`), [roomId]);
  async function getRoomData() {
    const room = await getRoomSnap(roomId);
    setroom(room);
  }

  // getting the user from the context
  const { user, loading } = useUser();

  const playersOpenedCards = useSharedValue(0);

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

  // console.log('🚀 ~ Playground ~ userPositions:', userPositions);

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
            y: owner === 'p1' ? target.y + 20 : target.y + 40,
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

  const getHandForPlayer = (player: playerId) => {
    return cards
      .filter(c => c.owner.value === player && c.state.value === 'hand')
      .sort((a, b) => (a.indexInHand.value ?? 0) - (b.indexInHand.value ?? 0));
  };

  const endBtnPos = {
    x: width / 2 - 30,
    y: (height * 4) / 5,
  };

  let cards: CardData[] = useGameStarted(roomId, gameStarted);
  console.log('🚀 ~ Playground ~ cards:', cards);

  const cardsReady = cards.length === cardDeck.length && cards.length > 0;

  // console.log('🚀 ~ Playground ~ cards:', cards);

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

  const [prevCard, setPrevCard] = useState<CardData>();

  function shuffle<T>(array: T[]): T[] {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  async function dealCardsHostOnly(
    roomId: number,
    room: RoomData,
    roomRef: any,
  ) {
    console.log('i am starting the dealing my id is : ', user?.uid);

    if (room) {
      if (room.hostUid !== user?.uid) return;
      if (room.cards) return;
      console.log('passed the bypass conditions');
      const players = Object.keys(room.players);
      const cardsPerPlayer = 5;

      const deckOrder = shuffle([...Array(52).keys()]);

      const cards: Record<string, any> = {};

      deckOrder
        .slice(0, players.length * cardsPerPlayer)
        .forEach((cardId, i) => {
          const owner = players[i % players.length];
          const indexInHand = Math.floor(i / players.length);

          cards[cardId] = {
            owner,
            state: 'hand',
            // faceup: true,
            indexInHand,
          };
        });
      console.log('dealing baase is created ');

      try {
        // FIX: Use roomRef.update (Standard RN Firebase syntax)
        // If you are using v9 modular, keep your 'update' import but ensure 'roomRef' is passed correctly.
        await roomRef.update({
          deck: { order: deckOrder },
          cards,
          activePlayer: 'p1', // Ensure this matches a valid player ID (e.g., players[0])
        });
        console.log('Cards dealt successfully to DB');
      } catch (error) {
        console.error('Error dealing cards:', error);
        hasDealtRef.current = false; // Reset lock if it failed so we can try again
      }
    }
    console.log('dealing is complete ');
  }

  const myPlayerId = useMemo<playerId | null>(() => {
    if (!room?.players || !user?.uid) return null;

    return (
      Object.entries(room.players).find(
        ([_, p]) => p.userId === user.uid,
      )?.[0] ?? null
    );
  }, [room, user]);

  const ReleaseOneMoreCard = async () => {
    if (!room?.deck?.order || !room?.cards || !room.activePlayer) {
      console.log('room not ready');
      return;
    }
    if (cardSent) {
      console.log('one card is already sent to the player from the deck');
      return;
    }

    // 1️⃣ Resolve my playerId (p1, p2, ...)
    console.log('🚀 ~ ReleaseOneMoreCard ~ room.players:', room.players);
    if (!room.players || !user?.uid) return;

    console.log('🚀 ~ ReleaseOneMoreCard ~ user.uid:', user);
    console.log('🚀 ~ ReleaseOneMoreCard ~ myPlayerId:', myPlayerId);

    if (!myPlayerId) {
      console.log('player not registered in room');
      return;
    }

    // 3️⃣ Find next undealt card
    const usedCardIds = new Set(Object.keys(room.cards).map(id => Number(id)));

    const nextCardId = room.deck.order.find(
      (id: number) => !usedCardIds.has(id),
    );

    if (nextCardId == null) {
      console.log('no cards left in deck');
      return;
    }

    // 4️⃣ Determine index in hand (DB-authoritative)
    const handSize = Object.values(room.cards).filter(
      (c: any) => c.owner === room.activePlayer && c.state === 'hand',
    ).length;

    // 5️⃣ Add card to player hand
    await UpdateCardData(
      roomId,
      nextCardId,
      room.activePlayer,
      'hand',
      true,
      handSize,
    );

    // 6️⃣ Advance turn
    // const playerCount = Object.keys(room.players).length;
    // const currentIndex = Number(myPlayerId.slice(1));
    // const nextIndex = (currentIndex % playerCount) + 1;

    // await database()
    //   .ref(`room/${roomId}`)
    //   .update({
    //     activePlayer: `p${nextIndex}`,
    //   });
    setCardSent(true);
  };

  const ReleasePrevCard = async () => {
    // 1️⃣ Validate room state

    if (!room?.cards || !room.activePlayer || !prevCard) {
      console.log('room or prevCard not ready');
      return;
    }
    if (cardSent) {
      console.log('one card is already sent to the player from the deck');
      return;
    }

    // 2️⃣ Resolve authoritative player
    const currentPlayer = room.activePlayer as playerId;

    // 3️⃣ Ensure the prevCard is valid
    const cardId = prevCard.meta.id;
    const dbCard = room.cards[cardId];

    if (!dbCard || dbCard.state !== 'prevcard') {
      console.log('card is not a valid prevcard');
      return;
    }

    setprevCardReleased(prevCard);
    console.log("🚀 ~ ReleasePrevCard ~ prevCard:", prevCard)

    // 4️⃣ Determine correct index in hand (DB-authoritative)
    const handSize = Object.values(room.cards).filter(
      (c: any) => c.owner === currentPlayer && c.state === 'hand',
    ).length;

    // 5️⃣ Update card ownership in Firebase
    await database().ref(`room/${roomId}/cards/${cardId}`).update({
      owner: currentPlayer,
      state: 'prevcard',
      faceup: true,
      indexInHand: handSize,
    });

    // 6️⃣ Advance turn
    // const playerCount = Object.keys(room.players).length;
    // const currentIndex = Number(currentPlayer.slice(1));
    // const nextIndex = (currentIndex % playerCount) + 1;

    // await database()
    //   .ref(`room/${roomId}`)
    //   .update({
    //     activePlayer: `p${nextIndex}`,
    //   });

    // 7️⃣ Clear local selection
    setPrevCard(undefined);
    setCardSent(true);
  };

  async function removeHighestCards(card: CardData, player: playerId) {
    console.log('im startinf removing card');
    if (!room?.cards || room.activePlayer !== player) return;

    console.log('i am here removeHighestCards');

    // console.log("🚀 ~ removeHighestCards ~ prevCardReleased:", prevCardReleased)
    console.log(
      '🚀 ~ removeHighestCards ~ prevCardReleased?.meta.id:',
      prevCardReleased?.meta.id,
    );
    console.log('🚀 ~ removeHighestCards ~ card.meta.id:', card.meta.id);
    if (prevCardReleased?.meta.id === card.meta.id) {
      console.log('i am here ');
      console.log('this card cannot be sent try with another card');
      return;
    }
    console.log('i am here removeHighestCards later');

    let oldPrevCard = {};
    if (prevCard) {
      oldPrevCard = prevCard;
    }

    // 1. Get all cards in this player's hand from the DB state
    const handCards = Object.entries(room.cards)
      .filter(([_, c]: any) => c.owner === player && c.state === 'hand')
      .map(([id, c]: any) => ({ id: Number(id), ...c }));

    // 2. Find matching priority cards
    const samePriority = handCards.filter(c => {
      // We match against the local 'cards' metadata for priority
      const localCard = cards.find(x => x.meta.id === c.id);
      return localCard?.meta.priority === card.meta.priority;
    });

    if (samePriority.length === 0) return;

    // 3. Prepare a single update object
    const updates: Record<string, any> = {};

    // Choose the 'prevcard' (the one left on the table)
    const prev = samePriority[samePriority.length - 1];
    const toCollect = samePriority.slice(0, -1);
    toCollect.push(oldPrevCard);

    // Update the prevcard
    updates[`cards/${prev.id}`] = {
      ...room.cards[prev.id],
      state: 'prevcard',
      faceup: true,
    };

    // Update cards to be collected/discarded
    toCollect.forEach(c => {
      if (!room.cards) return;
      updates[`cards/${c.id}`] = {
        ...room.cards[c.id],
        state: 'collected',
        faceup: false,
      };
    });

    // 4. Calculate next player turn
    const players = Object.keys(room.players);
    const currentIndex = players.indexOf(player);
    const nextIndex = (currentIndex + 1) % players.length;
    updates['activePlayer'] = players[nextIndex];

    // 5. Re-index the remaining hand
    const remainingInHand = handCards
      .filter(c => !samePriority.some(sp => sp.id === c.id))
      .sort((a, b) => a.indexInHand - b.indexInHand);

    remainingInHand.forEach((c, i) => {
      updates[`cards/${c.id}/indexInHand`] = i;
    });

    // 6. Execute atomic update
    try {
      await database().ref(`room/${roomId}`).update(updates);

      // Locally set the prevCard so your UI knows which one it is
      const localPrev = cards.find(c => c.meta.id === prev.id);
      if (localPrev) setPrevCard(localPrev);
    } catch (error) {
      console.error('Failed to update cards:', error);
    }
    setCardSent(false);
    setprevCardReleased(undefined);
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

  const animateCardToHand = (card: CardData) => {
    'worklet';

    card.faceup.value = true;

    const hand = getHandForPlayer(card.owner.value);
    const index = hand.length - 1;
    const target = computeHandTarget(index, card.owner.value);

    if (!target) return;
    card.handTarget.value = target;

    card.x.value = withTiming(target.x, {
      duration: 400,
      easing: Easing.out(Easing.quad),
    });

    card.y.value = withTiming(target.y, {
      duration: 400,
      easing: Easing.out(Easing.quad),
    });
  };

  const animateCardToPrev = (card: CardData) => {
    'worklet';

    card.faceup.value = true;

    card.x.value = withTiming(prevCardX, {
      duration: 400,
      easing: Easing.out(Easing.quad),
    });

    card.y.value = withTiming(prevCardY, {
      duration: 400,
      easing: Easing.out(Easing.quad),
    });
  };

  const animateCardToCollected = (card: CardData) => {
    'worklet';

    const popY = card.y.value - 30;

    card.y.value = withSequence(
      withTiming(popY, { duration: 300 }),
      withDelay(300, withTiming(discardedCardY, { duration: 600 })),
    );

    card.x.value = withDelay(
      600,
      withTiming(discardedCardX, { duration: 600 }),
    );

    card.faceup.value = false;
  };

  useEffect(() => {
    for (let i = 0; i < playersCount; i++) {
      const player = `p${i + 1}` as playerId;
      const hand = getHandForPlayer(player);

      hand.forEach((card, index) => {
        const target = computeHandTarget(index, player);
        if (!target) return;

        card.handTarget.value = target;

        if (card.state.value === 'hand') {
          card.x.value = withTiming(target.x, { duration: 400 });
          card.y.value = withTiming(target.y, { duration: 400 });
        }
      });
    }
  }, [room?.cards, gameStarted, playersCount]);

  useEffect(() => {
    if (!gameStarted || !room?.cards || !room?.players) return;

    const players = Object.keys(room.players);

    for (const player of players) {
      const handCount = Object.values(room.cards).filter(
        (c: any) => c.owner === player && c.state === 'hand',
      ).length;

      if (handCount === 0) {
        console.log(
          `[GameWin] Player ${player} has no cards left and wins the game.`,
        );

        setWinningPlayer(player);

        endingManually();
        break;
      }
    }
  }, [gameStarted, room?.cards, room?.players]);

  useEffect(() => {
    if (!gameStarted || !room?.cards) return;

    cards.forEach(card => {
      const prevState = prevCardStateRef.current[card.meta.id];
      const nextState = card.state.value;

      // First render
      if (!prevState) {
        prevCardStateRef.current[card.meta.id] = nextState;
        return;
      }

      // 🔹 HAND ENTER
      if (prevState !== 'hand' && nextState === 'hand') {
        const index = card.indexInHand.value ?? 0;
        const target = computeHandTarget(index, card.owner.value);
        if (target) {
          card.handTarget.value = target;
          animateCardToHand(card);
        }
      }

      // 🔹 PREVCARD ENTER
      if (prevState !== 'prevcard' && nextState === 'prevcard') {
        animateCardToPrev(card);
      }

      // 🔹 COLLECTED ENTER
      if (prevState !== 'collected' && nextState === 'collected') {
        animateCardToCollected(card);
      }

      prevCardStateRef.current[card.meta.id] = nextState;
    });
  }, [room?.cards, gameStarted]);

  const getMyPlayerId = () => {
    if (!room) return;
    const id = Object.entries(room.players).find(
      ([_, player]) => player.userId === user.uid,
    )?.[0] as playerId | null;
    if (id) setMyId(id);
    return id;
  };

  const canDrawFromDeck = async () => {
    // Pull values from REFS, not state
    const currentRoom = await getRoomSnap(roomId);
    const currentMeId = user.uid;
    console.log('🚀 ~ canDrawFromDeck ~ currentMeId:', currentMeId);

    console.log(
      '🚀 ~ canDrawFromDeck ~ currentRoom?.activePlayer:',
      currentRoom?.activePlayer,
    );
    if (!currentRoom?.activePlayer) {
      console.log('currentRoom is missing data', {
        active: currentRoom?.activePlayer,
        me: currentMeId,
      });
      return false;
    }

    console.log(
      '🚀 ~ canDrawFromDeck ~ currentRoom.players:',
      currentRoom.players,
    );

    const currentMe = Object.entries(currentRoom.players).find(
      ([_, player]) => player.userId === currentMeId,
    )?.[0] as playerId | null;

    if (!currentMe) {
      console.log('current me is not present');
      return false;
    }

    // Use trim and lowerCase to prevent "p1" vs "p1 " mismatches
    const active = currentRoom.activePlayer.toString().trim().toLowerCase();
    console.log('🚀 ~ canDrawFromDeck ~ active:', active);
    const me = currentMe.toString().trim().toLowerCase();
    console.log('🚀 ~ canDrawFromDeck ~ me:', me);

    return active === me;
  };

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .runOnJS(true)
    .onStart(async event => {
      if (gameEnded) {
        newGame();
        return;
      }
      console.log('hi from tapges function');

      for (let i = cards.length - 1; i >= 0; i--) {
        const card = cards[i];

        if (!cardHitTest(event.x, event.y, card)) continue;

        // 🔹 1. Player stack (open hand)
        if (card.state.value === 'player') {
          console.log('player card clicked');
          setactiveDeck(true);
          return;
        }

        // 🔹 2. Deck draw
        if (card.state.value === 'deck') {
          console.log('deck card clicked');
          if (card.state.value === 'deck') {
            ReleaseOneMoreCard();
            return;
          }

          // console.log('🚀 ~ Playground ~ canDrawFromDeck:', canDrawFromDeck());
          // if (!canDrawFromDeck()) return;

          // ReleaseOneMoreCard();
          return;
        }

        // 🔹 3. Hand card interaction
        // if (card.state.value === 'hand') {
        //   console.log('hand card clicked');

        //   if (!room?.activePlayer) return;

        //   const allowed = await canDrawFromDeck();
        //   if (!allowed) {
        //     Alert.alert('Not your turn');
        //     return;
        //   }

        //   // LOCK: Check if the card belongs to the local user
        //   // if (card.owner.value !== myPlayerId) {
        //   //   Alert.alert('Invalid Move', 'This is not your card!');
        //   //   return;
        //   // }

        //   // LOCK: Check if it's the local user's turn
        //   // if (room.activePlayer !== myPlayerId) {
        //   //   Alert.alert(
        //   //     'Wait your turn',
        //   //     `It is currently ${room.activePlayer}'s turn.`,
        //   //   );
        //   //   return;
        //   // }

        //   // If both pass, proceed to game logic
        //   removeHighestCards(card, room.activePlayer);
        //   return;
        // }
        if (card.state.value === 'hand') {
          console.log('hand card clicked');

          const allowed = await canDrawFromDeck();
          if (!allowed) {
            console.log('can draw allowed');
            Alert.alert('Not your turn');
            return;
          }
          const myPlayerId = getMyPlayerId();
          console.log('🚀 ~ Playground ~ myPlayerId:', myPlayerId);

          if (!room?.activePlayer || !myPlayerId) {
            console.log('active player or id not present', myPlayerId);
            console.log('active player or id not present', room?.activePlayer);
            return;
          }

          // 🔒 Turn lock (authoritative DB check)
          if (room.activePlayer !== myPlayerId) {
            console.log('player is not active');
            Alert.alert('Not your turn');
            return;
          }

          // 🔒 Ownership lock
          if (card.owner.value !== myPlayerId) {
            console.log('player is not other device');

            Alert.alert('This is not your card');
            return;
          }

          // ✅ Allowed move
          console.log('all checks passed will remove now');

          await removeHighestCards(card, myPlayerId);
          return;
        }

        // 🔹 4. Previous card pickup
        if (card.state.value === 'prevcard') {
          console.log('prevcard card clicked');

          ReleasePrevCard();
          return;
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

  async function newGame() {
    await update(roomRef, {
      status: 'waiting',
      cards: null,
      deck: null,
      activePlayer: null,
    });

    setGameStarted(false);
    setdeckFlattened(false);
    setPrevCard(undefined);
    setShowModal(false);
    playersOpenedCards.value = 0;
  }

  const handleCancel = () => {
    setShowModal(false);
    setQuitConfirmation(false);
    setQuitModal(false);
  };
  const handleResult = () => {
    setShowModal(false);
    setGameEnded(true);
    playersOpenedCards.value = 0;
  };

  const confirmQuit = () => {
    setQuitConfirmation(true);
    setQuitModal(true);
  };

  const endingManually = async () => {
    setQuitConfirmation(false);
    setQuitModal(false);

    if (!room?.cards || !room?.players) return;

    const cardsMap = room.cards;

    const players = Object.keys(room.players);

    // const scores = players.map(playerId => {
    //   const score = Object.entries(cardsMap)
    //     .filter(([_, c]: any) => c.owner === playerId && c.state === 'hand')
    //     .reduce((sum, [id]) => {
    //       const localCard = cards.find(c => c.meta.id === Number(id));
    //       return sum + (localCard?.meta.priority ?? 0);
    //     }, 0);

    //   return { playerId, score };
    // });

    // const minScore = Math.min(...scores.map(s => s.score));

    // const winners = scores
    //   .filter(s => s.score === minScore)
    //   .map(s => s.playerId);

    // await update(roomRef, {
    //   status: 'ended',
    //   result: {
    //     winners,
    //     scores,
    //     endedAt: Date.now(),
    //   },
    // });

    // setWinningPlayer(winners.join(' & '));
    playersOpenedCards.value = 0;
    setShowModal(true);
    setPreviosCardReleased(false);
    setCardReleased(false);
  };

  const db = database;

  const startGame = async () => {
    setdeckFlattened(true);
    // dealing();
  };

  const sortedCards = useMemo(() => {
    // If cards is undefined/null, return empty array to prevent crash
    if (!cards || cards.length === 0) return [];

    // Create a shallow copy to sort without mutating the original shared value reference
    return [...cards].sort((a, b) => {
      const statePriority = {
        collected: 1, // Bottom layer
        deck: 2,
        player: 3,
        hand: 4,
        prevcard: 5,
        show: 6, // Top layer (active/dragging)
      };

      // Get priority, default to 0 if state is missing
      const priorityA = a.state ? statePriority[a.state.value] : 0;
      const priorityB = b.state ? statePriority[b.state.value] : 0;

      // Primary Sort: By State (Layering)
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Secondary Sort: By ID (Stability)
      // Ensures cards don't "flicker" swap positions when in the same state
      return (a.meta?.id || 0) - (b.meta?.id || 0);
    });
  }, [cards]); // Only re-run this heavy sort when 'cards' array reference changes

  console.log('🚀 ~ Playground ~ sortedCards:', sortedCards);

  useEffect(() => {
    console.log('🚀 ~ Playground ~ roomId:', roomId);
    if (!roomId) return;

    const roomRef = database().ref(`room/${roomId}`);

    const unsubscribe = onValue(roomRef, snapshot => {
      const roomData = snapshot.val();

      console.log('🚀 ~ Playground ~ roomData:', roomData);
      if (roomData) {
        const playerCount = roomData.players
          ? Object.keys(roomData.players).length
          : 0;

        // DEBUG: Help trace dealing issues
        if (roomData.status === 'playing' && !roomData.cards) {
          console.log('[GameLoop] Checking Deal Conditions:', {
            isHost: roomData.hostUid === user?.uid,
            alreadyDealt: hasDealtRef.current,
            playersReady: playerCount === roomData.playerCount,
          });
        }

        // HOST LOGIC: Deal cards only if specific conditions are met
        if (
          roomData.status === 'playing' &&
          roomData.hostUid === user?.uid &&
          !roomData.cards &&
          !hasDealtRef.current &&
          playerCount === roomData.playerCount
        ) {
          console.log('Host initiating deal...');
          setdeckFlattened(true);
          hasDealtRef.current = true; // Lock immediately to prevent double deal
          dealCardsHostOnly(roomId, roomData, roomRef);
        }

        // CLIENT LOGIC: Check if game is ready to render
        if (roomData?.cards && roomData?.deck) {
          // Only set this if it's currently false to prevent extra re-renders
          setGameStarted(prev => (!prev ? true : prev));
        }

        setGameRoomData(roomData);
        setroom(roomData);
      }
    });

    return () => unsubscribe();
  }, [roomId, user]); // Added 'user' to dependencies as requested
  return (
    <View style={{ width: width, height: height, backgroundColor: '#1e1e1e' }}>
      {/* --- MODALS --- */}
      {quitConfirmation && (
        <EndModal
          visible={quitModal}
          onClose={() => handleCancel()}
          onProceed={() => endingManually()}
          heading={'Quit Game'}
          message={`Are you sure you want to end the game?`}
          button1="Cancel"
          button2="Quit"
        />
      )}

      {winningPlayer && (
        <EndModal
          visible={showModal}
          player={winningPlayer}
          onClose={() => handleResult()}
          onProceed={() => newGame()}
          heading={'Game Ended'}
          message={`${winningPlayer} has won the game`}
          button1="Result"
          button2="New Game"
        />
      )}

      {/* --- LOBBY VIEW --- */}
      {!gameStarted ? (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            borderColor: '#fdd702ff',
            borderWidth: 2,
          }}
        >
          <View>
            <TextInput
              value={roomId?.toString()}
              onChangeText={text => {
                const numericValue = text.replace(/[^0-9]/g, '');
                setRoomId(numericValue ? parseInt(numericValue, 10) : 0);
              }}
              keyboardType="numeric"
              placeholderTextColor="#888"
              placeholder="Enter Room ID"
              style={{
                color: '#fff',
                backgroundColor: '#2f2f31ff',
                width: 200,
                padding: 10,
                marginBottom: 20,
                borderRadius: 8,
              }}
            />
          </View>

          <View style={{ gap: 10 }}>
            <Button
              title="Join Room"
              onPress={async () => {
                if (user?.uid) {
                  console.log('join room is called');
                  const result = await JoinRoom(roomId, user?.uid);
                  if (result.startGame) {
                    console.log('joining sucessfull');
                    setPlayersCount(result.PlayerQty);
                  }
                }
              }}
            />
            <Button
              title="Create Room"
              color="#4CAF50"
              onPress={async () => {
                console.log('create room is called');
                if (user) await createRoom(user?.uid);
                console.log('rom creation done');
              }}
            />
          </View>
        </View>
      ) : (
        /* --- GAME BOARD VIEW --- */
        <GestureHandlerRootView
          style={{ flex: 1, borderWidth: 2, borderColor: '#006effff' }}
        >
          <GestureDetector gesture={tapGesture}>
            <Canvas style={{ flex: 1 }}>
              {/* 1. Background Layer */}
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

              {/* 2. Table Layer */}
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

              {/* 3. User Avatars Layer */}
              <Group>
                {userPositions.map((p, i) => (
                  <Group key={i}>
                    {userImage && (
                      <Image
                        image={userImage}
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

              {/* 4. Cards Layer (USING SORTED CARDS) */}
              <Group>
                {sortedCards.map(card => (
                  <Card
                    key={card.meta.id}
                    x={card.x}
                    y={card.y}
                    owner={card.owner} // Pass the SharedValue
                    state={card.state} // Pass the SharedValue
                    myId={myId} // Pass the string ID
                    backCardImg={backCardImg}
                    faceCardImg={card.cardFaceImg}
                    cardWidth={cardWidth}
                    cardHeight={cardHeight}
                  />
                ))}
              </Group>
            </Canvas>
          </GestureDetector>

          {/* 5. UI Overlay (Buttons) */}
          {/* Note: Ensure playersOpenedCards.value is synced to state if you want this to appear/disappear reactively, 
              otherwise wrap this View in a Reanimated Component */}
          {gameStarted && (
            <View
              style={{
                position: 'absolute',
                left: endBtnPos.x,
                top: endBtnPos.y,
                width: 100, // Increased width for text
                height: 40,
                zIndex: 100, // Ensure it's clickable
              }}
            >
              {/* FIX: Use a React State variable here, NOT activePlayer.value directly */}
              <Button
                title={`End Turn`}
                color="#d62929ff"
                onPress={() => confirmQuit()}
                disabled={previosCardReleased || cardReleased}
              />
            </View>
          )}
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
