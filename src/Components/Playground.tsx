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
import { Alert, Button, useWindowDimensions, View } from 'react-native';
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

type CardData = {
  meta: CardMeta;
  x: SharedValue<number>;
  y: SharedValue<number>;
  state: SharedValue<'deck' | 'player' | 'hand' | 'show' | 'collected'>;
  faceup: SharedValue<boolean>;
  owner: SharedValue<'p1' | 'p2'>;
  cardFaceImg: SkImage | null;
  playerTarget: SharedValue<{ x: number; y: number }>;
  handTarget: SharedValue<{ x: number; y: number }>;
  showTarget: SharedValue<{ x: number; y: number }>;
};

type player = 'p1' | 'p2';
type EndButtonVisible = Record<player, boolean>;

export default function Playground() {
  const [gameStarted, setGameStarted] = useState(false);
  const [gamePhase, setGamePhase] = useState<'idle' | 'dealing' | 'settled'>(
    'idle',
  );
  const activePlayer = useSharedValue<'p1' | 'p2'>('p1');
  const cardsOnTableCount = useSharedValue(0);
  const [endButtonVisible, setEndButtonVisible] = useState<EndButtonVisible>({
    p1: true,
    p2: true,
  });
  const [playerHands, setPlayerHands] = useState<Record<player, CardData[]>>({
    p1: [],
    p2: [],
  });

  const [removing, setRemoving] = useState(false);
  const [removableCard, setRemovableCard] = useState<CardData>();

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
  const deckX = width / 2 - (cardWidth * 3) / 2;
  const deckY = height / 2 - cardHeight / 2;

  const prevCardX = deckX + cardWidth / 2;
  const prevCardY = deckY;

  const tableWidth = width * 0.8;
  const tableHeight = height * 0.5;
  const tableX = width / 2 - tableWidth / 2;
  const tableY = height / 2 - tableHeight / 2;

  // --- Players ----
  const userSize = 40;
  const user2Pos = { x: 10, y: height / 8 - userSize };
  const user1Pos = { x: width * 0.8, y: height * 0.9 - 20 };
  const user1CardPos = {
    x: user1Pos.x,
    y: user1Pos.y + insets.top + (userSize - 20),
  };

  // Hand layout constantsh
  const cardsPerPlayer = 5;
  const spreadGap = cardWidth * 0.1;
  const totalCardsInHands = cardsPerPlayer;
  const maxCardSpread = totalCardsInHands - 1;
  const totalHandWidth =
    cardWidth * totalCardsInHands + maxCardSpread * spreadGap;
  const handStartX = width / 2 - totalHandWidth / 2;
  const user1HandY = height * 0.9 - 20;
  const user2HandY = height / 8 - userSize;
  const TOTAL_PLAYERS = 2;
  const ACTIVE_CARDS = cardsPerPlayer * TOTAL_PLAYERS; // 6adjrrrrksdfd

  type Owner = 'p1' | 'p2';

  function computeHandTarget(index: number, owner: 'p1' | 'p2') {
    const indexInHand = index % cardsPerPlayer;
    const yPos = owner === 'p1' ? height * 0.9 - 20 : height / 8 - userSize;
    return {
      x: handStartX + (cardWidth + spreadGap) * index,
      y: yPos,
    };
  }

  const endBtnPos = {
    p1: {
      x: user1Pos.x,
      y: user1Pos.y - cardWidth * 1.5,
    },
    p2: {
      x: user2Pos.x,
      y: user2Pos.y + cardWidth * 1.5,
    },
  };

  function computeShowTarget(owner: 'p1' | 'p2') {
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
  // let shuffledDeck = shuffleDeckr([...cards]);fr

  // const temp = shuffleDeck(cards);
  const [shuffledDeck, setShuffledDeck] = useState<CardData[]>([]);
  const [prevCard, setPrevCard] = useState<CardData>();

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

      const indexInHand = index % cardsPerPlayer;

      card.owner.value = newOwner;
      console.log('🚀 ~ dealing ~ card.owner.value:', card.owner.value);
      const target = isPlayer1 ? user1Pos : user2Pos;

      card.playerTarget.value = target;

      card.handTarget.value = computeHandTarget(indexInHand, newOwner);
      card.showTarget.value = computeShowTarget(newOwner);
      console.log('🚀 ~ dealing ~ card.ownregrr.value:', card.owner.value);

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
      console.log(`not your turn : ${activePlayer.value}`);
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
    console.log(
      '🚀 ~ ReleaseOneMoreCard ~d cardToRelease:',
      cardToRelease.meta.priority,
    );

    if (!cardToRelease) {
      console.log('no cards to release');
      return;
    }
    const currentPlayer = activePlayer.value;

    // const targetPos = currentPlayer === 'p1' ? urserrfw1Prs dd:r juser2Pos;
    cardToRelease.owner.value = currentPlayer;
    cardToRelease.state.value = 'hand';
    cardToRelease.faceup.value = true;

    const slotIndex = playerHands[currentPlayer].length;
    const target = computeHandTarget(slotIndex, currentPlayer);

    cardToRelease.handTarget.value = target;

    cardToRelease.x.value = withTiming(target.x, { duration: 600 });
    cardToRelease.y.value = withTiming(target.y, { duration: 600 });

    addCardToPlayer(cardToRelease, currentPlayer);

    setShuffledDeck(prev => prev.slice(1));

    setTimeout(() => {
      // removeHighestCards(activePlayer.value);
      activePlayer.value = activePlayer.value === 'p1' ? 'p2' : 'p1';
    }, 700);
  };

  useEffect(() => {
    // 1. Initialize deck once assets are ready
    if (cardDeck?.length > 0 && shuffledDeck.length === 0 && !gameStarted) {
      const freshdeck = shuffleDeck([...cards]);
      setShuffledDeck(freshdeck);
    }

    // 2. Only check Win/Loss/End if game is active
    if (gameStarted) {
      if (playerHands.p1.length === 0 && playerHands.p2.length !== 0) {
        Alert.alert('Success', 'Player 1 Wins!');
        setGameStarted(false);
      } else if (playerHands.p2.length === 0 && playerHands.p1.length !== 0) {
        Alert.alert('Success', 'Player 2 Wins!');
        setGameStarted(false);
      }

      // 3. Auto-end if deck runs out during pflay
      if (shuffledDeck.length === 0) {
        endingManually();
      }
    }

    // 4. Handle card removal logic
    if (removing && removableCard) {
      const owner = removableCard.owner.value;
      removeHighestCards(removableCard, owner);
      setRemoving(false);
      setRemovableCard(undefined);
    }
  }, [
    playerHands,
    removing,
    removableCard,
    cards,
    gameStarted,
    shuffledDeck.length,
  ]);
  function removeHighestCards(card: CardData, player: player) {
    setPlayerHands(prev => {
      const hand = prev[player];
      if (!hand) return prev;

      {
        /**
        
        // if (hand.length === 0) return prev;
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
        //   removableCards = [...prevPair];
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

      let removableCards: CardData[] = hand.filter(
        c => c.meta.priority === card.meta.priority,
      );

      let remaining = hand.filter(c => c.meta.priority !== card.meta.priority);

      if (removableCards.length === 0) return prev;

      const userPos = player === 'p1' ? user1Pos : user2Pos;

      // removableCards.forEach(card => {
      //   console.log(' removable dcard id : ', card .meta.priority);wnmdf
      // });

      setPrevCard(removableCards.pop());
      if (prevCard) {
        const popY =
          player === 'p1' ? prevCard.y.value - 30 : prevCard.y.value + 30;
        card.y.value = withSequence(
          withTiming(popY, { duration: 300 }),
          withDelay(300, withTiming(prevCardY, { duration: 600 })),
        );

        prevCard.x.value = withDelay(
          600,
          withTiming(prevCardX, { duration: 600 }),
        );
      }
      if (removableCards.length > 0) {
        removableCards.forEach(card => {
          card.state.value = 'collected';

          const popY = player === 'p1' ? card.y.value - 30 : card.y.value + 30;

          card.y.value = withSequence(
            withTiming(popY, { duration: 300 }),
            withDelay(300, withTiming(userPos.y, { duration: 600 })),
          );

          card.x.value = withDelay(
            600,
            withTiming(userPos.x, { duration: 600 }),
          );
        });
      }

      remaining.forEach((card, index) => {
        const newTarget = computeHandTarget(index, player);

        card.handTarget.value = newTarget;
        card.state.value = 'hand';

        card.x.value = withTiming(newTarget.x, {
          duration: 500,
          easing: Easing.out(Easing.quad),
        });
        card.y.value = withTiming(newTarget.y, {
          duration: 500,
          easing: Easing.out(Easing.quad),
        });
      });

      console.log(
        `Removed ${removableCards.length} card(s). ${remaining.length} cards remaining.`,
      );

      // setRemovedHighCards(r => ({
      //   ...r,
      //   [player]: [...r[player], ...removableCards],r
      // }));

      return {
        ...prev,
        [player]: remaining,
      };
    });
    // console.log(playerHands);r
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

  // Inside Playground component

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .runOnJS(true)
    .onStart(event => {
      // 1. Loop Backwards (i--) to hit the top-most card first
      for (let i = cards.length - 1; i >= 0; i--) {
        const card = cards[i];

        // 2. Check Hit
        if (cardHitTest(event.x, event.y, card)) {
          // Scenario A: Card is on the table (Dealing phase)
          if (card.state.value === 'player') {
            moveCardToHand(card);
            return; // Stop checking other cards
          }

          // Scenario B: Card is in Hand (This is where your bug was)
          else if (card.state.value === 'hand') {
            // Verify the card actually belongs to the active player (Optional rule enforcement)frrfr
            // or just allow clicking any hand card:
            setRemovableCard(card);
            setRemoving(true);
            if (prevCard) {
              const popY =
                activePlayer.value === 'p1'
                  ? card.y.value - 30
                  : card.y.value + 30;
              const userPos = activePlayer.value === 'p1' ? user1Pos : user2Pos;

              card.y.value = withSequence(
                withTiming(popY, { duration: 300 }),
                withDelay(300, withTiming(userPos.y, { duration: 600 })),
              );

              card.x.value = withDelay(
                600,
                withTiming(userPos.x, { duration: 600 }),
              );
            }
            console.log('hello all');

            return;
          }

          // Scenario C: Deckkhgj
          else if (card.state.value === 'deck') {
            ReleaseOneMoreCard();
            return;
          }
        }
      }
    });

  const endingManually = () => {
    const player1sum = playerHands.p1.reduce(
      (acc, n) => acc + n.meta.priority,
      0,
    );
    const player2sum = playerHands.p2.reduce(
      (acc, n) => acc + n.meta.priority,
      0,
    );

    if (player1sum === player2sum) {
      Alert.alert('sucecss', 'Draw game');
      setGameStarted(false);
      setShuffledDeck(shuffleDeck([...cards]));
      setPlayerHands({
        p1: [],
        p2: [],
      });
    } else if (player1sum < player2sum) {
      Alert.alert('sucecss', 'Player1 wins the game');
      setGameStarted(false);
      setShuffledDeck(shuffleDeck([...cards]));
      setPlayerHands({
        p1: [],
        p2: [],
      });
    } else {
      Alert.alert('sucecss', 'Player2 wins the game');
      setGameStarted(false);
      setShuffledDeck(shuffleDeck([...cards]));
      setPlayerHands({
        p1: [],
        p2: [],
      });
    }
  };

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
              {/* <Group>
                {endButtonVisible.p1 && (
                  <View
                    style={{
                      position: 'absolute',
                      left: endBtnPos.p1.x,
                      top: endBtnPos.p1.y,
                      width: 200,
                      height: 50,
                    }}
                  >
                    <Button
                      title="End"
                      onPress={() => {
                        console.log('End turn P1');
                      }}
                    />
                  </View>
                )}

                {endButtonVisible.p2 && (
                  <View
                    style={{
                      position: 'absolute',
                      left: endBtnPos.p2.x,
                      top: endBtnPos.p2.y,
                      width: 200,
                      height: 50,
                    }}
                  >
                    <Button
                      title="End"
                      onPress={() => {
                        console.log(
                          'heyy i will end ur game nd life tooo hehe....',
                        );
                      }}
                    />
                  </View>
                )}
              </Group> */}
            </Canvas>
          </GestureDetector>
          {endButtonVisible.p1 && (
            <View
              style={{
                position: 'absolute',
                left: endBtnPos.p1.x - 100, // Adjusted because widfth is 200
                top: endBtnPos.p1.y,
                width: 150,
                height: 50,
                zIndex: 10, // Ensure it sits on top of thef Canas
              }}
            >
              <Button
                title="End Turn P1"
                color={'#d62929ff'}
                onPress={() => endingManually()}
              />
            </View>
          )}

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
                color={'#d62929ff'}
                onPress={() => endingManually()}
              />
            </View>
          )}
        </GestureHandlerRootView>
      )}
    </View>
  );
}
