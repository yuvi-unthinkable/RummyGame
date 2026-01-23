import { useMemo } from 'react';
import { getRoomSnap } from '../services/db.service';

async function getRoomAvailibility(roomId: number) {
  const room = await getRoomSnap(roomId);
  if (!room) return null;
  const joinedPlayers = useMemo(() => {
    return room?.players ? Object.keys(room.players).length : 0;
  }, [room?.players]);

  const totalPlayers = room?.playerCount ?? 0;
  return { joinedPlayers, totalPlayers };
}

export default getRoomAvailibility;
