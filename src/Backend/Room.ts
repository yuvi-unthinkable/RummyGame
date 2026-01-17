import { getDatabase, ref, update } from '@react-native-firebase/database';
import { database } from '../context/Firebase';
import { getRoomSnap, UpdateRoomData } from '../services/db.service';
import { NetworkCard } from './useGameStarted';

export type TurnLock = {
  id: number;
  blockedPriority: number;
  untilTurn: number;
};

export type RoomData = {
  status: 'waiting' | 'playing' | 'ended';
  roomId: number;
  playerCount: number;
  createdAt: string;

  players: Record<string, Player>; // p1, p2, p3...

  abandonedCards?: Record<string, NetworkCard>;
  deck?: {
    order: number[];
  };

  hostUid: string;
  activePlayer?: string;

  turnLocks?: Record<string, TurnLock>;

  turnNumber?: number;

  PreviousCard?: NetworkCard;

  result?: {
    winners: string;
    reason: 'empty-hand' | 'manual-end';
    endedAt: number;
    endedBy?:string;
  };
};

export type Player = {
  userId: string;
  connected: boolean;
  dropped: boolean;
  handCards: Record<number, NetworkCard>;
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
  const db = getDatabase();
  console.log('Joining room:', roomId);

  const roomData = await getRoomSnap(roomId);

  if (roomData === null) {
    console.error('Room does not exist');
    return { PlayerQty: 0, startGame: false };
  }

  const players = roomData.players ?? {};

  const existingEntry = Object.entries(players).find(
    ([_, p]) => p.userId === uid,
  );

  if (existingEntry) {
    console.log('user already joined');
    return {
      PlayerQty: Object.keys(players).length,
      startGame: roomData.status === 'playing',
      myPosition: existingEntry[0],
    };
  }

  if (Object.keys(players).length >= roomData.playerCount) {
    console.log('room already filled');

    throw new Error('Room is full');
  }

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

  const roomRef = ref(db, `room/${roomId}`);

  await update(roomRef, {
    players: updatedPlayers,
    status: newStatus,
  });

  return {
    PlayerQty: Object.keys(updatedPlayers).length,
    startGame: newStatus === 'playing',
    myPosition: position,
  };
};
