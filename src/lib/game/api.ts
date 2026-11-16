import { getSupabase } from "../supabase/client";
import type { Game, Round } from "../types";

// Igual que en rooms.ts: el navegador solo llama funciones SQL que validan las reglas.

export async function startGame(roomId: string): Promise<Game> {
  const { data, error } = await getSupabase().rpc("start_game", { p_room: roomId });
  if (error) throw error;
  return data as Game;
}

export async function spinRound(roundId: string): Promise<Round> {
  const { data, error } = await getSupabase().rpc("spin_round", { p_round: roundId });
  if (error) throw error;
  return data as Round;
}

export async function voteLetter(roundId: string, accept: boolean): Promise<void> {
  const { error } = await getSupabase().rpc("vote_letter", { p_round: roundId, p_accept: accept });
  if (error) throw error;
}

export async function resolveLetterVote(roundId: string): Promise<Round> {
  const { data, error } = await getSupabase().rpc("resolve_letter_vote", { p_round: roundId });
  if (error) throw error;
  return data as Round;
}

/** Hora del servidor en milisegundos (para sincronizar los relojes). */
export async function fetchServerNow(): Promise<number> {
  const { data, error } = await getSupabase().rpc("server_now");
  if (error) throw error;
  return Date.parse(data as string);
}
