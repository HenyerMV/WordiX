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
    <section className="card flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto !p-3 text-center sm:!p-5" aria-labelledby="fin">
      <div className="shrink-0">
        <p className="text-xs uppercase tracking-widest text-mist">Fin de la partida · {totalRounds} rondas</p>
        <h1 id="fin" className="mt-1 font-display text-xl font-bold sm:text-2xl">
          {winners.length === 1
            ? `¡${nameOf(winners[0].player_id)} gana con ${winners[0].total_points} puntos!`
            : `¡Empate en el primer lugar con ${winners[0].total_points} puntos!`}
        </h1>
        {winners.length > 1 ? <p className="text-sm text-mist">{winners.map((w) => nameOf(w.player_id)).join(" y ")}</p> : null}
      </div>

      <ol className="grid w-full max-w-lg shrink-0 grid-cols-3 gap-2" aria-label="Podio">
        {podium.map((row) => (
          <li key={row.player_id} className={`flex min-w-0 flex-col items-center rounded-2xl px-2 py-2 ${PODIUM_STYLE[row.position] ?? ""}`}>
            <span className="text-[10px] font-bold uppercase tracking-wide">{PODIUM_LABEL[row.position]}</span>
            <span className="max-w-full truncate font-display text-base font-bold">
              {nameOf(row.player_id)}
              {row.player_id === myId ? " (tú)" : ""}
            </span>
            <span className="font-display text-xl font-bold">{row.total_points}</span>
          </li>
        ))}
      </ol>

      <div className="min-h-0 w-full max-w-lg flex-1 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <caption className="mb-1 text-left font-display text-base font-bold">Tabla final</caption>
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
                <td className="py-1.5 pr-3 font-bold">{row.position}.º</td>
                <td className="py-1.5 pr-3">
                  {nameOf(row.player_id)}
                  {row.player_id === myId ? " (tú)" : ""}
                </td>
                <td className="py-1.5 text-right font-display font-bold">{row.total_points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" className="btn-primary shrink-0" onClick={onExit}>
        Volver al inicio
      </button>
    </section>
  );
}
