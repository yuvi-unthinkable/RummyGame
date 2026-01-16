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
  // 🟢 NEW: Pass logic variables instead of a raw boolean
  owner: SharedValue<string>;
  state: SharedValue<CardState>;
  myId: string | null;

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
  state,
  myId,
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

  // const isMyCard = useDerivedValue(() => owner.value === activePlayer);

  const shadowDY = useDerivedValue(() =>
    owner.value === activePlayer ? 6 : 0,
  );

  const shadowBlur = useDerivedValue(() =>
    owner.value === activePlayer ? 12 : 0,
  );

  return (
    <Group transform={transform}>
      {/* 🔹 Shadow + Background */}
      <Rect x={0} y={0} width={cardWidth} height={cardHeight}>
        <Paint>
          <Shadow
            dx={0}
            dy={shadowDY}
            blur={shadowBlur}
            color="rgba(247, 211, 6, 0.88)"
          />
        </Paint>
      </Rect>

      {/* 🔹 Card Image */}
      {currentImage && (
        <Image
          image={currentImage}
          x={0}
          y={0}
          width={cardWidth}
          height={cardHeight}
        />
      )}

      {/* 🔹 Border */}
      {/* <Rect
        x={0}
        y={0}
        width={cardWidth}
        height={cardHeight}
        r={borderRadius}
        style="stroke"
        strokeWidth={2}
        color="white"
      /> */}
    </Group>
  );
};

export default Card;

// import React from 'react';
// import {
//   Group,
//   Image,
//   Rect,
//   Paint,
//   Shadow,
//   SkImage,
// } from '@shopify/react-native-skia';
// import {
//   SharedValue,
//   useDerivedValue,
//   withTiming,
//   interpolate,
//   Extrapolation,
// } from 'react-native-reanimated';
// import { CardState } from './cardTypes';

// type CardProps = {
//   x: SharedValue<number>;
//   y: SharedValue<number>;
//   owner: SharedValue<string>;
//   state: SharedValue<CardState>;
//   myId: string | null;
//   backCardImg: SkImage | null;
//   faceCardImg: SkImage | null;
//   cardWidth: number;
//   cardHeight: number;
//   activePlayer?: string; // If this comes from room, it might not be a shared value
// };

// const Card = ({
//   x,
//   y,
//   owner,
//   state,
//   myId,
//   backCardImg,
//   faceCardImg,
//   cardWidth,
//   cardHeight,
//   activePlayer,
// }: CardProps) => {
//   const halfWidth = cardWidth / 2;
//   const halfHeight = cardHeight / 2;

//   // 1. 🔒 LOGIC: Should the card be face up?
//   const isFaceUpLogic = useDerivedValue(() => {
//     const s = state.value;
//     const o = owner.value;
//     if (s === 'deck') return false;
//     if (s === 'hand') return o === myId;
//     return true; // Table, Show, etc.
//   });

//   // 2. 🔄 ANIMATION: Drive rotation 0 -> 180 (Pi)
//   const rotationAngle = useDerivedValue(() => {
//     return withTiming(isFaceUpLogic.value ? Math.PI : 0, { duration: 600 });
//   });

//   // 3. 🖼 FLIP LOGIC
//   // We determine "front vs back" based on the ACTUAL current rotation angle,
//   // not the boolean target.
//   const showFace = useDerivedValue(() => {
//     return rotationAngle.value >= Math.PI / 2;
//   });

//   const transform = useDerivedValue(() => {
//     return [
//       { perspective: 800 },
//       // Translate to center for rotation
//       { translateX: x.value + halfWidth },
//       { translateY: y.value + halfHeight },
//       { rotateY: rotationAngle.value },
//       // 🟢 FIX: Only un-mirror the card when we are actually showing the face
//       { scaleX: showFace.value ? -1 : 1 },
//       // Translate back
//       { translateX: -halfWidth },
//       { translateY: -halfHeight },
//     ];
//   });

//   const currentImage = useDerivedValue(() => {
//     if (!backCardImg || !faceCardImg) return null;
//     return showFace.value ? faceCardImg : backCardImg;
//   });

//   // 4. 🔦 HIGHLIGHT ACTIVE PLAYER
//   // Assuming activePlayer is a simple string prop, we compare it to the shared value
//   const isActive = useDerivedValue(() => {
//     return owner.value === activePlayer;
//   });

//   // Smoothly animate the shadow pop
//   const shadowBlur = useDerivedValue(() => {
//     return withTiming(isActive.value ? 12 : 2, { duration: 300 });
//   });
  
//   const shadowDY = useDerivedValue(() => {
//     return withTiming(isActive.value ? 6 : 1, { duration: 300 });
//   });

//   return (
//     <Group transform={transform}>
//       {/* Shadow Layer */}
//       <Rect x={0} y={0} width={cardWidth} height={cardHeight}>
//        <Paint>
//           <Shadow
//             dx={0}
//             dy={shadowDY}
//             blur={shadowBlur}
//             color="rgba(247, 211, 6, 0.88)"
//           />
//         </Paint>
//       </Rect>
      
//       {/* Active Player Glow (Optional extra layer) */}
//       {/* If you want the yellow glow ONLY for active player */}
//       {/* <Rect x={0} y={0} width={cardWidth} height={cardHeight} opacity={isActive}>
//          <Paint>
//           <Shadow dx={0} dy={0} blur={15} color="rgba(247, 211, 6, 0.8)" />
//          </Paint>
//       </Rect> */}

//       {/* Image Layer */}
//       {currentImage && (
//         <Image
//           image={currentImage}
//           x={0}
//           y={0}
//           width={cardWidth}
//           height={cardHeight}
//           fit="fill"
//         />
//       )}
//     </Group>
//   );
// };

// export default Card;