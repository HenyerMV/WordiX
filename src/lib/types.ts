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
  /** Cuántas rondas se juegan en la partida (se elige al crear la sala). */
  total_rounds: number;
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

/** Categoría de la partida, en orden (game_categories + nombre). */
export interface GameCategory {
  category_id: number;
  position: number;
  name: string;
}

/** Avance de un jugador en la fase de respuestas (una categoría a la vez). */
export interface AnswerProgress {
  round_id: string;
  player_id: string;
  /** Categoría que tiene abierta; null cuando ya completó todas. */
  category_id: number | null;
  /** Reloj oficial: momento del servidor en que se abrió esa categoría. */
  opened_at: string;
  /** 1 = primera vuelta; 2 o más = repetición de pendientes. */
  pass: number;
  finished: boolean;
}

export interface EndVote {
  round_id: string;
  player_id: string;
}

/** Respuesta propia de la ronda actual. */
export interface MyAnswer {
  category_id: number;
  answer: string | null;
  status: "pending" | "accepted" | "rejected" | "in_review";
}

/** Respuesta de cualquier jugador, visible cuando la ronda está en revisión. */
export interface RoundAnswer {
  id: string;
  player_id: string;
  category_id: number;
  answer: string | null;
  status: "pending" | "accepted" | "rejected" | "in_review";
  decided_by: "format" | "letter" | "dictionary" | "wikidata" | "wiktionary" | "vote" | null;
  points: number;
}

export interface WordReview {
  id: string;
  answer_id: string;
  status: "open" | "accepted" | "rejected";
}

export interface WordVote {
  review_id: string;
  voter_id: string;
  approve: boolean;
}

/** Puntaje de un jugador en la partida (se actualiza al cerrar cada ronda). */
export interface GameResult {
  game_id: string;
  player_id: string;
  total_points: number;
  /** Solo se llena cuando termina la partida. */
  position: number | null;
}
