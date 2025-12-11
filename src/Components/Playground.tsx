import {
  Canvas,
  Group,
  Image, // Use standard Skia Image
  matchFont,
  Paint,
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
  makeMutable, // 1. IMPORT THIS
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Card from './Card';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type CardData = {
  id: number;
  x: SharedValue<number>;
  y: SharedValue<number>;
  state: SharedValue<'deck' | 'player' | 'hand'>;
  faceup: SharedValue<boolean>;
  owner: 'p1' | 'p2';
  cardFaceImg: SkImage | null;
  playerTarget: { x: number; y: number };
  handTarget: { x: number; y: number };
};

export default function Playground() {
  const [gameStarted, setGameStarted] = useState(false);
  const [gamePhase, setGamePhase] = useState<'idle' | 'dealing' | 'settled'>(
    'idle',
  );
  const insets = useSafeAreaInsets();

  const { width, height } = useWindowDimensions();

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

  // --- Assets ---
  const bg = useImage(require('../../assets/poker-bg.png'));
  const backCardImg = useImage(require('../../assets/card-back.png'));
  const table = useImage(require('../../assets/table.png'));
  const user = useImage(require('../../assets/user.png'));

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

  // Card front images
  const CardFaces = [
    useImage(require('../../assets/ace.png')),
    useImage(require('../../assets/ace.png')),
    useImage(require('../../assets/ace.png')),
    useImage(require('../../assets/ace.png')),
    useImage(require('../../assets/ace.png')),
    useImage(require('../../assets/ace.png')),
  ];

  const cardSharedValues = useMemo(() => {
    return Array.from({ length: 6 }).map(() => ({
      x: makeMutable(0),
      y: makeMutable(0),
      state: makeMutable<'deck' | 'player' | 'hand'>('deck'),
      faceup: makeMutable(false),
    }));
  }, []);

  useEffect(() => {
    setTimeout(() => {
      cardSharedValues.forEach(sv => {
        sv.x.value = deckX;
        sv.y.value = deckY;
      });
    }, 1000);
  }, [deckX, deckY]);

  const cards: CardData[] = useMemo(() => {
    const owners: ('p1' | 'p2')[] = ['p2', 'p2', 'p2', 'p1', 'p1', 'p1'];

    return cardSharedValues.map((sharedValues, i) => {
      const indexInHand = i % cardsPerPlayer;
      const owner = owners[i];

      const targetY = owner === 'p1' ? user1HandY : user2HandY;
      const handTargetX = handStartX + (cardWidth + spreadGap) * indexInHand;

      return {
        id: i,
        x: sharedValues.x as SharedValue<number>,
        y: sharedValues.y as SharedValue<number>,
        state: sharedValues.state as SharedValue<'deck' | 'player' | 'hand'>,
        faceup: sharedValues.faceup as SharedValue<boolean>,
        owner: owners[i],
        cardFaceImg: CardFaces[i],
        playerTarget:
          owner === 'p1'
            ? { x: user1Pos.x, y: user1Pos.y + userSize - 20 }
            : user2Pos,
        handTarget: {
          x: handTargetX,
          y: targetY,
        },
      };
    });
  }, [
    cardSharedValues,
    deckX,
    deckY,
    cardWidth,
    handStartX,
    user1HandY,
    user2HandY,
    user1Pos,
    user2Pos,
    cardsPerPlayer,
    spreadGap,
    ...Object.values(CardFaces),
  ]);

  const defaultFont = matchFont({
    fontFamily: 'sans-serif',
    fontSize: 20,
    fontWeight: 'bold',
  });

  const handleCardSettled = useCallback(
    (cardId: number) => {
      if (!cards || cards.length === 0) return;

      console.log('🚀 ~ Playground ~ cards:', cards);
      if (cardId === cards[cards.length - 1].id) {
        setGamePhase('settled');
        console.log('Game Phase: Settled');
      }
    },

    [cards, setGamePhase],
  );

  const dealing = () => {
    setGameStarted(true);
    setGamePhase('dealing');

    cards.forEach((card, index) => {
      card.x.value = withDelay(
        index * 300,
        withTiming(card.playerTarget.x, { duration: 600 }),
      );

      card.y.value = withDelay(
        index * 300,
        withTiming(card.playerTarget.y, { duration: 600 }, isFinished => {
          if (isFinished) {
            card.state.value = 'player';
            scheduleOnRN(handleCardSettled, card.id);
          }
        }),
      );
    });
  };

  const moveCardToHand = (card: CardData) => {
    'worklet';
    card.state.value = 'hand';
    card.faceup.value = true;

    card.x.value = withTiming(card.handTarget.x, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });

    card.y.value = withTiming(card.handTarget.y, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  };

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
          console.log('hellooooooooooooo ');
          moveCardToHand(card);
          

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

              <Group>
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
              </Group>

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
                      key={card.id}
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
