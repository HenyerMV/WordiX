"use client";

import { useState } from "react";
import { friendlyError } from "@/lib/errors";
import { voteWord } from "@/lib/game/api";
import { tallyReview, type ReviewTally } from "@/lib/game/reviews";
import type { GameCategory, RoundAnswer, WordReview, WordVote } from "@/lib/types";

interface ReviewViewProps {
  categories: GameCategory[];
  answers: RoundAnswer[];
  reviews: WordReview[];
  votes: WordVote[];
  players: { id: string; name: string }[];
  myId: string;
  onChanged: () => void;
  /** En la pantalla de resultados la lista queda plegada para que todo quepa. */
  collapsible?: boolean;
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
      <span className="flex items-center gap-2">
        <span className="rounded-lg bg-volt/15 px-2 py-0.5 text-xs font-bold text-volt">
          Aceptada{answer.decided_by ? ` · ${SOURCE_LABEL[answer.decided_by] ?? answer.decided_by}` : ""}
        </span>
        {answer.points > 0 ? <span className="font-display font-bold text-volt">+{answer.points}</span> : null}
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

interface QueueItem {
  answer: RoundAnswer;
  review: WordReview;
  tally: ReviewTally;
}

export function ReviewView({ categories, answers, reviews, votes, players, myId, onChanged, collapsible = false }: ReviewViewProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = answers.filter((a) => a.status === "pending" && a.answer).length;
  const accepted = answers.filter((a) => a.status === "accepted").length;
  const rejected = answers.filter((a) => a.status === "rejected").length;
  const toVote = answers.filter((a) => a.status === "in_review").length;
  const memberIds = players.map((p) => p.id);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "jugador";
  const categoryOrder = (id: number) => categories.findIndex((c) => c.category_id === id);

  // Palabras abiertas a votación, con lo que le toca votar a este jugador.
  const queue: QueueItem[] = [];
  for (const answer of answers) {
    if (answer.status !== "in_review") continue;
    const review = reviews.find((r) => r.answer_id === answer.id);
    if (!review || review.status !== "open") continue;
    queue.push({
      answer,
      review,
      tally: tallyReview(
        votes.filter((v) => v.review_id === review.id),
        answer.player_id,
        memberIds,
        myId,
      ),
    });
  }
  queue.sort((a, b) => categoryOrder(a.answer.category_id) - categoryOrder(b.answer.category_id));
  const myQueue = queue.filter((q) => q.tally.canVote);
  const focus = myQueue[0];
  const categoryName = (id: number) => categories.find((c) => c.category_id === id)?.name ?? "";

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

  const summary =
    pending > 0
      ? `Validando respuestas… ${pending} por comprobar.`
      : myQueue.length > 0
        ? `Te faltan ${myQueue.length} ${myQueue.length === 1 ? "palabra" : "palabras"} por votar.`
        : toVote > 0
          ? `Esperando los votos de los demás jugadores (${toVote} ${toVote === 1 ? "palabra" : "palabras"}).`
          : `Revisión lista: ${accepted} aceptadas y ${rejected} rechazadas.`;

  const list = (
    <ul className="flex flex-col gap-2 text-left">
      {categories.map((category) => (
        <li key={category.category_id} className="rounded-xl bg-white/5 p-2.5">
          <p className="mb-1 font-display font-bold">{category.name}</p>
          <ul className="flex flex-col gap-1.5">
            {players.map((player) => {
              const answer = answers.find((a) => a.player_id === player.id && a.category_id === category.category_id);
              const item = answer ? queue.find((q) => q.answer.id === answer.id) : undefined;
              return (
                <li key={player.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="text-sm text-mist">
                    {player.name}
                    {player.id === myId ? " (tú)" : ""}
                  </span>
                  {answer && answer.answer ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{answer.answer}</span>
                      <Badge answer={answer} />
                      {item ? (
                        <span className="text-xs text-mist">
                          Votaron {item.tally.voted} de {item.tally.total}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-sm text-mist">sin respuesta</span>
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={`flex w-full flex-col gap-3 ${collapsible ? "" : "min-h-0 flex-1"}`}>
      <p role="status" aria-live="polite" className="shrink-0 rounded-xl bg-white/5 px-3 py-2 text-sm text-mist">
        {summary}
      </p>

      {focus ? (
        <div className="shrink-0 rounded-2xl bg-sun/10 p-3 text-center ring-1 ring-sun/40">
          <p className="text-xs uppercase tracking-wide text-mist">
            {categoryName(focus.answer.category_id)} · palabra de {nameOf(focus.answer.player_id)}
          </p>
          <p className="my-1 font-display text-3xl font-bold">{focus.answer.answer}</p>
          <p className="mb-2 text-xs text-mist">¿Es válida en esta categoría? Gana lo que decida la mayoría.</p>
          <div className="flex justify-center gap-3">
            <button type="button" className="btn-primary" disabled={busy !== null} onClick={() => void cast(focus.review.id, true)}>
              Es válida
            </button>
            <button type="button" className="btn-ghost" disabled={busy !== null} onClick={() => void cast(focus.review.id, false)}>
              No es válida
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="shrink-0 rounded-xl bg-bubble/15 px-3 py-2 text-sm text-bubble">
          {error}
        </p>
      ) : null}

      {collapsible ? (
        <details className="shrink-0 rounded-xl bg-white/5 px-3 py-2 text-left">
          <summary className="cursor-pointer text-sm font-bold">Ver todas las respuestas</summary>
          <div className="mt-2 max-h-[40dvh] overflow-y-auto">{list}</div>
        </details>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
      )}
    </div>
  );
}
