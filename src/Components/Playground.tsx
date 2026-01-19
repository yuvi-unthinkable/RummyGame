import {
  Canvas,
  Group,
  Image,
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
import { RootStackParamList } from '../navigators/types';
import { useNavigation } from '@react-navigation/native';
import { createRoom, JoinRoom, Player, RoomData } from '../Backend/Room';
import { useUser } from '../context/UserContext';
import { NetworkCard, useGameStarted } from '../Backend/useGameStarted';
import { getRoomSnap, UpdateCardData } from '../services/db.service';
import Card from './Card';
import { GameButton } from './GameButton';

import {
  getDatabase,
  ref,
  update,
  onValue,
  set,
} from '@react-native-firebase/database';
import { getApp } from '@react-native-firebase/app';
import CreateGameModal from './CreateGameRoomModal';
import CreateGameRoomModal from './CreateGameRoomModal';
import JoinGameRoomModal from './JoinGameRoomModal';

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

type EndButtonVisible = Record<playerId, boolean>;

type LogicalCard = {
  id: number;
  owner: playerId;
  state: CardState;
  indexInHand: number | null;
};

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
  const [CreateRoomModal, setCreateRoomModal] = useState(false);
  const [JoinRoomModal, setJoinRoomModal] = useState(false);
  const [activeDeck, setactiveDeck] = useState(false);
  const [playersCount, setPlayersCount] = useState(2);
  const [roomId, setRoomId] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);
  const [gameRoomData, setGameRoomData] = useState<RoomData | null>(null);
  const [deckFlattened, setdeckFlattened] = useState(false);
  const [myId, setMyId] = useState('');
  const [showQuitModal, setShowQuitModal] = useState(false);

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
      setGameStarted(true);
    } else if (room?.status !== 'ended') return;

    const winners = room.result?.winners;
    if (!winners?.length) return;

    setWinningPlayer(winners);
    setShowModal(true);
  }, [room?.status]);

  useEffect(() => {
    if (!room) return;
    if (room.deck != null) return;
    if (!room.abandonedCards) return;

    const rebuildDeck = async () => {
      const cards = Object.values(room.abandonedCards || [])
        .filter((c): c is NetworkCard => c != null)
        .map(c => c.id);

      if (cards.length === 0) return;

      const deckRef = ref(db, `room/${roomId}/deck`);
      const abondnedCardsRef = ref(db, `room/${roomId}/abandonedCards`);

      await update(deckRef, {
        order: cards,
      });
      await set(abondnedCardsRef, null);
    };

    rebuildDeck();
  }, [room, roomId]);

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

  function getNextHandIndex(handCards: NetworkCard[]): number {
    if (handCards.length === 0) return 0;

    return Math.max(...handCards.map(c => c.indexInHand ?? -1)) + 1;
  }

  const HAND_START_X = (cardWidth * 4) / 2;

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

    Object.entries(room.players ?? {})
      .filter(Boolean)
      .forEach(([pid, player]) => {
        Object.values(player.handCards ?? {})
          .filter((c): c is NetworkCard => c != null)
          .forEach(c => {
            result.push({
              id: c.id,
              owner: pid,
              state: 'hand',
              indexInHand: c.indexInHand ?? null,
            });
          });
      });

    if (room.PreviousCard) {
      result.push({
        id: room.PreviousCard.id,
        owner: 'unset',
        state: 'prevcard',
        indexInHand: null,
      });
    }

    Object.values(room.abandonedCards ?? {})
      .filter(Boolean)
      .forEach(c => {
        result.push({
          id: c.id,
          owner: 'unset',
          state: 'collected',
          indexInHand: null,
        });
      });

    room.deck?.order?.forEach(id => {
      result.push({
        id,
        owner: 'unset',
        state: 'deck',
        indexInHand: null,
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

  const orderedHands = useMemo(() => {
    const map: Record<string, LogicalCard[]> = {};

    logicalCards.forEach(c => {
      if (c.state !== 'hand') return;

      if (!map[c.owner]) map[c.owner] = [];
      map[c.owner].push(c);
    });

    Object.values(map).forEach(hand => {
      hand.sort((a, b) => {
        const ai = a.indexInHand ?? 0;
        const bi = b.indexInHand ?? 0;
        return ai - bi;
      });
    });

    return map;
  }, [logicalCards]);

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

      hands[owner][cardId] = {
        id: cardId,
        owner,
        state: 'hand',
        indexInHand,
        priority: cardDeck[cardId].priority,
      };
    });

    const dealtIds = deckOrder.slice(0, players.length * cardsPerPlayer);
    const remainingDeck = deckOrder.filter(id => !dealtIds.includes(id));

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
    setCardSent(true);

    if (!room || !room.deck?.order || !room.activePlayer) {
      console.log('[Release] Room not ready');
      return;
    }

    if (room?.status === 'ended') return;

    if (!myPlayerId || !room.players[myPlayerId]) {
      console.log('[Release] Player not registered');
      return;
    }

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

    const nextIndex = getNextHandIndex(handCards);

    const updates: Record<string, any> = {
      [`players/${myPlayerId}/handCards/${targetCardId}`]: {
        id: targetCardId,
        owner: myPlayerId,
        state: 'hand',
        indexInHand: nextIndex,
        priority: cardDeck[targetCardId].priority,
      },
      deck: {
        order: room.deck.order.slice(1),
      },
      turnNumber: (room.turnNumber ?? 0) + 1,
    };

    await update(ref(db, `room/${roomId}`), updates);
  };

  const ReleasePrevCard = async () => {
    setCardSent(true);

    if (!room || !room.activePlayer || !myPlayerId) return;

    if (room?.status === 'ended') return;

    if (room.activePlayer !== myPlayerId) {
      console.log('[ReleasePrev] Not your turn');
      return;
    }

    if (!room.PreviousCard) {
      console.log('[ReleasePrev] No PreviousCard in room');
      return;
    }

    const prev = room.PreviousCard;

    if (prev.owner && prev.owner !== 'unset') {
      console.log('[ReleasePrev] PreviousCard already owned');
      return;
    }

    const handCards = getHandForPlayer(room, myPlayerId);
    const nextIndex = getNextHandIndex(handCards);

    const updates: Record<string, any> = {
      [`players/${myPlayerId}/handCards/${prev.id}`]: {
        ...prev,
        owner: myPlayerId,
        state: 'hand',
        indexInHand: nextIndex,
        priority: prev.priority,
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
  };

  const removeHighestCards = async (card: CardData, player: playerId) => {
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

    if (lock && lock.id === logical.id && currentTurn <= lock.untilTurn) {
      Alert.alert(
        'Invalid Move',
        'You cannot send the card you just picked from previous.',
      );
      setCardSent(true);
      return;
    }

    console.log('passed blockers');

    const clickedPriority = handMap[logical.id]?.priority;
    if (clickedPriority == null) {
      console.log('clickedPriority == null');
      setCardSent(true);
      return;
    }

    let samePriority = handCards.filter(c => c.priority === clickedPriority);
    console.log('🚀 ~ removeHighestCards ~ samePriority:', samePriority);

    if (samePriority.length === 0) {
      console.log('samePriority.length === 0');
      setCardSent(true);
      return;
    }

    console.log('🚀 ~ removeHighestCards ~ samePriority:', samePriority);

    const allSamePriority = samePriority.length === handCards.length;

    let newPrev: NetworkCard;
    let toCollect: NetworkCard[];

    if (allSamePriority && lock) {
      const others = samePriority.filter(c => c.id !== logical.id);

      newPrev = others[0];
      toCollect = others.slice(1);
    } else {
      newPrev = handMap[logical.id];
      toCollect = samePriority.filter(c => c.id !== logical.id);
    }

    if (
      lock &&
      currentTurn <= lock.untilTurn &&
      !allSamePriority &&
      lock.blockedPriority === handMap[logical.id]?.priority
    ) {
      Alert.alert('Invalid Move', 'You cannot send this priority level yet.');
      setCardSent(true);
      return;
    }

    // if (room.PreviousCard) {
    //   updates[`abandonedCards/${room.PreviousCard.id}`] = {
    //     ...room.PreviousCard,
    //     state: 'collected',
    //     owner: 'unset',
    //     indexInHand: null,
    //   };
    // }

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

    // Remove clicked card from hand
    if (!allSamePriority)
      updates[`players/${player}/handCards/${newPrev.id}`] = null;

    // if (allSamePriority) {
    //   newPrev = samePriority[0];
    //   samePriority = samePriority.slice(1);
    // }

    // Set new PreviousCard
    updates.PreviousCard = {
      ...newPrev,
      state: 'prevcard',
      owner: 'unset',
      indexInHand: null,
    };

    // Collect remaining same-priority cards
    toCollect.forEach(c => {
      updates[`players/${player}/handCards/${c.id}`] = null;
      updates[`abandonedCards/${c.id}`] = {
        ...handMap[c.id],
        state: 'collected',
        owner: 'unset',
        indexInHand: null,
      };
    });

    if (!didPlayerWin) {
      const players = Object.keys(room.players);
      updates.activePlayer =
        players[(players.indexOf(player) + 1) % players.length];
      updates.turnNumber = currentTurn + 1;
    }

    handCards
      .filter(c => c.id !== newPrev.id && !toCollect.some(tc => tc.id === c.id))
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
  };

  const getWinner = (clickedPlayer: playerId): playerId | undefined => {
    if (!room) return;

    const scores = Object.keys(room.players).map(playerId => {
      const hand = getHandForPlayer(room, playerId);
      const score = hand.reduce((sum, c) => sum + c.priority, 0);
      return { playerId, score };
    });

    const minScore = Math.min(...scores.map(s => s.score));
    const lowest = scores.filter(s => s.score === minScore);

    // Tie breaker: clicked player loses
    if (lowest.length > 1) {
      const winner = lowest.find(s => s.playerId !== clickedPlayer);
      return winner?.playerId;
    }

    return lowest[0].playerId;
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

  const animateCardToHand = (
    card: CardData,
    player: string,
    visualIndex: number,
  ) => {
    'worklet';

    const target = computeHandTarget(visualIndex, player);
    if (!target) return;
    if (target) {
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

  useEffect(() => {
    logicalCards.forEach(lc => {
      const card = cards.find(c => c.meta.id === lc.id);
      if (!card) return;

      card.owner.value = lc.owner;
      card.state.value = lc.state;
      card.indexInHand.value = lc.indexInHand;

      const isMine = lc.owner === myPlayerId;

      card.faceup.value =
        lc.state === 'hand' ? isMine : lc.state === 'prevcard' ? true : false;
    });
  }, [logicalCards]);

  useEffect(() => {
    if (!room || !user?.uid) return;

    const id = Object.entries(room.players ?? {}).find(
      ([_, player]) => player.userId === user.uid,
    )?.[0];

    if (id && id !== myId) {
      setMyId(id);
    }
  }, [room, user]);

  useEffect(() => {
    const layoutReady =
      width > 0 && height > 0 && userPositions.length === playersCount;

    if (!layoutReady) return;

    const isInitialDeal = room?.status === 'playing' && room?.turnNumber === 0;

    logicalCards.forEach(lc => {
      const card = cards.find(c => c.meta.id === lc.id);
      if (!card) return;

      const prevState = prevStateRef.current[lc.id];
      const prevIndex = prevIndexRef.current[lc.id];

      const stateChanged = prevState !== lc.state;
      const indexChanged = prevIndex !== lc.indexInHand;

      if (!isInitialDeal && !stateChanged && !indexChanged) return;

      if (lc.state === 'hand') {
        const hand = orderedHands[lc.owner];
        if (!hand) return;

        const visualIndex = hand.findIndex(c => c.id === lc.id);
        if (visualIndex === -1) return;

        const target = computeHandTarget(visualIndex, lc.owner);
        if (!target) return;

        if (isInitialDeal) {
          const delay =
            ((lc.indexInHand ?? 0) + Number(lc.owner.slice(1)) * 0.5) * 120;

          card.x.value = withDelay(
            delay,
            withTiming(target.x, {
              duration: 500,
              easing: Easing.out(Easing.cubic),
            }),
          );

          card.y.value = withDelay(
            delay,
            withTiming(target.y, {
              duration: 500,
              easing: Easing.out(Easing.cubic),
            }),
          );
        } else {
          animateCardToHand(card, lc.owner, visualIndex);
        }
      }

      if (lc.state === 'deck') {
        card.x.value = withTiming(deckX);
        card.y.value = withTiming(deckY);
      }

      if (lc.state === 'prevcard') {
        card.faceup.value = true;
        animateCardToPrev(card);
      }

      if (lc.state === 'collected') {
        animateCardToCollected(card);
      }

      if (!isInitialDeal) {
        prevStateRef.current[lc.id] = lc.state;
        prevIndexRef.current[lc.id] = lc.indexInHand;
      }
    });
  }, [logicalCards, width, height, playersCount]);

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
      if (gameEnded && room?.status === 'ended') setGameStarted(false);
      if (room?.status === 'ended') return;

      for (let i = cards.length - 1; i >= 0; i--) {
        const card = cards[i];

        if (!cardHitTest(event.x, event.y, card)) continue;

        const logical = getLogicalCard(card.meta.id);
        if (!logical) return;

        if (!room || !myPlayerId) return;

        if (logical.state === 'deck') {
          if (room.activePlayer !== myPlayerId) {
            Alert.alert('Not your turn');
            return;
          }
          if (cardSent) {
            console.log('[Release] One card already sent');
            return;
          }

          await ReleaseOneMoreCard();
          return;
        }

        if (logical.state === 'prevcard') {
          if (room.activePlayer !== myPlayerId) {
            Alert.alert('Not your turn');
            return;
          }
          if (cardSent) {
            console.log('[ReleasePrev] One card already sent');
            return;
          }

          await ReleasePrevCard();
          return;
        }

        if (logical.state === 'hand') {
          if (room.activePlayer !== myPlayerId) {
            Alert.alert('Not your turn');
            return;
          }

          if (logical.owner !== myPlayerId) {
            Alert.alert('This is not your card');
            return;
          }
          if (!cardSent) {
            console.log('[first take a card from deck or previous ards');
            return;
          }

          await removeHighestCards(card, myPlayerId);
          return;
        }

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

  async function createRoomFunction(roomId: number, totalPlayers: number) {
    setPlayersCount(totalPlayers);
    setRoomId(roomId);
    if (user?.uid) {
      const created = await createRoom(user.uid, roomId, totalPlayers);
      if (created) {
        setCreateRoomModal(false);
        Alert.alert('Sucess', 'Created Room sucessfully');
      }
    }
  }
  async function joinRoomFunction(roomId: number) {
    setRoomId(roomId);
    if (user?.uid) {
      const result = await JoinRoom(roomId, user.uid);

      if (result.gameStart) {
        setJoinRoomModal(false);
        setPlayersCount(result.playerCount)
        Alert.alert('Sucess', 'Joined Room sucessfully');
      }
    }
  }

  async function newGame() {
    hasDealtRef.current = false;
    // setGameStarted(false);

    setdeckFlattened(false);
    setPrevCard(undefined);
    setShowModal(false);
    playersOpenedCards.value = 0;
    await set(ref(db, `room/${roomId}`), null);
    setGameStarted(false);
  }

  const handleCancel = () => {
    setShowModal(false);
  };
  const handleResult = () => {
    setShowModal(false);
    setGameEnded(true);
    playersOpenedCards.value = 0;
  };

  const confirmQuit = async () => {};

  useEffect(() => {
    if (!roomId) return;

    const roomRef = ref(db, `room/${roomId}`);

    const unsubscribe = onValue(roomRef, snapshot => {
      const roomData = snapshot.val();

      if (roomData) {
        // setPlayersCount(roomData.playersCount);
        const playerCount = roomData.players
          ? Object.keys(roomData.players).length
          : 0;

        if (
          roomData.status === 'playing' &&
          roomData.hostUid === user?.uid &&
          !roomData.players.p1.handcards &&
          !hasDealtRef.current &&
          playerCount === roomData.playerCount
        ) {
          setPlayersCount(roomData.playerCount)
          console.log('Host initiating deal...');
          setdeckFlattened(true);
          hasDealtRef.current = false;

          prevStateRef.current = {};
          prevIndexRef.current = {};
          setJoinRoomModal(false);
          setCreateRoomModal(false);
          dealCardsHostOnly(roomId, roomData, roomRef);
        }

        if (roomData?.players?.p1?.handCards && roomData?.deck) {
          setGameStarted(prev => (!prev ? true : prev));
        }

        setGameRoomData(roomData);
        setroom(roomData);
      }
    });

    return () => unsubscribe();
  }, [roomId, user]);

  // console.log('room>>>>>>>>>>>>>>..', room);
  console.log('CreateRoomModal>>>>>>>>>>>>>>>>>>', CreateRoomModal);

  return (
    <View style={{ width: width, height: height, backgroundColor: '#1e1e1e' }}>
      {/* --- MODALS --- */}

      {showQuitModal && (
        <EndModal
          visible={showQuitModal}
          heading="Quit Game"
          message="Are you sure you want to end the game?"
          button1="Cancel"
          button2="Quit"
          onClose={() => setShowQuitModal(false)}
          onProceed={async () => {
            if (!room || !myPlayerId) {
              console.log('room or player id does not exist');
              return;
            }

            const winner = getWinner(myPlayerId);
            if (!winner) return;

            await update(ref(db, `room/${roomId}`), {
              status: 'ended',
              activePlayer: null,
              result: {
                winners: winner,
                reason: 'manual-end',
                endedAt: Date.now(),
                endedBy: myPlayerId,
              },
            });

            setShowQuitModal(false);
          }}
        />
      )}

      {winningPlayer && (
        <EndModal
          visible={showModal}
          player={winningPlayer}
          onClose={() => handleResult()}
          onProceed={() => newGame()}
          heading={'Game Ended'}
          message={
            room?.result?.reason === 'manual-end'
              ? `Game ended by ${room?.result?.endedBy}  and ${room?.result?.winners} has won the game`
              : `${winningPlayer} has won the game`
          }
          button1="Result"
          button2="New Game"
        />
      )}

      {CreateRoomModal && (
        <CreateGameRoomModal
          visible={CreateRoomModal}
          player={winningPlayer}
          onClose={() => setCreateRoomModal(false)}
          onProceed={(roomId, totalPlayers) =>
            createRoomFunction(roomId, totalPlayers)
          }
          heading={'Create Room'}
          button1="Cancel"
          button2="Create"
        />
      )}
      {JoinRoomModal && (
        <JoinGameRoomModal
          visible={JoinRoomModal}
          player={winningPlayer}
          onClose={() => setJoinRoomModal(false)}
          onProceed={roomId => joinRoomFunction(roomId)}
          heading={'Join Room'}
          button1="Cancel"
          button2="Join"
        />
      )}
￼
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
          <View style={{ gap: 10 }}>
            <GameButton
              title="Join Room"
              onPress={async () => {
                console.log(JoinRoomModal);
                setJoinRoomModal(true);
              }}
            />

            <GameButton
              title="Create Room"
              onPress={() => {
                console.log(CreateRoomModal);
                setCreateRoomModal(true);
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

              <Group>
                {cards.map(card => (
                  <Card
                    key={card.meta.id}
                    x={card.x}
                    y={card.y}
                    owner={card.owner}
                    state={card.state}
                    myId={myId}
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

          {gameStarted && (
            <View
              style={{
                position: 'absolute',
                left: endBtnPos.x,
                top: endBtnPos.y,
                width: 100,
                height: 40,
                zIndex: 100,
              }}
            >
              <GameButton
                title="End Turn"
                danger
                onPress={() => {
                  if (!myPlayerId) return;
                  setShowQuitModal(true);
                }}
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
