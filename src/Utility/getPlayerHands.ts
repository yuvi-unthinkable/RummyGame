import { RoomData } from "../Backend/Room";
import { NetworkCard } from "../Backend/useGameStarted";
import { playerId } from "../Components/Playground";

export function getHandForPlayer(room: RoomData, playerId: playerId): NetworkCard[] {
    const map = room.players[playerId]?.handCards;
    return map ? Object.values(map).filter(Boolean) : [];
  }
