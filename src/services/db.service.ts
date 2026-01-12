import { database } from '../context/Firebase';
import { RoomData } from '../Backend/Room';

const db = database;

// export function UpdateDeck(roomId: number, deck: CardData[]) {
//   const roomRef = ref(db, `room/${roomId}`);

//   const serializeCards = deck.map(card => ({
//     meta: card.meta,
//     owner: card.owner.value,
//     state: card.state.value,
//     faceup: card.faceup.value,
//   }));

//   update(roomRef, {
//     cards: serializeCards,
//   });
// }

// export function updateCard(
//   roomId: number,
//   cardId: number,
//   owner: string,
//   state: string,
//   faceup: boolean,
// ) {
//   const cardRef = ref(db, `room/${roomId}/cards/${cardId}`);

//   update(cardRef, {
//     owner,
//     state,
//     faceup,
//   });
// }

// export function updateCardDeckToPlayer(
//   roomId: number,
//   cardId: number,
//   newOwner: string,
// ) {
//   const cardRef = ref(db, `room/${roomId}/cards/${cardId}`);

//   update(cardRef, {
//     owner: newOwner,
//     state: 'hand',
//     faceup: true,
//   });
// }
// export function updateCardPrevToPlayer(
//   roomId: number,
//   cardId: number,
//   newOwner: string,
// ) {
//   const cardRef = ref(db, `room/${roomId}/cards/${cardId}`);

//   update(cardRef, {
//     owner: newOwner,
//     state: 'prevcard',
//     faceup: true,
//   });
// }

// export function updateCardPlayerToPrev(roomId: number, cardId: number) {
//   const cardRef = ref(db, `room/${roomId}/cards/${cardId}`);

//   update(cardRef, {
//     owner: 'unset',
//     state: 'prevcard',
//     faceup: true,
//   });
// }
// export function updateCardPlayerToAbondended(roomId: number, cardId: number) {
//   const cardRef = ref(db, `room/${roomId}/cards/${cardId}`);

//   update(cardRef, {
//     owner: 'unset',
//     state: 'collected',
//     faceup: true,
//   });
// }

// // getting card data from its id
// export function getCardData(roomId: number, cardId: number) {
//   const cardRef = ref(db, `room/${roomId}/cards/${cardId}`);

//   update(cardRef, {
//     owner: 'unset',
//     state: 'collected',
//     faceup: true,
//   });
// }

// function to get current snap of room
export async function getRoomSnap(roomId: number): Promise<RoomData | null> {
  const roomRef = database().ref(`room/${roomId}`);
  const snapshot = await roomRef.once('value');

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.val() as RoomData;
}

// function to get current snap of card
export async function getCardSnap(
  roomId: number,
  cardId: number,
  owner: string,
  state: string,
  faceup: boolean,
  indexInHand: number,
) {
  const cardRef = database().ref(`room/${roomId}/cards/${cardId}`);

  const snapshot = await cardRef.once('value');
  if (snapshot.exists()) {
    return snapshot.val;
  }
  return undefined;
}
// function to update card
export async function UpdateCardData(
  roomId: number,
  cardId: number,
  owner: string,
  state: string,
  faceup: boolean,
  indexInHand: number,
) {
  const cardRef = database().ref(`room/${roomId}/cards/${cardId}`);

  await cardRef.update({
    owner,
    state,
    faceup,
    indexInHand,
  });
}

export async function UpdateRoomData(roomId: number, room: RoomData) {
  const roomRef = database().ref(`room/${roomId}`);
  await roomRef.set(room);
}
