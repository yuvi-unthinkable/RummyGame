import {
  Group,
  Image,
  SkImage,
} from '@shopify/react-native-skia';
import React from 'react';
import {
  SharedValue,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

type CardProps = {
  x: SharedValue<number>;
  y: SharedValue<number>;
  faceUp: SharedValue<boolean>;
  backCardImg: SkImage | null;
  faceCardImg: SkImage | null;
  cardWidth: number;
  cardHeight: number;
};

const Card = ({
  x,
  y,
  faceUp,
  backCardImg,
  faceCardImg,
  cardWidth,
  cardHeight,
}: CardProps) => {
  const halfWidth = cardWidth / 2;
  const halfHeight = cardHeight / 2;

  // 1. CLEANER ANIMATION: Directly derive the animation state
  const rotationAngle = useDerivedValue(() => {
    return withTiming(faceUp.value ? Math.PI : 0, { duration: 500 });
  }, [faceUp]);

  const transform = useDerivedValue(() => {
    const angle = rotationAngle.value;

    return [
      // Move origin to the center of the card
      { translateX: x.value + halfWidth },
      { translateY: y.value + halfHeight },
      // Perform the rotation
      { rotateY: angle },
      // Move origin back to top-left so the drawing logic is standard
      { translateX: -halfWidth },
      { translateY: -halfHeight },
    ];
  });

  const currentImage = useDerivedValue(() => {
    const angle = rotationAngle.value;
    // Swap image when we cross the 90 degree (PI/2) mark
    const isShowingFace = angle > Math.PI / 2 && angle < (3 * Math.PI) / 2;

    return isShowingFace ? faceCardImg : backCardImg;
  }, [faceCardImg, backCardImg]);

  return (
    <Group transform={transform}>
      {currentImage.value && (
        <Image
          image={currentImage}
          // 2. THE FIX: Set x and y to 0. 
          // The 'transform' on the Group already moved us to the correct screen position.
          x={0}
          y={0}
          width={cardWidth}
          height={cardHeight}
        />
      )}
    </Group>
  );
};

export default Card;