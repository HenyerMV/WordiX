// Reglas de la votación de palabras. Módulo sin dependencias (se prueba con `npm test`).
// Debe mantenerse alineado con la función SQL vote_word()
// (supabase/migrations/..._votacion_mayoria.sql, que reemplaza a la de la migración 6):
// ahí es donde de verdad se decide.

export interface VoteLike {
  voter_id: string;
  approve: boolean;
}

export type ReviewDecision = "open" | "accepted" | "rejected";

/**
 * Decide una revisión por MAYORÍA. `voterIds` son los jugadores que deben votar
 * (todos menos el autor).
 *  - Se acepta cuando más de la mitad vota a favor.
 *  - Se rechaza cuando ya no se puede llegar a esa mayoría (un empate rechaza).
 *  - Si el resultado todavía puede cambiar, sigue abierta.
 */
export function decideReview(votes: VoteLike[], voterIds: string[]): ReviewDecision {
  const eligible = new Set(voterIds);
  const total = eligible.size;
  if (total === 0) return "open";

  const valid = votes.filter((v) => eligible.has(v.voter_id));
  const approvals = new Set(valid.filter((v) => v.approve).map((v) => v.voter_id)).size;
  const rejections = new Set(valid.filter((v) => !v.approve).map((v) => v.voter_id)).size;

  if (approvals * 2 > total) return "accepted";
  if (rejections * 2 >= total) return "rejected";
  return "open";
}

export interface ReviewTally {
  /** Cuántos jugadores deben votar. */
  total: number;
  /** Cuántos ya votaron. */
  voted: number;
  /** Mi voto: true a favor, false en contra, null si todavía no voto. */
  myVote: boolean | null;
  /** ¿Puedo votar ahora? (no soy el autor y no he votado). */
  canVote: boolean;
  decision: ReviewDecision;
}

export function tallyReview(votes: VoteLike[], authorId: string, memberIds: string[], myId: string): ReviewTally {
  const voterIds = memberIds.filter((id) => id !== authorId);
  const eligible = new Set(voterIds);
  const valid = votes.filter((v) => eligible.has(v.voter_id));
  const mine = valid.find((v) => v.voter_id === myId);
  return {
    total: voterIds.length,
    voted: new Set(valid.map((v) => v.voter_id)).size,
    myVote: mine ? mine.approve : null,
    canVote: myId !== authorId && eligible.has(myId) && !mine,
    decision: decideReview(valid, voterIds),
  };
}
