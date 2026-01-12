import { database } from '../context/Firebase';
import { getRoomSnap, UpdateRoomData } from '../services/db.service';
import { NetworkCard } from './useGameStarted';

export type RoomData = {
  status: 'waiting' | 'playing' | 'ended';
  roomId: number;
  playerCount: number;
  createdAt: string;
  players: Record<string, Player>; // p1, p2, p3...
  cards?: Record<string, NetworkCard>;
  deck?: { order: number[] };
  hostUid: string;
  activePlayer?: string;
};

export type Player = {
  userId: string;
  connected: boolean;
  dropped: boolean;
};

const currentTimeString = new Date().toLocaleTimeString();

const room1 = {
  roomId: 123456,
  playerCount: 2,
  createdAt: currentTimeString,
  status: 'waiting',
  // cards: [],
};

export async function createRoom(uid: string) {
  const roomObj: RoomData = {
    roomId: room1.roomId,
    playerCount: room1.playerCount,
    hostUid: uid,
    createdAt: currentTimeString,
    status: 'waiting',
    players: {},
  };

  await UpdateRoomData(roomObj.roomId, roomObj);
}
export const JoinRoom = async (roomId: number, uid: string) => {
  console.log('Joining room:', roomId);

  // const roomRef = ref(database, `room/${roomId}`);

  // const room

  // if (!snapshot.exists()) {
  //   console.error('Room does not exist');
  //   return { PlayerQty: 0, startGame: false };
  // }

  // const roomData = snapshot.val() as RoomData;
  const roomData = await getRoomSnap(roomId);

  if (roomData === null) {
    console.error('Room does not exist');
    return { PlayerQty: 0, startGame: false };
  }

  const players = roomData.players ?? {};

  // 1️⃣ Check if user already joined
  const existingEntry = Object.entries(players).find(
    ([_, p]) => p.userId === uid,
  );

  if (existingEntry) {
    // User already has a seat
    return {
      PlayerQty: Object.keys(players).length,
      startGame: roomData.status === 'playing',
      myPosition: existingEntry[0],
    };
  }

  // 2️⃣ Prevent overfilling
  if (Object.keys(players).length >= roomData.playerCount) {
    throw new Error('Room is full');
  }

  // 3️⃣ Assign next available position deterministically
  const nextIndex = Object.keys(players).length + 1;
  const position = `p${nextIndex}`;

  const updatedPlayers = {
    ...players,
    [position]: {
      userId: uid,
      connected: true,
      dropped: false,
    },
  };

  // 4️⃣ Determine new room status
  const isNowFull = Object.keys(updatedPlayers).length === roomData.playerCount;
  const newStatus = isNowFull ? 'playing' : roomData.status;

  // 5️⃣ Atomic update

  const roomRef = database().ref(`room/${roomId}`);

  await roomRef.update({
    players: updatedPlayers,
    status: newStatus,
  });

  return {
    PlayerQty: Object.keys(updatedPlayers).length,
    startGame: newStatus === 'playing',
    myPosition: position,
  };
};
