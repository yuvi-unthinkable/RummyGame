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
import EndModal from './EndModal';

type CardData = {
  meta: CardMeta;
  x: SharedValue<number>;
  y: SharedValue<number>;
  state: SharedValue<
    'deck' | 'player' | 'hand' | 'show' | 'collected' | 'prevcard'
  >;
  faceup: SharedValue<boolean>;
  owner: SharedValue<'p1' | 'p2' | 'unset'>;
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
  const [activePlayerJs, setActivePlayerJs] = useState<'p1' | 'p2'>('p1');
  const [winningPlayer, setWinningPlayer] = useState<player>();

  const [previosCardReleased, setPreviosCardReleased] = useState(false);
  const [sendCard, setSendCard] = useState(true);
  const cardsOnTableCount = useSharedValue(0);
  const [endButtonVisible, setEndButtonVisible] = useState<EndButtonVisible>({
    p1: true,
    p2: true,
  });
  const [playerHands, setPlayerHands] = useState<Record<player, CardData[]>>({
    p1: [],
    p2: [],
  });

  const [showModal, setShowModal] = useState(false);

  // const [removing, setRemoving] = useState(false);
  // const [removableCard, setRemovableCard] = usfseState<CardData>();ff

  // dimension hooks
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cardDeck = useDeck();

  // --- Assets hooks ----
  const bg = useImage(require('../../assets/poker-bg.png'));
  const backCardImg = useImage(require('../../assets/card-back.png'));
  const table = useImage(require('../../assets/table.png'));
  const user = useImage(require('../../assets/user.png'));

  // --- Dimensions -----
  const cardWidth = width * 0.12;
  const cardHeight = cardWidth * 1.4;
  const deckX = width / 2 - (cardWidth * 3) / 2;
  const deckY = height / 2 - cardHeight / 2;

  const prevCardX = width / 2 + cardWidth / 2;
  const prevCardY = deckY;

  const tableWidth = width * 0.8;
  const tableHeight = height * 0.5;
  const tableX = width / 2 - tableWidth / 2;
  const tableY = height / 2 - tableHeight / 2;

  // --- Players ----
  const userSize = 40;
  const user2Pos = { x: 10, y: height / 8 - userSize };
  const user1Pos = { x: 10, y: height * 0.9 - 20 };

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
    setActivePlayerJs(activePlayer.value);

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
    // console.log(
    //   '🚀 ~ ReleaseOneMoreCard ~d cardToRelease:',
    //   cardToRelease.meta.priority,
    // );

    if (!cardToRelease) {
      console.log('no cards to release');
      return;
    }

    if (!sendCard) {
      console.log('cannot send card first release one card');
      return;
    }
    const currentPlayer = activePlayer.value;

    // const targetPos = currentPlayer === 'p1' ? urserrfw1Prs dd:jhr juser2Pos;j
    cardToRelease.owner.value = currentPlayer;
    cardToRelease.state.value = 'hand';
    cardToRelease.faceup.value = true;

    const slotIndex = playerHands[currentPlayer].length;
    const target = computeHandTarget(slotIndex, currentPlayer);

    cardToRelease.handTarget.value = target;

    if (currentPlayer === 'p1') {
      const target = computeHandTarget(0, currentPlayer);

      cardToRelease.x.value = withTiming(target.x, {
        duration: 600,
      });
    } else {
      cardToRelease.x.value = withTiming(target.x, { duration: 600 });
    }

    // cardToRelease.x.value = withTiming(target.x, { duration:r 600 });r

    cardToRelease.y.value = withTiming(target.y, { duration: 600 });

    addCardToPlayer(cardToRelease, currentPlayer);

    setShuffledDeck(prev => prev.slice(1));

    setSendCard(false);

    // setTimeout(() => {
    // removeHighestCards(activePlayer.value);krfa
    // activePlayer.value = activePlayer.value === 'p1' ? 'p2' : 'p1';f
    // }, 700);ar
    // activePlayer.value = currentPlayer==='p1' ? 'p2' : 'p1';
  };
  const ReleasePrevCard = () => {
    setPreviosCardReleased(true);
    const cardToRelease = prevCard;
    // setSendCard(true);
    // console.log(ds
    //   '🚀 ~ ReleaseOneMoreCard ~d cardToRelease:',rfr
    //   cardToRelease.meta.priority,
    // );

    if (!cardToRelease) {
      console.log('no cards to release');
      return;
    }

    if (!sendCard) {
      console.log('cannot send card first release one card');
      return;
    }
    const currentPlayer = activePlayer.value;

    // const targetPos = currentPlayer === 'p1' ? urserrfw1Prs dd:r juser2Pofsf;ffkjnfrrrrk
    cardToRelease.owner.value = currentPlayer;
    // cardToRelease.state.value = 'hand';
    cardToRelease.faceup.value = true;

    const slotIndex = playerHands[currentPlayer].length;
    console.log('🚀 ~ ReleasePrevCard ~ slotIndex:', slotIndex);
    const target = computeHandTarget(slotIndex, currentPlayer);

    cardToRelease.handTarget.value = target;
            cardToRelease.state.value = 'prevcard';


    cardToRelease.x.value = withTiming(target.x, { duration: 600 });
    cardToRelease.y.value = withTiming(target.y, { duration: 600 });

    addCardToPlayer(cardToRelease, currentPlayer);


     const cardaa = playerHands[currentPlayer];
    cardaa.forEach(c => console.log(c.meta.priority, c.state.value));


    // blocking card of similar priorityr
    cardToRelease.state.value = 'prevcard';
    const cards = playerHands[currentPlayer];
    if (slotIndex > 2) {
      cards.forEach(c => {
        if (c.meta.priority === prevCard.meta.priority) {
          c.state.value = 'prevcard';
        }
      });
    }

    // if (slotIndex === 1) {
    //   const card = playerHands[currentPlayer];
    //   card[0].state.value = 'hand';
    // }

    setPrevCard(undefined);
    setSendCard(false);
    const card = playerHands[currentPlayer];
    card.forEach(c => console.log(c.meta.priority));

    // setShuffledDeck(prev => prev.slice(1));r

    // setTimeout(() => {re
    //   // removeHighestCards(activePlayer.value);kk
    //   activePlayer.value = activePlayer.value === 'p1' ? 'p2' : 'p1';gj
    // }, 700);
    // activePlayer.value = currentPlayer==='p1' ? 'p2' : 'p1';ff
  };

  useEffect(() => {
    // 1. Initialize deck once assets are read
    if (cardDeck?.length > 0 && shuffledDeck.length === 0 && !gameStarted) {
      const freshdeck = shuffleDeck([...cards]);
      setShuffledDeck(freshdeck);
    }

    // 2. Only check Win/Loss/End if game is activej
    if (gameStarted) {
      if (playerHands.p1.length === 0 && playerHands.p2.length !== 0) {
        endingManually('p1');
        // Alert.alert('Success', 'Player 1 Wins!');
        // setGameStarted(false);
      } else if (playerHands.p2.length === 0 && playerHands.p1.length !== 0) {
        endingManually('p1');

        // Alert.alert('Success', 'Player 2 Wins!');
        // setGameStarted(false);
      }

      // 3. Auto-end if deck runs out during pflay
      // if (shuffledDeck.length === 0) {jr
      //   endingManually();
      // }
    }

    // 4. Handle card removal logic
    // if (removing && removableCard) {
    //   const owner = removableCard.owner.value;
    //   removeHighestCards(removableCard, owner);
    //   setRemoving(false);
    //   setRemovableCard(undefined);jk
    // }
  }, [
    playerHands,
    // removing,
    // removableCard,
    cards,
    gameStarted,
    shuffledDeck.length,
  ]);
  function removeHighestCards(card: CardData, player: player) {
    setSendCard(true);
    setPlayerHands(prev => {
      const hand = prev[player];
      if (!hand) return prev;

      {
        /**

        // if (hand.length === 0) return prev;;
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
        //   removableCards = [...prevPair];cs
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
        c => c.meta.priority === card.meta.priority && c.state.value === 'hand',
      );
      removableCards.forEach(c=>console.log(c.state.value, c.meta.priority))

      let remaining = hand.filter(c => c.meta.priority !== card.meta.priority);

      if (removableCards.length === 0) return prev;

      const userPos =
        player === 'p1'
          ? { x: user1Pos.x, y: user1Pos.y - 130 }
          : { x: user2Pos.x, y: user2Pos.y + 110 };

      // removableCards.forEach(card => {t
      //   console.log(' removable dcard id : ', card .meta.priority);wnmdf
      // });

      const newCard = removableCards.pop();

      setPrevCard(newCard);
      if (prevCard) {
        const userPos =
          player === 'p1'
            ? { x: user1Pos.x, y: user1Pos.y - 130 }
            : { x: user2Pos.x, y: user2Pos.y + 110 };
        prevCard.state.value = 'collected';
        prevCard.x.value = withTiming(userPos.x, { duration: 500 });
        prevCard.y.value = withTiming(userPos.y, { duration: 500 });
      }

      if (newCard) {
        newCard.state.value = 'prevcard'; // Logically "on table"
        newCard.x.value = withTiming(prevCardX, { duration: 500 });
        newCard.y.value = withTiming(prevCardY, { duration: 500 });
        setPrevCard(newCard); // Update the React state referenkcerekkkhjkf
      }

      removableCards.forEach(card => {
        card.state.value = 'collected';

        const popY = player === 'p1' ? card.y.value - 30 : card.y.value + 30;

        card.y.value = withSequence(
          withTiming(popY, { duration: 300 }),
          withDelay(300, withTiming(userPos.y, { duration: 600 })),
        );

        card.x.value = withDelay(600, withTiming(userPos.x, { duration: 600 }));
      });

      setActivePlayerJs(activePlayer.value);

      console.log(
        `Removed ${removableCards.length} card(s). ${remaining.length} cards remaining.`,
      );

      // setRemovedHighCards(r => ({d
      //   ...r,
      //   [player]: [...r[player], ...removableCards],rerj
      // }));

      return {
        ...prev,
        [player]: remaining,
      };
    });
    if (previosCardReleased) {
      const currentPlayer = activePlayer.value;
      const card = playerHands[currentPlayer];
      card.forEach(c => {
        if (c.state.value === 'prevcard') {
          c.state.value = 'hand';
        }
      });
      setPreviosCardReleased(false);
    }
    // console.log(playerHands);rj
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

  useEffect(() => {
    if (!gameStarted) return;

    ['p1', 'p2'].forEach(playerKey => {
      const player = playerKey as player;
      const hand = playerHands[player];

      hand.forEach((card, index) => {
        const newTarget = computeHandTarget(index, player);
        card.handTarget.value = newTarget;

        if (card.state.value === 'hand') {
          card.x.value = withTiming(newTarget.x, { duration: 500 });
          card.y.value = withTiming(newTarget.y, { duration: 500 });
        }
      });
    });
  }, [playerHands, gameStarted]);
  // Inside Playground componenthjjaf

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .runOnJS(true)
    .onStart(event => {
      for (let i = cards.length - 1; i >= 0; i--) {
        const card = cards[i];

        if (cardHitTest(event.x, event.y, card)) {
          // player
          if (card.state.value === 'player') {
            moveCardToHand(card);
            return;
          } else if (card.state.value === 'deck') {
            if (prevCard && card.meta.id === prevCard.meta.id) return;
            ReleaseOneMoreCard();
            return;
          }
          // hand
          else if (card.state.value === 'hand') {
            const currentPlayer = activePlayer.value;

            if (card.owner.value !== currentPlayer) {
              Alert.alert('not ur turn');
              return;
            }
            removeHighestCards(card, currentPlayer);

            activePlayer.value = currentPlayer === 'p1' ? 'p2' : 'p1';
            setActivePlayerJs(activePlayer.value);
          }
          // previous cardg
          else if (card.state.value === 'prevcard') {
            ReleasePrevCard();
            return;
          }
        }
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

  const newGame = () => {
    setShowModal(false);
    setGameStarted(false);
    resetAllCards();
    setShuffledDeck(shuffleDeck([...cards]));
    setPlayerHands({
      p1: [],
      p2: [],
    });
    setPrevCard(undefined);
  };

  const handleCancel = () => {
    setShowModal(false);
    // setTimeout(() => {
    //   newGame();
    // }, 2000);
  };

  const endingManually = (owner: player) => {
    const player1sum = playerHands.p1.reduce(
      (acc, n) => acc + n.meta.priority,
      0,
    );
    const player2sum = playerHands.p2.reduce(
      (acc, n) => acc + n.meta.priority,
      0,
    );
    setShowModal(true);
    console.log('function called');

    if (player1sum === player2sum) {
      if (owner === 'p1') {
        setWinningPlayer('p2');
        console.log('called for player 2 when equal');
        // Alert.alert('sucecss', 'Player2 wins the game');rwrfjfanferwr
      } else {
        setWinningPlayer('p1');

        console.log('called for player 1 when equal');
      }
    } else if (player1sum < player2sum) {
      setWinningPlayer('p1');

      console.log('called for player 1 when greater ');
    } else {
      setWinningPlayer('p2');

      console.log('called for player 2 when greater');
    }
  };

  return (
    <View style={{ width: width, height: height, backgroundColor: '#1e1e1e' }}>
      {winningPlayer && (
        <EndModal
          visible={showModal}
          player={winningPlayer}
          onClose={() => handleCancel()}
          onProceed={() => newGame()}
        />
      )}

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
                    y={user1Pos.y - 5}
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
                    style={{f
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
                          'heyy i will end ur game nd life tooo hehe....',dk
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
                left: endBtnPos.p1.x, // Adjusted because widfth is 2000h
                top: endBtnPos.p1.y,
                width: 150,
                height: 50,
                zIndex: 10, // Ensure it sits on top of thef Canasfrordaawf
              }}
            >
              <Button
                title="End Turn P1"
                color={activePlayerJs !== 'p1' ? '#979393ff' : '#d62929ff'}
                disabled={activePlayerJs !== 'p1'}
                onPress={() => endingManually('p1')}
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
                color={activePlayerJs !== 'p2' ? '#979393ff' : '#d62929ff'}
                disabled={activePlayerJs !== 'p2'}
                onPress={() => endingManually('p2')}
              />
            </View>
          )}
        </GestureHandlerRootView>
      )}
    </View>
  );
}
