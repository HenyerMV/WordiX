export interface Player {
  id: string;
  username: string;
  created_at: string;
}

export type RoomStatus = "waiting" | "playing" | "finished";

export interface Room {
  id: string;
  code: string;
  host_id: string;
  status: RoomStatus;
  max_players: number;
  created_at: string;
}

/** Jugador sentado en una sala (room_players + nombre). */
export interface Member {
  playerId: string;
  username: string;
  seat: number;
}
