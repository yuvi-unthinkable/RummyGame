import React from 'react';
import {
  Group,
  Image,
  Rect,
  Paint,
  Shadow,
  SkImage,
} from '@shopify/react-native-skia';
import {
  SharedValue,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { CardState } from './cardTypes';

type CardProps = {
  x: SharedValue<number>;
  y: SharedValue<number>;
  owner: SharedValue<string>;
  faceup: SharedValue<boolean>;

  backCardImg: SkImage | null;
  faceCardImg: SkImage | null;
  cardWidth: number;
  cardHeight: number;
  activePlayer?: string;
};

const Card = ({
  x,
  y,
  owner,
  faceup,
  backCardImg,
  faceCardImg,
  cardWidth,
  cardHeight,
  activePlayer,
}: CardProps) => {
  const halfWidth = cardWidth / 2;
  const halfHeight = cardHeight / 2;
  const borderRadius = 12;
  const shadowOpacity = 0.35;

  const rotationAngle = useDerivedValue(() => {
    return withTiming(faceup.value ? Math.PI : 0, { duration: 500 });
  });

  const transform = useDerivedValue(() => {
    const angle = rotationAngle.value;

    return [
      { perspective: 800 },
      { translateX: x.value + halfWidth },
      { translateY: y.value + halfHeight },
      { scale: faceup.value ? 1.2 : 1 },
      { rotateY: angle },
      { scaleX: faceup.value ? -1 : 1 },
      { translateX: -halfWidth },
      { translateY: -halfHeight },
    ];
  });

  const currentImage = useDerivedValue(() => {
    const angle = rotationAngle.value;
    const isShowingFace = angle > Math.PI / 2;

    if (!backCardImg || !faceCardImg) return null;

    return isShowingFace ? faceCardImg : backCardImg;
  });

  const shadowDY = useDerivedValue(() =>
    owner.value === activePlayer ? 6 : 0,
  );

  const shadowBlur = useDerivedValue(() =>
    owner.value === activePlayer ? 12 : 0,
  );

  return (
    <Group transform={transform}>
      {/* <Rect
        style={{ value: 'stroke' }}
        x={0}
        y={0}
        width={cardWidth}
        height={cardHeight}
      >
        <Paint>
          <Shadow
            dx={0}
            dy={shadowDY}
            blur={shadowBlur}
            color="rgba(247, 211, 6, 0.88)"
          />
        </Paint>
      </Rect> */}

      {currentImage && (
        <Image
          image={currentImage}
          // x={!faceup ? index : x}
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
