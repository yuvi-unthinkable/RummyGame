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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardMeta, CardState, useDeck } from './cardTypes';
import EndModal from './EndModal';

import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// import { UserContext } from '../context/UserContext';
import { RootStackParamList } from '../navigators/types';
import { useNavigation } from '@react-navigation/native';
import { createRoom, JoinRoom, Player, RoomData } from '../Backend/Room';
import { useUser } from '../context/UserContext';
import { NetworkCard, useGameStarted } from '../Backend/useGameStarted';
import { getRoomSnap, UpdateCardData } from '../services/db.service';
import Card from './Card';
import { GameButton } from './GameButton';

// import { auth, database } from '../context/Firebase';
// import { get, set, update } from 'firebase/database';
import {
  getDatabase,
  ref,
  update,
  onValue,
} from '@react-native-firebase/database';
import { getApp } from '@react-native-firebase/app';

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

type HandCard = {
  id: number;
  indexInHand: number;
};

// type player = 'p1' | 'p2';
type EndButtonVisible = Record<playerId, boolean>;

type LogicalCard = {
  id: number;
  owner: playerId;
  state: CardState;
  indexInHand: number | null;
  faceup: boolean;
};

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
  const [gameRoomData, setGameRoomData] = useState<RoomData | null>(null);
  const [deckFlattened, setdeckFlattened] = useState(false);
  const [myId, setMyId] = useState('');
  const [prevCardReleased, setprevCardReleased] = useState<CardData | null>(
    null,
  );

  const [gameStarted, setGameStarted] = useState(false);

  const lastAppliedTurnRef = useRef<number | null>(null);
  const hasInitializedFromRoomRef = useRef(false);

  const navigation = useNavigation<NavigationProp>();

  const [cardSent, setCardSent] = useState(false);

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
  const [room, setroom] = useState<RoomData | null>(null);
  const [allSameCards, setAllSameCards] = useState(false);
  const prevStateRef = useRef<Record<number, CardState>>({});
  const prevIndexRef = useRef<Record<number, number | null>>({});

  const db = getDatabase(getApp());

  useEffect(() => {
    if (room?.status === 'playing') {
      // console.log('🚀 ~ Playground ~ gameStarted:', gameStarted);
      setGameStarted(true);
    }
    return;
  }, [room]);

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

    return positions;
  }, [playersCount, width, height, userSize]);

  const handStartX = userPositions;

  function computeHandTarget(index: number, owner: string) {
    if (owner === 'unset' || !owner) {
      console.log('owner is not present');
      return { x: 0, y: 0 }; // Guard clauseuE
    }
    const playerIndex = parseInt(owner.slice(1), 10) - 1;
    const target = handStartX[playerIndex];
    if (!target) {
      console.log('target is not present');
      return { x: 0, y: 0 }; // Prevent null object access
    }
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

  function getHandForPlayer(room: RoomData, playerId: playerId): NetworkCard[] {
    const map = room.players[playerId]?.handCards;
    return map ? Object.values(map).filter(Boolean) : [];
  }

  const endBtnPos = {
    x: width / 2 - 30,
    y: (height * 4) / 5,
  };

  let cards: CardData[] = useGameStarted(roomId, gameStarted, room?.players);

  const cardsReady = cards.length === cardDeck.length && cards.length > 0;

  const logicalCards = useMemo<LogicalCard[]>(() => {
    if (!room) return [];

    const result: LogicalCard[] = [];

    Object.entries(room.players ?? {}).forEach(([pid, player]) => {
      Object.values(player.handCards ?? {}).forEach(c => {
        result.push({
          id: c.id,
          owner: pid,
          state: 'hand',
          indexInHand: c.indexInHand ?? null,
          faceup: c.faceup,
        });
      });
    });

    if (room.PreviousCard) {
      result.push({
        id: room.PreviousCard.id,
        owner: 'unset',
        state: 'prevcard',
        indexInHand: null,
        faceup: true,
      });
    }

    Object.values(room.abandonedCards ?? {}).forEach(c => {
      result.push({
        id: c.id,
        owner: 'unset',
        state: 'collected',
        indexInHand: null,
        faceup: false,
      });
    });

    room.deck?.order?.forEach(id => {
      result.push({
        id,
        owner: 'unset',
        state: 'deck',
        indexInHand: null,
        faceup: false,
      });
    });

    return result;
  }, [room]);

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
    if (!user?.uid) return;
    if (room.hostUid !== user.uid) return;

    const alreadyDealt = Object.values(room.players).some(p => {
      const hand = Object.values(p.handCards ?? {}).filter(Boolean);
      return hand.length > 0;
    });
    if (alreadyDealt) return;

    const players = Object.keys(room.players);
    const cardsPerPlayer = 5;

    const deckOrder = shuffle([...Array(52).keys()]);

    const hands: Record<string, Record<number, NetworkCard>> = {};

    players.forEach(p => (hands[p] = {}));

    deckOrder.slice(0, players.length * cardsPerPlayer).forEach((cardId, i) => {
      const owner = players[i % players.length];
      const indexInHand = Math.floor(i / players.length);

      // hands[owner].push({
      //   id: cardId,
      //   owner,
      //   state: 'hand',
      //   faceup: true,
      //   indexInHand,
      //   priority: cardDeck[cardId].priority,
      // });

      hands[owner][cardId] = {
        id: cardId,
        owner,
        state: 'hand',
        faceup: true,
        indexInHand,
        priority: cardDeck[cardId].priority,
      };
    });

    // 4️⃣ Remaining deck
    const dealtIds = deckOrder.slice(0, players.length * cardsPerPlayer);
    const remainingDeck = deckOrder.filter(id => !dealtIds.includes(id));

    // 5️⃣ Atomic DB update
    const updates: Record<string, any> = {};

    players.forEach(playerId => {
      updates[`players/${playerId}/handCards`] = hands[playerId];
    });

    updates.deck = { order: remainingDeck };
    updates.activePlayer = players[0];
    updates.turnNumber = 0;
    updates.PreviousCard = null;
    updates.abandonedCards = null;
    updates.turnLocks = null;

    try {
      await update(roomRef, updates);
      hasDealtRef.current = true;
      console.log('[Deal] Cards dealt successfully');
      // setGameStarted(true);
      console.log('🚀 ~ dealCardsHostOnly ~ setGameStarted:', gameStarted);
    } catch (err) {
      console.error('[Deal] Failed:', err);
      hasDealtRef.current = false;
    }
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
    if (cardSent) return console.log('[Release] One card already sent');

    if (!room || !room.deck?.order || !room.activePlayer) {
      console.log('[Release] Room not ready');
      return;
    }

    if (!myPlayerId || !room.players[myPlayerId]) {
      console.log('[Release] Player not registered');
      return;
    }

    // 🔒 Authoritative turn check
    if (room.activePlayer !== myPlayerId) {
      console.log('[Release] Not your turn');
      return;
    }

    const handCards = getHandForPlayer(room, myPlayerId);
    const targetCardId = room.deck.order[0];

    if (targetCardId == null) {
      console.log('[Release] No cards left in deck');
      return;
    }

    const handSize = handCards.length;

    // 🔒 SINGLE atomic update
    const updates: Record<string, any> = {
      [`players/${myPlayerId}/handCards/${targetCardId}`]: {
        id: targetCardId,
        owner: myPlayerId,
        state: 'hand',
        faceup: true,
        indexInHand: handSize,
        priority: room.deck.order
          ? undefined // priority already known by clients
          : undefined,
      },
      deck: {
        order: room.deck.order.slice(1),
      },
      turnNumber: (room.turnNumber ?? 0) + 1,
    };

    await update(ref(db, `room/${roomId}`), updates);

    setCardSent(true);
  };

  const ReleasePrevCard = async () => {
    if (cardSent) return console.log('[ReleasePrev] One card already sent');

    if (!room || !room.activePlayer || !myPlayerId) return;

    // 🔒 Authoritative turn check
    if (room.activePlayer !== myPlayerId) {
      console.log('[ReleasePrev] Not your turn');
      return;
    }

    if (!room.PreviousCard) {
      console.log('[ReleasePrev] No PreviousCard in room');
      return;
    }

    const prev = room.PreviousCard;

    // 🔒 Ownership safety
    if (prev.owner && prev.owner !== 'unset') {
      console.log('[ReleasePrev] PreviousCard already owned');
      return;
    }

    const handCards = getHandForPlayer(room, myPlayerId);
    const handSize = handCards.length;

    const updates: Record<string, any> = {
      [`players/${myPlayerId}/handCards/${prev.id}`]: {
        ...prev,
        owner: myPlayerId,
        state: 'hand',
        faceup: true,
        indexInHand: handSize,
      },
      PreviousCard: null,
      [`turnLocks/${myPlayerId}`]: {
        id: prev.id,
        blockedPriority: prev.priority,
        untilTurn: (room.turnNumber ?? 0) + 1,
      },
      turnNumber: (room.turnNumber ?? 0) + 1,
    };

    await update(ref(db, `room/${roomId}`), updates);

    setPrevCard(undefined);
    setCardSent(true);
  };

  // const removeHighestCards = async (card: CardData, player: playerId) => {
  //   if (!room || !room.activePlayer) return;

  //   // ✅ Correct authority check
  //   if (room.activePlayer !== player) return;

  //   const handMap = room.players[player]?.handCards;
  //   if (!handMap) return;

  //   const handCards = Object.values(handMap).filter(Boolean);

  //   const currentTurn = room.turnNumber ?? 0;
  //   const lock = room.turnLocks?.[player];

  //   // 🔒 Turn lock validation
  //   if (lock && lock.id === card.meta.id && currentTurn <= lock.untilTurn) {
  //     Alert.alert(
  //       'Invalid Move',
  //       'You cannot send the card you just picked from previous.',
  //     );
  //     return;
  //   }

  //   console.log('passed blockers');

  //   const allSamePriority = handCards.every(
  //     c => c.priority === card.meta.priority,
  //   );
  //   setAllSameCards(allSamePriority);
  //   console.log('🚀 ~ removeHighestCards ~ allSamePriority:', allSamePriority);

  //   if (
  //     lock &&
  //     currentTurn <= lock.untilTurn &&
  //     !allSamePriority &&
  //     lock.blockedPriority === card.meta.priority
  //   ) {
  //     Alert.alert('Invalid Move', 'You cannot send this priority level yet.');
  //     return;
  //   }

  //   const samePriority = handCards
  //     .filter(c => c.priority === card.meta.priority)
  //     .sort((a, b) => (a.indexInHand ?? 0) - (b.indexInHand ?? 0));
  //   console.log('🚀 ~ removeHighestCards ~ samePriority:', samePriority);

  //   if (samePriority.length === 0) return;

  //   const updates: Record<string, any> = {};

  //   // 1️⃣ Move old PreviousCard to abandoned
  //   console.log(
  //     '🚀 ~ removeHighestCards ~ room.PreviousCard:',
  //     room?.PreviousCard,
  //   );
  //   if (room.PreviousCard) {
  //     updates[`abandonedCards/${room.PreviousCard.id}`] = {
  //       ...room.PreviousCard,
  //       state: 'collected',
  //       faceup: false,
  //       owner: 'unset',
  //       indexInHand: null,
  //     };
  //   }

  //   updates.PreviousCard = null;

  //   const newPrev = samePriority[samePriority.length - 1];
  //   console.log('🚀 ~ removeHighestCards ~ newPrev:', newPrev);
  //   const toCollect = samePriority.slice(0, -1);

  //   samePriority.forEach(c => {
  //     updates[`players/${player}/handCards/${c.id}`] = null;
  //   });

  //   updates.PreviousCard = {
  //     ...newPrev,
  //     state: 'prevcard',
  //     owner: 'unset',
  //     faceup: true,
  //     indexInHand: null,
  //   };

  //   toCollect.forEach(c => {
  //     updates[`abandonedCards/${c.id}`] = {
  //       ...handMap[c.id],
  //       state: 'collected',
  //       faceup: false,
  //       owner: 'unset',
  //       indexInHand: null,
  //     };
  //   });

  //   const players = Object.keys(room.players);
  //   updates.activePlayer =
  //     players[(players.indexOf(player) + 1) % players.length];
  //   updates.turnNumber = currentTurn + 1;

  //   handCards
  //     .filter(c => !samePriority.some(sp => sp.id === c.id))
  //     .sort((a, b) => (a.indexInHand ?? 0) - (b.indexInHand ?? 0))
  //     .forEach((c, i) => {
  //       updates[`players/${player}/handCards/${c.id}/indexInHand`] = i;
  //     });

  //   if (lock && currentTurn + 1 > lock.untilTurn) {
  //     updates[`turnLocks/${player}`] = null;
  //   }

  //   await update(ref(db, `room/${roomId}`), updates);

  //   const prevCard = room.PreviousCard;
  //   console.log('🚀 ~ removeHighestCards ~ prevCard:', prevCard);

  //   const abondnedCards = cards.filter(c => c.state.value === 'collected');
  //   console.log('🚀 ~ removeHighestCards ~ abondnedCards:', abondnedCards);

  //   setCardSent(false);
  // };
  const removeHighestCards = async (card: CardData, player: playerId) => {
    if (!room || !room.activePlayer) {
      console.log('room not ready');
      return;
    }

    const logical = logicalCards.find(c => c.id === card.meta.id);
    if (!logical) return;

    if (logical.owner !== player) {
      Alert.alert('Invalid Move', 'This card does not belong to you');
      return;
    }

    const handMap = room.players[player]?.handCards;
    if (!handMap) return;

    const handCards = Object.values(handMap).filter(Boolean);

    const currentTurn = room.turnNumber ?? 0;
    const lock = room.turnLocks?.[player];

    if (lock && lock.id === logical.id && currentTurn <= lock.untilTurn) {
      Alert.alert(
        'Invalid Move',
        'You cannot send the card you just picked from previous.',
      );
      return;
    }

    console.log('passed blockers');

    // const allSamePriority = handCards.every(
    //   c => c.priority === card.meta.priority,
    // );
    // setAllSameCards(allSamePriority);
    // console.log('🚀 ~ removeHighestCards ~ allSamePriority:', allSamePriority);

    // if (
    //   lock &&
    //   currentTurn <= lock.untilTurn &&
    //   !allSamePriority &&
    //   lock.blockedPriority === card.meta.priority
    // ) {
    //   Alert.alert('Invalid Move', 'You cannot send this priority level yet.');
    //   return;
    // }

    const samePriority = handCards
      .filter(c => c.priority === handMap[logical.id]?.priority)
      .sort((a, b) => (a.indexInHand ?? 0) - (b.indexInHand ?? 0));

    if (samePriority.length === 0) return;

    console.log('🚀 ~ removeHighestCards ~ samePriority:', samePriority);

    const allSamePriority = handCards.every(
      c => c.priority === handMap[logical.id]?.priority,
    );

    if (
      lock &&
      currentTurn <= lock.untilTurn &&
      !allSamePriority &&
      lock.blockedPriority === handMap[logical.id]?.priority
    ) {
      Alert.alert('Invalid Move', 'You cannot send this priority level yet.');
      return;
    }

    const updates: Record<string, any> = {};

    if (room.PreviousCard) {
      updates[`abandonedCards/${room.PreviousCard.id}`] = {
        ...room.PreviousCard,
        state: 'collected',
        faceup: false,
        owner: 'unset',
        indexInHand: null,
      };
    }

    const newPrev = samePriority[samePriority.length - 1];
    const toCollect = samePriority.slice(0, -1);

    samePriority.forEach(c => {
      updates[`players/${player}/handCards/${c.id}`] = null;
    });

    updates.PreviousCard = {
      ...newPrev,
      state: 'prevcard',
      owner: 'unset',
      faceup: true,
      indexInHand: null,
    };

    toCollect.forEach(c => {
      updates[`abandonedCards/${c.id}`] = {
        ...handMap[c.id],
        state: 'collected',
        faceup: false,
        owner: 'unset',
        indexInHand: null,
      };
    });

    const players = Object.keys(room.players);
    updates.activePlayer =
      players[(players.indexOf(player) + 1) % players.length];
    updates.turnNumber = currentTurn + 1;

    handCards
      .filter(c => !samePriority.some(sp => sp.id === c.id))
      .sort((a, b) => (a.indexInHand ?? 0) - (b.indexInHand ?? 0))
      .forEach((c, i) => {
        updates[`players/${player}/handCards/${c.id}/indexInHand`] = i;
      });

    if (lock && currentTurn + 1 > lock.untilTurn) {
      updates[`turnLocks/${player}`] = null;
    }

    await update(ref(db, `room/${roomId}`), updates);

    const prevCard = room.PreviousCard;
    console.log('🚀 ~ removeHighestCards ~ prevCard:', prevCard);

    const abondnedCards = cards.filter(c => c.state.value === 'collected');
    console.log('🚀 ~ removeHighestCards ~ abondnedCards:', abondnedCards);

    setCardSent(false);
  };

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

  const animateCardToHand = (card: CardData, player:string) => {
    'worklet';
    card.faceup.value = true;

    const target = computeHandTarget(
      card.indexInHand.value ?? 0,
      player,
    );
    if (target) {
      // card.x.value = withTiming(target.x, { duration: 350 });
      // card.y.value = withTiming(target.y, { duration: 350 });
      card.x.value = withTiming(target.x, {
        duration: 800,
        easing: Easing.out(Easing.exp),
      });
      card.y.value = withTiming(target.y, {
        duration: 800,
        easing: Easing.out(Easing.exp),
      });
    }
  };

  const animateCardToPrev = (card: CardData) => {
    'worklet';
    card.faceup.value = true;

    card.x.value = withTiming(prevCardX, {
      duration: 800,
      easing: Easing.out(Easing.exp),
    });
    card.y.value = withTiming(prevCardY, {
      duration: 800,
      easing: Easing.out(Easing.exp),
    });
  };

  const animateCardToCollected = (card: CardData) => {
    'worklet';

    const popY = card.y.value - 25;

    card.y.value = withSequence(
      withTiming(popY, { duration: 300 }),
      withDelay(200, withTiming(discardedCardY, { duration: 500 })),
    );

    card.x.value = withDelay(
      200,
      withTiming(discardedCardX, { duration: 500 }),
    );

    card.faceup.value = false;
  };

  // useEffect(() => {
  //   if (!room || !room.players) return;

  //   Object.entries(room.players).forEach(([playerId, player]) => {
  //     const hand = Object.values(player.handCards ?? {}).filter(Boolean);

  //     hand.forEach(handCard => {
  //       const localCard = cards.find(c => c.meta.id === handCard.id);
  //       if (!localCard) return;

  //       localCard.owner.value = playerId;
  //       localCard.state.value = 'hand';
  //       localCard.indexInHand.value = handCard.indexInHand ?? 0;
  //       localCard.faceup.value = handCard.faceup;
  //     });
  //   });

  //   const abondnedCards = Object.values(room.abandonedCards ?? {}).filter(
  //     Boolean,
  //   );

  //   abondnedCards.forEach(handCard => {
  //     const localCard = cards.find(c => c.meta.id === handCard.id);
  //     if (!localCard) return;

  //     localCard.owner.value = 'unset';
  //     localCard.state.value = 'collected';
  //     localCard.faceup.value = false;
  //   });

  //   const deckCards = Object.values(room.abandonedCards ?? {}).filter(Boolean);

  //   deckCards.forEach(handCard => {
  //     const localCard = cards.find(c => c.meta.id === handCard.id);
  //     if (!localCard) return;

  //     localCard.owner.value = 'unset';
  //     localCard.state.value = 'deck';
  //     localCard.faceup.value = false;
  //   });

  //   if (room.PreviousCard) {
  //     const prevcard = room.PreviousCard;
  //     const localCard = cards.find(c => c.meta.id === prevcard.id);
  //     if (!localCard || !prevCard) return;

  //     localCard.owner.value = 'unset';
  //     localCard.state.value = 'prevcard';
  //     localCard.faceup.value = true;
  //   }
  // }, [room]);

  useEffect(() => {
    logicalCards.forEach(lc => {
      const card = cards.find(c => c.meta.id === lc.id);
      if (!card) return;

      card.owner.value = lc.owner;
      card.state.value = lc.state;
      card.indexInHand.value = lc.indexInHand;
      card.faceup.value = lc.faceup;
    });
  }, [logicalCards]);

  // useEffect(() => {
  //   if (!room) return;
  //   Object.entries(room.players ?? {}).forEach(([pid, player]) => {
  //     Object.values(player.handCards ?? {}).forEach(c => {
  //       if (c.state === 'hand') {
  //         const card = cards.find(ca => ca.meta.id === c.id);
  //         if (card) animateCardToHand(card);
  //       }
  //     });
  //   });
  // }, [gameStarted]);

  // useEffect(() => {
  //   console.log('useeffec to position with useeffect');

  //   console.log('🚀 ~ Playground ~ cards:', cards);

  //   cards.forEach(card => {
  //     const currentState = card.state.value;
  //     if (currentState === 'hand') {
  //       // console.log('came to hand');

  //       animateCardToHand(card);
  //     } else if (currentState === 'deck') {
  //       // console.log('came to deck');
  //       card.x.value = withTiming(deckX, { duration: 500 });
  //       card.y.value = withTiming(deckY, { duration: 500 });
  //     } else if (currentState === 'prevcard') {
  //       // console.log('came to prevcard');

  //       animateCardToPrev(card);
  //     } else if (currentState === 'collected') {
  //       // console.log('came to collected');

  //       animateCardToCollected(card);
  //     }
  //   });
  //   console.log('🚀 ~ Playground ~ cards:', cards);
  // }, [room, room?.players]);

  useEffect(() => {
    logicalCards.forEach(lc => {
      const card = cards.find(c => c.meta.id === lc.id);

      if (!card) return;

      const player = lc.owner;

      const prevState = prevStateRef.current[lc.id];
      const prevIndex = prevIndexRef.current[lc.id];

      const stateChanged = prevState !== lc.state;
      const indexChanged = prevIndex !== lc.indexInHand;

      card.faceup.value = lc.faceup;

      if (!stateChanged && !indexChanged) return;

      switch (lc.state) {
        case 'hand':
          animateCardToHand(card,player);
          break;
        case 'deck':
          card.x.value = withTiming(deckX);
          card.y.value = withTiming(deckY);
          break;
        case 'prevcard':
          animateCardToPrev(card);
          break;
        case 'collected':
          animateCardToCollected(card);
          break;
      }

      prevStateRef.current[lc.id] = lc.state;
      prevIndexRef.current[lc.id] = lc.indexInHand;
    });
  }, [logicalCards]);

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
    setroom(currentRoom);
    const currentMeId = user.uid;

    if (!currentRoom?.activePlayer) {
      console.log('currentRoom is missing data', {
        active: currentRoom?.activePlayer,
        me: currentMeId,
      });
      return false;
    }

    const currentMe = Object.entries(currentRoom.players).find(
      ([_, player]) => player.userId === currentMeId,
    )?.[0] as playerId | null;

    if (!currentMe) {
      console.log('current me is not present');
      return false;
    }

    // Use trim and lowerCase to prevent "p1" vs "p1 " mismatches
    const active = currentRoom.activePlayer.toString().trim().toLowerCase();
    const me = currentMe.toString().trim().toLowerCase();

    return active === me;
  };

  const getLogicalCard = (id: number) => logicalCards.find(c => c.id === id);

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .runOnJS(true)
    .onStart(async event => {
      if (gameEnded) {
        newGame();
        return;
      }

      for (let i = cards.length - 1; i >= 0; i--) {
        const card = cards[i];

        // Hit test still uses SharedValues (correct)
        if (!cardHitTest(event.x, event.y, card)) continue;

        const logical = getLogicalCard(card.meta.id);
        if (!logical) return;

        // 🔒 Universal authority checks
        if (!room || !myPlayerId) return;

        // ===============================
        // DECK DRAW
        // ===============================
        if (logical.state === 'deck') {
          if (room.activePlayer !== myPlayerId) {
            Alert.alert('Not your turn');
            return;
          }

          await ReleaseOneMoreCard();
          return;
        }

        // ===============================
        // PREVIOUS CARD PICKUP
        // ===============================
        if (logical.state === 'prevcard') {
          if (room.activePlayer !== myPlayerId) {
            Alert.alert('Not your turn');
            return;
          }

          await ReleasePrevCard();
          return;
        }

        // ===============================
        // HAND CARD PLAY
        // ===============================
        if (logical.state === 'hand') {
          if (room.activePlayer !== myPlayerId) {
            Alert.alert('Not your turn');
            return;
          }

          if (logical.owner !== myPlayerId) {
            Alert.alert('This is not your card');
            return;
          }

          await removeHighestCards(card, myPlayerId);
          return;
        }

        // ===============================
        // EVERYTHING ELSE → IGNORE
        // ===============================
        return;
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
    await update(ref(db, `room/${roomId}`), {
      status: 'waiting',
      cards: null,
      deck: null,
      activePlayer: null,
    });
    hasDealtRef.current = false; // 🔴 REQUIRED
    // setGameStarted(false);
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

    if (!room || !room?.players || !room?.activePlayer) return;

    const hand = getHandForPlayer(room, room?.activePlayer);

    const cardsMap = hand;

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
    setCardReleased(false);
  };

  const startGame = async () => {
    setdeckFlattened(true);
    // dealing();
  };

  // const sortedCards = useMemo(() => {
  //   // If cards is undefined/null, return empty array to prevent crash
  //   if (!room || !room.deck || room.deck.order?.length === 0) return [];

  //   // Create a shallow copy to sort without mutating the original shared value reference
  //   return [...cards].sort((a, b) => {
  //     const statePriority = {
  //       collected: 1, // Bottom layer
  //       deck: 2,
  //       player: 3,
  //       hand: 4,
  //       prevcard: 5,
  //       show: 6, // Top layer (active/dragging)
  //     };

  //     // Get priority, default to 0 if state is missing
  //     const priorityA = a.state ? statePriority[a.state.value] : 0;
  //     const priorityB = b.state ? statePriority[b.state.value] : 0;

  //     // Primary Sort: By State (Layering)
  //     if (priorityA !== priorityB) {
  //       return priorityA - priorityB;
  //     }

  //     // Secondary Sort: By ID (Stability)
  //     // Ensures cards don't "flicker" swap positions when in the same state
  //     return (a.meta?.id || 0) - (b.meta?.id || 0);
  //   });
  // }, [cards]); // Only re-run this heavy sort when 'cards' array reference changes

  // useEffect(() => {
  //   // console.log('UseEffectCalleds');
  //   if (!roomId) return;
  //   const roomRef = ref(db, `room/${roomId}`);

  //   const unsubscribe = onValue(roomRef, snapshot => {
  //     const roomData: RoomData = snapshot.val();

  //     if (roomData) {
  //       const playerCount = roomData.players
  //         ? Object.keys(roomData.players).length
  //         : 0;

  //       setroom(roomData);

  //       if (
  //         roomData.status === 'playing' &&
  //         roomData.hostUid === user?.uid &&
  //         !roomData.players['p1'].handCards &&
  //         !hasDealtRef.current &&
  //         playerCount === roomData.playerCount
  //       ) {
  //         console.log('Host initiating deal...');
  //         setdeckFlattened(true);
  //         hasDealtRef.current = true; // Lock immediately to prevent double deal
  //         setroom(roomData);
  //         dealCardsHostOnly(roomId, roomData, roomRef);
  //         return;
  //       }
  //     }
  //   });

  //   return () => unsubscribe();
  // }, [roomId, user]);

  useEffect(() => {
    console.log('🚀 ~ Playground ~ roomId:', roomId);
    if (!roomId) return;

    const roomRef = ref(db, `room/${roomId}`);

    const unsubscribe = onValue(roomRef, snapshot => {
      const roomData = snapshot.val();

      console.log(
        'updating>>>>>>>>>>>>>>>>>',
        snapshot.exists(),
        snapshot.val(),
      );

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
          !roomData.players.p1.handcards &&
          !hasDealtRef.current &&
          playerCount === roomData.playerCount
        ) {
          console.log('Host initiating deal...');
          setdeckFlattened(true);
          hasDealtRef.current = true; // Lock immediately to prevent double deal
          dealCardsHostOnly(roomId, roomData, roomRef);
        }

        // CLIENT LOGIC: Check if game is ready to render
        if (roomData?.players?.p1?.handCards && roomData?.deck) {
          // Only set this if it's currently false to prevent extra re-renders
          setGameStarted(prev => (!prev ? true : prev));
        }

        setGameRoomData(roomData);
        setroom(roomData);
      }
    });

    return () => unsubscribe();
  }, [roomId, user]);

  // console.log('room>>>>>>>>>>>>>>..', room);

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
            <GameButton
              title="Join Room"
              onPress={async () => {
                if (user?.uid) {
                  const result = await JoinRoom(roomId, user.uid);
                  if (result.startGame) {
                    console.log('joined the room');
                    setPlayersCount(result.PlayerQty);
                  }
                }
              }}
            />

            <GameButton
              title="Create Room"
              onPress={async () => {
                if (user?.uid) await createRoom(user.uid);
                console.log('created the room');
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
                {cards.map(card => (
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
                    activePlayer={room?.activePlayer}
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
              {/* <GameButton
                title="End Turn"
                danger
                onPress={confirmQuit}
                disabled={previosCardReleased || cardReleased}
              /> */}
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
