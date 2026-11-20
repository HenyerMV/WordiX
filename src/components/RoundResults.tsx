"use client";

import { rankPlayers } from "@/lib/game/scoring";
import type { GameResult, RoundAnswer } from "@/lib/types";

interface RoundResultsProps {
  players: { id: string; name: string }[];
  answers: RoundAnswer[];
  results: GameResult[];
  myId: string;
  roundNumber: number;
  totalRounds: number;
  busy: boolean;
  onNext: () => void;
}

export function RoundResults({ players, answers, results, myId, roundNumber, totalRounds, busy, onNext }: RoundResultsProps) {
  const standings = rankPlayers(
    players.map((p) => ({
      player_id: p.id,
      total_points: results.find((r) => r.player_id === p.id)?.total_points ?? 0,
    })),
  );
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "jugador";
  const roundPoints = (id: string) => answers.filter((a) => a.player_id === id).reduce((sum, a) => sum + a.points, 0);

  return (
    <div className="flex w-full shrink-0 flex-col items-center gap-3">
      <p className="font-display text-lg font-bold">
        Resultados de la ronda {roundNumber} <span className="text-sm font-normal text-mist">({roundNumber} de {totalRounds})</span>
      </p>
      <ol className="flex w-full max-w-md flex-col gap-1.5 text-left" aria-label="Puntajes">
        {standings.map((row) => (
          <li key={row.player_id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-1.5">
            <span className="flex min-w-0 items-center gap-2">
              <span className="font-display font-bold text-mist">{row.position}.º</span>
              <span className="truncate font-bold">
                {nameOf(row.player_id)}
                {row.player_id === myId ? " (tú)" : ""}
              </span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="text-sm text-volt">+{roundPoints(row.player_id)}</span>
              <span className="font-display text-lg font-bold">{row.total_points}</span>
            </span>
          </li>
        ))}
      </ol>
      <button type="button" className="btn-primary" disabled={busy} onClick={onNext}>
        Siguiente ronda
      </button>
    </div>
  );
}
