"use client";

import { rankPlayers } from "@/lib/game/scoring";
import type { GameResult } from "@/lib/types";

interface FinalResultsProps {
  players: { id: string; name: string }[];
  results: GameResult[];
  myId: string;
  totalRounds: number;
  onExit: () => void;
}

const PODIUM_STYLE: Record<number, string> = {
  1: "bg-volt text-ink-900",
  2: "bg-sky text-ink-900",
  3: "bg-sun text-ink-900",
};
const PODIUM_LABEL: Record<number, string> = { 1: "1.er lugar", 2: "2.º lugar", 3: "3.er lugar" };

export function FinalResults({ players, results, myId, totalRounds, onExit }: FinalResultsProps) {
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "jugador";
  const standings = rankPlayers(
    players.map((p) => ({
      player_id: p.id,
      total_points: results.find((r) => r.player_id === p.id)?.total_points ?? 0,
    })),
  );
  const winners = standings.filter((s) => s.position === 1);
  const podium = standings.filter((s) => s.position <= 3);

  return (
    <section className="card flex flex-col items-center gap-6 text-center" aria-labelledby="fin">
      <div>
        <p className="text-sm uppercase tracking-widest text-mist">Fin de la partida · {totalRounds} rondas</p>
        <h1 id="fin" className="mt-1 font-display text-3xl font-bold">
          {winners.length === 1
            ? `¡${nameOf(winners[0].player_id)} gana con ${winners[0].total_points} puntos!`
            : `¡Empate en el primer lugar con ${winners[0].total_points} puntos!`}
        </h1>
        {winners.length > 1 ? <p className="mt-1 text-mist">{winners.map((w) => nameOf(w.player_id)).join(" y ")}</p> : null}
      </div>

      <ol className="flex w-full max-w-lg flex-col gap-3" aria-label="Podio">
        {podium.map((row) => (
          <li
            key={row.player_id}
            className={`flex items-center justify-between gap-3 rounded-2xl px-5 py-3 ${PODIUM_STYLE[row.position] ?? ""}`}
          >
            <span className="flex flex-col text-left">
              <span className="text-xs font-bold uppercase tracking-wide">{PODIUM_LABEL[row.position]}</span>
              <span className="font-display text-xl font-bold">
                {nameOf(row.player_id)}
                {row.player_id === myId ? " (tú)" : ""}
              </span>
            </span>
            <span className="font-display text-2xl font-bold">{row.total_points}</span>
          </li>
        ))}
      </ol>

      <div className="w-full max-w-lg overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="mb-2 text-left font-display text-lg font-bold">Tabla final</caption>
          <thead className="text-mist">
            <tr>
              <th scope="col" className="py-1 pr-3">Lugar</th>
              <th scope="col" className="py-1 pr-3">Jugador</th>
              <th scope="col" className="py-1 text-right">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr key={row.player_id} className="border-t border-white/10">
                <td className="py-2 pr-3 font-bold">{row.position}.º</td>
                <td className="py-2 pr-3">
                  {nameOf(row.player_id)}
                  {row.player_id === myId ? " (tú)" : ""}
                </td>
                <td className="py-2 text-right font-display font-bold">{row.total_points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" className="btn-primary" onClick={onExit}>
        Volver al inicio
      </button>
    </section>
  );
}
