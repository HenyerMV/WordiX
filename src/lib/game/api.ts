import { getSupabase } from "../supabase/client";
import type { AnswerProgress, Game, Round } from "../types";

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

/** Pide al servidor que valide las respuestas de la ronda (es seguro llamarlo varias veces). */
export async function validateRound(roundId: string): Promise<void> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("NOT_AUTHENTICATED");
  const res = await fetch("/api/validar", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ roundId }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "VALIDATION_FAILED");
  }
}

export async function startMyTurn(roundId: string): Promise<AnswerProgress> {
  const { data, error } = await getSupabase().rpc("start_my_turn", { p_round: roundId });
  if (error) throw error;
  return data as AnswerProgress;
}

export async function submitAnswer(roundId: string, categoryId: number, answer: string): Promise<AnswerProgress> {
  const { data, error } = await getSupabase().rpc("submit_answer", {
    p_round: roundId,
    p_category: categoryId,
    p_answer: answer,
  });
  if (error) throw error;
  return data as AnswerProgress;
}

export async function skipCategory(roundId: string, categoryId: number): Promise<AnswerProgress> {
  const { data, error } = await getSupabase().rpc("skip_category", { p_round: roundId, p_category: categoryId });
  if (error) throw error;
  return data as AnswerProgress;
}

export async function expireCategory(roundId: string, categoryId: number): Promise<AnswerProgress> {
  const { data, error } = await getSupabase().rpc("expire_category", { p_round: roundId, p_category: categoryId });
  if (error) throw error;
  return data as AnswerProgress;
}

export async function pressStop(roundId: string): Promise<Round> {
  const { data, error } = await getSupabase().rpc("press_stop", { p_round: roundId });
  if (error) throw error;
  return data as Round;
}

export async function voteEndRound(roundId: string, want: boolean): Promise<Round> {
  const { data, error } = await getSupabase().rpc("vote_end_round", { p_round: roundId, p_want: want });
  if (error) throw error;
  return data as Round;
}

export async function voteWord(reviewId: string, approve: boolean): Promise<void> {
  const { error } = await getSupabase().rpc("vote_word", { p_review: reviewId, p_approve: approve });
  if (error) throw error;
}
