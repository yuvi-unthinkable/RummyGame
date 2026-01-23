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
import { Alert, StyleSheet, useWindowDimensions, View } from 'react-native';
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
import { createRoom, JoinRoom, Player, RoomData } from '../Backend/Room';
import { useUser } from '../context/UserContext';
import { NetworkCard, useGameStarted } from '../Backend/useGameStarted';
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
// import CreateGameModal from './CreateGameRoomModal';
// import CreateGameRoomModal from './CreateGameRoomModal';
// import JoinGameRoomModal from './JoinGameRoomModal';
import WaitingModal from './WaitingModal';
import { removeHighestCards } from '../services/RemoveCard';
import { ReleaseOneMoreCard } from '../services/ReleaseDeckCard';
import { ReleasePrevCard } from '../services/ReleasePrevCard';
import { getHandForPlayer } from '../Utility/getPlayerHands';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../navigators/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

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

export type playerId = string;

export type LogicalCard = {
  id: number;
  owner: playerId;
  state: CardState;
  indexInHand: number | null;
};

type Positions = {
  x: number;
  y: number;
};

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Playground'
>;

type PlaygroundRouteProp = RouteProp<RootStackParamList, 'Playground'>;

export default function Playground() {
  const [winningPlayer, setWinningPlayer] = useState<playerId>();

  const [showModal, setShowModal] = useState(false);
  const [CreateRoomModal, setCreateRoomModal] = useState(false);
  const [JoinRoomModal, setJoinRoomModal] = useState(false);
  const [WaitingRoomModal, setWaitingRoomModal] = useState(false);
  const [playersCount, setPlayersCount] = useState(2);
  const [roomId, setRoomId] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);
  const [gameRoomData, setGameRoomData] = useState<RoomData | null>(null);
  const [deckFlattened, setdeckFlattened] = useState(false);
  const [myId, setMyId] = useState('');
  const [showQuitModal, setShowQuitModal] = useState(false);

  const [gameStarted, setGameStarted] = useState(false);
  const [revealAllCards, setRevealAllCards] = useState(false);

  const [cardSent, setCardSent] = useState(false);
  const route = useRoute<PlaygroundRouteProp>();

  const { roomid, playerCount } = route.params;

  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cardDeck = useDeck();

  const bg = useImage(require('../../assets/poker-bg.png'));
  const backCardImg = useImage(require('../../assets/cardBackground.png'));
  const table = useImage(require('../../assets/table.png'));
  const userImage = useImage(require('../../assets/user.png'));

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

  const userSize = 40;

  const hasDealtRef = useRef(false);
  const [room, setroom] = useState<RoomData | null>(null);
  const prevStateRef = useRef<Record<number, CardState>>({});
  const prevIndexRef = useRef<Record<number, number | null>>({});

  const db = getDatabase(getApp());
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    console.log('i am updating roomid');
    if (roomid && playerCount) {
      setRoomId(roomid);
      setPlayersCount(playerCount);

      console.log('roomid nd player count updated');
    }
  }, [roomid, playerCount]);

  useEffect(() => {
    if (room?.status === 'waiting') {
      setWaitingRoomModal(true);
    }
    if (room?.status === 'playing') {
      setGameStarted(true);
      setWaitingRoomModal(false);
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

  const myPlayerId = useMemo<playerId | null>(() => {
    if (!room?.players || !user?.uid) return null;

    return (
      Object.entries(room.players).find(
        ([_, p]) => p.userId === user.uid,
      )?.[0] ?? null
    );
  }, [room, user]);

  const userPositions = useMemo(() => {
    if (!playersCount || playersCount < 1 || !width || !height) {
      return [];
    }
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

  const getVisualPosition = (targetPlayerId: string) => {
    'worklet';
    if (!myPlayerId || !targetPlayerId) {
      console.log(
        'myplayerId or targetplayerId not present>>>>>>>',
        myPlayerId,
        targetPlayerId,
      );
      return userPositions[0];
    }

    const myIndex = parseInt(myPlayerId.replace('p', ''), 10) - 1;
    console.log('🚀 ~ getVisualPosition ~ myIndex:', myIndex);
    const targetIndex = parseInt(targetPlayerId.replace('p', ''), 10) - 1;
    console.log('🚀 ~ getVisualPosition ~ targetIndex:', targetIndex);

    const visualIndex = (targetIndex - myIndex + playersCount) % playersCount;

    return userPositions[visualIndex];
  };

  function computeHandTarget(index: number, owner: string) {
    if (owner === 'unset' || !owner) return { x: 0, y: 0 };
    if (!myPlayerId || !owner) {
      console.log('myplayerId or owner not present>>>>>>>', myPlayerId, owner);
      return userPositions[0];
    }
    const indexInHand = parseInt(owner[1]);

    const myIndex = parseInt(myPlayerId.replace('p', ''), 10) - 1;
    console.log('🚀 ~ getVisualPosition ~ myIndex:', myIndex);
    const targetIndex = parseInt(owner.replace('p', ''), 10) - 1;
    console.log('🚀 ~ getVisualPosition ~ targetIndex:', targetIndex);

    const visualIndex = (targetIndex - myIndex + playersCount) % playersCount;

    // const target = handStartX[indexInHand - 1];

    const target = getVisualPosition(owner);
    // console.log("🚀 ~ computeHandTarget ~ target:",owner,  target.x, target.y)
    if (!target) return { x: 0, y: 0 };

    let initialX = target.x - cardWidth * 2;
    let initialY = target.y + cardHeight;
    let spreadGap = cardWidth * 1.1;
    let verticalSpreadGap = cardHeight * 1.1;
    if (visualIndex === 0) {
      verticalSpreadGap = cardHeight * 1 + cardWidth * 0.4;
      spreadGap = cardWidth * 1.1;
      initialX = target.x - (cardWidth * 5) / 2;
    }

    if (target) {
      if (playersCount === 2) {
        return {
          x: initialX + spreadGap * index,
          y: target.y + 20,
        };
      } else if (playersCount === 3) {
        if (visualIndex === 0) {
          return {
            x: initialX + spreadGap * index,
            y: target.y + 20,
          };
        } else {
          return {
            x: target.x,
            y: initialY + verticalSpreadGap * index,
          };
        }
      } else if (playersCount === 4) {
        if (visualIndex === 0 || visualIndex === 2) {
          return {
            x: initialX + spreadGap * index,
            y: target.y + 20,
          };
        } else {
          return {
            x: target.x,
            y: initialY + verticalSpreadGap * index,
          };
        }
      } else if (playersCount === 5) {
        if (visualIndex === 0) {
          return {
            x: initialX + spreadGap * index,
            y: target.y + 20,
          };
        } else if (visualIndex === 2 || visualIndex === 3) {
          return {
            x: visualIndex === 2 ? target.x - 40 : target.x + 40,
            y: target.y + 20 + verticalSpreadGap * index,
          };
        } else {
          if (visualIndex !== 0) verticalSpreadGap = cardHeight * 0.6;

          return {
            x: visualIndex === 1 ? target.x - 20 : target.x + 20,
            y: target.y + 10 + verticalSpreadGap * index,
          };
        }
      } else if (playersCount === 6) {
        if (visualIndex === 0 || visualIndex === 3) {
          return {
            x: width / 2 - cardWidth * 3 + spreadGap * index,
            y: visualIndex === 0 ? target.y + 20 : target.y + 40,
          };
        } else if (visualIndex === 2 || visualIndex === 4) {
          if (owner !== myPlayerId) verticalSpreadGap = cardHeight * 0.6;
          return {
            x: visualIndex === 2 ? target.x - 30 : target.x + 30,
            y: target.y - 40 + verticalSpreadGap * index,
          };
        } else {
          return {
            x: visualIndex === 1 ? target.x - 30 : target.x + 30,
            y: target.y - 80 + verticalSpreadGap * index,
          };
        }
      }
    }
  }

  const endBtnPos = {
    x: width / 2 - 40,
    y: (height * 4) / 5,
  };

  let cards: CardData[] = useGameStarted(roomId, gameStarted, room?.players);

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

  const visualIndexMap = useMemo(() => {
    const map = new Map<number, number>();

    Object.values(orderedHands).forEach(hand => {
      hand.forEach((c, i) => {
        map.set(c.id, i);
      });
    });

    return map;
  }, [orderedHands]);

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
    updates.activePlayer = players[1];
    updates.turnNumber = 0;
    updates.PreviousCard = null;
    updates.abandonedCards = null;
    updates.turnLocks = null;

    try {
      await update(roomRef, updates);
      hasDealtRef.current = true;
      console.log('[Deal] Cards dealt successfully');
      console.log('🚀 ~ dealCardsHostOnly ~ setGameStarted:', gameStarted);
    } catch (err) {
      console.error('[Deal] Failed:', err);
      hasDealtRef.current = false;
    }
  }

  const getWinner = (clickedPlayer: playerId): playerId | undefined => {
    if (!room) return;

    const scores = Object.keys(room.players).map(playerId => {
      const hand = getHandForPlayer(room, playerId);
      const score = hand.reduce((sum, c) => sum + c.priority, 0);
      return { playerId, score };
    });

    const minScore = Math.min(...scores.map(s => s.score));
    const lowest = scores.filter(s => s.score === minScore);

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

      card.faceup.value = revealAllCards
        ? true
        : lc.state === 'hand'
        ? isMine
        : lc.state === 'prevcard'
        ? true
        : false;
    });
  }, [logicalCards, revealAllCards, myPlayerId]);

    useEffect(() => {
    console.log('revealAllCards : >>>>>>> ', revealAllCards);
  }, [revealAllCards]);


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
          const delay = visualIndex * 120;

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

    useEffect(() => {
    if (!roomId) return;

    console.log('i am listening');

    const roomRef = ref(db, `room/${roomId}`);

    const unsubscribe = onValue(roomRef, snapshot => {
      const roomData = snapshot.val();

      if (roomData) {
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
          setPlayersCount(roomData.playerCount);
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

  const joinedPlayers = useMemo(() => {
  return room?.players ? Object.keys(room.players).length : 0;
}, [room?.players]);

const totalPlayers = room?.playerCount ?? playersCount;


  const getLogicalCard = (id: number) => logicalCards.find(c => c.id === id);

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .runOnJS(true)
    .onStart(async event => {
      if (gameEnded && room?.status === 'ended') {
        setGameStarted(false);
        setRevealAllCards(false);
            navigation.navigate('Home');

      }
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

          await ReleaseOneMoreCard(
            room,
            roomId,
            setCardSent,
            myPlayerId,
            cardDeck,
          );
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

          await ReleasePrevCard(
            room,
            roomId,
            setCardSent,
            setPrevCard,
            myPlayerId,
          );
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

          await removeHighestCards(
            room,
            roomId,
            setCardSent,
            logicalCards,
            card,
            myPlayerId,
          );
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

  // async function createRoomFunction(roomId: number, totalPlayers: number) {
  //   setPlayersCount(totalPlayers);
  //   setRoomId(roomId);
  //   if (user?.uid) {
  //     const created = await createRoom(user.uid, roomId, totalPlayers);
  //     if (created) {
  //       setCreateRoomModal(false);
  //       joinRoomFunction(roomId);
  //     }
  //   }
  // }
  // async function joinRoomFunction(roomId: number) {
  //   setRoomId(roomId);
  //   if (user?.uid) {
  //     const result = await JoinRoom(roomId, user.uid, user.username);

  //     if (result.gameStart) {
  //       setJoinRoomModal(false);
  //       setPlayersCount(result.playerCount);
  //     }
  //   }
  // }

  async function newGame() {
    hasDealtRef.current = false;
    resetAllCards();
    prevStateRef.current = {};
    prevIndexRef.current = {};

    setdeckFlattened(false);
    setPrevCard(undefined);
    setRevealAllCards(false);
    setWinningPlayer(undefined);
    setShowModal(false);
    setGameEnded(false);
    setWaitingRoomModal(false);
    setCardSent(false);

    playersOpenedCards.value = 0;
    await set(ref(db, `room/${roomId}`), null);
    setGameStarted(false);
    navigation.navigate('Home');
  }

  async function handleResult() {
    setShowModal(false);
    playersOpenedCards.value = 0;
    console.log(revealAllCards);
    setRevealAllCards(true);
    console.log('ater>>>>>>>>>>>>>>', revealAllCards);
    setGameEnded(true);
  }
  async function handleCancel() {
    setWaitingRoomModal(false);
    if (!room?.players) return;

    playersOpenedCards.value = 0;
    await set(ref(db, `room/${roomId}/players/${myId}`), null);
        navigation.navigate('Home');


  }
  return (
    <View style={{ width: width, height: height, backgroundColor: '#1e1e1e' }}>
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
          button1="Show"
          button2="New Game"
        />
      )}
      
      {!gameStarted ? (
        <WaitingModal
          visible={WaitingRoomModal}
          onClose={handleCancel}
          heading={'Join Room'}
          button1="Cancel"
          playerCount={totalPlayers}
          joinedPlayers={joinedPlayers}
        />
      ) : (
        <GestureHandlerRootView
          style={{ flex: 1, borderWidth: 2, borderColor: '#006effff' }}
        >
          <GestureDetector gesture={tapGesture}>
            <Canvas style={{ flex: 1 }}>
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
              
              <Group>
                {room &&
                  Object.entries(room.players).map(([pid, player]) => {
                    const pos = getVisualPosition(pid);

                    return (
                      <Group key={pid}>
                        {userImage && (
                          <Image
                            image={userImage}
                            x={pos.x}
                            y={pos.y}
                            width={userSize}
                            height={userSize}
                          />
                        )}
                        {defaultFont && (
                          <Text
                            text={player.userName || 'Player'}
                            x={pos.x}
                            y={pos.y - 5}
                            font={defaultFont}
                            color="white"
                          />
                        )}
                      </Group>
                    );
                  })}
              </Group>

              <Group>
                {[...cards]
                  .sort((a, b) => {
                    const indexA = visualIndexMap.get(a.meta.id);
                    const indexB = visualIndexMap.get(b.meta.id);

                    const aInHand = indexA !== undefined;
                    const bInHand = indexB !== undefined;

                    if (aInHand && bInHand) {
                      return indexA! - indexB!;
                    }

                    if (aInHand && !bInHand) return 1;
                    if (!aInHand && bInHand) return -1;

                    return 0;
                  })
                  .map(card => (
                    <Card
                      key={card.meta.id}
                      x={card.x}
                      y={card.y}
                      owner={card.owner}
                      faceup={card.faceup}
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
                width: 90,
                height: 20,
                zIndex: 100,
              }}
            >
              <GameButton
                title="End Game"
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
