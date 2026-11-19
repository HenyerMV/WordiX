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
    <div className="flex w-full flex-col items-center gap-4">
      <p className="font-display text-xl font-bold">Resultados de la ronda {roundNumber}</p>
      <ol className="flex w-full max-w-md flex-col gap-2 text-left" aria-label="Puntajes">
        {standings.map((row) => (
          <li key={row.player_id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-2">
            <span className="flex items-center gap-3">
              <span className="font-display font-bold text-mist">{row.position}.º</span>
              <span className="font-bold">
                {nameOf(row.player_id)}
                {row.player_id === myId ? " (tú)" : ""}
              </span>
            </span>
            <span className="flex items-baseline gap-3">
              <span className="text-sm text-volt">+{roundPoints(row.player_id)}</span>
              <span className="font-display text-xl font-bold">{row.total_points}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-mist">Llevan {roundNumber} de {totalRounds} rondas.</p>
      <button type="button" className="btn-primary" disabled={busy} onClick={onNext}>
        Siguiente ronda
      </button>
    </div>
  );
}
