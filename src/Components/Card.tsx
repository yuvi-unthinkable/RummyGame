import React from 'react';
import { Group, Image, SkImage } from '@shopify/react-native-skia';
import {
  SharedValue,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { CardState } from './cardTypes';

type CardProps = {
  x: SharedValue<number>;
  y: SharedValue<number>;
  // 🟢 NEW: Pass logic variables instead of a raw boolean
  owner: SharedValue<string>;
  state: SharedValue<CardState>;
  myId: string | null;
  
  backCardImg: SkImage | null;
  faceCardImg: SkImage | null;
  cardWidth: number;
  cardHeight: number;
};

const Card = ({
  x,
  y,
  owner,
  state,
  myId,
  backCardImg,
  faceCardImg,
  cardWidth,
  cardHeight,
}: CardProps) => {
  const halfWidth = cardWidth / 2;
  const halfHeight = cardHeight / 2;

  // 1. 🔒 VISIBILITY LOGIC (The "Fog of War")
  // This runs instantly on the UI thread.
  const isFaceUpLogic = useDerivedValue(() => {
    const s = state.value;
    const o = owner.value;

    // A. Deck is ALWAYS hidden (Back side)
    if (s === 'deck') return false; 
    
    // B. Hand is visible ONLY if I own it
    if (s === 'hand') {
        return o === myId; 
    }
    
    // C. Table/Show/PrevCard/Collected is visible to everyone
    return true; 
  });

  // 2. 🔄 ANIMATION DRIVER
  // Drives the flip based on the calculated logic above
  const rotationAngle = useDerivedValue(() => {
    return withTiming(isFaceUpLogic.value ? Math.PI : 0, { duration: 500 });
  });

  // 3. 📐 TRANSFORMATION MATRIX
  const transform = useDerivedValue(() => {
    const angle = rotationAngle.value;

    return [
      { perspective: 800 },
      { translateX: x.value + halfWidth },
      { translateY: y.value + halfHeight },
      { rotateY: angle },
      // 🔑 FIX MIRROR: If face up, flip scaleX so text isn't backwards
      { scaleX: isFaceUpLogic.value ? -1 : 1 }, 
      { translateX: -halfWidth },
      { translateY: -halfHeight },
    ];
  });

  // 4. 🖼 IMAGE SWAPPER
  const currentImage = useDerivedValue(() => {
    const angle = rotationAngle.value;
    // Swap image when we cross the 90 degree mark
    const isShowingFace = angle > Math.PI / 2; 
    
    if (!backCardImg || !faceCardImg) return null;

    return isShowingFace ? faceCardImg : backCardImg;
  });

  return (
    <Group transform={transform}>
      {currentImage.value && (
        <Image
          image={currentImage} // Skia handles DerivedValues automatically here
          x={0}
          y={0}
          width={cardWidth}
          height={cardHeight}
          zIndex={200}
        />
      )}
    </Group>
  );
};

export default Card;