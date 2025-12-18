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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, useWindowDimensions, View } from 'react-native';
import {
  withDelay,
  withTiming,
  Easing,
  SharedValue,
  makeMutable,
  useSharedValue, // 1. IMPORT THIS
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

type CardData = {
  meta: CardMeta;
  x: SharedValue<number>;
  y: SharedValue<number>;
  state: SharedValue<'deck' | 'player' | 'hand' | 'show' | 'collected'>;
  faceup: SharedValue<boolean>;
  owner: SharedValue<'p1' | 'p2' | 'unset'>;
  cardFaceImg: SkImage | null;
  playerTarget: SharedValue<{ x: number; y: number }>;
  handTarget: SharedValue<{ x: number; y: number }>;
  showTarget: SharedValue<{ x: number; y: number }>;
};

type player = 'p1' | 'p2';

export default function Playground() {
  const [gameStarted, setGameStarted] = useState(false);
  const [gamePhase, setGamePhase] = useState<'idle' | 'dealing' | 'settled'>(
    'idle',
  );
  const activePlayer = useSharedValue<'p1' | 'p2'>('p1');
  const cardsOnTableCount = useSharedValue(0);
  const [distribute, setDistribute] = useState(false);

  const [playerHands, setPlayerHands] = useState<Record<player, CardData[]>>({
    p1: [],
    p2: [],
  });
  const [removedHighCards, setRemovedHighCards] = useState<
    Record<player, CardData[]>
  >({
    p1: [],
    p2: [],
  });

  // dimension hooks
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cardDeck = useDeck();

  // --- Assets hooks ---
  const bg = useImage(require('../../assets/poker-bg.png'));
  const backCardImg = useImage(require('../../assets/card-back.png'));
  const table = useImage(require('../../assets/table.png'));
  const user = useImage(require('../../assets/user.png'));

  // --- Dimensions ---
  const cardWidth = width * 0.12;
  const cardHeight = cardWidth * 1.4;
  const deckX = width / 2 - cardWidth / 2;
  const deckY = height / 2 - cardHeight / 2;
  const tableWidth = width * 0.8;
  const tableHeight = height * 0.5;
  const tableX = width / 2 - tableWidth / 2;
  const tableY = height / 2 - tableHeight / 2;

  // --- Players ---
  const userSize = 40;
  const user2Pos = { x: 10, y: height / 8 - userSize };
  const user1Pos = { x: width * 0.8, y: height * 0.9 - 20 };
  const user1CardPos = {
    x: user1Pos.x,
    y: user1Pos.y + insets.top + (userSize - 20),
  };

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
  const TOTAL_PLAYERS = 2;
  const ACTIVE_CARDS = cardsPerPlayer * TOTAL_PLAYERS; // 6

  type Owner = 'p1' | 'p2' | 'unset';

  function computeHandTarget(index: number, owner: 'p1' | 'p2' | 'unset') {
    const indexInHand = index % cardsPerPlayer;
    const yPos = owner === 'p1' ? height * 0.9 - 20 : height / 8 - userSize;
    return {
      x: handStartX + (cardWidth + spreadGap) * indexInHand,
      y: yPos,
    };
  }

  function computeShowTarget(owner: 'p1' | 'p2' | 'unset') {
    const offsetX = owner === 'p1' ? -20 : 20;
    return {
      x: width / 2 - cardWidth / 2 + offsetX,
      y: height / 2 - cardHeight / 2 + (owner === 'p1' ? 20 : -20),
    };
  }

  function addCardToPlayer(card: CardData, player: player) {
    setPlayerHands(prev => ({
      ...prev,
      [player]: [...prev[player], card],
    }));
  }

  const cardSharedValues = useMemo(() => {
    const cardArray = Array?.from({ length: 52 });
    console.log('🚀 ~ Playground ~ cardArray:', cardArray);

    return Array?.from({ length: 52 }).map((_, i) => ({
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
  const [updateshuffledDeck, setUpdateshuffledDeck] = useState(false);

  const cards: CardData[] = useMemo(() => {
    return cardDeck
      ?.map((meta, i) => {
        const owner =
          i < cardsPerPlayer ? 'p1' : i < cardsPerPlayer * 2 ? 'p2' : 'p1';
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

    let winner: 'p1' | 'p2' | 'unset' | 'tie' = 'tie';
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
  // let shuffledDeck = shuffleDeckr([...cards]);

  const temp = shuffleDeck(cards);
  const [shuffledDeck, setShuffledDeck] = useState([...temp]);

  const dealing = () => {
    setGameStarted(true);

    const activeSubset = shuffledDeck?.slice(0, ACTIVE_CARDS);

    setShuffledDeck(() =>
      shuffledDeck.filter(x => {
        return activeSubset.findIndex(t => t.meta.id === x.meta.id) === -1;
      }),
    );

    activeSubset.forEach((card1, index) => {
      const card = card1;
      const isPlayer1 = index < cardsPerPlayer;
      const newOwner = isPlayer1 ? 'p1' : 'p2';
      card.owner.value = newOwner;
      console.log('🚀 ~ dealing ~ card.owner.value:', card.owner.value);
      const target = isPlayer1 ? user1Pos : user2Pos;

      card.playerTarget.value = target;

      card.handTarget.value = computeHandTarget(index, newOwner);
      card.showTarget.value = computeShowTarget(newOwner);
      console.log('🚀 ~ dealing ~ card.ownrerr.vaclue:', card.owner.value);

      setPlayerHands(prev => ({
        ...prev,
        [newOwner]: prev[newOwner].some(c => c.meta.id === card.meta.id)
          ? prev[newOwner]
          : [...prev[newOwner], card],
      }));

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
    });
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
      console.log(`not your knkturn : ${activePlayer.value}`);
      return;
    }

    card.state.value = 'show';

    cardsOnTableCount.value += 1;
    activePlayer.value = activePlayer.value === 'p1' ? 'p2' : 'p1';

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

    if (!cardToRelease) {
      console.log('no cards to release');
      return;
    }
    const currentPlayer = activePlayer.value;

    // const targetPos = currentPlayer === 'p1' ? user1Pos : user2Pos;
    cardToRelease.owner.value = currentPlayer;
    cardToRelease.state.value = 'hand';
    cardToRelease.faceup.value = true;

    cardToRelease.handTarget.value = computeHandTarget(
      playerHands[currentPlayer].length,
      currentPlayer,
    );

    cardToRelease.x.value = withTiming(cardToRelease.handTarget.value.x);
    cardToRelease.y.value = withTiming(cardToRelease.handTarget.value.y);

    addCardToPlayer(cardToRelease, currentPlayer);

    setShuffledDeck(prev => prev.slice(1));
    removeHighestCards(activePlayer.value);

    activePlayer.value = activePlayer.value === 'p1' ? 'p2' : 'p1';
    // checkingGreatestCards();
  };

  useEffect(() => {
    console.log('playerHands updated:', playerHands);
  }, [playerHands]);

  function removeHighestCards(player: player) {
    setPlayerHands(prev => {
      const hand = prev[player];
      if (hand.length === 0) return prev;

      const sorted = [...hand].sort(
        (a, b) => b.meta.priority - a.meta.priority,
      );
      console.log("🚀 ~ removeHigjhestCards ~ sorted:", sorted)
      const highest = sorted[0].meta.priority;
      console.log('🚀 ~ removeHighestCards ~ highest:', highest);

      const removableCards: CardData[] = sorted.filter(
        card => card.meta.priority === highest,
      );
      console.log(
        '🚀 ~ removeHighestcCardgs ~ removableCards:',
        removableCards,
      );

      const remaining = hand.filter(c => c.meta.priority !== highest);

      remaining.forEach((card, index) => {
        card.handTarget.value = computeHandTarget(index, player);
        card.handTarget.value = computeHandTarget(index, player);
        card.x.value = withTiming(card.handTarget.value.x);
        card.y.value = withTiming(card.handTarget.value.y);
      });

      setRemovedHighCards(r => ({
        ...r,
        [player]: [...r[player], ...removableCards],
      }));

      removableCards.forEach(card => {
        card.state.value = 'collected';
        card.x.value = withTiming(player === 'p1' ? user1Pos.x : user2Pos.x);
        card.y.value = withTiming(player === 'p1' ? user1Pos.y : user2Pos.y);
      });

      return {
        ...prev,
        [player]: remaining,
      };
    });
    // console.log(playerHands);
  }

  const cardHitTest = (x: number, y: number, card: CardData) => {
    'worklet';
    const cx = card.x.value;
    const cy = card.y.value;
    return x >= cx && x <= cx + cardWidth && y >= cy && y <= cy + cardHeight;
  };

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onStart(event => {
      'worklet';
      for (const card of cards) {
        if (
          card.state.value === 'player' &&
          cardHitTest(event.x, event.y, card)
        ) {
          moveCardToHand(card);
          break;
        } else if (
          card.state.value === 'hand' &&
          cardHitTest(event.x, event.y, card)
        ) {
          // console.log('clicked the hand card');
          playCardToTable(card);
          break;
        } else if (
          card.state.value === 'deck' &&
          cardHitTest(event.x, event.y, card)
        ) {
          console.log('releasing new card');
          scheduleOnRN(ReleaseOneMoreCard);
          break;
        }
      }
    });

  return (
    <View style={{ width: width, height: height, backgroundColor: '#1e1e1e' }}>
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

              {/* <Group>
                {backCardImg && (
                  <>
                    <Image
                      image={backCardImg}
                      x={deckX}
                      y={deckY - 4}
                      width={cardWidth}
                      height={cardHeight}
                    />
                    <Image
                      image={backCardImg}
                      x={deckX + 2}
                      y={deckY - 2}
                      width={cardWidth}
                      height={cardHeight}
                    />
                    <Image
                      image={backCardImg}
                      x={deckX + 4}
                      y={deckY}
                      width={cardWidth}
                      height={cardHeight}
                    />
                  </>
                )}
              </Group> */}

              {/* user */}
              <Group>
                {user && (
                  <Image
                    image={user}
                    x={user1Pos.x}
                    y={user1Pos.y}
                    width={userSize}
                    height={userSize}
                  />
                )}
                {defaultFont && (
                  <Text
                    text="P1"
                    x={user1Pos.x}
                    y={user1Pos.y}
                    font={defaultFont}
                    color="white"
                  />
                )}
                {user && (
                  <Image
                    image={user}
                    x={user2Pos.x}
                    y={user2Pos.y}
                    width={userSize}
                    height={userSize}
                  />
                )}
                {defaultFont && (
                  <Text
                    text="P2"
                    x={user2Pos.x}
                    y={user2Pos.y + userSize + 20}
                    font={defaultFont}
                    color="white"
                  />
                )}
              </Group>

              <Group>
                {cards.map(card => {
                  // console.log(card.x, card.y);
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
              {/* <Rect x={180} y={620} width={10} height={100} color="#ff0000ff" /> */}
            </Canvas>
          </GestureDetector>
        </GestureHandlerRootView>
      )}
    </View>
  );
}
