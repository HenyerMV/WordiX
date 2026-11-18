// Reglas de la votación de palabras. Módulo sin dependencias (se prueba con `npm test`).
// Debe mantenerse alineado con la función SQL vote_word()
// (supabase/migrations/..._votacion_palabras.sql): ahí es donde de verdad se decide.

export interface VoteLike {
  voter_id: string;
  approve: boolean;
}

export type ReviewDecision = "open" | "accepted" | "rejected";

/**
 * Decide una revisión. `voterIds` son los jugadores que deben votar (todos menos el autor).
 *  - Un solo voto en contra la rechaza.
 *  - Todos a favor la acepta.
 *  - Si no, sigue abierta.
 */
export function decideReview(votes: VoteLike[], voterIds: string[]): ReviewDecision {
  const eligible = new Set(voterIds);
  const valid = votes.filter((v) => eligible.has(v.voter_id));
  if (valid.some((v) => !v.approve)) return "rejected";
  const approvals = new Set(valid.filter((v) => v.approve).map((v) => v.voter_id));
  return eligible.size > 0 && approvals.size >= eligible.size ? "accepted" : "open";
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
