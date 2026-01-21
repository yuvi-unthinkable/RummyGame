import { getDatabase, ref, update } from '@react-native-firebase/database';
import { database } from '../context/Firebase';
import { getRoomSnap, UpdateRoomData } from '../services/db.service';
import { NetworkCard } from './useGameStarted';
import { Alert } from 'react-native';

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
    endedBy?: string;
  };
};

export type Player = {
  userId: string;
  userName: string;
  connected: boolean;
  dropped: boolean;
  handCards: Record<number, NetworkCard>;
};

const currentTimeString = new Date().toLocaleTimeString();

const room1 = {
  // roomId: 123456,
  createdAt: currentTimeString,
  status: 'waiting',
  // cards: [],
};

export async function createRoom(
  uid: string,
  roomId: number,
  playersCount: number,
): Promise<boolean> {
  const roomObj: RoomData = {
    roomId,
    playerCount: playersCount,
    hostUid: uid,
    createdAt: currentTimeString,
    status: 'waiting',
    players: {},
  };

  try {
    await UpdateRoomData(roomId, roomObj);
    return true;
  } catch (error) {
    console.error('createRoom error:', error);
    return false;
  }
}

export const JoinRoom = async (
  roomId: number,
  uid: string,
  username: string,
) => {
  const db = getDatabase();
  console.log('Joining room:', roomId);

  const roomData = await getRoomSnap(roomId);

  if (roomData === null) {
    console.error('Room does not exist');
    return {
      gameStart: false,
      playerCount: 0,
    };
  }

  const players = roomData.players ?? {};

  const existingEntry = Object.entries(players).find(
    ([_, p]) => p.userId === uid,
  );

  if (existingEntry) {
    console.log('user already joined');
    return {
      gameStart: true,
      playerCount: roomData.playerCount,
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
      userName: username,
      connected: true,
      dropped: false,
    },
  };

  // 4️⃣ Determine new room status
  const isNowFull = Object.keys(updatedPlayers).length === roomData.playerCount;
  const newStatus = isNowFull ? 'playing' : roomData.status;

  // 5️⃣ Atomic update

  const roomRef = ref(db, `room/${roomId}`);

  try {
    await update(roomRef, {
      players: updatedPlayers,
      status: newStatus,
    });
    return {
      gameStart: true,
      playerCount: roomData.playerCount,
    };
  } catch (error) {
    console.log('🚀 ~ JoinRoom ~ error:', error);

    return {
      gameStart: false,
      playerCount: 0,
    };
  }
};
