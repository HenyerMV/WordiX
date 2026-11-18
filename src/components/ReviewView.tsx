"use client";

import { useState } from "react";
import { friendlyError } from "@/lib/errors";
import { voteWord } from "@/lib/game/api";
import { tallyReview } from "@/lib/game/reviews";
import type { GameCategory, RoundAnswer, WordReview, WordVote } from "@/lib/types";

interface ReviewViewProps {
  categories: GameCategory[];
  answers: RoundAnswer[];
  reviews: WordReview[];
  votes: WordVote[];
  players: { id: string; name: string }[];
  myId: string;
  onChanged: () => void;
}

const SOURCE_LABEL: Record<string, string> = {
  dictionary: "diccionario de WordiX",
  wikidata: "Wikidata",
  wiktionary: "Wikcionario",
  vote: "votación de los jugadores",
};

function Badge({ answer }: { answer: RoundAnswer }) {
  if (answer.status === "accepted") {
    return (
      <span className="rounded-lg bg-volt/15 px-2 py-0.5 text-xs font-bold text-volt">
        Aceptada{answer.decided_by ? ` · ${SOURCE_LABEL[answer.decided_by] ?? answer.decided_by}` : ""}
      </span>
    );
  }
  if (answer.status === "rejected") {
    const why =
      answer.decided_by === "letter" ? " · no empieza con la letra" : answer.decided_by === "vote" ? " · votación de los jugadores" : "";
    return <span className="rounded-lg bg-bubble/15 px-2 py-0.5 text-xs font-bold text-bubble">Rechazada{why}</span>;
  }
  if (answer.status === "in_review") {
    return <span className="rounded-lg bg-sun/15 px-2 py-0.5 text-xs font-bold text-sun">Sin confirmar · en votación</span>;
  }
  return <span className="rounded-lg bg-white/10 px-2 py-0.5 text-xs font-bold text-mist">Validando…</span>;
}

export function ReviewView({ categories, answers, reviews, votes, players, myId, onChanged }: ReviewViewProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = answers.filter((a) => a.status === "pending" && a.answer).length;
  const accepted = answers.filter((a) => a.status === "accepted").length;
  const rejected = answers.filter((a) => a.status === "rejected").length;
  const toVote = answers.filter((a) => a.status === "in_review").length;
  const memberIds = players.map((p) => p.id);

  async function cast(reviewId: string, approve: boolean) {
    if (busy) return;
    setBusy(reviewId);
    setError(null);
    try {
      await voteWord(reviewId, approve);
    } catch (e) {
      console.error("[wordix] no se pudo votar", e);
      setError(friendlyError(e));
    } finally {
      onChanged();
      setBusy(null);
    }
  }

  return (
    <div className="flex w-full flex-col gap-4 text-left">
      <div role="status" aria-live="polite" className="rounded-xl bg-white/5 px-4 py-3 text-sm text-mist">
        {pending > 0 ? (
          <span>Validando respuestas… {pending} por comprobar.</span>
        ) : toVote > 0 ? (
          <span>
            {accepted} aceptadas, {rejected} rechazadas. Faltan {toVote} palabras por votar: se aceptan solo si todos los
            demás jugadores votan a favor.
          </span>
        ) : (
          <span>
            Revisión lista: {accepted} aceptadas y {rejected} rechazadas.
          </span>
        )}
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-bubble/15 px-4 py-3 text-bubble">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {categories.map((category) => {
          const rows = players.map((player) => ({
            player,
            answer: answers.find((a) => a.player_id === player.id && a.category_id === category.category_id),
          }));
          return (
            <li key={category.category_id} className="rounded-2xl bg-white/5 p-3">
              <p className="mb-2 font-display text-lg font-bold">{category.name}</p>
              <ul className="flex flex-col gap-3">
                {rows.map(({ player, answer }) => {
                  const review = answer ? reviews.find((r) => r.answer_id === answer.id) : undefined;
                  const open = answer?.status === "in_review" && review?.status === "open";
                  const tally = open
                    ? tallyReview(
                        votes.filter((v) => v.review_id === review.id),
                        player.id,
                        memberIds,
                        myId,
                      )
                    : null;
                  return (
                    <li key={player.id} className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm text-mist">
                          {player.name}
                          {player.id === myId ? " (tú)" : ""}
                        </span>
                        {answer && answer.answer ? (
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-bold">{answer.answer}</span>
                            <Badge answer={answer} />
                          </span>
                        ) : (
                          <span className="text-sm text-mist">sin respuesta</span>
                        )}
                      </div>

                      {open && review && tally ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sun/10 px-3 py-2">
                          <span className="text-xs text-mist" aria-live="polite">
                            Votaron {tally.voted} de {tally.total}
                            {tally.myVote !== null ? ` · tú votaste ${tally.myVote ? "a favor" : "en contra"}` : ""}
                            {player.id === myId ? " · los demás votan tu palabra" : ""}
                          </span>
                          {tally.canVote ? (
                            <span className="flex gap-2">
                              <button
                                type="button"
                                className="btn-primary px-3 py-1 text-sm"
                                disabled={busy !== null}
                                onClick={() => void cast(review.id, true)}
                              >
                                Es válida
                              </button>
                              <button
                                type="button"
                                className="btn-ghost px-3 py-1 text-sm"
                                disabled={busy !== null}
                                onClick={() => void cast(review.id, false)}
                              >
                                No es válida
                              </button>
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
