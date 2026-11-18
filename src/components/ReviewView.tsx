"use client";

import type { GameCategory, RoundAnswer, WordReview } from "@/lib/types";

interface ReviewViewProps {
  categories: GameCategory[];
  answers: RoundAnswer[];
  reviews: WordReview[];
  players: { id: string; name: string }[];
  myId: string;
}

const SOURCE_LABEL: Record<string, string> = {
  dictionary: "diccionario de WordiX",
  wikidata: "Wikidata",
  wiktionary: "Wikcionario",
  vote: "votación",
};

function Badge({ answer, review }: { answer: RoundAnswer; review?: WordReview }) {
  if (answer.status === "accepted") {
    return (
      <span className="rounded-lg bg-volt/15 px-2 py-0.5 text-xs font-bold text-volt">
        Aceptada{answer.decided_by ? ` · ${SOURCE_LABEL[answer.decided_by] ?? answer.decided_by}` : ""}
      </span>
    );
  }
  if (answer.status === "rejected") {
    return (
      <span className="rounded-lg bg-bubble/15 px-2 py-0.5 text-xs font-bold text-bubble">
        Rechazada{answer.decided_by === "letter" ? " · no empieza con la letra" : ""}
      </span>
    );
  }
  if (answer.status === "in_review") {
    return (
      <span className="rounded-lg bg-sun/15 px-2 py-0.5 text-xs font-bold text-sun">
        {review?.status === "open" || !review ? "Sin confirmar · pasa a revisión de los jugadores" : "En revisión"}
      </span>
    );
  }
  return <span className="rounded-lg bg-white/10 px-2 py-0.5 text-xs font-bold text-mist">Validando…</span>;
}

export function ReviewView({ categories, answers, reviews, players, myId }: ReviewViewProps) {
  const pending = answers.filter((a) => a.status === "pending" && a.answer).length;
  const accepted = answers.filter((a) => a.status === "accepted").length;
  const inReview = answers.filter((a) => a.status === "in_review").length;
  const rejected = answers.filter((a) => a.status === "rejected").length;

  return (
    <div className="flex w-full flex-col gap-4 text-left">
      <div role="status" aria-live="polite" className="rounded-xl bg-white/5 px-4 py-3 text-sm text-mist">
        {pending > 0 ? (
          <span>Validando respuestas… {pending} por comprobar.</span>
        ) : (
          <span>
            Validación lista: {accepted} aceptadas, {rejected} rechazadas, {inReview} sin confirmar.
            {inReview > 0 ? " Las sin confirmar las decidirán los jugadores en la siguiente etapa." : ""}
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-3">
        {categories.map((category) => {
          const rows = players.map((player) => ({
            player,
            answer: answers.find((a) => a.player_id === player.id && a.category_id === category.category_id),
          }));
          return (
            <li key={category.category_id} className="rounded-2xl bg-white/5 p-3">
              <p className="mb-2 font-display text-lg font-bold">{category.name}</p>
              <ul className="flex flex-col gap-2">
                {rows.map(({ player, answer }) => (
                  <li key={player.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-mist">
                      {player.name}
                      {player.id === myId ? " (tú)" : ""}
                    </span>
                    {answer && answer.answer ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{answer.answer}</span>
                        <Badge answer={answer} review={reviews.find((r) => r.answer_id === answer.id)} />
                      </span>
                    ) : (
                      <span className="text-sm text-mist">sin respuesta</span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
