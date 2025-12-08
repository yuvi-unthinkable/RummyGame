import {
  Canvas,
  Group,
  Image, // Use standard Skia Image
  matchFont,
  Paint,
  Rect,
  Text,
  useImage,
} from '@shopify/react-native-skia';
import React, { useEffect, useState } from 'react';
import { Button, useWindowDimensions, View } from 'react-native';
import {
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
  useDerivedValue, // Import useDerivedValue
} from 'react-native-reanimated';

/**
 * FIXED: No createAnimatedComponent needed.
 * Skia components accept SharedValues/DerivedValues directly.
 */
const FlyingCard = ({
  image,
  startPos,
  endPos,
  index,
  width,
  height,
}:any) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      index * 300,
      withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, []);

  // Calculate X and Y dynamically on the UI thread
  const x = useDerivedValue(() => {
    return startPos.x + (endPos.x - startPos.x) * progress.value;
  });

  const y = useDerivedValue(() => {
    return startPos.y + (endPos.y - startPos.y) * progress.value;
  });

  return (
    <Image
      image={image}
      x={x}   // Pass derived value directly
      y={y}   // Pass derived value directly
      width={width}
      height={height}
    />
  );
};

export default function Playground() {
  const [gameStarted, setGameStarted] = useState(false);
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
  const user1Pos = { x: width - userSize * 2, y: height - userSize * 4 }; // Bottom
  const user2Pos = { x: width / 8 - userSize, y: height / 8 - userSize }; // Top

  // --- Assets ---
  const bg = useImage(require('../../assets/poker-bg.png'));
  const backCardImg = useImage(require('../../assets/card-back.png'));
  const table = useImage(require('../../assets/table.png'));
  const user = useImage(require('../../assets/user.png'));

  const defaultFont = matchFont({
    fontFamily: 'sans-serif',
    fontSize: 20,
    fontWeight: 'bold',
  });

  // Deal 6 cards
  const cardsToDeal = Array.from({ length: 6 }).map((_, i) => {
    const isTopUser = i < 3; // First 3 go to top, next 3 to bottom
    return {
      id: i,
      target: isTopUser ? user2Pos : user1Pos,
    };
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#1e1e1e' }}>
      {!gameStarted ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Button title="Start Dealing" onPress={() => setGameStarted(true)} />
        </View>
      ) : (
        <Canvas style={{ flex: 1 }}>
          {/* Background */}
          <Group>
            <Rect x={0} y={0} width={width} height={height} color="#000" />
            {bg && (
              <Image image={bg} x={0} y={0} width={width} height={height} fit="cover" />
            )}
          </Group>

          {/* Table */}
          <Group>
            {table ? (
              <Image image={table} x={tableX} y={tableY} width={tableWidth} height={tableHeight} fit="contain" />
            ) : (
              <Rect x={tableX} y={tableY} width={tableWidth} height={tableHeight} color="#1178ffff" />
            )}
          </Group>

          {/* Static Deck */}
          <Group>
            {backCardImg && (
              <>
                 <Image image={backCardImg} x={deckX} y={deckY-4} width={cardWidth} height={cardHeight} />
                 <Image image={backCardImg} x={deckX+2} y={deckY-2} width={cardWidth} height={cardHeight} />
                 <Image image={backCardImg} x={deckX+4} y={deckY} width={cardWidth} height={cardHeight} />
              </>
            )}
          </Group>

          {/* Users */}
          <Group>
            {user && <Image image={user} x={user1Pos.x} y={user1Pos.y} width={userSize} height={userSize} />}
            {defaultFont && <Text text="P1" x={user1Pos.x} y={user1Pos.y + userSize + 20} font={defaultFont} color="white" />}
            
            {user && <Image image={user} x={user2Pos.x} y={user2Pos.y} width={userSize} height={userSize} />}
            {defaultFont && <Text text="P2" x={user2Pos.x} y={user2Pos.y + userSize + 20} font={defaultFont} color="white" />}
          </Group>

          {/* Flying Cards */}
          <Group>
            {backCardImg &&
              cardsToDeal.map((card, index) => (
                <FlyingCard
                  key={card.id}
                  index={index}
                  image={backCardImg}
                  startPos={{ x: deckX, y: deckY }}
                  endPos={card.target}
                  width={cardWidth}
                  height={cardHeight}
                />
              ))}
          </Group>
        </Canvas>
      )}
    </View>
  );
}