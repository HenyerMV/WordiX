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

export interface Game {
  id: string;
  room_id: string;
  status: "in_progress" | "finished";
  created_at: string;
  finished_at: string | null;
}

export type RoundStatus =
  | "spinning"
  | "letter_vote"
  | "answering"
  | "reviewing"
  | "finished"
  | "letter_rejected";

export interface Round {
  id: string;
  game_id: string;
  number: number;
  hand_player_id: string;
  letter: string | null;
  status: RoundStatus;
  stopped_by: string | null;
  /** Reloj oficial: marca de tiempo del servidor en que empezó la fase actual. */
  phase_started_at: string;
  created_at: string;
}

export interface LetterVote {
  round_id: string;
  player_id: string;
  accept: boolean;
  voted_at: string;
}
